import { describe, it, expect } from "vitest"
import { selectSpotlight, SPOTLIGHT_MIN_BUILDERS } from "@/lib/spotlight/rotation"
import type { BuildLogRow } from "@/lib/hooks/useBuildLog"

const NOW = new Date("2026-06-28T12:00:00Z")

function ship(author: string, at: string, id = `${author}-${at}`): BuildLogRow {
  return { id, author_id: author, category: "ship", note: "did a thing", created_at: at }
}

describe("selectSpotlight", () => {
  it("knows the floor is 3", () => {
    expect(SPOTLIGHT_MIN_BUILDERS).toBe(3)
  })

  it("returns empty for no posts", () => {
    expect(selectSpotlight([], NOW)).toEqual([])
  })

  it("returns empty below the cold-start floor", () => {
    const posts = [ship("a", "2026-06-28T09:00:00Z"), ship("b", "2026-06-28T10:00:00Z")]
    expect(selectSpotlight(posts, NOW)).toEqual([])
  })

  it("returns all distinct shippers at or above the floor", () => {
    const posts = [
      ship("a", "2026-06-28T09:00:00Z"),
      ship("b", "2026-06-28T10:00:00Z"),
      ship("c", "2026-06-28T11:00:00Z"),
    ]
    const r = selectSpotlight(posts, NOW)
    expect(r.map((p) => p.author_id).sort()).toEqual(["a", "b", "c"])
  })

  it("keeps one entry per author — their latest ship of the day", () => {
    const posts = [
      ship("a", "2026-06-28T08:00:00Z", "a-early"),
      ship("a", "2026-06-28T15:00:00Z", "a-late"),
      ship("b", "2026-06-28T09:00:00Z"),
      ship("c", "2026-06-28T09:00:00Z"),
    ]
    const r = selectSpotlight(posts, NOW)
    expect(r.filter((p) => p.author_id === "a")).toHaveLength(1)
    expect(r.find((p) => p.author_id === "a")!.id).toBe("a-late")
  })

  it("ignores ships from other days", () => {
    const posts = [
      ship("a", "2026-06-28T09:00:00Z"),
      ship("b", "2026-06-28T09:00:00Z"),
      ship("c", "2026-06-28T09:00:00Z"),
      ship("d", "2026-06-27T09:00:00Z"),
    ]
    const r = selectSpotlight(posts, NOW)
    expect(r.map((p) => p.author_id)).not.toContain("d")
    expect(r).toHaveLength(3)
  })

  it("produces a stable order within a day", () => {
    const posts = [
      ship("a", "2026-06-28T09:00:00Z"),
      ship("b", "2026-06-28T09:00:00Z"),
      ship("c", "2026-06-28T09:00:00Z"),
    ]
    const morning = selectSpotlight(posts, new Date("2026-06-28T08:00:00Z"))
    const evening = selectSpotlight(posts, new Date("2026-06-28T20:00:00Z"))
    expect(morning.map((p) => p.author_id)).toEqual(evening.map((p) => p.author_id))
  })

  it("keeps the same members when the day-key changes", () => {
    const authors = ["a", "b", "c", "d", "e"]
    const mk = (now: Date) =>
      selectSpotlight(authors.map((x) => ship(x, now.toISOString())), now).map((p) => p.author_id)
    const d1 = mk(new Date("2026-06-28T09:00:00Z"))
    const d2 = mk(new Date("2026-07-15T09:00:00Z"))
    expect([...d1].sort()).toEqual([...d2].sort())
    expect(d1).toHaveLength(5)
  })
})
