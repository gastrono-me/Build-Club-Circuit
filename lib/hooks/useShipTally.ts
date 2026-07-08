"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { SHIP_KINDS, SHIP_KIND_PLURAL } from "@/lib/data/ship-kinds"

/**
 * A builder's ship tally by type, from the author_ship_kind_counts view.
 * Returns the total plus a display-ordered breakdown ("12 updates",
 * "3 features", …) omitting zero counts.
 */
export function useShipTally(authorId: string | null): { total: number; parts: string[]; loading: boolean } {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authorId) { setCounts({}); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data, error } = await createClient()
        .from("author_ship_kind_counts")
        .select("kind, count")
        .eq("author_id", authorId)
      if (cancelled) return
      if (error) console.error("[useShipTally] fetch error:", error)
      const c: Record<string, number> = {}
      for (const row of (data ?? []) as { kind: string; count: number }[]) c[row.kind] = row.count
      setCounts(c)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [authorId])

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const parts = SHIP_KINDS
    .filter((k) => (counts[k] ?? 0) > 0)
    .map((k) => `${counts[k]} ${SHIP_KIND_PLURAL[k] ?? k.toLowerCase()}`)

  return { total, parts, loading }
}
