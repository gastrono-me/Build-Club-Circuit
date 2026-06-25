"use client"

import React from "react"
import { PeopleDirectory } from "@/components/people/PeopleDirectory"
import { colors, spacing } from "@/lib/design/tokens"

export default function PeoplePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.surface,
        padding: spacing[4],
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <PeopleDirectory />
      </div>
    </div>
  )
}
