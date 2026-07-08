/**
 * Ship "type" — a significance axis orthogonal to the work category. Category
 * says which discipline (Product/Engineering/…); kind says how big a deal:
 * a small daily Update, a shipped Feature, or a major Milestone. Ordered
 * small -> large so the project tally reads naturally.
 *
 * build_log.kind is free text (default 'Update'), so this list can grow with
 * no migration; unknown values just render as their plain label.
 */
export const SHIP_KINDS = ['Update', 'Feature', 'Milestone'] as const

export type ShipKind = (typeof SHIP_KINDS)[number]

/** Plural label for the project tally, e.g. 3 features. */
export const SHIP_KIND_PLURAL: Record<string, string> = {
  Update: 'updates',
  Feature: 'features',
  Milestone: 'milestones',
}
