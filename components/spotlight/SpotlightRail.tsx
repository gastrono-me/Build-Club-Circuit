"use client"

import React, { useEffect, useMemo, useState } from "react"
import { MessageCircle } from "lucide-react"
import { Avatar } from "@/components/shell/Avatar"
import { Card } from "@/components/ui/Card"
import { Tag } from "@/components/ui/Tag"
import { selectSpotlight } from "@/lib/spotlight/rotation"
import type { BuildLogRow } from "@/lib/hooks/useBuildLog"
import { colors, fonts, fontSize, fontWeight, radii, spacing, motion } from "@/lib/design/tokens"

/** How many faces show before collapsing the rest into a +N chip. */
const FACES_VISIBLE = 10
/** Auto-advance interval for the featured ship. */
const CYCLE_MS = 7000

export interface SpotlightRailProps {
  posts: BuildLogRow[]
  now: Date
  /** Header label. Defaults to "Shipped today". */
  label?: string
  /** When true, the featured card shows cheer + message actions. */
  interactive?: boolean
  currentUserId?: string | null
  cheerCounts?: Record<string, number>
  mineCheers?: Set<string>
  onCheer?: (postId: string) => void
  onMessage?: (post: BuildLogRow) => void
}

export function SpotlightRail({
  posts,
  now,
  label = "Shipped today",
  interactive = false,
  currentUserId = null,
  cheerCounts = {},
  mineCheers,
  onCheer,
  onMessage,
}: SpotlightRailProps) {
  const eligible = useMemo(() => selectSpotlight(posts, now), [posts, now])
  const visibleCount = Math.min(eligible.length, FACES_VISIBLE)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = usePrefersReducedMotion()

  // Keep the index in range as the eligible set changes (realtime updates).
  useEffect(() => {
    if (visibleCount && index >= visibleCount) setIndex(0)
  }, [visibleCount, index])

  // Auto-cycle, unless paused, reduced-motion, or nothing to cycle.
  useEffect(() => {
    if (paused || reduceMotion || visibleCount <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % visibleCount), CYCLE_MS)
    return () => clearInterval(t)
  }, [paused, reduceMotion, visibleCount])

  if (eligible.length === 0) return null

  const faces = eligible.slice(0, FACES_VISIBLE)
  const featured = faces[Math.min(index, faces.length - 1)]
  const overflow = eligible.length - faces.length
  const isOwnFeatured = !!currentUserId && featured.author_id === currentUserId
  const cheered = mineCheers?.has(featured.id) ?? false

  return (
    <section
      aria-label={label}
      style={{ marginBottom: spacing[6] }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: spacing[2], marginBottom: spacing[3] }}>
        <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.muted }}>
          {label}
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: fontSize.meta, color: colors.go }}>
          {eligible.length} builders
        </div>
      </div>

      {/* faces strip */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: spacing[3] }}>
        {faces.map((p, i) => {
          const active = i === index
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${p.author_name ?? "builder"}'s ship`}
              aria-pressed={active}
              style={{
                marginLeft: i === 0 ? 0 : -8,
                borderRadius: radii.pill,
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                outline: active ? `2px solid ${colors.violet}` : "none",
                outlineOffset: 2,
                position: "relative",
                zIndex: active ? 2 : 1,
              }}
            >
              <Avatar name={p.author_name ?? "Builder"} photo={p.author_avatar} size={38} />
            </button>
          )
        })}
        {overflow > 0 && (
          <div style={{ marginLeft: -8, width: 38, height: 38, borderRadius: radii.pill, border: `1.4px dashed ${colors.line}`, background: colors.panel, color: colors.muted, fontFamily: fonts.mono, fontSize: fontSize.label, display: "flex", alignItems: "center", justifyContent: "center" }}>
            +{overflow}
          </div>
        )}
      </div>

      {/* featured full post */}
      <Card spine="go" padding={spacing[4]}>
        <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, letterSpacing: "0.1em", textTransform: "uppercase", color: colors.violet, fontWeight: fontWeight.semibold, marginBottom: spacing[3] }}>
          Featured ship
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: spacing[3], marginBottom: spacing[3] }}>
          <Avatar name={featured.author_name ?? "Builder"} photo={featured.author_avatar} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: fonts.body, fontWeight: fontWeight.semibold, fontSize: fontSize.body, color: colors.ink, lineHeight: 1.2 }}>
              {featured.author_name ?? "Builder"}
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft, marginTop: 2 }}>
              {timeAgo(featured.created_at, now)}
            </div>
          </div>
          <Tag tone="go">{featured.category}</Tag>
        </div>

        <p style={{ margin: 0, fontFamily: fonts.body, fontSize: fontSize.body, color: colors.ink, lineHeight: 1.6 }}>
          {featured.note}
        </p>

        {interactive && (
          <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginTop: spacing[4] }}>
            <button
              type="button"
              onClick={() => onCheer?.(featured.id)}
              disabled={!currentUserId || isOwnFeatured}
              aria-pressed={cheered}
              aria-label={`Cheer, ${cheerCounts[featured.id] ?? 0}`}
              style={cheerStyle(cheered, !currentUserId || isOwnFeatured)}
            >
              <span aria-hidden>👏</span> cheer
              {(cheerCounts[featured.id] ?? 0) > 0 && (
                <span style={{ marginLeft: 4, fontWeight: fontWeight.bold }}>{cheerCounts[featured.id]}</span>
              )}
            </button>
            {!isOwnFeatured && (
              <button
                type="button"
                onClick={() => onMessage?.(featured)}
                aria-label="Message author"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1.4px solid ${colors.line}`, background: colors.surface, color: colors.ink, borderRadius: radii.md, padding: "6px 10px", fontFamily: fonts.mono, fontSize: fontSize.label, cursor: "pointer" }}
              >
                <MessageCircle size={13} /> Message
              </button>
            )}
          </div>
        )}

        {/* dots / manual navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginTop: spacing[4], paddingTop: spacing[3], borderTop: `1px solid ${colors.lineSoft}` }}>
          <div style={{ display: "flex", gap: 6 }}>
            {faces.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to ship ${i + 1}`}
                style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 999, border: "none", padding: 0, background: i === index ? colors.violet : colors.line, cursor: "pointer", transition: `width ${motion.fast} ${motion.ease}` }}
              />
            ))}
          </div>
          {faces.length > 1 && !reduceMotion && (
            <span style={{ marginLeft: "auto", fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft }}>
              spotlight rotates
            </span>
          )}
        </div>
      </Card>
    </section>
  )
}

function cheerStyle(mine: boolean, disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 999,
    border: `1.5px solid ${mine ? colors.go : colors.line}`,
    background: mine ? colors.goSoft : colors.panel,
    color: mine ? colors.go : colors.muted,
    fontFamily: fonts.mono,
    fontSize: fontSize.label,
    fontWeight: fontWeight.medium,
    letterSpacing: "0.04em",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
  }
}

function timeAgo(iso: string, now: Date): string {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(mq.matches)
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return reduce
}

export default SpotlightRail
