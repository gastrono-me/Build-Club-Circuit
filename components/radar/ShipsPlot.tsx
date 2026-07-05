"use client"

import React from "react"
import { MessageCircle } from "lucide-react"
import type { BuildLogRow } from "@/lib/hooks/useBuildLog"
import { layoutField, similarityLinks, type Point } from "@/lib/radar/similarity"
import { colors, fonts, fontSize, fontWeight, spacing } from "@/lib/design/tokens"
import { EmbeddingField, type FieldLink, type FieldNode } from "@/components/field/EmbeddingField"
import { WORK_CATEGORY_FIELD, RADAR_AXIS_LABELS, type CategoryColorKey } from "@/lib/config/event"
import { WORK_CATEGORIES, type WorkCategory } from "@/lib/data/work-categories"
import { useSocial } from "@/components/shell/SocialProvider"
import { shipTime } from "@/lib/time"

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

export interface ShipsPlotProps {
  /** Recent ships only - the plot is an energy lens, not the archive. */
  posts: BuildLogRow[]
  cheerCounts: Record<string, number>
  mineCheers: Set<string>
  userId: string | null
  onCheer: (postId: string) => Promise<void>
}

/**
 * The Shipped twin of the stuck field: recent ships laid out by text
 * similarity on the same work-category geography (build cluster left, market
 * right). Radius scales with cheers; tap a node to read the ship, cheer it,
 * or message the builder. Shares EmbeddingField + lib/radar/similarity with
 * the stuck plot and People.
 */
export function ShipsPlot({ posts, cheerCounts, mineCheers, userId, onCheer }: ShipsPlotProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [voting, setVoting] = React.useState(false)
  const { openPanel } = useSocial()

  // Layout + links depend only on ship content, not cheer counts, so cheering
  // never re-solves the field (same convention as the stuck plot).
  const layoutKey = React.useMemo(
    () => posts.map((p) => `${p.id}${p.category}${p.note}`).join(""),
    [posts],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const positions = React.useMemo(() => layoutField(posts, { anchors: CATEGORY_ANCHORS }), [layoutKey])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const simLinks = React.useMemo(() => similarityLinks(posts), [layoutKey])

  const selected = posts.find((p) => p.id === selectedId) ?? null

  async function handleCheer(id: string) {
    if (!userId || voting) return
    setVoting(true)
    try {
      await onCheer(id)
    } finally {
      setVoting(false)
    }
  }

  // Legend: categories present, taxonomy order, max 3.
  const presentCategories = React.useMemo(() => {
    const s = new Set(posts.map((p) => p.category))
    const shown: string[] = WORK_CATEGORIES.filter((c) => s.has(c)).slice(0, 3)
    if (shown.length < 3) {
      for (const c of s) {
        if (!shown.includes(c) && shown.length < 3) shown.push(c)
      }
    }
    return shown
  }, [posts])

  const links: FieldLink[] = simLinks.flatMap(({ a, b, sim }) => {
    const pa = positions[a]
    const pb = positions[b]
    if (!pa || !pb) return []
    const w = Math.min(cheerCounts[a] ?? 0, cheerCounts[b] ?? 0)
    const sw = Math.max(0.8, Math.min(7, 0.7 + w * 0.16))
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

  const nodes: FieldNode[] = posts.flatMap((p) => {
    const pos = positions[p.id]
    if (!pos) return []
    const count = cheerCounts[p.id] ?? 0
    const isOwn = !!userId && p.author_id === userId
    return [{
      id: p.id,
      x: pos.x,
      y: pos.y,
      radius: Math.min(8 + count * 0.5, 20),
      fill: isOwn ? colors.violet : catColor(p.category),
      selected: selectedId === p.id,
      pulsing: false,
      ariaLabel: `${p.category}: ${p.note} — ${count} cheer${count === 1 ? "" : "s"}. Tap to ${selectedId === p.id ? "close" : "view"}.`,
      onClick: () => setSelectedId(selectedId === p.id ? null : p.id),
    }]
  })

  const isOwnSelected = !!selected && !!userId && selected.author_id === userId
  const cheered = !!selected && mineCheers.has(selected.id)

  const panel = selected && (
    <>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.micro,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: catColor(selected.category),
          marginBottom: spacing[1],
        }}
      >
        {selected.category}
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
        {selected.note}
      </p>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.micro,
          color: colors.muted,
          marginBottom: spacing[3],
        }}
      >
        {selected.author_name ?? "Builder"} · {shipTime(selected.created_at, new Date())}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2], flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={voting || !userId || isOwnSelected}
          aria-pressed={cheered}
          onClick={() => handleCheer(selected.id)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 999,
            border: `1.5px solid ${cheered ? colors.go : colors.line}`,
            background: cheered ? colors.goSoft : "transparent",
            color: cheered ? colors.go : colors.ink,
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: "0.03em",
            cursor: (voting || !userId || isOwnSelected) ? "not-allowed" : "pointer",
            opacity: (!userId || isOwnSelected) ? 0.45 : 1,
          }}
        >
          <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>👏</span>
          cheer
          <span style={{ fontWeight: fontWeight.bold, minWidth: 14, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            {cheerCounts[selected.id] ?? 0}
          </span>
        </button>
        {!isOwnSelected && (
          <button
            type="button"
            onClick={() => openPanel({ id: selected.author_id, name: selected.author_name ?? "Builder", avatar: selected.author_avatar }, "chat")}
            aria-label="Message author"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1.4px solid ${colors.line}`, background: colors.surface, color: colors.ink, borderRadius: 8, padding: "6px 10px", fontFamily: fonts.mono, fontSize: fontSize.label, cursor: "pointer" }}
          >
            <MessageCircle size={13} /> Message
          </button>
        )}
      </div>
    </>
  )

  return (
    <EmbeddingField
      ariaLabel="Embedding field of recent ships"
      title="Ship field"
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
              {cat}
            </span>
          ))}
        </div>
      }
      links={links}
      nodes={nodes}
      panel={panel}
      panelAriaLabel={selected ? `Detail: ${selected.note}` : undefined}
      panelBottom={28}
      axisLabels={RADAR_AXIS_LABELS}
      originLabel="0,0"
      liveBlip
    />
  )
}

export default ShipsPlot
