"use client"

import React, { useState } from "react"
import { useEventData } from "@/lib/data/useEventData"
import { useSimClock } from "@/lib/hooks/useSimClock"
import { useSavedSchedule } from "@/lib/hooks/useSavedSchedule"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Tag } from "@/components/ui/Tag"
import { SessionCard } from "@/components/discover/SessionCard"
import { colors, fonts, fontSize, spacing } from "@/lib/design/tokens"

export function Calendar() {
  const { sessions, tbaSessions, days, venues } = useEventData()
  const { day: simDay, mins: simMins } = useSimClock()
  const { saved, toggle } = useSavedSchedule()

  const [selectedDay, setSelectedDay] = useState<number>(simDay)

  // Filter sessions by selected day, sorted by start time
  const daySessions = sessions
    .filter(s => s.day === selectedDay)
    .sort((a, b) => a.start - b.start)

  return (
    <div>
      <SectionTitle kicker="EVENT CALENDAR" title="Schedule" />

      {/* Day filter chips */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spacing[2],
          marginBottom: spacing[5],
        }}
      >
        {days.map(d => (
          <Tag
            key={d.idx}
            tone="violet"
            active={selectedDay === d.idx}
            onClick={() => setSelectedDay(d.idx)}
          >
            {d.label}
          </Tag>
        ))}
      </div>

      {/* Sessions list */}
      {daySessions.length === 0 ? (
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.body,
            color: colors.muted,
            padding: `${spacing[8]}px 0`,
            textAlign: "center",
          }}
        >
          No sessions scheduled for this day.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
          {daySessions.map(session => {
            const isLive =
              session.day === simDay &&
              session.start <= simMins &&
              session.end > simMins
            const venueName = venues[session.venue]?.name ?? session.venue
            return (
              <SessionCard
                key={session.id}
                session={session}
                isLive={isLive}
                isSaved={saved.has(session.id)}
                onToggleSave={() => toggle(session.id)}
                venueName={venueName}
              />
            )
          })}
        </div>
      )}

      {/* Sessions without a published time slot yet */}
      {tbaSessions.length > 0 && (
        <>
          <SectionTitle kicker="MORE SESSIONS" title="Time TBA" />
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
            {tbaSessions.map(session => {
              const venueName = venues[session.venue]?.name ?? session.venue
              return (
                <SessionCard
                  key={session.id}
                  session={session}
                  isLive={false}
                  isSaved={false}
                  onToggleSave={undefined}
                  venueName={venueName}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default Calendar
