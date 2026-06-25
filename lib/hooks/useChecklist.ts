"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

export function useChecklist(itemIds: string[]): {
  checked: Set<string>
  toggle: (itemId: string) => void
  loading: boolean
} {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  // Store uid so we don't re-fetch it on every toggle
  const uidRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const supabase = createClient()
        const { data: userData } = await supabase.auth.getUser()
        const uid = userData?.user?.id
        if (!uid) {
          // Not signed in — nothing to load
          setLoading(false)
          return
        }
        uidRef.current = uid

        const { data, error } = await supabase
          .from("checklist_state")
          .select("item_id")
          .eq("user_id", uid)
          .eq("checked", true)
          .in("item_id", itemIds)

        if (cancelled) return
        if (error) {
          console.error("useChecklist: fetch error", error)
          setLoading(false)
          return
        }

        const ids = new Set<string>((data ?? []).map((row: { item_id: string }) => row.item_id))
        setChecked(ids)
      } catch (err) {
        console.error("useChecklist: unexpected error", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = useCallback(async (itemId: string) => {
    const uid = uidRef.current
    if (!uid) return

    const wasChecked = checked.has(itemId)
    const nowChecked = !wasChecked

    // Optimistic update
    setChecked(prev => {
      const next = new Set(prev)
      if (nowChecked) next.add(itemId)
      else next.delete(itemId)
      return next
    })

    try {
      const supabase = createClient()
      if (nowChecked) {
        const { error } = await supabase
          .from("checklist_state")
          .upsert(
            { user_id: uid, item_id: itemId, checked: true },
            { onConflict: "user_id,item_id" }
          )
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("checklist_state")
          .delete()
          .eq("user_id", uid)
          .eq("item_id", itemId)
        if (error) throw error
      }
    } catch (err) {
      console.error("useChecklist: toggle error — reverting", err)
      // Revert optimistic update
      setChecked(prev => {
        const next = new Set(prev)
        if (wasChecked) next.add(itemId)
        else next.delete(itemId)
        return next
      })
    }
  }, [checked])

  return { checked, toggle, loading }
}
