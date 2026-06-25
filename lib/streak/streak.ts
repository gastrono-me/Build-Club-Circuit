/**
 * Streak engine — the heart of Circuit's daily ship ritual.
 *
 * Unlike `lib/time.ts` (event-schedule minutes-since-midnight for the sim clock),
 * this works in real calendar days: a builder's streak is how many consecutive
 * days they have shipped something to their Build Log.
 *
 * Day boundaries use UTC for v1. Per-builder timezone is a later refinement;
 * keeping it deterministic and tz-free now keeps the engine pure and testable.
 */

export interface StreakResult {
  /** Consecutive days shipped, counting back from today (or yesterday, within grace). */
  current: number
  /** Longest run of consecutive shipping days in the builder's whole history. */
  longest: number
  /** True if the builder has shipped something today. */
  shippedToday: boolean
  /** Most recent day shipped, as YYYY-MM-DD, or null if never. */
  lastShipDate: string | null
}

/** YYYY-MM-DD for a date, in UTC. Sorts lexically == chronologically. */
export function toDayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** The calendar day before a YYYY-MM-DD key, in UTC. */
function prevDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d) - 86_400_000).toISOString().slice(0, 10)
}

/**
 * Compute a builder's streak from their ship timestamps.
 *
 * The current streak stays alive through a one-day grace window: if you shipped
 * yesterday but not yet today, the streak is intact (it only breaks once a full
 * calendar day passes with no ship). Shipping today extends it.
 *
 * @param timestamps  Any ship times (ISO strings or Dates); order/duplicates don't matter.
 * @param now         The reference "now" (defaults to real time; injectable for tests).
 */
export function computeStreak(
  timestamps: Array<string | Date>,
  now: Date = new Date(),
): StreakResult {
  const days = new Set<string>()
  for (const t of timestamps) {
    const d = t instanceof Date ? t : new Date(t)
    if (!Number.isNaN(d.getTime())) days.add(toDayKey(d))
  }

  if (days.size === 0) {
    return { current: 0, longest: 0, shippedToday: false, lastShipDate: null }
  }

  const todayKey = toDayKey(now)
  const yesterdayKey = prevDay(todayKey)
  const shippedToday = days.has(todayKey)

  // Walk consecutive days backwards from the live anchor (today, else yesterday).
  let cursor: string | null = shippedToday
    ? todayKey
    : days.has(yesterdayKey)
      ? yesterdayKey
      : null
  let current = 0
  while (cursor && days.has(cursor)) {
    current += 1
    cursor = prevDay(cursor)
  }

  // Longest historical run.
  const sorted = [...days].sort()
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const k of sorted) {
    run = prev !== null && prevDay(k) === prev ? run + 1 : 1
    if (run > longest) longest = run
    prev = k
  }

  return {
    current,
    longest,
    shippedToday,
    lastShipDate: sorted[sorted.length - 1],
  }
}
