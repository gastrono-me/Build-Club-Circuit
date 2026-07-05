"use client"

import React from "react"
import { Link2, Plus, X } from "lucide-react"
import { colors, fonts, fontSize, radii, spacing, motion } from "@/lib/design/tokens"

/**
 * Edits a project's list of links (website, repo, demo, socials). Operates
 * purely on a string[] of raw URLs; the parent normalizes/filters on save.
 * Shared by the create form and the project edit form.
 */
export function LinksEditor({
  links,
  onChange,
  label = "Links (optional)",
}: {
  links: string[]
  onChange: (links: string[]) => void
  label?: string
}) {
  function setAt(i: number, value: string) {
    onChange(links.map((l, idx) => (idx === i ? value : l)))
  }
  function removeAt(i: number) {
    onChange(links.filter((_, idx) => idx !== i))
  }
  function add() {
    onChange([...links, ""])
  }

  return (
    <div>
      <span
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
        {label}
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
        {links.map((link, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: colors.paper2,
                border: `1.4px solid ${colors.line}`,
                borderRadius: radii.md,
                padding: "0 12px",
                transition: `border-color ${motion.fast} ${motion.ease}`,
              }}
              onFocusCapture={(e) => { e.currentTarget.style.borderColor = colors.violet }}
              onBlurCapture={(e) => { e.currentTarget.style.borderColor = colors.line }}
            >
              <Link2 size={15} color={colors.mutedSoft} style={{ flexShrink: 0 }} />
              <input
                type="url"
                inputMode="url"
                value={link}
                onChange={(e) => setAt(i, e.target.value)}
                placeholder="Website, repo, or demo"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: colors.ink,
                  fontFamily: fonts.body,
                  fontSize: fontSize.body,
                  padding: "11px 0",
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="Remove link"
              style={{ border: "none", background: "transparent", color: colors.muted, cursor: "pointer", display: "flex", flexShrink: 0, padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={add}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            border: `1.4px solid ${colors.line}`,
            background: colors.surface,
            color: colors.muted,
            borderRadius: radii.md,
            padding: "6px 11px",
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            cursor: "pointer",
          }}
        >
          <Plus size={13} /> {links.length ? "Add another link" : "Add a link"}
        </button>
      </div>
    </div>
  )
}

export default LinksEditor
