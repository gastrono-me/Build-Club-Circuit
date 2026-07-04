"use client"

import React from "react"
import { Tag } from "@/components/ui/Tag"
import { ALL_TAGS, INDUSTRIES } from "@/types/index"
import { colors, fonts, fontSize, spacing } from "@/lib/design/tokens"

/** The two label dimensions a project can carry, and their option lists. */
export const LABEL_GROUPS = [
  { key: "industries" as const, label: "Industries", options: INDUSTRIES },
  { key: "tags" as const, label: "Tags", options: ALL_TAGS },
]

function groupHeading(text: string) {
  return (
    <div
      style={{
        fontFamily: fonts.mono,
        fontSize: fontSize.label,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: colors.muted,
        marginBottom: spacing[2],
      }}
    >
      {text}
    </div>
  )
}

/** Toggleable chip rows for picking a project's industries + tags. */
export function ProjectLabelPicker({
  industries,
  tags,
  onToggle,
}: {
  industries: string[]
  tags: string[]
  onToggle: (group: "industries" | "tags", value: string) => void
}) {
  const selected = { industries, tags }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[4] }}>
      {LABEL_GROUPS.map(({ key, label, options }) => (
        <div key={key}>
          {groupHeading(label)}
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2] }}>
            {options.map((opt) => (
              <Tag key={opt} active={selected[key].includes(opt)} onClick={() => onToggle(key, opt)}>
                {opt}
              </Tag>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Read-only chip row for a project's labels. Renders nothing when empty. */
export function ProjectLabelChips({
  industries,
  tags,
  max,
}: {
  industries: string[]
  tags: string[]
  max?: number
}) {
  const all = [
    ...industries.map((v) => ({ v, tone: "violet" as const })),
    ...tags.map((v) => ({ v, tone: "ink" as const })),
  ]
  if (all.length === 0) return null
  const shown = max ? all.slice(0, max) : all
  const overflow = all.length - shown.length

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2] }}>
      {shown.map(({ v, tone }) => (
        <Tag key={`${tone}-${v}`} tone={tone}>{v}</Tag>
      ))}
      {overflow > 0 && (
        <span style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.mutedSoft, alignSelf: "center" }}>
          +{overflow}
        </span>
      )}
    </div>
  )
}
