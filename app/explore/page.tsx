"use client"

import React from "react"
import { useProfile } from "@/lib/hooks/useProfile"
import { RadarFeed } from "@/components/radar/RadarFeed"
import { colors, spacing } from "@/lib/design/tokens"

export default function ExplorePage() {
  const { loading } = useProfile()

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      />
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.surface,
        padding: spacing[4],
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: spacing[12] }}>
        {/* Browse-only: composing (ship + stuck) happens on Today. */}
        <RadarFeed compose={false} />
      </div>
    </div>
  )
}
