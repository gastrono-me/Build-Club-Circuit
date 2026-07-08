import { matchScore, LOOKING_PAIRS, type PersonLike } from '@/lib/match'
import { fmt } from '@/lib/time'

// ---- localReadinessReview ------------------------------------------------

/**
 * Heuristic review of a hackathon project write-up.
 * Returns a formatted Strengths / Gaps / Verdict string.
 * Ported from legacy/App.jsx:194-206.
 */
export function localReadinessReview(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const has = (kw: string) => text.toLowerCase().includes(kw)
  const strengths: string[] = []
  const gaps: string[] = []

  if (has('demo') || has('video') || has('http')) {
    strengths.push('Mentions a demo or link — judges can actually see it working.')
  } else {
    gaps.push('No mention of a demo link or video — without one, judges can\'t verify it\'s real.')
  }

  if (has('ai') || has('claude') || has('llm') || has('agent')) {
    strengths.push('AI use is explicit, not just implied.')
  } else {
    gaps.push('Unclear where AI is actually doing the work versus just being mentioned.')
  }

  if (words > 40) {
    strengths.push('Enough detail for a judge to understand the idea without asking.')
  } else {
    gaps.push('Pretty thin — judges skim fast, so spell out the problem and the fix in plain terms.')
  }

  const strengthsText = strengths.length
    ? strengths.join('\n- ')
    : 'Hard to tell from this draft — add more specifics.'
  const gapsText = gaps.length
    ? gaps.join('\n- ')
    : 'None obvious — looks solid.'
  const verdict =
    gaps.length > 1
      ? 'Needs another pass before you submit.'
      : 'Close — tighten the gaps above and you\'re ready.'

  return `Strengths:\n- ${strengthsText}\n\nGaps:\n- ${gapsText}\n\nVerdict: ${verdict}`
}

// ---- localAnswer context types -------------------------------------------

export interface SessionLike {
  id: string
  day: number
  start: number
  end: number
  title: string
  venue: string
  tags?: string[]
}

export interface DayLike {
  idx: number
  label: string
  date: string
}

export interface VenueLike {
  name: string
  area?: string
}

export interface CatchupLike {
  id: string
  day: number
  start: number
  end: number
  personId: string
}

export interface AttendeeForAnswer extends PersonLike {
  id: string
  name: string
  occupation?: string
  bio?: string
}

export interface LocalAnswerCtx {
  attendees: AttendeeForAnswer[]
  sessions: SessionLike[]
  days: DayLike[]
  venues: Record<string, { name: string; area?: string }>
  schedule: Set<string>
  catchups: CatchupLike[]
  currentDay: number
  currentMins: number
}

// ---- localAnswer ---------------------------------------------------------

/**
 * Rule-based fallback for the Pulse assistant.
 * Ported from legacy/App.jsx:1178-1201.
 */
export function localAnswer(me: PersonLike, ctx: LocalAnswerCtx, q: string): string {
  const t = q.toLowerCase()
  const { attendees, sessions, days, venues, schedule, catchups, currentDay, currentMins } = ctx
  const venueName = (key: string) => venues[key]?.name ?? key

  const day = days[currentDay]
  const today = sessions.filter((s) => s.day === currentDay).sort((a, b) => a.start - b.start)
  const todayCatchups = catchups.filter((c) => c.day === currentDay)

  if (t.includes('now') || t.includes('right now') || t.includes('happening')) {
    const liveCatchup = todayCatchups.find(
      (c) => currentMins >= c.start && currentMins < c.end
    )
    if (liveCatchup) {
      const person = attendees.find((a) => a.id === liveCatchup.personId)
      return `You're mid-catchup with ${person?.name ?? 'someone'} right now, until ${fmt(liveCatchup.end)}.`
    }
    const live = today.filter((s) => currentMins >= s.start && currentMins < s.end)
    const next = today.find((s) => s.start > currentMins)
    const dayLabel = day ? day.date : ''
    return live.length
      ? `Right now (${fmt(currentMins)}, ${dayLabel}): ${live.map((s) => `${s.title} at ${venueName(s.venue)}`).join('; ')}.${next ? ` Up next: ${next.title} at ${fmt(next.start)}.` : ''}`
      : `Nothing's running at ${fmt(currentMins)}.${next ? ` Next up is ${next.title} at ${fmt(next.start)}, ${venueName(next.venue)}.` : ' That\'s a wrap for today.'}`
  }

  if (t.includes('meet') || t.includes('who')) {
    const top = [...attendees]
      .sort((a, b) => matchScore(me, b).score - matchScore(me, a).score)
      .slice(0, 3)
    const tagList = (me.tags ?? []).join(', ')
    const topText = top
      .map((p) => {
        const shared = (p.tags ?? []).filter((x) => (me.tags ?? []).includes(x))
        const role = shared.join('/') || p.occupation || ''
        return `${p.name} (${role}, ${(p.looking ?? []).join('/')})`
      })
      .join('; ')
    return `Based on your tags (${tagList}), start with: ${topText}. Head to the People tab to message or schedule a catchup.`
  }

  const mine = new Set(me.tags ?? [])
  const recs = today
    .filter((s) => s.start > currentMins && !schedule.has(s.id) && (s.tags ?? []).some((x) => mine.has(x)))
    .slice(0, 3)
  return recs.length
    ? `For your free time today, these match your interests: ${recs.map((s) => `${s.title} (${fmt(s.start)}, ${venueName(s.venue)})`).join('; ')}.`
    : `Your day looks full or winding down. Use any gap to build, or check Community Night to meet people.`
}

// ---- localReason --------------------------------------------------------

/** One-line "why meet them". Ported from main App.jsx:165-177. */
export function localReason(
  me: PersonLike,
  person: PersonLike & { looking?: string[] }
): string {
  const { shared, sharedIndustries } = matchScore(me, person)
  const bits: string[] = []
  if (shared.length) bits.push(`shares your interest in ${shared.slice(0, 2).join(' & ')}`)
  if (sharedIndustries.length) bits.push(`is also building in ${sharedIndustries[0]}`)
  const myLooking = me.looking ?? []
  const complementary = myLooking.some((l) =>
    (LOOKING_PAIRS[l] ?? []).some((x) => (person.looking ?? []).includes(x))
  )
  if (complementary && (person.looking ?? []).length) {
    bits.push(`is looking for a ${person.looking![0].toLowerCase()}`)
  }
  if (bits.length) return bits.join(' and ') + '.'
  return (person.looking ?? []).length
    ? `Looking for ${person.looking!.join('/').toLowerCase()}. Could be a complementary fit.`
    : 'Worth a hello. Overlapping circles at the event.'
}

