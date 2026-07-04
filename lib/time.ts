/** Minutes since midnight from hours + optional minutes */
export const hm = (h: number, m = 0): number => h * 60 + m

/** Format minutes-since-midnight as 12-hour time string, e.g. "10:15 AM" */
export const fmt = (mins: number): string => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  const hh = ((h + 11) % 12) + 1
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`
}

/** Convert a {day, mins} slot to absolute minutes (day 0 = first 1440 min block) */
export const toAbsoluteMinutes = ({ day, mins }: { day: number; mins: number }): number =>
  day * 1440 + mins

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "Jul 2", with the year appended when it differs from `now`'s year. */
export const shipDate = (iso: string, now: Date): string => {
  const d = new Date(iso)
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return d.getFullYear() === now.getFullYear() ? base : `${base}, ${d.getFullYear()}`
}

/**
 * Ship card timestamp: relative while fresh (the daily ritual), a real calendar
 * date once it is older than a day, so progress is trackable at a glance.
 *   "just now" · "12m ago" · "5h ago" · "Jul 2" · "Dec 12, 2025"
 */
export const shipTime = (iso: string, now: Date): string => {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return shipDate(iso, now)
}

/** Timeline day header, e.g. "Wednesday, Jul 2" (year appended when not this year). */
export const shipDayHeading = (iso: string, now: Date): string => {
  const d = new Date(iso)
  return `${WEEKDAYS[d.getDay()]}, ${shipDate(iso, now)}`
}

/** Clock time for a ship inside a day group, e.g. "2:05 PM". */
export const shipClock = (iso: string): string => {
  const d = new Date(iso)
  return fmt(d.getHours() * 60 + d.getMinutes())
}

/** Local-day key for grouping a timeline (display grouping, not streak math). */
export const localDayKey = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
