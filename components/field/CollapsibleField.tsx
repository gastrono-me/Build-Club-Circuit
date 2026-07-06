"use client"

import React from "react"
import { colors, fonts, fontSize, spacing } from "@/lib/design/tokens"

/** One shared preference: hiding the field on either Explore tab hides both. */
const STORAGE_KEY = "circuit.fieldHidden"

/**
 * Wraps an embedding-field plot with a quiet show/hide toggle, persisted in
 * localStorage. For builders (especially on phones) who come to scan the list,
 * the field is a lens they can put down - without the tabs losing their
 * mirrored structure.
 */
export function CollapsibleField({ children }: { children: React.ReactNode }) {
  // Start visible (matches the server render), then adopt the stored
  // preference on mount - a brief flash beats a hydration mismatch.
  const [hidden, setHidden] = React.useState(false)
  React.useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") setHidden(true)
  }, [])

  function toggle() {
    setHidden((h) => {
      const next = !h
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      } catch { /* private mode etc. - preference just won't persist */ }
      return next
    })
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: spacing[2] }}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!hidden}
          style={{
            border: "none",
            background: "transparent",
            color: colors.mutedSoft,
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {hidden ? "Show field" : "Hide field"}
        </button>
      </div>
      {!hidden && children}
    </div>
  )
}

export default CollapsibleField
