"use client"

import React, { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { HostBoard } from "@/components/coworking/HostBoard"
import { useIsAdmin } from "@/lib/hooks/useIsAdmin"
import { colors } from "@/lib/design/tokens"

export default function EventBoardPage() {
  const params = useParams<{ slug: string }>()
  const { isAdmin, loading } = useIsAdmin()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAdmin) router.replace(`/events/${params.slug}`)
  }, [loading, isAdmin, router, params.slug])

  if (loading || !isAdmin) return <div style={{ minHeight: "100vh", background: colors.ink }} />
  return <HostBoard slug={params.slug} />
}
