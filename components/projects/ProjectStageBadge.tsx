"use client"

import React from "react"
import { colors, fonts, fontSize, radii } from "@/lib/design/tokens"

/** A pill for a project's lifecycle stage. Renders nothing when unset. */
export function ProjectStageBadge({ stage }: { stage: string | null }) {
  if (!stage) return null
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: radii.pill,
        border: `1.4px solid ${colors.ink}`,
        background: "transparent",
        color: colors.ink,
        fontFamily: fonts.mono,
        fontSize: fontSize.micro,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {stage}
    </span>
  )
}

export default ProjectStageBadge
