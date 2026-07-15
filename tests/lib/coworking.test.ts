import { describe, expect, it } from "vitest"
import { huddlePhase, liveMatchScore, rankLiveMatches } from "@/lib/coworking/matching"
import type { EventCheckin } from "@/lib/coworking/types"

function checkin(overrides: Partial<EventCheckin> = {}): EventCheckin {
  return {
    id: "checkin-a",
    event_id: "event-1",
    user_id: "user-a",
    project_id: null,
    goal: "Collaboration",
    intention: "Build an AI onboarding flow",
    checked_in_at: "2026-07-15T08:00:00Z",
    checked_out_at: null,
    updated_at: "2026-07-15T08:00:00Z",
    profile_name: "Ada",
    profile_avatar: null,
    profile_occupation: "Founder",
    profile_skills: ["Product"],
    profile_industries: ["Enterprise"],
    profile_looking: ["Teammate"],
    project_name: "Launchpad",
    project_stage: "MVP",
    focus_items: [],
    ...overrides,
  }
}

describe("live coworking matching", () => {
  it("uses current intent as a why-now signal", () => {
    const result = liveMatchScore(
      checkin(),
      checkin({
        id: "checkin-b",
        user_id: "user-b",
        profile_name: "Lin",
        profile_skills: ["Engineering"],
        intention: "Ship the onboarding API",
      }),
    )
    expect(result.score).toBeGreaterThan(0)
    expect(result.reason).toContain("onboarding")
  })

  it("excludes the current builder and people who checked out", () => {
    const me = checkin()
    const active = checkin({ id: "b", user_id: "b", profile_name: "B" })
    const gone = checkin({ id: "c", user_id: "c", profile_name: "C", checked_out_at: "2026-07-15T09:00:00Z" })
    expect(rankLiveMatches(me, [me, active, gone])).toHaveLength(1)
    expect(rankLiveMatches(me, [me, active, gone])[0].checkin.user_id).toBe("b")
  })
})

describe("huddlePhase", () => {
  const now = new Date("2026-07-15T10:00:00Z")
  it("derives phase from real timestamps", () => {
    expect(huddlePhase("2026-07-15T11:00:00Z", "2026-07-15T11:15:00Z", "scheduled", now)).toBe("scheduled")
    expect(huddlePhase("2026-07-15T09:55:00Z", "2026-07-15T10:10:00Z", "scheduled", now)).toBe("live")
    expect(huddlePhase("2026-07-15T09:00:00Z", "2026-07-15T09:15:00Z", "scheduled", now)).toBe("ended")
  })
})
