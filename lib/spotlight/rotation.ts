/**
 * Spotlight selection: who gets featured on the "Shipped today" rail.
 *
 * Inclusive and effort-based, not ranked: every builder who shipped today is
 * eligible exactly once. The order is fair (a deterministic hash keyed on the
 * day), so it is stable within a day and rotates across days, giving everyone a
 * turn over time rather than crowning the same faces. There is no engagement
 * metric, by design.
 *
 * Like lib/streak/streak.ts this is pure and real-time: it keys off `now`, uses
 * UTC day boundaries, and has no I/O.
 */

import { toDayKey } from "@/lib/streak/streak"
import type { BuildLogRow } from "@/lib/hooks/useBuildLog"

/**
 * Below this many distinct shippers in the window, the rail does not render.
 * 1 = show as soon as anyone ships (small-cohort and demo friendly). Raise it
 * (e.g. to 3) once the cohort is large enough that a single shipper should not
 * carry the rail alone.
 */
export const SPOTLIGHT_MIN_BUILDERS = 1

/** djb2 hash over a string (same family as the Avatar fill hash). */
function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

export function selectSpotlight(posts: BuildLogRow[], now: Date): BuildLogRow[] {
  const dayKey = toDayKey(now)

  // One entry per author: keep their latest ship of the day.
  const latestByAuthor = new Map<string, BuildLogRow>()
  for (const p of posts) {
    if (toDayKey(new Date(p.created_at)) !== dayKey) continue
    const existing = latestByAuthor.get(p.author_id)
    if (!existing || new Date(p.created_at) > new Date(existing.created_at)) {
      latestByAuthor.set(p.author_id, p)
    }
  }

  // Cold-start floor: render nothing until enough distinct builders have shipped.
  if (latestByAuthor.size < SPOTLIGHT_MIN_BUILDERS) return []

  return [...latestByAuthor.values()].sort(
    (a, b) => hash(a.author_id + dayKey) - hash(b.author_id + dayKey),
  )
}
