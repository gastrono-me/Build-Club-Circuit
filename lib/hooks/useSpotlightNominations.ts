"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * The signed-in builder's spotlight nominations: the set of their own post ids
 * they have opted in for an external feature. Per-post, default off. Optimistic
 * with revert on error. Not realtime: it is a personal opt-in queue, not a
 * shared feed.
 */
export function useSpotlightNominations() {
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data, error } = await supabase
        .from("spotlight_nominations")
        .select("post_id")
        .eq("user_id", user.id)
      if (error) {
        console.error("[useSpotlightNominations] fetch error:", error)
        return
      }
      setMine(new Set((data ?? []).map((r) => r.post_id as string)))
    }
    init()
  }, [])

  const nominate = useCallback(async (postId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    setMine((prev) => new Set(prev).add(postId))
    const { error } = await supabase
      .from("spotlight_nominations")
      .insert({ post_id: postId, user_id: user.id })
    if (error) {
      setMine((prev) => { const n = new Set(prev); n.delete(postId); return n })
      throw error
    }
  }, [])

  const unnominate = useCallback(async (postId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    setMine((prev) => { const n = new Set(prev); n.delete(postId); return n })
    const { error } = await supabase
      .from("spotlight_nominations")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id)
    if (error) {
      setMine((prev) => new Set(prev).add(postId))
      throw error
    }
  }, [])

  return { mine, nominate, unnominate, userId }
}
