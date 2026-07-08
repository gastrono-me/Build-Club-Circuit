"use client"

import React from "react"
import { colors, fonts, fontSize, radii } from "@/lib/design/tokens"

/**
 * A small badge for a ship's type. Renders nothing for the default "Update"
 * (most ships are updates — badging them all would be noise), so a Feature or
 * Milestone stands out precisely because it's rarer.
 */
export function ShipKindBadge({ kind }: { kind: string }) {
  if (!kind || kind === "Update") return null
  const tone = kind === "Milestone"
    ? { bg: colors.goSoft, fg: colors.go }
    : { bg: colors.violetSoft, fg: colors.violet }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: radii.pill,
        background: tone.bg,
        color: tone.fg,
        fontFamily: fonts.mono,
        fontSize: fontSize.micro,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {kind}
    </span>
  )
}

export default ShipKindBadge
