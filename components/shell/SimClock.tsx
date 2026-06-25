"use client"

import React from "react"
import { useSimClock } from "@/lib/hooks/useSimClock"
import { DAYS } from "@/lib/data/days"
import { fmt } from "@/lib/time"
import { colors, fonts, fontSize, fontWeight, spacing, radii } from "@/lib/design/tokens"

export function SimClock() {
  const { day, mins, setDay, setMins } = useSimClock()

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[2],
        flexShrink: 0,
      }}
    >
      <select
        value={day}
        onChange={e => setDay(Number(e.target.value))}
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          color: colors.ink,
          background: colors.surface,
          border: `1px solid ${colors.line}`,
          borderRadius: radii.sm,
          padding: `2px ${spacing[2]}px`,
          cursor: "pointer",
          outline: "none",
        }}
      >
        {DAYS.map(d => (
          <option key={d.idx} value={d.idx}>
            {d.label}
          </option>
        ))}
      </select>

      <input
        type="range"
        min={480}
        max={1380}
        step={15}
        value={mins}
        onChange={e => setMins(Number(e.target.value))}
        style={{
          width: 80,
          cursor: "pointer",
          accentColor: colors.violet,
        }}
      />

      <span
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          fontWeight: fontWeight.medium,
          color: colors.ink,
          minWidth: 60,
          textAlign: "right",
        }}
      >
        {fmt(mins)}
      </span>
    </div>
  )
}

export default SimClock
