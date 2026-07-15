/**
 * Event status — derives an event's phase from its window in real time.
 *
 * Like the streak engine (lib/streak), this is pure and event-clock-free: phase
 * is computed from starts_at/ends_at vs a real `now`, never stored. Boundaries:
 * the event is "live" from starts_at (inclusive) until ends_at (exclusive).
 */

export type EventPhase = "upcoming" | "live" | "ended" | "cancelled"

export interface EventStatus {
  phase: EventPhase
  /** ms from now to the next transition: start (upcoming) or end (live); 0 when ended. */
  msUntilNext: number
}

export function eventStatus(
  startsAt: string | Date,
  endsAt: string | Date,
  now: Date = new Date(),
  cancelledAt: string | Date | null = null,
): EventStatus {
  if (cancelledAt) return { phase: "cancelled", msUntilNext: 0 }
  const start = (startsAt instanceof Date ? startsAt : new Date(startsAt)).getTime()
  const end = (endsAt instanceof Date ? endsAt : new Date(endsAt)).getTime()
  const t = now.getTime()

  if (t < start) return { phase: "upcoming", msUntilNext: start - t }
  if (t < end) return { phase: "live", msUntilNext: end - t }
  return { phase: "ended", msUntilNext: 0 }
}

/** Ordering for display: live first, then upcoming, then ended. */
export const PHASE_ORDER: Record<EventPhase, number> = { live: 0, upcoming: 1, ended: 2, cancelled: 3 }

/**
 * Pick the one event to feature: the live event ending soonest, else the next
 * upcoming event, else null. Used to surface "the event happening now".
 */
export function pickActiveEvent<T extends { starts_at: string; ends_at: string; cancelled_at?: string | null }>(
  events: T[],
  now: Date = new Date(),
): T | null {
  const live: Array<{ e: T; ms: number }> = []
  const upcoming: Array<{ e: T; ms: number }> = []
  for (const e of events) {
    const s = eventStatus(e.starts_at, e.ends_at, now, e.cancelled_at)
    if (s.phase === "live") live.push({ e, ms: s.msUntilNext })
    else if (s.phase === "upcoming") upcoming.push({ e, ms: s.msUntilNext })
  }
  if (live.length) return live.sort((a, b) => a.ms - b.ms)[0].e
  if (upcoming.length) return upcoming.sort((a, b) => a.ms - b.ms)[0].e
  return null
}
