"use client"

import { useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { notifyFeed, BLOCKERS_TOPIC } from "@/lib/realtime/feedBus"

/**
 * Post a blocker without subscribing to the whole radar feed. For surfaces like
 * Today that only need to compose ("I'm stuck") — browsing/history lives on
 * Explore, which uses the full useRadar hook. Pings the blockers topic so every
 * open Explore refetches.
 */
export function usePostBlocker() {
  return useCallback(async (category: string, note: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { error } = await supabase
      .from("blockers")
      .insert({ author_id: user.id, category, note, event_id: null })
    if (error) throw error
    notifyFeed(BLOCKERS_TOPIC)
  }, [])
}
