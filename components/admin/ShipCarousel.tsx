"use client"

import React from "react"
import { useRouter } from "next/navigation"
import QRCode from "react-qr-code"
import { X, FolderGit2 } from "lucide-react"
import { useBuildLog, type BuildLogRow } from "@/lib/hooks/useBuildLog"
import { Avatar } from "@/components/shell/Avatar"
import { Tag } from "@/components/ui/Tag"
import { ShipKindBadge } from "@/components/radar/ShipKindBadge"
import { shipTime } from "@/lib/time"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

/** How long each ship holds centre stage. */
const ROTATE_MS = 9000
/** Width of one slide slot, in vw. Neighbours peek in the remaining width. */
const STRIDE_VW = 48

/**
 * A full-screen, no-interaction coverflow of recent ships for an IRL screen or
 * projector. Ships sit on a horizontal track that slides one slot per tick, so
 * the previous and next ships peek in (dimmed, scaled) on each side and the
 * next slides into centre. Auto-rotates; new ships fold in live (the feed rides
 * the shared broadcast bus). A QR points people at Circuit to join.
 */
export function ShipCarousel() {
  const router = useRouter()
  const { posts, cheerCounts, commentCounts, loading } = useBuildLog()
  const [index, setIndex] = React.useState(0)
  const [snap, setSnap] = React.useState(false) // true = no transition (wrap jump)
  const [now, setNow] = React.useState<Date>(() => new Date())
  const [joinUrl, setJoinUrl] = React.useState("")

  const ships = React.useMemo(() => posts.slice(0, 30), [posts])
  const len = ships.length

  React.useEffect(() => { setJoinUrl(window.location.origin) }, [])

  React.useEffect(() => {
    if (len && index >= len) setIndex(0)
  }, [len, index])

  // Auto-advance. On the wrap back to 0, snap without a transition so the track
  // doesn't sweep the whole width.
  React.useEffect(() => {
    if (len <= 1) return
    const t = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % len
        if (next === 0) {
          setSnap(true)
          requestAnimationFrame(() => requestAnimationFrame(() => setSnap(false)))
        }
        return next
      })
    }, ROTATE_MS)
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

  const transition = snap ? "none" : "transform 0.65s cubic-bezier(0.2,0,0,1)"

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
      <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}>
        {loading ? null : !len ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fonts.body, fontSize: "clamp(20px, 3vw, 30px)", color: colors.muted, textAlign: "center", padding: spacing[6] }}>
            No ships logged yet. This screen lights up as the cohort ships.
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              left: "50vw",
              top: "50%",
              display: "flex",
              alignItems: "center",
              transform: `translateX(calc(-${index * STRIDE_VW}vw - ${STRIDE_VW / 2}vw)) translateY(-50%)`,
              transition,
            }}
          >
            {ships.map((s, i) => {
              const active = i === index
              return (
                <div
                  key={s.id}
                  style={{
                    width: `${STRIDE_VW}vw`,
                    flexShrink: 0,
                    display: "flex",
                    justifyContent: "center",
                    transform: active ? "scale(1)" : "scale(0.78)",
                    opacity: active ? 1 : 0.3,
                    transition: snap ? "none" : "transform 0.65s cubic-bezier(0.2,0,0,1), opacity 0.65s ease",
                  }}
                >
                  {active
                    ? <CenterShip ship={s} now={now} cheers={cheerCounts[s.id] ?? 0} comments={commentCounts[s.id] ?? 0} />
                    : <SidePreview ship={s} />}
                </div>
              )
            })}
          </div>
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

      {/* Join QR, tucked in the corner */}
      {joinUrl && (
        <div style={{ position: "absolute", right: spacing[6], bottom: spacing[6], display: "flex", alignItems: "center", gap: spacing[3], background: colors.surface, border: `1.5px solid ${colors.ink}`, borderRadius: radii.lg, padding: spacing[3], zIndex: 4 }}>
          <div style={{ background: "#fff", padding: 6, borderRadius: radii.sm, lineHeight: 0 }}>
            <QRCode value={joinUrl} size={84} bgColor="#ffffff" fgColor={colors.ink} />
          </div>
          <div style={{ maxWidth: 130 }}>
            <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.body, color: colors.ink, lineHeight: 1.1 }}>Join the build</div>
            <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft, marginTop: 3 }}>Scan to ship with the cohort</div>
          </div>
        </div>
      )}

      <style>{`@keyframes radarPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
    </div>
  )
}

/** The centre ship: big, full detail, with its image if it has one. */
function CenterShip({ ship, now, cheers, comments }: { ship: BuildLogRow; now: Date; cheers: number; comments: number }) {
  const isImage = !!ship.media_url && (ship.media_type?.startsWith("image/") ?? false)
  return (
    <div style={{ display: "flex", gap: "clamp(20px, 3vw, 56px)", alignItems: "center", justifyContent: "center", width: "100%", flexWrap: "wrap", padding: `0 clamp(${spacing[3]}px, 2vw, 32px)`, boxSizing: "border-box" }}>
      {isImage && (
        <div style={{ flex: "1 1 300px", maxWidth: 520, minWidth: 220 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ship.media_url!} alt="" style={{ width: "100%", maxHeight: "54vh", objectFit: "cover", borderRadius: radii.xl, border: `1.5px solid ${colors.ink}` }} />
        </div>
      )}
      <div style={{ flex: "1 1 360px", minWidth: 240, maxWidth: 680 }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3], marginBottom: spacing[4] }}>
          <Avatar name={ship.author_name ?? "Builder"} photo={ship.author_avatar} size={52} />
          <div>
            <div style={{ fontFamily: fonts.body, fontWeight: fontWeight.bold, fontSize: "clamp(19px, 2.2vw, 28px)", color: colors.ink, lineHeight: 1.1 }}>
              {ship.author_name ?? "Builder"}
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: fontSize.body, color: colors.mutedSoft, marginTop: 2 }}>
              {shipTime(ship.created_at, now)}
            </div>
          </div>
        </div>
        <p style={{ margin: 0, fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: "clamp(24px, 3.2vw, 46px)", lineHeight: 1.12, letterSpacing: "-0.02em", color: colors.ink }}>
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

/** A neighbour peeking in: author + a clamped note. */
function SidePreview({ ship }: { ship: BuildLogRow }) {
  return (
    <div aria-hidden style={{ width: "min(88%, 460px)", background: colors.panel, border: `1.5px solid ${colors.line}`, borderRadius: radii.xl, padding: spacing[5], boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: spacing[3] }}>
        <Avatar name={ship.author_name ?? "Builder"} photo={ship.author_avatar} size={36} />
        <span style={{ fontFamily: fonts.body, fontWeight: fontWeight.semibold, fontSize: "clamp(15px, 1.4vw, 20px)", color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ship.author_name ?? "Builder"}
        </span>
      </div>
      <p style={{ margin: 0, fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: "clamp(17px, 1.8vw, 26px)", lineHeight: 1.2, color: colors.ink, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {ship.note}
      </p>
    </div>
  )
}

export default ShipCarousel
