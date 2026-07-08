"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { X, FolderGit2 } from "lucide-react"
import { useBuildLog } from "@/lib/hooks/useBuildLog"
import { Avatar } from "@/components/shell/Avatar"
import { Tag } from "@/components/ui/Tag"
import { ShipKindBadge } from "@/components/radar/ShipKindBadge"
import { shipTime } from "@/lib/time"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

/** How long each ship holds on screen. */
const ROTATE_MS = 9000

/**
 * A full-screen, no-interaction carousel of recent ships for an IRL screen or
 * projector. Rotates through the recent feed automatically; new ships fold in
 * live (the feed is on the shared broadcast bus). Rendered as a fixed overlay
 * so it covers the app chrome.
 */
export function ShipCarousel() {
  const router = useRouter()
  const { posts, cheerCounts, commentCounts, loading } = useBuildLog()
  const [index, setIndex] = React.useState(0)
  const [now, setNow] = React.useState<Date>(() => new Date())

  // Bounded to the most recent set so the loop stays fresh.
  const ships = React.useMemo(() => posts.slice(0, 30), [posts])

  // Keep the index in range as the set changes.
  React.useEffect(() => {
    if (ships.length && index >= ships.length) setIndex(0)
  }, [ships.length, index])

  // Auto-advance + a ticking clock for the header.
  React.useEffect(() => {
    if (ships.length <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % ships.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [ships.length])
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Esc exits.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.push("/admin") }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])

  const ship = ships[index] ?? null
  const isImage = !!ship?.media_url && (ship.media_type?.startsWith("image/") ?? false)

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${spacing[4]}px ${spacing[6]}px`, borderBottom: `1.5px solid ${colors.ink}` }}>
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

      {/* Stage */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: `${spacing[6]}px clamp(${spacing[5]}px, 6vw, 120px)`, minHeight: 0 }}>
        {loading ? null : !ship ? (
          <div style={{ fontFamily: fonts.body, fontSize: "clamp(20px, 3vw, 30px)", color: colors.muted, textAlign: "center" }}>
            No ships logged yet. This screen lights up as the cohort ships.
          </div>
        ) : (
          <div
            key={ship.id}
            style={{
              display: "flex",
              gap: "clamp(24px, 5vw, 80px)",
              alignItems: "center",
              width: "100%",
              maxWidth: 1500,
              flexWrap: "wrap",
              justifyContent: "center",
              animation: "carouselIn 0.5s cubic-bezier(0.2,0,0,1)",
            }}
          >
            {isImage && (
              <div style={{ flex: "1 1 380px", maxWidth: 640, minWidth: 300 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ship.media_url!} alt="" style={{ width: "100%", maxHeight: "62vh", objectFit: "cover", borderRadius: radii.xl, border: `1.5px solid ${colors.ink}` }} />
              </div>
            )}

            <div style={{ flex: "1 1 440px", minWidth: 300, maxWidth: 760 }}>
              {/* author row */}
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

              {/* the ship */}
              <p style={{ margin: 0, fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.12, letterSpacing: "-0.02em", color: colors.ink }}>
                {ship.note}
              </p>

              {/* meta row */}
              <div style={{ display: "flex", alignItems: "center", gap: spacing[3], flexWrap: "wrap", marginTop: spacing[5] }}>
                <Tag tone="go">{ship.category}</Tag>
                <ShipKindBadge kind={ship.kind} />
                {ship.project_name && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: fonts.mono, fontSize: fontSize.body, color: colors.violet }}>
                    <FolderGit2 size={16} /> {ship.project_name}
                  </span>
                )}
                {(cheerCounts[ship.id] ?? 0) > 0 && (
                  <span style={{ fontFamily: fonts.mono, fontSize: fontSize.body, color: colors.go }}>👏 {cheerCounts[ship.id]}</span>
                )}
                {(commentCounts[ship.id] ?? 0) > 0 && (
                  <span style={{ fontFamily: fonts.mono, fontSize: fontSize.body, color: colors.muted }}>💬 {commentCounts[ship.id]}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer: progress dots */}
      {ships.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: spacing[4] }}>
          {ships.slice(0, 30).map((s, i) => (
            <span key={s.id} aria-hidden style={{ width: i === index ? 26 : 7, height: 7, borderRadius: 999, background: i === index ? colors.violet : colors.line, transition: "width 0.3s ease" }} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes radarPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }
        @keyframes carouselIn { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}

export default ShipCarousel
