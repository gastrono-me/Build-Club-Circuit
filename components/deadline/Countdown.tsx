"use client"

import React from "react"
import { useSimClock } from "@/lib/hooks/useSimClock"
import { toAbsoluteMinutes } from "@/lib/time"
import { Card } from "@/components/ui/Card"
import { colors, fonts, fontSize, fontWeight, spacing } from "@/lib/design/tokens"
import { DEMO_DAY_DEADLINE as DEADLINE } from "@/lib/config/event"

export function Countdown() {
  const { day, mins } = useSimClock()
  const remaining = toAbsoluteMinutes(DEADLINE) - toAbsoluteMinutes({ day, mins })

  const safeRemaining = Math.max(0, remaining)
  const d = Math.floor(safeRemaining / 1440)
  const h = Math.floor((safeRemaining % 1440) / 60)
  const m = safeRemaining % 60

  return (
    <Card spine="ink">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: spacing[2],
          padding: `${spacing[2]}px 0`,
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            fontWeight: fontWeight.medium,
            color: colors.muted,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Time to Demo Day
        </span>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 52,
            fontWeight: fontWeight.bold,
            color: colors.ink,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {remaining <= 0 ? "Time's up" : `${d}d ${h}h ${m}m`}
        </span>
      </div>
    </Card>
  )
}

export default Countdown
