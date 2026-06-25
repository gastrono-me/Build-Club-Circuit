"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Check, Users as UsersIcon } from "lucide-react"
import { useEvents, type EventRow } from "@/lib/hooks/useEvents"
import { eventStatus, PHASE_ORDER, type EventPhase } from "@/lib/events/eventStatus"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

/**
 * Events as episodes. Lists every event with a real-time phase badge
 * (live/upcoming/ended) and a join/leave control. Joining is what links a
 * builder's persistent identity to an event; event-scoped Radar/Build Log feeds
 * build on top of this.
 */
export function EventsView() {
  const { events, joined, memberCounts, loading, join, leave } = useEvents()

  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])

  const sorted = useMemo(() => {
    if (!now) return events
    return [...events].sort((a, b) => {
      const pa = PHASE_ORDER[eventStatus(a.starts_at, a.ends_at, now).phase]
      const pb = PHASE_ORDER[eventStatus(b.starts_at, b.ends_at, now).phase]
      if (pa !== pb) return pa - pb
      return a.starts_at.localeCompare(b.starts_at)
    })
  }, [events, now])

  return (
    <div style={{ padding: `${spacing[5]}px ${spacing[4]}px`, maxWidth: 680, margin: "0 auto" }}>
      <SectionTitle
        kicker="Events"
        title="Episodes"
        note="Build Club events, past and upcoming. Join one to plug your build into it."
      />

      {loading || !now ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
          {sorted.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              now={now}
              joined={joined.has(e.id)}
              memberCount={memberCounts[e.id] ?? 0}
              onJoin={() => join(e.id)}
              onLeave={() => leave(e.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EventCard({
  event,
  now,
  joined,
  memberCount,
  onJoin,
  onLeave,
}: {
  event: EventRow
  now: Date
  joined: boolean
  memberCount: number
  onJoin: () => Promise<void>
  onLeave: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { phase, msUntilNext } = eventStatus(event.starts_at, event.ends_at, now)

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      await (joined ? onLeave() : onJoin())
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card spine={phase === "live" ? "live" : phase === "upcoming" ? "violet" : "none"}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: spacing[3] }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PhaseBadge phase={phase} msUntilNext={msUntilNext} />
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.heading,
              color: colors.ink,
              margin: `${spacing[2]}px 0 2px`,
            }}
          >
            {event.name}
          </div>
          {event.tagline && (
            <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted }}>
              {event.tagline}
            </div>
          )}
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              color: colors.muted,
              letterSpacing: "0.04em",
              marginTop: spacing[2],
              display: "flex",
              gap: spacing[3],
              flexWrap: "wrap",
            }}
          >
            <span>{fmtRange(event.starts_at, event.ends_at, now)}</span>
            {event.location && <span>{event.location}</span>}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <UsersIcon size={12} />
              {memberCount === 0 ? "Be the first" : `${memberCount} ${memberCount === 1 ? "builder" : "builders"}`}
            </span>
          </div>
          {error && (
            <p style={{ margin: `${spacing[2]}px 0 0`, fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.live }}>
              {error}
            </p>
          )}
        </div>

        {phase !== "ended" && (
          <Button
            variant={joined ? "secondary" : "accent"}
            size="sm"
            disabled={busy}
            onClick={toggle}
            icon={joined ? <Check size={14} /> : undefined}
            style={{ flexShrink: 0 }}
          >
            {busy ? "…" : joined ? "Joined" : "Join"}
          </Button>
        )}
      </div>
    </Card>
  )
}

function PhaseBadge({ phase, msUntilNext }: { phase: EventPhase; msUntilNext: number }) {
  const map: Record<EventPhase, { label: string; color: string; bg: string }> = {
    live: { label: "LIVE", color: colors.oxblood, bg: colors.liveSoft },
    upcoming: { label: "UPCOMING", color: colors.violet, bg: colors.violetSoft },
    ended: { label: "ENDED", color: colors.muted, bg: colors.paper2 },
  }
  const m = map[phase]
  const detail =
    phase === "live" ? `ends in ${fmtDuration(msUntilNext)}`
    : phase === "upcoming" ? `in ${fmtDuration(msUntilNext)}`
    : null

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: spacing[2] }}>
      <span
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.micro,
          fontWeight: fontWeight.semibold,
          letterSpacing: "0.08em",
          color: m.color,
          background: m.bg,
          padding: "2px 7px",
          borderRadius: radii.pill,
        }}
      >
        {m.label}
      </span>
      {detail && (
        <span style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft }}>{detail}</span>
      )}
    </div>
  )
}

function Loading() {
  return (
    <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.mutedSoft, letterSpacing: "0.06em", textAlign: "center", padding: `${spacing[8]}px 0` }}>
      Loading…
    </div>
  )
}

function Empty() {
  return (
    <div style={{ fontFamily: fonts.body, fontSize: fontSize.body, color: colors.muted, textAlign: "center", padding: `${spacing[8]}px 0` }}>
      No events yet.
    </div>
  )
}

/** "Jun 25 – Jun 29" (adds year when it differs from now's year). */
function fmtRange(startsAt: string, endsAt: string, now: Date): string {
  const s = new Date(startsAt)
  const e = new Date(endsAt)
  const sameYear = s.getFullYear() === e.getFullYear()
  const yr = s.getFullYear() === now.getFullYear()
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  const sStr = s.toLocaleDateString(undefined, opts)
  const eStr = e.toLocaleDateString(undefined, sameYear ? opts : { ...opts, year: "numeric" })
  const tail = yr && sameYear ? "" : ` ${e.getFullYear()}`
  return `${sStr} – ${eStr}${sameYear ? tail : ""}`
}

/** Coarse human duration: "3d", "5h", "12m", or "<1m". */
function fmtDuration(ms: number): string {
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "<1m"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export default EventsView
