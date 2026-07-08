"use client"

import React from "react"
import Link from "next/link"
import { CalendarRange, Check, ArrowRight } from "lucide-react"
import { useEvents } from "@/lib/hooks/useEvents"
import { eventStatus } from "@/lib/events/eventStatus"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

/** How many live/upcoming events to surface on Today. */
const SHOWN = 3

/**
 * A compact Today strip surfacing live + upcoming events with a one-tap join.
 * Hidden entirely when there's nothing current to join, so it never clutters
 * the daily surface. Joining is what plugs your build into the event.
 */
export function UpcomingEventsStrip({ now }: { now: Date }) {
  const { events, joined, memberCounts, loading, join, leave } = useEvents()
  const [busy, setBusy] = React.useState<string | null>(null)

  // Live first, then upcoming soonest-first. Ended events don't appear here.
  const current = React.useMemo(() => {
    return events
      .map((e) => ({ e, phase: eventStatus(e.starts_at, e.ends_at, now).phase }))
      .filter((x) => x.phase !== "ended")
      .sort((a, b) => {
        if (a.phase !== b.phase) return a.phase === "live" ? -1 : 1
        return a.e.starts_at.localeCompare(b.e.starts_at)
      })
      .slice(0, SHOWN)
  }, [events, now])

  async function toggle(id: string, isJoined: boolean) {
    setBusy(id)
    try { await (isJoined ? leave(id) : join(id)) }
    catch (err) { console.error("[events] join/leave failed:", err) }
    finally { setBusy(null) }
  }

  if (loading || current.length === 0) return null

  return (
    <section aria-label="Events" style={{ marginBottom: spacing[6] }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: spacing[2], marginBottom: spacing[3] }}>
        <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.muted }}>
          Events
        </div>
        <Link href="/events" style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.violet, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
          All events <ArrowRight size={12} />
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
        {current.map(({ e, phase }) => {
          const isJoined = joined.has(e.id)
          const live = phase === "live"
          return (
            <div
              key={e.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing[3],
                padding: `${spacing[3]}px ${spacing[3]}px`,
                border: `1.4px solid ${colors.line}`,
                borderRadius: radii.lg,
                background: colors.panel,
              }}
            >
              <CalendarRange size={17} color={live ? colors.go : colors.violet} style={{ flexShrink: 0 }} />
              <Link href={`/events/${e.slug}`} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
                  <span style={{ fontFamily: fonts.body, fontWeight: fontWeight.semibold, fontSize: fontSize.body, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.name}
                  </span>
                  <span style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, letterSpacing: "0.06em", textTransform: "uppercase", color: live ? colors.go : colors.violet, background: live ? colors.goSoft : colors.violetSoft, borderRadius: radii.pill, padding: "1px 8px", flexShrink: 0 }}>
                    {live ? "Live" : "Upcoming"}
                  </span>
                </div>
                <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft, marginTop: 2 }}>
                  {whenLabel(e.starts_at, e.ends_at, now)} · {memberCounts[e.id] ?? 0} in
                </div>
              </Link>
              <button
                type="button"
                onClick={() => toggle(e.id, isJoined)}
                disabled={busy === e.id}
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  border: `1.5px solid ${isJoined ? colors.go : colors.ink}`,
                  background: isJoined ? colors.goSoft : "transparent",
                  color: isJoined ? colors.go : colors.ink,
                  borderRadius: radii.md,
                  padding: "6px 12px",
                  fontFamily: fonts.mono,
                  fontSize: fontSize.label,
                  fontWeight: fontWeight.semibold,
                  letterSpacing: "0.04em",
                  cursor: busy === e.id ? "wait" : "pointer",
                }}
              >
                {isJoined ? <><Check size={13} /> Joined</> : "Join"}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** "starts in 3 days" / "ends today" style label. */
function whenLabel(startsAt: string, endsAt: string, now: Date): string {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (now < start) {
    const days = Math.round((start.getTime() - now.getTime()) / 86_400_000)
    if (days <= 0) return "starts today"
    if (days === 1) return "starts tomorrow"
    return `starts in ${days} days`
  }
  const days = Math.round((end.getTime() - now.getTime()) / 86_400_000)
  if (days <= 0) return "ends today"
  if (days === 1) return "ends tomorrow"
  return `${days} days left`
}

export default UpcomingEventsStrip
