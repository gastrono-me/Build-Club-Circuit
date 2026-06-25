"use client"

import React from "react"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Countdown } from "@/components/deadline/Countdown"
import { Checklist } from "@/components/deadline/Checklist"
import { DevpostLink } from "@/components/deadline/DevpostLink"
import { ReadinessReview } from "@/components/deadline/ReadinessReview"
import { colors, spacing } from "@/lib/design/tokens"

export default function DeadlinePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.surface,
        padding: spacing[4],
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: spacing[6],
        }}
      >
        <SectionTitle kicker="deadline" title="Deadline Guardian" />
        <Countdown />
        <Checklist />
        <DevpostLink />
        <ReadinessReview />
      </div>
    </div>
  )
}
