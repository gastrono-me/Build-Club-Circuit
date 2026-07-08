"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { X, FolderGit2 } from "lucide-react"
import { useBuildLog, type BuildLogRow } from "@/lib/hooks/useBuildLog"
import { Avatar } from "@/components/shell/Avatar"
import { Tag } from "@/components/ui/Tag"
import { ShipKindBadge } from "@/components/radar/ShipKindBadge"
import { shipTime } from "@/lib/time"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

/** How long each ship holds centre stage. */
const ROTATE_MS = 9000

/**
 * A full-screen, no-interaction coverflow of recent ships for an IRL screen or
 * projector. The current ship holds centre; the previous and next peek in,
 * dimmed and scaled, on each side. Auto-rotates; new ships fold in live (the
 * feed rides the shared broadcast bus). Rendered as a fixed overlay over the
 * app chrome.
 */
export function ShipCarousel() {
  const router = useRouter()
  const { posts, cheerCounts, commentCounts, loading } = useBuildLog()
  const [index, setIndex] = React.useState(0)
  const [now, setNow] = React.useState<Date>(() => new Date())

  const ships = React.useMemo(() => posts.slice(0, 30), [posts])
  const len = ships.length

  React.useEffect(() => {
    if (len && index >= len) setIndex(0)
  }, [len, index])

  // Auto-advance + a slow header clock.
  React.useEffect(() => {
    if (len <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % len), ROTATE_MS)
    return () => clearInterval(t)
  }, [len])
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.push("/admin") }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])

  const current = ships[index] ?? null
  // Neighbours only make sense with 3+; with 2 they'd duplicate.
  const prev = len > 2 ? ships[(index - 1 + len) % len] : null
  const next = len > 2 ? ships[(index + 1) % len] : null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: colors.surface,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header strip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${spacing[4]}px ${spacing[6]}px`, borderBottom: `1.5px solid ${colors.ink}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: spacing[3] }}>
          <span style={{ fontFamily: fonts.display, fontWeight: fontWeight.bold, fontSize: "clamp(22px, 3vw, 34px)", color: colors.ink, letterSpacing: "-0.02em" }}>Circuit</span>
          <span style={{ fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.mutedSoft }}>Build Club · shipping live</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing[4] }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.go }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: colors.go, display: "inline-block", animation: "radarPulse 2s ease-in-out infinite" }} />
            live
          </span>
          <button onClick={() => router.push("/admin")} aria-label="Exit projector view" title="Exit (Esc)"
            style={{ border: `1.4px solid ${colors.line}`, background: "transparent", color: colors.muted, borderRadius: radii.md, padding: 6, cursor: "pointer", display: "flex" }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Coverflow stage */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, overflow: "hidden" }}>
        {loading ? null : !current ? (
          <div style={{ fontFamily: fonts.body, fontSize: "clamp(20px, 3vw, 30px)", color: colors.muted, textAlign: "center", padding: spacing[6] }}>
            No ships logged yet. This screen lights up as the cohort ships.
          </div>
        ) : (
          <>
            {prev && <SidePreview ship={prev} side="left" />}
            {next && <SidePreview ship={next} side="right" />}
            <CenterShip
              key={current.id}
              ship={current}
              now={now}
              cheers={cheerCounts[current.id] ?? 0}
              comments={commentCounts[current.id] ?? 0}
            />
          </>
        )}
      </div>

      {/* Footer: progress dots */}
      {len > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: spacing[4], flexShrink: 0 }}>
          {ships.map((s, i) => (
            <span key={s.id} aria-hidden style={{ width: i === index ? 26 : 7, height: 7, borderRadius: 999, background: i === index ? colors.violet : colors.line, transition: "width 0.3s ease" }} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes radarPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }
        @keyframes carouselIn { from { opacity: 0; transform: translateX(6%) scale(0.97) } to { opacity: 1; transform: translateX(0) scale(1) } }
      `}</style>
    </div>
  )
}

/** The centre ship: big, full detail, with its image if it has one. */
function CenterShip({ ship, now, cheers, comments }: { ship: BuildLogRow; now: Date; cheers: number; comments: number }) {
  const isImage = !!ship.media_url && (ship.media_type?.startsWith("image/") ?? false)
  return (
    <div
      style={{
        position: "relative",
        zIndex: 3,
        display: "flex",
        gap: "clamp(24px, 4vw, 64px)",
        alignItems: "center",
        justifyContent: "center",
        width: "min(72vw, 1180px)",
        flexWrap: "wrap",
        padding: `0 clamp(${spacing[4]}px, 4vw, 60px)`,
        animation: "carouselIn 0.55s cubic-bezier(0.2,0,0,1)",
      }}
    >
      {isImage && (
        <div style={{ flex: "1 1 340px", maxWidth: 560, minWidth: 260 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ship.media_url!} alt="" style={{ width: "100%", maxHeight: "58vh", objectFit: "cover", borderRadius: radii.xl, border: `1.5px solid ${colors.ink}` }} />
        </div>
      )}
      <div style={{ flex: "1 1 420px", minWidth: 280, maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3], marginBottom: spacing[4] }}>
          <Avatar name={ship.author_name ?? "Builder"} photo={ship.author_avatar} size={56} />
          <div>
            <div style={{ fontFamily: fonts.body, fontWeight: fontWeight.bold, fontSize: "clamp(20px, 2.4vw, 30px)", color: colors.ink, lineHeight: 1.1 }}>
              {ship.author_name ?? "Builder"}
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: fontSize.body, color: colors.mutedSoft, marginTop: 2 }}>
              {shipTime(ship.created_at, now)}
            </div>
          </div>
        </div>
        <p style={{ margin: 0, fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: "clamp(26px, 3.6vw, 48px)", lineHeight: 1.12, letterSpacing: "-0.02em", color: colors.ink }}>
          {ship.note}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3], flexWrap: "wrap", marginTop: spacing[5] }}>
          <Tag tone="go">{ship.category}</Tag>
          <ShipKindBadge kind={ship.kind} />
          {ship.project_name && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: fonts.mono, fontSize: fontSize.body, color: colors.violet }}>
              <FolderGit2 size={16} /> {ship.project_name}
            </span>
          )}
          {cheers > 0 && <span style={{ fontFamily: fonts.mono, fontSize: fontSize.body, color: colors.go }}>👏 {cheers}</span>}
          {comments > 0 && <span style={{ fontFamily: fonts.mono, fontSize: fontSize.body, color: colors.muted }}>💬 {comments}</span>}
        </div>
      </div>
    </div>
  )
}

/** A dimmed, scaled neighbour peeking in from one edge. */
function SidePreview({ ship, side }: { ship: BuildLogRow; side: "left" | "right" }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "50%",
        [side]: 0,
        width: "clamp(240px, 30vw, 440px)",
        transform: `translate(${side === "left" ? "-32%" : "32%"}, -50%) scale(0.8)`,
        opacity: 0.32,
        zIndex: 1,
        pointerEvents: "none",
        background: colors.panel,
        border: `1.5px solid ${colors.line}`,
        borderRadius: radii.xl,
        padding: spacing[5],
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: spacing[3] }}>
        <Avatar name={ship.author_name ?? "Builder"} photo={ship.author_avatar} size={38} />
        <span style={{ fontFamily: fonts.body, fontWeight: fontWeight.semibold, fontSize: "clamp(16px, 1.5vw, 22px)", color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ship.author_name ?? "Builder"}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: fonts.display,
          fontWeight: fontWeight.semibold,
          fontSize: "clamp(18px, 1.9vw, 26px)",
          lineHeight: 1.2,
          color: colors.ink,
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {ship.note}
      </p>
    </div>
  )
}

export default ShipCarousel
