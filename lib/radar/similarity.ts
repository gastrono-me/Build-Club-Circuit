/**
 * Radar field similarity + layout — the real "embedding field".
 *
 * Pure, deterministic, zero token spend. Blockers are positioned by the actual
 * similarity of their text (TF-IDF cosine), so two posts that describe the same
 * real problem drift together even when their categories differ. Category
 * anchors seed the layout (keeping the axis semantics and per-category regions
 * legible); similarity forces then refine it.
 *
 * Everything here is a pure function of its input, so the same blocker set
 * always yields the same field — no per-render jitter — and it's unit-testable
 * without React or Supabase.
 */

export interface SimItem {
  id: string
  category: string
  note: string
}

export interface Point {
  x: number
  y: number
}

/** Stable string hash (djb2-xor). Drives deterministic per-id seed jitter. */
export function hashCode(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
    h = h >>> 0
  }
  return h
}

// Small stopword set — common filler that carries no signal about the blocker.
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "am", "i", "my", "to", "on", "of", "and",
  "it", "with", "for", "in", "im", "me", "not", "no", "cant", "cannot", "can",
  "how", "do", "does", "get", "got", "this", "that", "be", "we", "our", "but",
  "so", "if", "or", "at", "as", "by", "from", "have", "has", "was", "when",
  "keep", "keeps", "still", "just", "any", "some",
])

/**
 * Tokenize a blocker into normalised terms: lowercase, alphanumeric runs,
 * stopwords dropped, light singularisation so "timeouts" matches "timeout".
 */
export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]+/g) ?? []
  const out: string[] = []
  for (let w of raw) {
    if (w.length < 2) continue
    if (STOPWORDS.has(w)) continue
    if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1) // crude singularise
    out.push(w)
  }
  return out
}

type SparseVec = Map<string, number>

/**
 * Build L2-normalised, smooth-IDF TF-IDF vectors for each item. The category
 * is folded in as a light extra signal so same-category posts share some mass.
 * Returns a map from item id to its sparse term vector.
 */
export function buildTfidf(items: SimItem[]): Map<string, SparseVec> {
  const docs = new Map<string, string[]>()
  const df = new Map<string, number>()

  for (const it of items) {
    // Category words count once, with the note text, as part of the document.
    const terms = [...tokenize(it.note), ...tokenize(it.category)]
    docs.set(it.id, terms)
    const seen = new Set(terms)
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1)
  }

  const n = items.length
  const vectors = new Map<string, SparseVec>()

  for (const it of items) {
    const terms = docs.get(it.id) ?? []
    const tf = new Map<string, number>()
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1)

    const vec: SparseVec = new Map()
    let norm = 0
    for (const [term, count] of tf) {
      // Smooth IDF (sklearn-style): never fully zeroes a term, so identical
      // documents still score cosine 1.
      const idf = Math.log((1 + n) / (1 + (df.get(term) ?? 0))) + 1
      const w = count * idf
      vec.set(term, w)
      norm += w * w
    }
    norm = Math.sqrt(norm) || 1
    for (const [term, w] of vec) vec.set(term, w / norm)
    vectors.set(it.id, vec)
  }

  return vectors
}

/** Cosine similarity of two L2-normalised sparse vectors (i.e. their dot product). */
export function cosine(a: SparseVec, b: SparseVec): number {
  // Iterate the smaller vector for efficiency.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  let dot = 0
  for (const [term, w] of small) {
    const o = large.get(term)
    if (o) dot += w * o
  }
  return dot
}

/**
 * For each item, its most similar other item above `threshold` (or null).
 * This is what the vector links should connect — genuinely related blockers,
 * across category lines, not just geometric neighbours.
 */
export function nearestBySimilarity(
  items: SimItem[],
  threshold = 0.12,
): Record<string, { id: string; sim: number } | null> {
  const vectors = buildTfidf(items)
  const result: Record<string, { id: string; sim: number } | null> = {}

  for (const a of items) {
    const va = vectors.get(a.id)
    let best: { id: string; sim: number } | null = null
    if (va) {
      for (const b of items) {
        if (b.id === a.id) continue
        const vb = vectors.get(b.id)
        if (!vb) continue
        const sim = cosine(va, vb)
        if (sim >= threshold && (!best || sim > best.sim)) {
          best = { id: b.id, sim }
        }
      }
    }
    result[a.id] = best
  }

  return result
}

/** Deduplicated similarity links (each pair once), strongest neighbour per node. */
export function similarityLinks(
  items: SimItem[],
  threshold = 0.12,
): Array<{ a: string; b: string; sim: number }> {
  const nearest = nearestBySimilarity(items, threshold)
  const seen = new Set<string>()
  const links: Array<{ a: string; b: string; sim: number }> = []
  for (const it of items) {
    const n = nearest[it.id]
    if (!n) continue
    const key = [it.id, n.id].sort().join("|")
    if (seen.has(key)) continue
    seen.add(key)
    links.push({ a: it.id, b: n.id, sim: n.sim })
  }
  return links
}

