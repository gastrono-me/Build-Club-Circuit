"use client"

import React from "react"
import type { BlockerRow } from "@/lib/hooks/useRadar"
import { layoutField, similarityLinks, type Point } from "@/lib/radar/similarity"
import { colors, fonts, fontSize, fontWeight, spacing } from "@/lib/design/tokens"
import { EmbeddingField, type FieldLink, type FieldNode } from "@/components/field/EmbeddingField"
import { WORK_CATEGORY_FIELD, RADAR_AXIS_LABELS, type CategoryColorKey } from "@/lib/config/event"
import { WORK_CATEGORIES, type WorkCategory } from "@/lib/data/work-categories"

const COLOR_TOKENS: Record<CategoryColorKey, string> = {
  ink: colors.ink,
  violet: colors.violet,
  oxblood: colors.oxblood,
  muted: colors.muted,
}

const CATEGORY_ANCHORS: Record<string, Point> = Object.fromEntries(
  Object.entries(WORK_CATEGORY_FIELD).map(([cat, { anchor }]) => [cat, anchor]),
)

function catColor(category: string): string {
  const entry = WORK_CATEGORY_FIELD[category as WorkCategory]
  return entry ? COLOR_TOKENS[entry.color] : colors.ink
}

export interface EmbeddingPlotProps {
  blockers: BlockerRow[]
  meTooCounts: Record<string, number>
  mineMeToo: Set<string>
  userId: string | null
  onMeToo: (id: string) => Promise<void>
  /** Most-recently posted blocker id (to show "just posted" emphasis) */
  latestId?: string | null
  /** Blocker id that just took a cross-client "me too" (transient pulse). */
  pulseId?: string | null
}

