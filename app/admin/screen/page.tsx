"use client"

import React, { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useIsAdmin } from "@/lib/hooks/useIsAdmin"
import { ShipCarousel } from "@/components/admin/ShipCarousel"
import { colors } from "@/lib/design/tokens"

export default function ScreenPage() {
  const { isAdmin, loading } = useIsAdmin()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAdmin) router.replace("/events")
  }, [loading, isAdmin, router])

  if (loading || !isAdmin) {
    return <div style={{ minHeight: "100vh", background: colors.surface }} />
  }

  return <ShipCarousel />
}
