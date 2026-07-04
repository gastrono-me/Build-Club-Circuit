"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { subscribeFeed, BUILD_LOG_TOPIC } from "@/lib/realtime/feedBus"

/** One notification: recent cheers on a single ship of mine, grouped. */
export interface ActivityRow {
  postId: string
  note: string
  /** Most recent cheerer, shown as the face + name. */
  latestName: string | null
  latestAvatar: string | null
  /** How many distinct cheerers in the fetched window. */
  cheerCount: number
  /** Timestamp of the most recent cheer. */
  lastAt: string
  /** Cheers newer than my read cursor. */
  newCount: number
  unread: boolean
}

/** How many recent cheers to consider. Bounded so the query stays cheap. */
const WINDOW = 80
/** Coalesce bursts of cheers into a single refetch. */
const REFETCH_DEBOUNCE_MS = 500

interface CheerRow {
  post_id: string
  user_id: string
  created_at: string
  build_log: { author_id: string; note: string } | null
  profiles: { name: string | null; avatar_url: string | null } | null
}

/**
 * "Who reacted to what I shipped." Reads cheers on my own build_log posts
 * (excluding my own cheers), grouped by post, and marks a group unread when it
 * has cheers newer than my activity_reads cursor. Lives on the shared build-log
 * broadcast topic, so a cheer anywhere pings a debounced refetch.
 */
export function useActivity(): {
  activity: ActivityRow[]
  unreadActivity: number
  markActivityRead: () => void
  loading: boolean
} {
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)

  const fetchActivity = useCallback(async () => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    const me = user?.id ?? null
    userIdRef.current = me
    if (!me) {
      setActivity([])
      setLoading(false)
      return
    }

    const [cheerRes, readRes] = await Promise.all([
      supabase
        .from("build_log_cheers")
        .select("post_id, user_id, created_at, build_log!inner ( author_id, note ), profiles:user_id ( name, avatar_url )")
        .eq("build_log.author_id", me)
        .neq("user_id", me)
        .order("created_at", { ascending: false })
        .limit(WINDOW),
      supabase
        .from("activity_reads")
        .select("last_read_at")
        .eq("user_id", me)
        .maybeSingle(),
    ])

    if (cheerRes.error) console.error("[useActivity] cheers fetch error:", cheerRes.error)
    if (readRes.error) console.error("[useActivity] read cursor fetch error:", readRes.error)

    const lastReadAt = (readRes.data as { last_read_at: string } | null)?.last_read_at
      ?? new Date(0).toISOString()

    // Group cheers by post. Rows come newest-first, so the first per post is the
    // most recent cheer on it.
    const groups = new Map<string, ActivityRow>()
    for (const c of (cheerRes.data ?? []) as unknown as CheerRow[]) {
      const isNew = c.created_at > lastReadAt
      const existing = groups.get(c.post_id)
      if (existing) {
        existing.cheerCount += 1
        if (isNew) { existing.newCount += 1; existing.unread = true }
      } else {
        groups.set(c.post_id, {
          postId: c.post_id,
          note: c.build_log?.note ?? "your ship",
          latestName: c.profiles?.name ?? null,
          latestAvatar: c.profiles?.avatar_url ?? null,
          cheerCount: 1,
          lastAt: c.created_at,
          newCount: isNew ? 1 : 0,
          unread: isNew,
        })
      }
    }

    // Newest activity first (groups already inserted in that order via the map,
    // but sort defensively on lastAt).
    setActivity([...groups.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)))
    setLoading(false)
  }, [])

  // Keep the live refetch pointing at the latest fetch without re-subscribing.
  const fetchRef = useRef(fetchActivity)
  fetchRef.current = fetchActivity

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefetch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchRef.current(), REFETCH_DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  useEffect(() => {
    const off = subscribeFeed(BUILD_LOG_TOPIC, scheduleRefetch)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      off()
    }
  }, [scheduleRefetch])

  const markActivityRead = useCallback(() => {
    const me = userIdRef.current
    if (!me) return
    // Nothing unread? Skip the write.
    if (!activity.some((a) => a.unread)) return

    const now = new Date().toISOString()
    setActivity((prev) => prev.map((a) => ({ ...a, unread: false, newCount: 0 })))

    createClient()
      .from("activity_reads")
      .upsert({ user_id: me, last_read_at: now }, { onConflict: "user_id" })
      .then(({ error }) => {
        if (error) console.error("[useActivity] markActivityRead error:", error)
      })
  }, [activity])

  const unreadActivity = activity.reduce((n, a) => n + (a.unread ? 1 : 0), 0)

  return { activity, unreadActivity, markActivityRead, loading }
}