export function EmbeddingPlot({
  blockers,
  meTooCounts,
  mineMeToo,
  userId,
  onMeToo,
  latestId,
  pulseId,
}: EmbeddingPlotProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [voting, setVoting] = React.useState(false)

  // Layout + links depend only on blocker *content* (id/category/note), not on
  // me-too counts — so tapping "me too" never re-solves the field or makes
  // nodes jump. Same content always yields the same field (pure + deterministic).
  const layoutKey = React.useMemo(
    () => blockers.map((b) => `${b.id}${b.category}${b.note}`).join(""),
    [blockers],
  )

  // Real embedding field: position by text similarity (TF-IDF cosine), seeded
  // from category anchors and relaxed with similarity forces.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const positions = React.useMemo(() => layoutField(blockers, { anchors: CATEGORY_ANCHORS }), [layoutKey])

  // Vector lines connect genuinely similar blockers — across categories, not
  // just geometric neighbours.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const simLinks = React.useMemo(() => similarityLinks(blockers), [layoutKey])

  const selectedBlocker = blockers.find((b) => b.id === selectedId) ?? null

  async function handleMeToo(id: string) {
    if (!userId || voting) return
    setVoting(true)
    try {
      await onMeToo(id)
    } finally {
      setVoting(false)
    }
  }

  // Legend categories actually present in data (show at most 3, taxonomy order)
  const presentCategories = React.useMemo(() => {
    const s = new Set(blockers.map((b) => b.category))
    const shown: string[] = WORK_CATEGORIES.filter((c) => s.has(c)).slice(0, 3)
    // Legacy categories (old rows) fill remaining slots so the legend never lies.
    if (shown.length < 3) {
      for (const c of s) {
        if (!shown.includes(c) && shown.length < 3) shown.push(c)
      }
    }
    return shown
  }, [blockers])

  const links: FieldLink[] = simLinks.flatMap(({ a, b, sim }) => {
    const pa = positions[a]
    const pb = positions[b]
    if (!pa || !pb) return []
    const wa = meTooCounts[a] ?? 0
    const wb = meTooCounts[b] ?? 0
    const w = Math.min(wa, wb)
    const sw = Math.max(0.8, Math.min(7, 0.7 + w * 0.16))
    // Base visibility tracks similarity strength, then me-too adds weight,
    // so a strong text match reads even before anyone has voted.
    const simOpacity = 0.12 + Math.min(0.28, sim * 0.4)
    const opacity = w > 0 ? Math.min(0.85, simOpacity + w * 0.03) : simOpacity
    return [{
      key: `${a}|${b}`,
      from: pa,
      to: pb,
      strokeWidth: sw,
      opacity,
      active: selectedId === a || selectedId === b,
    }]
  })

  const nodes: FieldNode[] = blockers.flatMap((b) => {
    const pos = positions[b.id]
    if (!pos) return []
    const count = meTooCounts[b.id] ?? 0
    const isOwn = !!userId && b.author_id === userId
    const isLatest = b.id === latestId
    const isPulse = b.id === pulseId
    const fill = isOwn || isLatest || isPulse ? colors.violet : catColor(b.category)
    // Radius: 8px base + 0.5px per me-too, capped at 20px
    const radius = Math.min(8 + count * 0.5, 20)
    return [{
      id: b.id,
      x: pos.x,
      y: pos.y,
      radius,
      fill,
      selected: selectedId === b.id,
      pulsing: isLatest || isPulse,
      ariaLabel: `${b.category}: ${b.note} — ${count} me too. Tap to ${selectedId === b.id ? "close" : "view"}.`,
      onClick: () => setSelectedId(selectedId === b.id ? null : b.id),
    }]
  })

  const panel = selectedBlocker && (
    <>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.micro,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: catColor(selectedBlocker.category),
          marginBottom: spacing[1],
        }}
      >
        {selectedBlocker.category}
      </div>
      <p
        style={{
          margin: `0 0 ${spacing[2]}px`,
          fontFamily: fonts.body,
          fontSize: fontSize.body,
          color: colors.ink,
          lineHeight: 1.45,
        }}
      >
        {selectedBlocker.note}
      </p>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.micro,
          color: colors.muted,
          marginBottom: spacing[3],
        }}
      >
        {selectedBlocker.author_id == null
          ? "Community"
          : (selectedBlocker.author_name ?? "Attendee")}
      </div>
      <button
        type="button"
        disabled={
          voting ||
          !userId ||
          (!!userId && selectedBlocker.author_id === userId)
        }
        aria-pressed={mineMeToo.has(selectedBlocker.id)}
        onClick={() => handleMeToo(selectedBlocker.id)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 14px",
          borderRadius: 999,
          border: `1.5px solid ${mineMeToo.has(selectedBlocker.id) ? colors.violet : colors.line}`,
          background: mineMeToo.has(selectedBlocker.id) ? colors.violet : "transparent",
          color: mineMeToo.has(selectedBlocker.id) ? colors.onDark : colors.ink,
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          letterSpacing: "0.03em",
          cursor: (voting || !userId || selectedBlocker.author_id === userId) ? "not-allowed" : "pointer",
          opacity: (!userId || selectedBlocker.author_id === userId) ? 0.45 : 1,
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1, color: mineMeToo.has(selectedBlocker.id) ? colors.onDark : colors.violet }}>→</span>
        me too
        <span style={{ fontWeight: 600, minWidth: 14, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {meTooCounts[selectedBlocker.id] ?? 0}
        </span>
      </button>
    </>
  )

  return (
    <EmbeddingField
      ariaLabel="Embedding field of current blockers"
      title="Bottleneck Radar"
      headerRight={
        <div aria-hidden style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {presentCategories.map((cat) => (
            <span
              key={cat}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontFamily: fonts.mono, fontSize: fontSize.micro, letterSpacing: "0.03em",
                color: colors.muted, textTransform: "uppercase",
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: catColor(cat), display: "inline-block", flexShrink: 0 }} />
              {cat.split("/")[0]}
            </span>
          ))}
        </div>
      }
      links={links}
      nodes={nodes}
      panel={panel}
      panelAriaLabel={selectedBlocker ? `Detail: ${selectedBlocker.note}` : undefined}
      panelBottom={28}
      axisLabels={RADAR_AXIS_LABELS}
      originLabel="0,0"
      liveBlip
    />
  )
}

export default EmbeddingPlot
