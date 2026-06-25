export interface ScheduleItem {
  id: string
  day: number
  start: number
  end: number
}

/**
 * Returns true if two items share the same day and their time windows overlap
 * (half-open intervals: a.start < b.end && b.start < a.end).
 * Adjacent sessions where end === start do NOT overlap.
 */
export function overlaps(a: ScheduleItem, b: ScheduleItem): boolean {
  return a.day === b.day && a.start < b.end && b.start < a.end
}

/**
 * O(n²) scan — returns the Set of item ids involved in at least one conflict.
 */
export function conflictIds(items: ScheduleItem[]): Set<string> {
  const conflicts = new Set<string>()
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i], items[j])) {
        conflicts.add(items[i].id)
        conflicts.add(items[j].id)
      }
    }
  }
  return conflicts
}

export interface AgendaItem extends ScheduleItem {
  title: string
  kind: 'session' | 'catchup'
}

/**
 * Merge saved sessions and 1:1 catchups into a single titled agenda for
 * conflict checks. Catchups expose start_min/end_min; map them to start/end.
 * Callers decide which catchup statuses count as committed time (e.g. only
 * 'accepted') before passing them in here.
 * Ported from main App.jsx:264-273.
 */
export function buildAgenda(
  sessions: AgendaItem[],
  catchups: { id: string; otherId: string; day: number; start_min: number; end_min: number; otherName?: string | null }[],
  nameFor: (otherId: string) => string,
  excludeCatchupId?: string
): AgendaItem[] {
  const catchupItems: AgendaItem[] = catchups
    .filter((c) => c.id !== excludeCatchupId)
    .map((c) => ({
      id: c.id,
      day: c.day,
      start: c.start_min,
      end: c.end_min,
      title: `Catchup with ${c.otherName ?? nameFor(c.otherId)}`,
      kind: 'catchup',
    }))
  return [...sessions, ...catchupItems]
}
