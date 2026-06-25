export const LOOKING_PAIRS: Record<string, string[]> = {
  Teammate: ['Teammate', 'Co-founder'],
  'Co-founder': ['Co-founder', 'Teammate'],
  Mentor: ['Mentee'],
  Mentee: ['Mentor'],
  'Just networking': ['Just networking', 'Teammate'],
}

export interface MatchResult {
  score: number
  shared: string[]
  sharedIndustries: string[]
}

export interface PersonLike {
  tags?: string[]
  industries?: string[]
  looking?: string[]
}

/**
 * Compute tag-overlap badges and a combined score between two profiles.
 * Returns {score, shared, sharedIndustries}.
 * Used for badge display only — not search ranking.
 */
export function matchScore(me: PersonLike | null | undefined, person: PersonLike): MatchResult {
  if (!me) return { score: 0, shared: [], sharedIndustries: [] }
  const mine = new Set(me.tags ?? [])
  const shared = (person.tags ?? []).filter((t) => mine.has(t))
  const myInd = new Set(me.industries ?? [])
  const sharedIndustries = (person.industries ?? []).filter((i) => myInd.has(i))
  let score = shared.length * 10 + sharedIndustries.length * 4
  const myLooking = me.looking ?? []
  const theirLooking = person.looking ?? []
  const lookingMatch = myLooking.some((l) =>
    (LOOKING_PAIRS[l] ?? []).some((x) => theirLooking.includes(x))
  )
  if (lookingMatch) score += 8
  return { score, shared, sharedIndustries }
}

/* ------------------------------------------------------------------ */
/*  Complementarity — "who completes you", not "who is like you".      */
/* ------------------------------------------------------------------ */

const TEAM_INTENT = new Set(['Teammate', 'Co-founder'])

export type Relationship = 'they-mentor-you' | 'you-mentor-them' | 'team' | 'network' | null

export interface ComplementResult {
  /** Combined complement strength. Higher = more worth meeting. */
  score: number
  /** Detected relationship intent between the two profiles. */
  relationship: Relationship
  /** Skills they have that you lack — the diversity they bring to a team. */
  complementarySkills: string[]
  /** Skills you both share — common ground. */
  sharedSkills: string[]
  /** Industries you both work in — shared domain. */
  sharedIndustries: string[]
  /** Human-readable reasons, strongest first. Honors "no opaque ranking". */
  reasons: string[]
  /** One-line headline reason (the strongest signal). */
  headline: string | null
}

/** Weights — tuned so reciprocal intent + complementary skills outrank mere similarity. */
const CW = {
  teamIntent: 10, // both want to build a team
  mentorIntent: 12, // directional Mentor -> Mentee, very actionable
  complementSkill: 6, // per skill they bring that you lack (cap 3)
  sharedIndustry: 5, // per shared industry (cap 2)
  sharedSkill: 2, // per shared skill, common ground (cap 3)
  mentorSharedSkill: 5, // shared skill weighs more for mentor/mentee (mentor knows your area)
} as const

function detectRelationship(myLooking: string[], theirLooking: string[]): Relationship {
  const mine = new Set(myLooking)
  const theirs = new Set(theirLooking)
  if (mine.has('Mentee') && theirs.has('Mentor')) return 'they-mentor-you'
  if (mine.has('Mentor') && theirs.has('Mentee')) return 'you-mentor-them'
  const myTeam = myLooking.some((l) => TEAM_INTENT.has(l))
  const theirTeam = theirLooking.some((l) => TEAM_INTENT.has(l))
  if (myTeam && theirTeam) return 'team'
  if (mine.has('Just networking') || theirs.has('Just networking')) return 'network'
  return null
}

/**
 * Score how much two people *complete* each other, with explainable reasons.
 *
 * Unlike matchScore (which rewards similarity — shared tags), this rewards the
 * reciprocal need that actually drives a hackathon introduction:
 *  - directional mentor/mentee intent (one teaches the other's area),
 *  - mutual team intent plus complementary (non-overlapping) skills in a
 *    shared domain — the diverse-team magic,
 *  - shared industry as alignment, shared skills as light common ground.
 */
export function complementScore(
  me: PersonLike | null | undefined,
  person: PersonLike,
): ComplementResult {
  const empty: ComplementResult = {
    score: 0,
    relationship: null,
    complementarySkills: [],
    sharedSkills: [],
    sharedIndustries: [],
    reasons: [],
    headline: null,
  }
  if (!me) return empty

  const mySkills = me.tags ?? []
  const theirSkills = person.tags ?? []
  const mySet = new Set(mySkills)
  const theirSet = new Set(theirSkills)

  const sharedSkills = theirSkills.filter((t) => mySet.has(t))
  const complementarySkills = theirSkills.filter((t) => !mySet.has(t))
  const myInd = new Set(me.industries ?? [])
  const sharedIndustries = (person.industries ?? []).filter((i) => myInd.has(i))
  const relationship = detectRelationship(me.looking ?? [], person.looking ?? [])

  let score = 0
  const reasons: string[] = []

  // Relationship intent — the strongest, most actionable signal.
  if (relationship === 'they-mentor-you') {
    score += CW.mentorIntent
    const area = sharedSkills[0] ?? (theirSkills[0] ?? null)
    reasons.push(area ? `They can mentor you in ${area}` : 'They are open to mentoring')
  } else if (relationship === 'you-mentor-them') {
    score += CW.mentorIntent
    const area = sharedSkills[0] ?? (mySkills[0] ?? null)
    reasons.push(area ? `You can mentor them in ${area}` : 'You could mentor them')
  } else if (relationship === 'team') {
    score += CW.teamIntent
    reasons.push('You are both looking to build a team')
  }

  // Complementary skills — the diversity a teammate brings (matters most for teams).
  if (complementarySkills.length > 0) {
    const capped = Math.min(complementarySkills.length, 3)
    // Full weight when there's team intent; lighter as general "they bring X".
    const weight = relationship === 'team' || relationship === null ? CW.complementSkill : CW.complementSkill * 0.6
    score += capped * weight
    reasons.push(`They bring ${complementarySkills.slice(0, 3).join(', ')}`)
  }

  // Shared industry — same domain. Weighs heavily for teams (shared vision).
  if (sharedIndustries.length > 0) {
    const capped = Math.min(sharedIndustries.length, 2)
    const weight = relationship === 'team' ? CW.sharedIndustry * 1.4 : CW.sharedIndustry
    score += capped * weight
    reasons.push(`Both in ${sharedIndustries.slice(0, 2).join(', ')}`)
  }

  // Shared skills — common ground; worth more for mentor/mentee (same area).
  if (sharedSkills.length > 0) {
    const capped = Math.min(sharedSkills.length, 3)
    const isMentor = relationship === 'they-mentor-you' || relationship === 'you-mentor-them'
    score += capped * (isMentor ? CW.mentorSharedSkill : CW.sharedSkill)
    if (!isMentor) reasons.push(`Common ground on ${sharedSkills.slice(0, 3).join(', ')}`)
  }

  return {
    score: Math.round(score),
    relationship,
    complementarySkills,
    sharedSkills,
    sharedIndustries,
    reasons,
    headline: reasons[0] ?? null,
  }
}
