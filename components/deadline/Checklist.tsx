"use client"

import React from "react"
import { useChecklist } from "@/lib/hooks/useChecklist"
import { Card } from "@/components/ui/Card"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"
import { CHECKLIST_ITEMS as ITEMS } from "@/lib/config/event"

export function Checklist() {
  const { checked, toggle, loading } = useChecklist(ITEMS.map(i => i.id))
  const total = ITEMS.length
  const done = checked.size
  const pct = total > 0 ? (done / total) * 100 : 0

  return (
    <Card spine="violet">
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontFamily: fonts.body,
              fontSize: fontSize.heading,
              fontWeight: fontWeight.semibold,
              color: colors.ink,
            }}
          >
            Submission Checklist
          </span>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.meta,
              fontWeight: fontWeight.medium,
              color: colors.muted,
            }}
          >
            {done}/{total}
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 6,
            borderRadius: radii.pill,
            background: colors.line,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: colors.go,
              borderRadius: radii.pill,
              transition: "width 200ms ease",
            }}
          />
        </div>

        {/* Items */}
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}>
          {ITEMS.map(item => {
            const isChecked = checked.has(item.id)
            const isOptional = item.id === "github-repo"
            return (
              <label
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: spacing[2],
                  cursor: loading ? "not-allowed" : "pointer",
                  padding: `${spacing[1]}px 0`,
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={loading}
                  onChange={() => toggle(item.id)}
                  style={{
                    marginTop: 2,
                    flexShrink: 0,
                    accentColor: colors.go,
                    width: 16,
                    height: 16,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                />
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span
                    style={{
                      fontFamily: fonts.body,
                      fontSize: fontSize.body,
                      fontWeight: fontWeight.regular,
                      color: isChecked ? colors.muted : colors.ink,
                      textDecoration: isChecked ? "line-through" : "none",
                    }}
                  >
                    {item.label}
                  </span>
                  {isOptional && (
                    <span
                      style={{
                        fontFamily: fonts.body,
                        fontSize: fontSize.meta,
                        color: colors.mutedSoft,
                      }}
                    >
                      optional
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

export default Checklist
