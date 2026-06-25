import type { TbaSession } from '@/types/index'

let _id = 0
const T = (o: Omit<TbaSession, 'id'>): TbaSession => ({ id: `tba${++_id}`, ...o })

// Real Agentic AI Build Week sessions whose date/time Luma hasn't published yet
// (private/approval-gated listings). Shown unscheduled until Luma reveals a slot.
export const TBA_SESSIONS: TbaSession[] = []
