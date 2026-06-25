"use client"

import React from "react"
import { useSimClock } from "@/lib/hooks/useSimClock"
import { useEventData } from "@/lib/data/useEventData"
import { useProfile } from "@/lib/hooks/useProfile"
import { useSavedSchedule } from "@/lib/hooks/useSavedSchedule"
import { fmt } from "@/lib/time"
import { Card } from "@/components/ui/Card"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Tag } from "@/components/ui/Tag"
import { ProfileNudge } from "@/components/now/ProfileNudge"
import { RadarPulse } from "@/components/now/RadarPulse"
import { Sparkles, Plus } from "lucide-react"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"
import type { Session } from "@/types/index"

const UP_NEXT_COUNT = 3

function SessionRow({ s, live }: { s: Session; live: boolean }) {
  return (
    <Card spine={live ? "live" : "violet"} style={{ marginBottom: spacing[2] }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: spacing[2],
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.heading,
              color: colors.ink,
              marginBottom: 2,
            }}
          >
            {s.title}
          </div>
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: fontSize.meta,
              color: colors.muted,
              marginBottom: spacing[1],
            }}
          >
            {s.by}
          </div>
          <div style={{ display: "flex", gap: spacing[1], flexWrap: "wrap" }}>
            {s.tags.slice(0, 3).map((t) => (
              <Tag key={t} tone={live ? "live" : "violet"}>
                {t}
              </Tag>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              color: live ? colors.live : colors.violet,
              fontWeight: fontWeight.medium,
            }}
          >
            {fmt(s.start)}
          </div>
          {live && (
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: fontSize.micro,
                color: colors.live,
                marginTop: 2,
              }}
            >
              NOW
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export function NowView() {
  const { day, mins } = useSimClock()
  const { sessions, days } = useEventData()
  const { profile } = useProfile()
  const { saved, toggle } = useSavedSchedule()

  const mySkills = new Set(profile?.skills ?? [])
  const nudge = sessions
    .filter(s => s.day === day && s.start > mins && !saved.has(s.id) && s.tags.some(t => mySkills.has(t)))
    .sort((a, b) => a.start - b.start)[0]

  const todaySessions = sessions.filter((s) => s.day === day)
  const liveSessions = todaySessions.filter((s) => s.start <= mins && mins < s.end)
  const upNext = todaySessions
    .filter((s) => s.start > mins)
    .sort((a, b) => a.start - b.start)
    .slice(0, UP_NEXT_COUNT)

  const currentDay = days.find((d) => d.idx === day)

  return (
    <div
      style={{
        padding: `${spacing[5]}px ${spacing[4]}px`,
        maxWidth: 680,
        margin: "0 auto",
      }}
    >
      <ProfileNudge />

      <SectionTitle
        kicker="Now + Upcoming"
        title={currentDay ? currentDay.label : `Day ${day + 1}`}
        note={currentDay ? `${currentDay.date} · ${currentDay.sub}` : undefined}
      />

      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.meta,
          color: colors.muted,
          marginBottom: spacing[5],
        }}
      >
        {fmt(mins)}
      </div>

      <RadarPulse />

      {liveSessions.length > 0 && (
        <section style={{ marginBottom: spacing[6] }}>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              color: colors.live,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: spacing[2],
            }}
          >
            Happening now
          </div>
          {liveSessions.map((s) => (
            <SessionRow key={s.id} s={s} live />
          ))}
        </section>
      )}

      {nudge && (
        <div style={{ background: colors.violet, color: colors.onDark, borderRadius: radii["2xl"], padding: 18, marginBottom: 24, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 38, height: 38, borderRadius: radii.md, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Sparkles size={20} /></div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, opacity: 0.8, letterSpacing: "0.06em" }}>MATCHES YOUR INTERESTS</div>
            <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, marginTop: 3 }}>{nudge.title}</div>
            <div style={{ fontSize: fontSize.meta, opacity: 0.9, marginTop: 2 }}>{fmt(nudge.start)} · {nudge.tags.filter(t => mySkills.has(t)).join(", ")}</div>
          </div>
          <button onClick={() => toggle(nudge.id)} style={{ background: colors.onDark, color: colors.violet, border: "none", borderRadius: radii.md, padding: "9px 14px", fontFamily: fonts.mono, fontWeight: fontWeight.semibold, fontSize: fontSize.meta, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Add to schedule</button>
        </div>
      )}

      {upNext.length > 0 && (
        <section>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              color: colors.muted,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: spacing[2],
            }}
          >
            Up next
          </div>
          {upNext.map((s) => (
            <SessionRow key={s.id} s={s} live={false} />
          ))}
        </section>
      )}

      {liveSessions.length === 0 && upNext.length === 0 && (
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.body,
            color: colors.muted,
            padding: `${spacing[8]}px 0`,
            textAlign: "center",
          }}
        >
          No more sessions today.
        </div>
      )}
    </div>
  )
}

export default NowView
