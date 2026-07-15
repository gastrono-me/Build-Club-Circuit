import { complementScore } from "@/lib/match"
import type { EventCheckin } from "@/lib/coworking/types"

export interface LiveMatch {
  checkin: EventCheckin
  score: number
  reason: string
}
const GOAL_PAIRS: Record<string, string[]> = {
  Feedback: ["Feedback", "Open"],
  Networking: ["Networking", "Open"],
  Collaboration: ["Collaboration", "Open"],
  "Deep work": [],
  Open: ["Feedback", "Networking", "Collaboration", "Open"],
}

function words(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9+#.-]+/)
      .filter((word) => word.length > 3),
  )
}

/**
 * Explainable event-time matching. Circuit's profile complementarity remains
 * the base signal; current goal and intention add the "why now" layer Pulse
 * introduced. Scores are internal only and never shown to builders.
 */
export function liveMatchScore(me: EventCheckin, them: EventCheckin): { score: number; reason: string } {
  const complement = complementScore(
    {
      tags: me.profile_skills,
      industries: me.profile_industries,
      looking: me.profile_looking,
    },
    {
      tags: them.profile_skills,
      industries: them.profile_industries,
      looking: them.profile_looking,
    },
  )

  let score = complement.score
  const reasons = [...complement.reasons]

  if ((GOAL_PAIRS[me.goal] ?? []).includes(them.goal)) {
    score += 8
    reasons.unshift(`You are both here for ${them.goal.toLowerCase()}`)
  }

  const mine = words(me.intention)
  const overlap = [...words(them.intention)].filter((word) => mine.has(word)).slice(0, 2)
  if (overlap.length > 0) {
    score += overlap.length * 4
    reasons.unshift(`Working on ${overlap.join(" and ")}`)
  }

  return {
    score,
    reason: reasons[0] ?? `${them.profile_occupation ?? "Builder"} working alongside you today`,
  }
}

export function rankLiveMatches(me: EventCheckin | null, room: EventCheckin[], limit = 5): LiveMatch[] {
  if (!me) return []
  return room
    .filter((person) => person.user_id !== me.user_id && !person.checked_out_at)
    .map((checkin) => ({ checkin, ...liveMatchScore(me, checkin) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.checkin.profile_name.localeCompare(b.checkin.profile_name))
    .slice(0, limit)
}

export function huddlePhase(
  startsAt: string,
  endsAt: string,
  status: string,
  now: Date,
): "scheduled" | "live" | "ended" | "cancelled" {
  if (status === "cancelled") return "cancelled"
  if (status === "ended" || now.getTime() >= new Date(endsAt).getTime()) return "ended"
  if (status === "live" || now.getTime() >= new Date(startsAt).getTime()) return "live"
  return "scheduled"
}
