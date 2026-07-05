/**
 * Categories a builder can file a ship under on the Build Log.
 *
 * Deliberately distinct from BLOCKER_TAGS (blocker-tags.ts): a blocker says
 * *where you're stuck* (AI subsystems), a ship says *what kind of work you got
 * done*. These span disciplines on purpose, so a GTM, sales, or design builder
 * has a real home for their update, not just "Other".
 *
 * `build_log.category` is a free text column, so this list can change freely
 * with no migration; existing ships keep whatever string they were filed under.
 */
export const SHIP_CATEGORIES = [
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

export type ShipCategory = (typeof SHIP_CATEGORIES)[number]
