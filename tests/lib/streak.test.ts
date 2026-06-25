import { describe, it, expect } from "vitest"
import { computeStreak } from "@/lib/streak/streak"

// Fixed reference "now" so every case is deterministic.
const NOW = new Date("2026-06-26T12:00:00Z")
const day = (d: string) => `${d}T09:00:00Z`

describe("computeStreak", () => {
  it("returns zeros for no ships", () => {
    expect(computeStreak([], NOW)).toEqual({
      current: 0,
      longest: 0,
      shippedToday: false,
      lastShipDate: null,
    })
  })

  it("counts a single ship today", () => {
    const r = computeStreak([day("2026-06-26")], NOW)
    expect(r.current).toBe(1)
    expect(r.longest).toBe(1)
    expect(r.shippedToday).toBe(true)
    expect(r.lastShipDate).toBe("2026-06-26")
  })

  it("keeps the streak alive on a grace day (shipped yesterday, not today)", () => {
    const r = computeStreak([day("2026-06-25")], NOW)
    expect(r.current).toBe(1)
    expect(r.shippedToday).toBe(false)
  })

  it("breaks the streak once a full day is missed", () => {
    // Last ship two days ago -> current streak is dead, but history is kept.
    const r = computeStreak([day("2026-06-23"), day("2026-06-24")], NOW)
    expect(r.current).toBe(0)
    expect(r.longest).toBe(2)
    expect(r.lastShipDate).toBe("2026-06-24")
  })

  it("counts consecutive days backward from today", () => {
    const r = computeStreak(
      [day("2026-06-24"), day("2026-06-25"), day("2026-06-26")],
      NOW,
    )
    expect(r.current).toBe(3)
    expect(r.longest).toBe(3)
  })

  it("collapses multiple ships on the same day", () => {
    const r = computeStreak(
      [day("2026-06-26"), day("2026-06-26"), day("2026-06-26")],
      NOW,
    )
    expect(r.current).toBe(1)
    expect(r.longest).toBe(1)
  })

  it("finds the longest historical run separate from the current one", () => {
    const r = computeStreak(
      [
        // a 4-day run in the past
        day("2026-06-10"),
        day("2026-06-11"),
        day("2026-06-12"),
        day("2026-06-13"),
        // gap, then a live 2-day run up to today
        day("2026-06-25"),
        day("2026-06-26"),
      ],
      NOW,
    )
    expect(r.current).toBe(2)
    expect(r.longest).toBe(4)
  })

  it("handles month boundaries", () => {
    const now = new Date("2026-07-01T12:00:00Z")
    const r = computeStreak([day("2026-06-30"), day("2026-07-01")], now)
    expect(r.current).toBe(2)
    expect(r.longest).toBe(2)
  })

  it("ignores unparseable timestamps", () => {
    const r = computeStreak(["not-a-date", day("2026-06-26")], NOW)
    expect(r.current).toBe(1)
  })
})
