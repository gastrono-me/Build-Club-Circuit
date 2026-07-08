"use client"

import React from "react"
import Link from "next/link"
import { Sparkles, X } from "lucide-react"
import { useProfile } from "@/lib/hooks/useProfile"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

const DISMISS_KEY = "circuit.profileNudgeDismissed"

/**
 * A quiet, dismissible Today nudge for builders whose profile is still thin
 * (no skills and no industries) — usually people who skipped onboarding. An
 * empty profile is invisible to People matching, so this recovers that value
 * without nagging: one dismissal and it's gone.
 */
export function ProfileNudge() {
  const { profile, loading } = useProfile()
  const [dismissed, setDismissed] = React.useState(true) // assume dismissed until we read storage
  React.useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1")
  }, [])

  const thin = !!profile && (profile.skills?.length ?? 0) === 0 && (profile.industries?.length ?? 0) === 0
  if (loading || !thin || dismissed) return null

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1") } catch { /* private mode */ }
    setDismissed(true)
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing[3], padding: `${spacing[3]}px ${spacing[3]}px`, marginBottom: spacing[5], borderRadius: radii.lg, background: colors.violetSoft, border: `1.4px solid ${colors.violet}` }}>
      <Sparkles size={17} color={colors.violet} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.ink }}>
        Add your skills and industries so the cohort can find and match with you.{" "}
        <Link href="/profile" style={{ color: colors.violet, fontWeight: fontWeight.semibold, textDecoration: "none" }}>Finish your profile →</Link>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" style={{ border: "none", background: "transparent", color: colors.muted, cursor: "pointer", display: "flex", flexShrink: 0, padding: 2 }}>
        <X size={15} />
      </button>
    </div>
  )
}

export default ProfileNudge
