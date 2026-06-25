import type { Session, Day, Venue, TbaSession } from '@/types/index'
import { SESSIONS } from './sessions'
import { TBA_SESSIONS } from './tba-sessions'
import { DAYS } from './days'
import { VENUES } from './venues'

export interface EventData {
  sessions: Session[]
  tbaSessions: TbaSession[]
  days: Day[]
  venues: Record<string, Venue>
}

/**
 * Returns event data synchronously.
 * This is the single swap-point for future live Luma data.
 */
export function useEventData(): EventData {
  return {
    sessions: SESSIONS,
    tbaSessions: TBA_SESSIONS,
    days: DAYS,
    venues: VENUES,
  }
}
