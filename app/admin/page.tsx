"use client"

import React, { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useIsAdmin } from "@/lib/hooks/useIsAdmin"
import { AdminView } from "@/components/admin/AdminView"
import { colors, fonts, fontSize, spacing } from "@/lib/design/tokens"

export default function AdminPage() {
  const { isAdmin, loading } = useIsAdmin()
  const router = useRouter()

  // Non-admins never see admin UI. RLS is the real guard; this is the redirect.
  useEffect(() => {
    if (!loading && !isAdmin) router.replace("/events")
  }, [loading, isAdmin, router])

  if (loading || !isAdmin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          color: colors.mutedSoft,
          letterSpacing: "0.06em",
        }}
      >
        {loading ? "" : "Redirecting…"}
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.surface, padding: spacing[4] }}>
      <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: spacing[12] }}>
        <AdminView />
      </div>
    </div>
  )
}
