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
