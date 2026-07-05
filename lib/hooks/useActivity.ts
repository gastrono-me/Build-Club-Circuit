"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { subscribeFeed, BUILD_LOG_TOPIC } from "@/lib/realtime/feedBus"

/** One notification: recent cheers OR comments on a single ship of mine, grouped. */
export interface ActivityRow {
  kind: "cheer" | "comment"
  postId: string
  /** Context line: the ship note for cheers, the latest comment body for comments. */
  note: string
  /** Most recent actor, shown as the face + name. */
  latestName: string | null
  latestAvatar: string | null
  /** How many distinct reactions of this kind in the fetched window. */
  count: number
  /** Timestamp of the most recent one. */
  lastAt: string
  /** Reactions newer than my read cursor. */
  newCount: number
  unread: boolean
}

/** How many recent reactions of each kind to consider. Bounded so the queries stay cheap. */
const WINDOW = 80
/** Coalesce bursts of reactions into a single refetch. */
const REFETCH_DEBOUNCE_MS = 500

interface ReactionRow {
  post_id: string
  created_at: string
  /** Comment body; absent on cheers. */
  body?: string
  build_log: { author_id: string; note: string } | null
  profiles: { name: string | null; avatar_url: string | null } | null
}

/**
 * "Who reacted to what I shipped." Reads cheers and comments on my own
 * build_log posts (excluding my own), grouped per kind+post, and marks a group
 * unread when it has reactions newer than my activity_reads cursor (one cursor
 * covers both streams). Lives on the shared build-log broadcast topic, so a
 * reaction anywhere pings a debounced refetch.
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

    const [cheerRes, commentRes, readRes] = await Promise.all([
      supabase
        .from("build_log_cheers")
        .select("post_id, created_at, build_log!inner ( author_id, note ), profiles:user_id ( name, avatar_url )")
        .eq("build_log.author_id", me)
        .neq("user_id", me)
        .order("created_at", { ascending: false })
        .limit(WINDOW),
      supabase
        .from("ship_comments")
        .select("post_id, created_at, body, build_log!inner ( author_id, note ), profiles:author_id ( name, avatar_url )")
        .eq("build_log.author_id", me)
        .neq("author_id", me)
        .order("created_at", { ascending: false })
        .limit(WINDOW),
      supabase
        .from("activity_reads")
        .select("last_read_at")
        .eq("user_id", me)
        .maybeSingle(),
    ])

    if (cheerRes.error) console.error("[useActivity] cheers fetch error:", cheerRes.error)
    if (commentRes.error) console.error("[useActivity] comments fetch error:", commentRes.error)
    if (readRes.error) console.error("[useActivity] read cursor fetch error:", readRes.error)

    const lastReadAt = (readRes.data as { last_read_at: string } | null)?.last_read_at
      ?? new Date(0).toISOString()

    // Group per kind+post. Rows come newest-first, so the first per group is
    // the most recent reaction on it.
    const groups = new Map<string, ActivityRow>()
    const fold = (kind: ActivityRow["kind"], rows: ReactionRow[]) => {
      for (const r of rows) {
        const isNew = r.created_at > lastReadAt
        const key = `${kind}|${r.post_id}`
        const existing = groups.get(key)
        if (existing) {
          existing.count += 1
          if (isNew) { existing.newCount += 1; existing.unread = true }
        } else {
          groups.set(key, {
            kind,
            postId: r.post_id,
            // Cheers show the ship they landed on; comments show what was said.
            note: kind === "comment" ? (r.body ?? "") : (r.build_log?.note ?? "your ship"),
            latestName: r.profiles?.name ?? null,
            latestAvatar: r.profiles?.avatar_url ?? null,
            count: 1,
            lastAt: r.created_at,
            newCount: isNew ? 1 : 0,
            unread: isNew,
          })
        }
      }
    }
    fold("cheer", (cheerRes.data ?? []) as unknown as ReactionRow[])
    fold("comment", (commentRes.data ?? []) as unknown as ReactionRow[])

    // Newest activity first across both kinds.
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
