import { describe, it, expect } from "vitest"
import {
  tokenize,
  buildTfidf,
  cosine,
  nearestBySimilarity,
  similarityLinks,
  layoutField,
  type SimItem,
} from "@/lib/radar/similarity"

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

describe("tokenize", () => {
  it("lowercases, splits on non-alphanumerics, drops stopwords", () => {
    const t = tokenize("My RAG retrieval is SLOW!")
    expect(t).toContain("rag")
    expect(t).toContain("retrieval")
    expect(t).toContain("slow")
    expect(t).not.toContain("my")
    expect(t).not.toContain("is")
  })

  it("singularises plurals so timeouts ~ timeout", () => {
    expect(tokenize("timeouts")).toEqual(tokenize("timeout"))
  })

  it("drops 1-char tokens", () => {
    expect(tokenize("a b retrieval")).toEqual(["retrieval"])
  })
})

describe("cosine via tfidf", () => {
  const items: SimItem[] = [
    { id: "1", category: "RAG/Retrieval", note: "pinecone retrieval is timing out" },
    { id: "2", category: "Deploy/Infra", note: "pinecone retrieval keeps timing out" },
    { id: "3", category: "Auth/Login", note: "google oauth redirect loop on login" },
  ]
  const vecs = buildTfidf(items)

  it("is symmetric", () => {
    const a = cosine(vecs.get("1")!, vecs.get("2")!)
    const b = cosine(vecs.get("2")!, vecs.get("1")!)
    expect(a).toBeCloseTo(b, 10)
  })

  it("scores near-duplicate notes high and unrelated notes low", () => {
    const near = cosine(vecs.get("1")!, vecs.get("2")!)
    const far = cosine(vecs.get("1")!, vecs.get("3")!)
    expect(near).toBeGreaterThan(0.4)
    expect(far).toBeLessThan(0.1)
    expect(near).toBeGreaterThan(far)
  })

  it("identical documents score ~1", () => {
    const dup: SimItem[] = [
      { id: "a", category: "Other", note: "deploy timeout on vercel" },
      { id: "b", category: "Other", note: "deploy timeout on vercel" },
    ]
    const v = buildTfidf(dup)
    expect(cosine(v.get("a")!, v.get("b")!)).toBeCloseTo(1, 6)
  })
})

describe("nearestBySimilarity", () => {
  it("links genuinely related blockers across category lines", () => {
    const items: SimItem[] = [
      { id: "1", category: "RAG/Retrieval", note: "my pinecone retrieval is super slow" },
      { id: "2", category: "Deploy/Infra", note: "pinecone retrieval queries are slow" },
      { id: "3", category: "Auth/Login", note: "stuck on github oauth callback" },
    ]
    const nn = nearestBySimilarity(items)
    // The two retrieval posts find each other despite different categories.
    expect(nn["1"]?.id).toBe("2")
    expect(nn["2"]?.id).toBe("1")
    // The unrelated oauth post has no neighbour above threshold.
    expect(nn["3"]).toBeNull()
  })

  it("returns null for a single item", () => {
    const nn = nearestBySimilarity([{ id: "1", category: "Other", note: "alone here" }])
    expect(nn["1"]).toBeNull()
  })

  it("similarityLinks dedupes mutual pairs", () => {
    const items: SimItem[] = [
      { id: "1", category: "RAG/Retrieval", note: "retrieval latency too high" },
      { id: "2", category: "Data/Eval", note: "retrieval latency is high" },
    ]
    const links = similarityLinks(items)
    expect(links).toHaveLength(1)
    expect([links[0].a, links[0].b].sort()).toEqual(["1", "2"])
  })
})

describe("layoutField", () => {
  const items: SimItem[] = [
    { id: "1", category: "RAG/Retrieval", note: "pinecone retrieval timing out badly" },
    { id: "2", category: "Deploy/Infra", note: "pinecone retrieval keeps timing out" },
    { id: "3", category: "Auth/Login", note: "google oauth redirect loop" },
    { id: "4", category: "Launch/Demo", note: "slides not ready for demo day" },
  ]

  it("is deterministic — same input yields identical positions", () => {
    const a = layoutField(items)
    const b = layoutField(items)
    expect(a).toEqual(b)
  })

  it("keeps every node inside the plot bounds", () => {
    const pos = layoutField(items)
    for (const id of Object.keys(pos)) {
      expect(pos[id].x).toBeGreaterThanOrEqual(0.06)
      expect(pos[id].x).toBeLessThanOrEqual(0.94)
      expect(pos[id].y).toBeGreaterThanOrEqual(0.06)
      expect(pos[id].y).toBeLessThanOrEqual(0.94)
    }
  })

  it("pulls similar cross-category blockers closer than dissimilar ones", () => {
    const pos = layoutField(items)
    const simPairDist = dist(pos["1"], pos["2"]) // two retrieval posts
    const dissimPairDist = dist(pos["1"], pos["4"]) // retrieval vs slides
    expect(simPairDist).toBeLessThan(dissimPairDist)
  })

  it("handles the trivial single-node and empty cases", () => {
    expect(layoutField([])).toEqual({})
    const one = layoutField([{ id: "x", category: "Other", note: "solo" }])
    expect(Object.keys(one)).toEqual(["x"])
  })
})
