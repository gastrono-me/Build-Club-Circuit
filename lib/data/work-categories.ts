/**
 * The one work taxonomy, shared by ships ("what kind of work you got done")
 * and blockers ("what kind of work you're stuck in"). Discipline-spanning on
 * purpose: a GTM, sales, or design builder has a real home for their update or
 * blocker, not just "Other".
 *
 * Both build_log.category and blockers.category are free text columns, so this
 * list can change with no migration; existing rows keep their old strings and
 * the embedding field lays unknown categories out via a deterministic hash
 * fallback (lib/radar/similarity.ts anchorFor).
 */
export const WORK_CATEGORIES = [
  'Product',
  'Engineering',
  'Design',
  'Growth',
  'Sales',
  'Customers',
  'Fundraising',
  'Content',
  'Other',
] as const

export type WorkCategory = (typeof WORK_CATEGORIES)[number]
