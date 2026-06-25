"use client"

import React, { useState } from "react"
import { useSimClock } from "@/lib/hooks/useSimClock"
import { useEventData } from "@/lib/data/useEventData"
import { fmt } from "@/lib/time"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Tag } from "@/components/ui/Tag"
import { CityMapSVG } from "./CityMapSVG"
import { BuildFloorPlanSVG } from "./BuildFloorPlanSVG"
import { colors, fonts, fontSize, fontWeight, spacing, radii } from "@/lib/design/tokens"

type TabId = 0 | 1 | 2 | "build"

const DAY_OPTIONS: { id: TabId; label: string }[] = [
  { id: 0,       label: "Day 1 · Jul 8" },
  { id: 1,       label: "Day 2 · Jul 9" },
  { id: 2,       label: "Day 3 · Jul 10" },
  { id: "build", label: "Build & Demo · Jul 11-12" },
]

const BUILD_ZONES = [
  { name: "Main Stage",         desc: "Keynotes, talks, and Demo Day presentations" },
  { name: "Build Zone A & B",   desc: "Team tables for heads-down building" },
  { name: "Mentor Lounge",      desc: "Drop in for help, roaming mentors" },
  { name: "Snacks & Coffee",    desc: "Fuel for the long sessions" },
  { name: "Quiet / Focus Room", desc: "Need silence? Head here" },
  { name: "Registration",       desc: "Check-in, badges, lost and found" },
]

function simDayToTab(day: number): TabId {
  if (day >= 3) return "build"
  return day as 0 | 1 | 2
}

export function MapsView() {
  const { day: simDay } = useSimClock()
  const { sessions, venues } = useEventData()
  const [selected, setSelected] = useState<TabId>(simDayToTab(simDay))

  const isBuild = selected === "build"
  const dayIndex = isBuild ? null : (selected as number)
  const daySessions = dayIndex !== null ? sessions.filter((s) => s.day === dayIndex) : []
  const activeKeys = new Set(daySessions.map((s) => s.venue))
  const venuesToday = [...activeKeys].map((k) => ({
    key: k,
    ...venues[k],
    sessions: daySessions.filter((s) => s.venue === k).sort((a, b) => a.start - b.start),
  }))

  return (
    <div
      style={{
        padding: `${spacing[5]}px ${spacing[4]}px`,
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <SectionTitle
        kicker="Find your way"
        title="Maps & venues"
        note="Illustrative layouts. Exact floor plans are confirmed closer to the event; venues and zones are real."
      />

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: spacing[4] }}>
        {DAY_OPTIONS.map((d) => (
          <Tag
            key={String(d.id)}
            active={selected === d.id}
            onClick={() => setSelected(d.id)}
          >
            {d.label}
          </Tag>
        ))}
      </div>

      <div
        style={{
          background: colors.panel,
          border: `1px solid ${colors.line}`,
          borderRadius: radii.xl,
          padding: spacing[4],
          marginBottom: spacing[5],
        }}
      >
        {isBuild ? <BuildFloorPlanSVG /> : <CityMapSVG activeKeys={activeKeys} />}
      </div>

      {isBuild ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: spacing[2],
          }}
        >
          {BUILD_ZONES.map((z) => (
            <div
              key={z.name}
              style={{
                background: colors.panel,
                border: `1px solid ${colors.line}`,
                borderRadius: radii.lg,
                padding: spacing[3],
              }}
            >
              <div
                style={{
                  fontFamily: fonts.display,
                  fontWeight: fontWeight.semibold,
                  fontSize: fontSize.body,
                  color: colors.ink,
                }}
              >
                {z.name}
              </div>
              <div
                style={{
                  fontFamily: fonts.body,
                  fontSize: fontSize.meta,
                  color: colors.muted,
                  marginTop: 3,
                }}
              >
                {z.desc}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: spacing[3] }}>
          {venuesToday.map((v) => (
            <div
              key={v.key}
              style={{
                background: colors.panel,
                border: `1px solid ${colors.line}`,
                borderRadius: radii.xl,
                padding: spacing[4],
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: spacing[2],
                  flexWrap: "wrap",
                  gap: spacing[1],
                }}
              >
                <span
                  style={{
                    fontFamily: fonts.display,
                    fontWeight: fontWeight.semibold,
                    fontSize: 15,
                    color: colors.ink,
                  }}
                >
                  {v.name}
                </span>
                <span
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: fontSize.label,
                    color: colors.muted,
                  }}
                >
                  {v.area}{v.main ? " · main venue" : ""}
                </span>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {v.sessions.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      gap: spacing[2],
                      alignItems: "baseline",
                      fontSize: fontSize.body,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: fontSize.label,
                        color: colors.violet,
                        flexShrink: 0,
                        width: 78,
                      }}
                    >
                      {fmt(s.start)}
                    </span>
                    <span style={{ color: colors.ink }}>{s.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MapsView
