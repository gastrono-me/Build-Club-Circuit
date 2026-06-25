import { describe, it, expect } from "vitest"
import { eventStatus, pickActiveEvent } from "@/lib/events/eventStatus"

const NOW = new Date("2026-06-26T12:00:00Z")
const ev = (starts: string, ends: string) => ({ starts_at: starts, ends_at: ends })

describe("eventStatus", () => {
  it("is upcoming before the start", () => {
    const s = eventStatus("2026-06-27T00:00:00Z", "2026-06-29T00:00:00Z", NOW)
    expect(s.phase).toBe("upcoming")
    expect(s.msUntilNext).toBe(Date.parse("2026-06-27T00:00:00Z") - NOW.getTime())
  })

  it("is live within the window", () => {
    const s = eventStatus("2026-06-25T00:00:00Z", "2026-06-29T00:00:00Z", NOW)
    expect(s.phase).toBe("live")
    expect(s.msUntilNext).toBe(Date.parse("2026-06-29T00:00:00Z") - NOW.getTime())
  })

  it("is ended after the end", () => {
    const s = eventStatus("2026-06-20T00:00:00Z", "2026-06-25T00:00:00Z", NOW)
    expect(s.phase).toBe("ended")
    expect(s.msUntilNext).toBe(0)
  })

  it("treats the start boundary as live (inclusive)", () => {
    const s = eventStatus(NOW.toISOString(), "2026-06-29T00:00:00Z", NOW)
    expect(s.phase).toBe("live")
  })

  it("treats the end boundary as ended (exclusive)", () => {
    const s = eventStatus("2026-06-20T00:00:00Z", NOW.toISOString(), NOW)
    expect(s.phase).toBe("ended")
  })
})

describe("pickActiveEvent", () => {
  it("returns null with no events", () => {
    expect(pickActiveEvent([], NOW)).toBeNull()
  })

  it("prefers a live event over an upcoming one", () => {
    const live = ev("2026-06-25T00:00:00Z", "2026-06-29T00:00:00Z")
    const soon = ev("2026-06-27T00:00:00Z", "2026-06-28T00:00:00Z")
    expect(pickActiveEvent([soon, live], NOW)).toBe(live)
  })

  it("among live events, picks the one ending soonest", () => {
    const endsLater = ev("2026-06-25T00:00:00Z", "2026-06-30T00:00:00Z")
    const endsSooner = ev("2026-06-25T00:00:00Z", "2026-06-27T00:00:00Z")
    expect(pickActiveEvent([endsLater, endsSooner], NOW)).toBe(endsSooner)
  })

  it("falls back to the soonest upcoming when none are live", () => {
    const farther = ev("2026-07-10T00:00:00Z", "2026-07-12T00:00:00Z")
    const nearer = ev("2026-06-30T00:00:00Z", "2026-07-01T00:00:00Z")
    expect(pickActiveEvent([farther, nearer], NOW)).toBe(nearer)
  })

  it("returns null when everything has ended", () => {
    const past = ev("2026-06-01T00:00:00Z", "2026-06-05T00:00:00Z")
    expect(pickActiveEvent([past], NOW)).toBeNull()
  })
})
