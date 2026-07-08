"use client"

import React from "react"
import { PROJECT_STAGES } from "@/lib/data/project-stages"
import { colors, fonts, fontSize, radii, spacing, motion } from "@/lib/design/tokens"

/** Labeled single-select for a project's lifecycle stage. "" = no stage. */
export function StageSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: colors.muted,
          marginBottom: spacing[2],
        }}
      >
        Stage <span style={{ color: colors.mutedSoft, textTransform: "none" }}>(optional)</span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontFamily: fonts.body,
          fontSize: fontSize.body,
          color: colors.ink,
          background: colors.paper2,
          border: `1.4px solid ${colors.line}`,
          borderRadius: radii.md,
          outline: "none",
          cursor: "pointer",
          appearance: "none",
          transition: `border-color ${motion.fast} ${motion.ease}`,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = colors.violet }}
        onBlur={(e) => { e.currentTarget.style.borderColor = colors.line }}
      >
        <option value="">No stage</option>
        {PROJECT_STAGES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  )
}

export default StageSelect
