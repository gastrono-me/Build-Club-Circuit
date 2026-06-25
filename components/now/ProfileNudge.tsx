"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { Sparkles, X } from "lucide-react"
import { useProfile } from "@/lib/hooks/useProfile"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

const DISMISS_KEY = "vector_profile_nudge_dismissed"

/** Incomplete enough that matching (Suggested for you, Clawbie) has nothing to work with. */
function isIncomplete(profile: { name: string; skills: string[]; industries: string[]; looking: string[] } | null): boolean {
  if (!profile) return false
  return !profile.name.trim() || profile.skills.length === 0
}

/**
 * Nudges a user with a blank/near-blank profile to fill it in, since People matching
 * and Clawbie's "who should I meet" both silently degrade to nothing when skills/
 * industries/looking are empty. Dismissal is per-session (sessionStorage), not
 * permanent, so the reminder resurfaces on the next visit if still incomplete.
 */
export function ProfileNudge() {
  const { profile, loading } = useProfile()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1")
  }, [])

  if (loading || dismissed || !isIncomplete(profile)) return null

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1")
    setDismissed(true)
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[3],
        background: colors.violetSoft,
        border: `1.5px solid ${colors.violet}`,
        borderRadius: radii.lg,
        padding: `${spacing[3]}px ${spacing[4]}px`,
        marginBottom: spacing[5],
      }}
    >
      <Sparkles size={18} color={colors.violet} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontFamily: fonts.body, fontWeight: fontWeight.medium, fontSize: fontSize.body, color: colors.ink }}>
          Finish your profile to get matched
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, marginTop: 2 }}>
          Add your skills and what you're looking for — it's what powers Suggested for you and Ask Clawbie.
        </div>
      </div>
      <Link
        href="/profile"
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          fontWeight: fontWeight.semibold,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: colors.onDark,
          background: colors.violet,
          borderRadius: radii.md,
          padding: "8px 14px",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Complete profile
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ background: "none", border: "none", cursor: "pointer", color: colors.muted, flexShrink: 0, display: "flex" }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

export default ProfileNudge
