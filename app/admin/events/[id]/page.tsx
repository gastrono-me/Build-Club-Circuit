"use client"

import React, { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { EventOperations } from "@/components/admin/EventOperations"
import { useIsAdmin } from "@/lib/hooks/useIsAdmin"
import { colors, fonts, fontSize, spacing } from "@/lib/design/tokens"

export default function EventOperationsPage() {
  const params = useParams<{ id: string }>()
  const { isAdmin, loading } = useIsAdmin()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAdmin) router.replace("/events")
  }, [loading, isAdmin, router])

  if (loading || !isAdmin) return <div style={{ minHeight: "100vh", fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.muted, padding: spacing[8] }}>{loading ? "" : "Redirecting…"}</div>

  return <div style={{ maxWidth: 980, margin: "0 auto", padding: `${spacing[5]}px ${spacing[4]}px ${spacing[12]}px` }}><EventOperations eventId={params.id} /></div>
}
