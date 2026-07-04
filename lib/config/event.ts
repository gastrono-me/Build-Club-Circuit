/**
 * Per-event configuration — the facts that change when Circuit is stood up for
 * a different hackathon/build week. Everything here used to be hardcoded
 * inline across Countdown.tsx, Checklist.tsx, and EmbeddingPlot.tsx; centralised
 * so spinning up a new event means editing this file, not forking components.
 *
 * Deliberately NOT here: the embedding-field layout engine (lib/radar/similarity.ts)
 * stays event-agnostic — it takes anchors as an argument rather than importing
 * this file, so it keeps working for any taxonomy (any event's categories, or
 * People's industries) without caring what AABW's blocker categories are.
 */

import type { BlockerTag } from "@/lib/data/blocker-tags"
import type { Point } from "@/lib/radar/similarity"

export type CategoryColorKey = "ink" | "violet" | "oxblood" | "muted"

/** Bottleneck Radar plot axis labels — describe this event's category spread. */
export const RADAR_AXIS_LABELS = { topLeft: "tooling → model", bottomRight: "retrieval → shipping" }

/**
 * Per-category plot anchor + dot color for the Radar/Build Log embedding field.
 * Keyed by BlockerTag so TypeScript flags it if a category is added to
 * lib/data/blocker-tags.ts without a matching anchor here.
 */
export const BLOCKER_CATEGORIES: Record<BlockerTag, { color: CategoryColorKey; anchor: Point }> = {
  "RAG/Retrieval":    { color: "ink",    anchor: { x: 0.27, y: 0.65 } },
  "Getting unstuck":  { color: "violet", anchor: { x: 0.62, y: 0.78 } },
  "Deploy/Infra":     { color: "oxblood", anchor: { x: 0.78, y: 0.22 } },
  "Agent loops":      { color: "violet", anchor: { x: 0.45, y: 0.72 } },
  "Auth/Login":       { color: "ink",    anchor: { x: 0.2, y: 0.3 } },
  "Rate limits/Cost": { color: "muted",  anchor: { x: 0.68, y: 0.38 } },
  "UI polish":        { color: "muted",  anchor: { x: 0.35, y: 0.48 } },
  "Launch/Demo":      { color: "violet", anchor: { x: 0.55, y: 0.85 } },
  "Data/Eval":        { color: "ink",    anchor: { x: 0.3, y: 0.55 } },
  Other:              { color: "muted",  anchor: { x: 0.5, y: 0.45 } },
}
