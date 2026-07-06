"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Users as UsersIcon } from "lucide-react"
import { useEvents } from "@/lib/hooks/useEvents"
import { eventStatus, type EventPhase } from "@/lib/events/eventStatus"
import { RadarFeed } from "@/components/radar/RadarFeed"
import { SpotlightRail } from "@/components/spotlight/SpotlightRail"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Button } from "@/components/ui/Button"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"
import { useBuildLog } from "@/lib/hooks/useBuildLog"
import { useNow } from "@/lib/hooks/useNow"
import { useSocial } from "@/components/shell/SocialProvider"

type Scope = "event" | "all"

/**
 * One event's episode page: its own Radar + Build Log, scoped to posts made
 * while inside this event. The scope toggle rolls the same feed back up to
 * every builder's posts (event-scoped or not) for comparison.
 */
export function EventDetailView({ slug }: { slug: string }) {
  const { events, joined, memberCounts, loading, join, leave } = useEvents()
  const now = useNow()
  const [scope, setScope] = useState<Scope>("event")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const event = useMemo(() => events.find((e) => e.slug === slug) ?? null, [events, slug])

  const railEventId = scope === "event" ? (event?.id ?? null) : null
  // browse:false — the rail only shows today's ships; RadarFeed below fetches its own feed.
  const { todayPosts, cheerCounts, commentCounts, mineCheers, toggleCheer, userId } = useBuildLog(railEventId, { browse: false })
  const { openPanel } = useSocial()

  if (loading || !now) {
    return (
      <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.mutedSoft, letterSpacing: "0.06em", textAlign: "center", padding: `${spacing[8]}px 0` }}>
        Loading…
      </div>
    )
  }

  if (!event) {
    return (
      <div style={{ padding: `${spacing[5]}px ${spacing[4]}px`, maxWidth: 680, margin: "0 auto" }}>
        <SectionTitle kicker="Events" title="Not found" note="This event doesn't exist or has been removed." />
        <Link href="/events" style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.violet }}>
          ← Back to events
        </Link>
      </div>
    )
  }

  const eventId = event.id
  const { phase } = eventStatus(event.starts_at, event.ends_at, now)
  const isJoined = joined.has(event.id)
  const memberCount = memberCounts[event.id] ?? 0

  async function toggleJoin() {
    setBusy(true)
    setError(null)
    try {
      await (isJoined ? leave(eventId) : join(eventId))
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: `${spacing[5]}px ${spacing[4]}px`, maxWidth: 760, margin: "0 auto" }}>
      <Link
        href="/events"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          color: colors.muted,
          letterSpacing: "0.05em",
          marginBottom: spacing[4],
        }}
      >
        <ArrowLeft size={13} /> Events
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: spacing[3], marginBottom: spacing[5] }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PhaseBadge phase={phase} />
          <h1
            style={{
              fontFamily: fonts.display,
              fontWeight: fontWeight.semibold,
              fontSize: "clamp(30px, 7vw, 44px)",
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              margin: `${spacing[2]}px 0 2px`,
              color: colors.ink,
            }}
          >
            {event.name}
          </h1>
          {event.tagline && (
            <p style={{ margin: 0, fontFamily: fonts.body, fontSize: fontSize.body, color: colors.muted }}>
              {event.tagline}
            </p>
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
            variant={isJoined ? "secondary" : "accent"}
            size="sm"
            disabled={busy}
            onClick={toggleJoin}
            icon={isJoined ? <Check size={14} /> : undefined}
            style={{ flexShrink: 0 }}
          >
            {busy ? "…" : isJoined ? "Joined" : "Join"}
          </Button>
        )}
      </div>

      {/* Event-scoped vs global roll-up toggle */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          background: colors.line,
          borderRadius: radii.pill,
          padding: 2,
          marginBottom: spacing[5],
        }}
      >
        {([
          { key: "event" as Scope, label: "This event" },
          { key: "all" as Scope, label: "All builders" },
        ]).map(({ key, label }) => {
          const active = scope === key
          return (
            <button
              key={key}
              onClick={() => setScope(key)}
              style={{
                fontFamily: fonts.mono,
                fontSize: fontSize.label,
                fontWeight: fontWeight.semibold,
                padding: `${spacing[1]}px ${spacing[3]}px`,
                borderRadius: radii.pill,
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.05em",
                lineHeight: 1.4,
                background: active ? colors.violet : "transparent",
                color: active ? colors.onDark : colors.mutedSoft,
                textTransform: "uppercase",
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {now && (
        <SpotlightRail
          posts={todayPosts}
          now={now}
          label={scope === "event" ? "Shipped in this event" : "Shipped today"}
          interactive
          currentUserId={userId}
          cheerCounts={cheerCounts}
          commentCounts={commentCounts}
          mineCheers={mineCheers}
          onCheer={toggleCheer}
          onMessage={(p) =>
            openPanel(
              { id: p.author_id, name: p.author_name ?? "Builder", avatar: p.author_avatar },
              "chat",
            )
          }
        />
      )}

      <RadarFeed eventId={scope === "event" ? event.id : null} />
    </div>
  )
}

function PhaseBadge({ phase }: { phase: EventPhase }) {
  const map: Record<EventPhase, { label: string; color: string; bg: string }> = {
    live: { label: "LIVE", color: colors.oxblood, bg: colors.liveSoft },
    upcoming: { label: "UPCOMING", color: colors.violet, bg: colors.violetSoft },
    ended: { label: "ENDED", color: colors.muted, bg: colors.paper2 },
  }
  const m = map[phase]
  return (
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
        display: "inline-block",
      }}
    >
      {m.label}
    </span>
  )
}

export default EventDetailView