export interface LayoutOptions {
  iterations?: number
  /** Pull strength toward similar neighbours. */
  attract?: number
  /** Spring strength back to the category anchor (keeps regions readable). */
  anchor?: number
  /** Short-range push so coincident nodes separate. */
  repel?: number
  /** Minimum similarity for an attraction force to apply. */
  threshold?: number
  /** Plot-space clamp margin. */
  margin?: number
  /** Category->anchor map for this taxonomy (e.g. blocker categories, or industries for the People field). Unanchored categories fall back to a deterministic hash-based spread. */
  anchors?: Record<string, Point>
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Stable anchor for a category. Known categories use the provided map; anything
 * else gets a deterministic point spread across the mid-field from its hash, so
 * any taxonomy (blocker categories, industries, …) lays out sensibly.
 */
function anchorFor(category: string, anchors: Record<string, Point>): Point {
  const known = anchors[category]
  if (known) return known
  const h = hashCode(category)
  return {
    x: 0.2 + ((h & 0xff) / 255) * 0.6,
    y: 0.2 + (((h >> 8) & 0xff) / 255) * 0.6,
  }
}

/**
 * Lay out the field: seed each node at its category anchor (+ deterministic
 * per-id jitter), then run a fixed, deterministic force relaxation where
 * similar blockers attract, every node springs gently back to its anchor, and
 * close nodes repel. Returns normalised 0-1 positions keyed by id.
 */
export function layoutField(items: SimItem[], opts: LayoutOptions = {}): Record<string, Point> {
  const ITER = opts.iterations ?? 60
  const K_ATTRACT = opts.attract ?? 0.06
  const K_ANCHOR = opts.anchor ?? 0.03
  const K_REPEL = opts.repel ?? 0.02
  const THRESH = opts.threshold ?? 0.12
  const MARGIN = opts.margin ?? 0.06
  const ANCHOR_MAP = opts.anchors ?? {}
  const REPEL_RANGE = 0.12

  // Seed positions: anchor + deterministic jitter (same as the original field).
  const pos: Record<string, Point> = {}
  const anchors: Record<string, Point> = {}
  for (const it of items) {
    const anchor = anchorFor(it.category, ANCHOR_MAP)
    anchors[it.id] = anchor
    const h = hashCode(it.id)
    const jx = ((h & 0xff) / 255 - 0.5) * 0.18
    const jy = (((h >> 8) & 0xff) / 255 - 0.5) * 0.18
    pos[it.id] = {
      x: clamp(anchor.x + jx, MARGIN, 1 - MARGIN),
      y: clamp(anchor.y + jy, MARGIN, 1 - MARGIN),
    }
  }

  if (items.length < 2) return pos

  const vectors = buildTfidf(items)

  for (let iter = 0; iter < ITER; iter++) {
    const cooling = 1 - (iter / ITER) * 0.7 // 1.0 -> 0.3
    const disp: Record<string, Point> = {}
    for (const it of items) disp[it.id] = { x: 0, y: 0 }

    for (let i = 0; i < items.length; i++) {
      const a = items[i]
      const pa = pos[a.id]
      const va = vectors.get(a.id)

      // Anchor spring — keeps category regions from collapsing.
      disp[a.id].x += (anchors[a.id].x - pa.x) * K_ANCHOR
      disp[a.id].y += (anchors[a.id].y - pa.y) * K_ANCHOR

      for (let j = i + 1; j < items.length; j++) {
        const b = items[j]
        const pb = pos[b.id]
        let dx = pb.x - pa.x
        let dy = pb.y - pa.y
        const dist = Math.hypot(dx, dy) || 1e-4

        // Attraction toward similar blockers (across categories).
        const sim = va ? cosine(va, vectors.get(b.id)!) : 0
        if (sim >= THRESH) {
          const f = sim * K_ATTRACT
          disp[a.id].x += dx * f
          disp[a.id].y += dy * f
          disp[b.id].x -= dx * f
          disp[b.id].y -= dy * f
        }

        // Short-range repulsion so nodes don't stack.
        if (dist < REPEL_RANGE) {
          const push = (K_REPEL * (REPEL_RANGE - dist)) / dist
          dx *= push
          dy *= push
          disp[a.id].x -= dx
          disp[a.id].y -= dy
          disp[b.id].x += dx
          disp[b.id].y += dy
        }
      }
    }

    for (const it of items) {
      const p = pos[it.id]
      p.x = clamp(p.x + disp[it.id].x * cooling, MARGIN, 1 - MARGIN)
      p.y = clamp(p.y + disp[it.id].y * cooling, MARGIN, 1 - MARGIN)
    }
  }

  return pos
}
