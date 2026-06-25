"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export interface UseSavedScheduleResult {
  saved: Set<string>
  toggle: (sessionId: string) => void
  loading: boolean
}

export function useSavedSchedule(): UseSavedScheduleResult {
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      setUserId(user.id)

      const { data, error } = await supabase
        .from("saved_sessions")
        .select("session_id")
        .eq("user_id", user.id)
      // RLS ensures only the current user's rows are returned
      if (error) console.error("[useSavedSchedule] fetch error:", error)
      if (data) {
        setSaved(new Set(data.map((row: { session_id: string }) => row.session_id)))
      }
      setLoading(false)
    }

    init()
  }, [])

  const toggle = useCallback((sessionId: string) => {
    if (!userId) return

    // Derive isSaved from current state inside the updater to avoid stale
    // closure bugs when toggle is called multiple times before re-render.
    let isSaved = false
    setSaved(prev => {
      isSaved = prev.has(sessionId)
      const next = new Set(prev)
      isSaved ? next.delete(sessionId) : next.add(sessionId)
      return next
    })

    // isSaved is set synchronously by the updater above, so it's safe to use
    // it here before the async Supabase op fires.
    if (isSaved) {
      // was saved → delete
      createClient()
        .from("saved_sessions")
        .delete()
        .match({ user_id: userId, session_id: sessionId })
        .then(({ error }) => {
          if (error) {
            // Revert on error
            setSaved(prev => {
              const next = new Set(prev)
              next.add(sessionId)
              return next
            })
          }
        })
    } else {
      // was not saved → insert
      createClient()
        .from("saved_sessions")
        .insert({ user_id: userId, session_id: sessionId })
        .then(({ error }) => {
          if (error) {
            // Revert on error
            setSaved(prev => {
              const next = new Set(prev)
              next.delete(sessionId)
              return next
            })
          }
        })
    }
  }, [userId])

  return { saved, toggle, loading }
}
