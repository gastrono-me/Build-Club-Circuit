"use client"

import React from "react"
import { useProfile } from "@/lib/hooks/useProfile"
import { ProfileForm } from "@/components/profile/ProfileForm"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { colors, spacing } from "@/lib/design/tokens"

export default function ProfilePage() {
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
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <SectionTitle
          kicker="Your account"
          title="Profile"
          note="Visible to other attendees. Keep it honest."
        />
        <ProfileForm />
      </div>
    </div>
  )
}
