/**
 * Embedding-field configuration for the work taxonomy — where each category
 * anchors on the plot and what color its dots take. Centralised so changing
 * the taxonomy (lib/data/work-categories.ts) means editing this map, not the
 * plot component.
 *
 * Deliberately NOT here: the embedding-field layout engine (lib/radar/similarity.ts)
 * stays taxonomy-agnostic — it takes anchors as an argument rather than importing
 * this file, so it keeps working for any taxonomy (work categories, or People's
 * industries). Categories missing from this map (e.g. legacy blocker tags on old
 * rows) fall back to a deterministic hash-based anchor and ink dots.
 */

import type { WorkCategory } from "@/lib/data/work-categories"
import type { Point } from "@/lib/radar/similarity"

export type CategoryColorKey = "ink" | "violet" | "oxblood" | "muted"

/** Embedding-field axis labels — describe the discipline spread, plotter-style. */
export const RADAR_AXIS_LABELS = { topLeft: "build → grow", bottomRight: "craft → market" }

/**
 * Per-category plot anchor + dot color. Keyed by WorkCategory so TypeScript
 * flags it if a category is added to lib/data/work-categories.ts without a
 * matching anchor here.
 *
 * Rough geography: the build cluster (Engineering, Product, Design) sits left,
 * the market cluster (Growth, Sales, Content) right, money and customers up
 * top, Other in the middle.
 */
export const WORK_CATEGORY_FIELD: Record<WorkCategory, { color: CategoryColorKey; anchor: Point }> = {
  Engineering: { color: "ink",     anchor: { x: 0.24, y: 0.32 } },
  Product:     { color: "violet",  anchor: { x: 0.38, y: 0.48 } },
  Design:      { color: "muted",   anchor: { x: 0.28, y: 0.66 } },
  Content:     { color: "violet",  anchor: { x: 0.52, y: 0.74 } },
  Growth:      { color: "oxblood", anchor: { x: 0.7, y: 0.62 } },
  Sales:       { color: "ink",     anchor: { x: 0.78, y: 0.4 } },
  Customers:   { color: "violet",  anchor: { x: 0.64, y: 0.26 } },
  Fundraising: { color: "oxblood", anchor: { x: 0.46, y: 0.16 } },
  Other:       { color: "muted",   anchor: { x: 0.5, y: 0.46 } },
}
