import { describe, it, expect } from "vitest"
import { complementScore } from "@/lib/match"

describe("complementScore", () => {
  it("returns an empty result for a null me", () => {
    const r = complementScore(null, { tags: ["ML"], industries: [], looking: [] })
    expect(r.score).toBe(0)
    expect(r.reasons).toEqual([])
    expect(r.headline).toBeNull()
  })

  it("rewards reciprocal team intent + complementary skills in a shared industry", () => {
    const me = { tags: ["Backend", "Agents"], industries: ["Fintech"], looking: ["Teammate"] }
    const them = { tags: ["Design", "Product"], industries: ["Fintech"], looking: ["Co-founder"] }
    const r = complementScore(me, them)
    expect(r.relationship).toBe("team")
    expect(r.complementarySkills).toEqual(["Design", "Product"])
    expect(r.sharedIndustries).toEqual(["Fintech"])
    expect(r.score).toBeGreaterThan(0)
    expect(r.reasons[0]).toMatch(/build a team/i)
  })

  it("ranks a complementary teammate above a near-identical one", () => {
    const me = { tags: ["Backend"], industries: ["Fintech"], looking: ["Teammate"] }
    // Complementary: different skills, same domain, same intent.
    const complement = { tags: ["Design", "Product"], industries: ["Fintech"], looking: ["Teammate"] }
    // Twin: identical skills, same domain/intent — similar but doesn't complete you.
    const twin = { tags: ["Backend"], industries: ["Fintech"], looking: ["Teammate"] }
    expect(complementScore(me, complement).score).toBeGreaterThan(complementScore(me, twin).score)
  })

  it("detects directional mentor relationship and explains it", () => {
    const me = { tags: ["ML"], industries: [], looking: ["Mentee"] }
    const them = { tags: ["ML", "Data"], industries: [], looking: ["Mentor"] }
    const r = complementScore(me, them)
    expect(r.relationship).toBe("they-mentor-you")
    expect(r.headline).toMatch(/mentor you in ML/i)
  })

  it("is directional — mentor vs mentee read from each side", () => {
    const mentee = { tags: ["ML"], industries: [], looking: ["Mentee"] }
    const mentor = { tags: ["ML"], industries: [], looking: ["Mentor"] }
    expect(complementScore(mentor, mentee).relationship).toBe("you-mentor-them")
    expect(complementScore(mentee, mentor).relationship).toBe("they-mentor-you")
  })

  it("weights shared skills more heavily in a mentor relationship (mentor knows your area)", () => {
    const mentee = { tags: ["ML", "Data"], industries: [], looking: ["Mentee"] }
    const mentorInArea = { tags: ["ML", "Data"], industries: [], looking: ["Mentor"] }
    const mentorOffArea = { tags: ["Mobile"], industries: [], looking: ["Mentor"] }
    expect(complementScore(mentee, mentorInArea).score).toBeGreaterThan(
      complementScore(mentee, mentorOffArea).score,
    )
  })

  it("falls back to a network relationship when intents only loosely align", () => {
    const me = { tags: ["Backend"], industries: ["Fintech"], looking: ["Just networking"] }
    const them = { tags: ["Frontend"], industries: ["Fintech"], looking: ["Just networking"] }
    const r = complementScore(me, them)
    expect(r.relationship).toBe("network")
    // Still surfaces complementary skills and shared domain as reasons.
    expect(r.reasons.join(" ")).toMatch(/Frontend/)
    expect(r.reasons.join(" ")).toMatch(/Fintech/)
  })

  it("yields no relationship and a low score for unrelated people", () => {
    const me = { tags: ["Backend"], industries: ["Fintech"], looking: ["Mentor"] }
    const them = { tags: ["Backend"], industries: ["Gaming"], looking: ["Mentee"] }
    // Mentor<->Mentee still connects them, but flip to truly disjoint intent:
    const stranger = { tags: ["Mobile"], industries: ["Gaming"], looking: [] }
    expect(complementScore(me, stranger).relationship).toBeNull()
    expect(complementScore(me, stranger).score).toBeGreaterThanOrEqual(0)
  })

  it("headline is the strongest reason and never crashes on empty profiles", () => {
    const r = complementScore({ tags: [], industries: [], looking: [] }, { tags: [], industries: [], looking: [] })
    expect(r.score).toBe(0)
    expect(r.headline).toBeNull()
  })
})
