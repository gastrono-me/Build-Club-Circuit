"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

export interface BuildLogRow {
  id: string
  author_id: string
  category: string
  note: string
  created_at: string
  /** Joined from profiles */
  author_name?: string | null
  author_avatar?: string | null
}

export function useBuildLog() {
  const [posts, setPosts] = useState<BuildLogRow[]>([])
  const [cheerCounts, setCheerCounts] = useState<Record<string, number>>({})
  const [mineCheers, setMineCheers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id ?? null
    userIdRef.current = uid
    setUserId(uid)

    const { data: postData, error: postErr } = await supabase
      .from("build_log")
      .select(`
        id,
        author_id,
        category,
        note,
        created_at,
        profiles:author_id ( name, avatar_url )
      `)
      .order("created_at", { ascending: false })

    if (postErr) {
      console.error("[useBuildLog] posts fetch error:", postErr)
    }

    const { data: cheerData, error: cheerErr } = await supabase
      .from("build_log_cheers")
      .select("post_id, user_id")

    if (cheerErr) {
      console.error("[useBuildLog] cheers fetch error:", cheerErr)
    }

    const counts: Record<string, number> = {}
    const mine = new Set<string>()
    for (const row of cheerData ?? []) {
      counts[row.post_id] = (counts[row.post_id] ?? 0) + 1
      if (uid && row.user_id === uid) {
        mine.add(row.post_id)
      }
    }

    const normalized: BuildLogRow[] = (postData ?? []).map((p: any) => ({
      id: p.id,
      author_id: p.author_id,
      category: p.category,
      note: p.note,
      created_at: p.created_at,
      author_name: p.profiles?.name ?? null,
      author_avatar: p.profiles?.avatar_url ?? null,
    }))

    setPosts(normalized)
    setCheerCounts(counts)
    setMineCheers(mine)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("build-log")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "build_log" },
        () => { fetchAll() }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "build_log_cheers" },
        () => { fetchAll() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const post = useCallback(async (category: string, note: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { error } = await supabase
      .from("build_log")
      .insert({ author_id: user.id, category, note })

    if (error) throw error
  }, [])

  const toggleCheer = useCallback(async (postId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const alreadyIn = mineCheers.has(postId)

    if (alreadyIn) {
      const { error } = await supabase
        .from("build_log_cheers")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from("build_log_cheers")
        .insert({ post_id: postId, user_id: user.id })
      if (error) throw error
    }
  }, [mineCheers])

  return { posts, loading, post, toggleCheer, cheerCounts, mineCheers, userId }
}
