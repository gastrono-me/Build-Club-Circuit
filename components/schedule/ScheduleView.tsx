"use client"

import React from "react"
import Link from "next/link"
import { useEventData } from "@/lib/data/useEventData"
import { useSimClock } from "@/lib/hooks/useSimClock"
import { useSavedSchedule } from "@/lib/hooks/useSavedSchedule"
import { useSocial } from "@/components/shell/SocialProvider"
import { conflictIds } from "@/lib/schedule"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Tag } from "@/components/ui/Tag"
import { Button } from "@/components/ui/Button"
import { SessionCard } from "@/components/discover/SessionCard"
import { Avatar } from "@/components/shell/Avatar"
import { fmt } from "@/lib/time"
import { colors, fonts, fontSize, fontWeight, letterSpacing, radii, spacing } from "@/lib/design/tokens"

export function ScheduleView() {
  const { sessions, days, venues } = useEventData()
  const { day: simDay, mins: simMins } = useSimClock()
  const { saved, toggle, loading } = useSavedSchedule()
  const { catchups, cancelCatchup } = useSocial()

  // Filter to saved sessions only
  const savedSessions = sessions.filter(s => saved.has(s.id))

  // Compute conflicts
  const conflicts = conflictIds(savedSessions)

  // Group by day, sorted by start within each day
  const byDay = new Map<number, typeof savedSessions>()
  for (const session of savedSessions) {
    if (!byDay.has(session.day)) byDay.set(session.day, [])
    byDay.get(session.day)!.push(session)
  }
  // Sort sessions within each day by start time
  for (const [, list] of byDay) {
    list.sort((a, b) => a.start - b.start)
  }
  // Merge catchups into the per-day groups as pseudo-items.
  for (const c of catchups) {
    if (!byDay.has(c.day)) byDay.set(c.day, [])
  }
  // Get sorted day indices
  const sortedDayIndices = Array.from(byDay.keys()).sort((a, b) => a - b)

  return (
    <div>
      <SectionTitle kicker="MY SCHEDULE" title="Saved Sessions" />

      {/* Conflict warning */}
      {conflicts.size > 0 && (
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.body,
            color: colors.live,
            marginBottom: spacing[4],
            padding: `${spacing[3]}px ${spacing[4]}px`,
            background: colors.liveSoft,
            borderRadius: radii.sm,
            border: `1px solid ${colors.live}`,
          }}
        >
          Some sessions overlap. Check the conflicts below.
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: fontSize.meta,
            color: colors.mutedSoft,
            marginBottom: spacing[4],
          }}
        >
          Loading saved sessions…
        </div>
      )}

      {/* Empty state */}
      {!loading && savedSessions.length === 0 && catchups.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: `${spacing[12]}px 0`,
          }}
        >
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: fontSize.body,
              color: colors.muted,
              marginBottom: spacing[3],
            }}
          >
            Nothing saved yet.
          </div>
          <Link
            href="/discover"
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.meta,
              color: colors.violet,
              textDecoration: "none",
              fontWeight: fontWeight.medium,
              letterSpacing: letterSpacing.tag,
            }}
          >
            Browse the schedule →
          </Link>
        </div>
      )}

      {/* Day groups */}
      {sortedDayIndices.map(dayIdx => {
        const daySessions = byDay.get(dayIdx)!
        const dayMeta = days.find(d => d.idx === dayIdx)
        return (
          <div key={dayIdx} style={{ marginBottom: spacing[8] }}>
            {/* Day sub-header */}
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: fontSize.label,
                fontWeight: fontWeight.semibold,
                color: colors.muted,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: spacing[3],
                paddingBottom: spacing[2],
                borderBottom: `1px solid ${colors.line}`,
              }}
            >
              {dayMeta ? dayMeta.label : `Day ${dayIdx + 1}`}
            </div>

            {/* Sessions in day */}
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
              {daySessions.map(session => {
                const isLive =
                  session.day === simDay &&
                  session.start <= simMins &&
                  session.end > simMins
                const venueName = venues[session.venue]?.name ?? session.venue
                const hasConflict = conflicts.has(session.id)
                return (
                  <div key={session.id}>
                    <SessionCard
                      session={session}
                      isLive={isLive}
                      isSaved={true}
                      onToggleSave={() => toggle(session.id)}
                      venueName={venueName}
                    />
                    {hasConflict && (
                      <div style={{ marginTop: spacing[1] }}>
                        <Tag tone="live">Clashes</Tag>
                      </div>
                    )}
                  </div>
                )
              })}
              {catchups.filter(c => c.day === dayIdx).sort((a, b) => a.start_min - b.start_min).map(c => {
                const resolvedName = c.otherName ?? "Builder"
                return (
                  <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "center", background: colors.surface, border: `1.5px solid ${colors.line}`, borderRadius: radii.xl, padding: 16, marginBottom: spacing[3] }}>
                    <Avatar name={resolvedName} photo={c.otherAvatar} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.go, textTransform: "uppercase", letterSpacing: "0.06em" }}>1:1 Catchup</div>
                      <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, color: colors.ink }}>{resolvedName}</div>
                      <div style={{ fontFamily: fonts.mono, fontSize: fontSize.meta, color: colors.ink, marginTop: 6 }}>{fmt(c.start_min)}–{fmt(c.end_min)}</div>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => cancelCatchup(c.id)}>Cancel</Button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ScheduleView
