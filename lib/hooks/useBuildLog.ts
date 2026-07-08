"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { chunk } from "@/lib/util/chunk"
import { subscribeFeed, notifyFeed, BUILD_LOG_TOPIC } from "@/lib/realtime/feedBus"

export interface BuildLogRow {
  id: string
  author_id: string
  category: string
  /** Significance tier: Update | Feature | Milestone (default Update). */
  kind: string
  note: string
  created_at: string
  event_id?: string | null
  project_id?: string | null
  /** Optional attachments the builder added to the ship. */
  link_url?: string | null
  media_url?: string | null
  media_type?: string | null
  media_name?: string | null
  /** Joined from profiles */
  author_name?: string | null
  author_avatar?: string | null
  /** Joined from projects */
  project_name?: string | null
}

/** Optional attachments passed to post(). */
export interface ShipAttachment {
  linkUrl?: string | null
  mediaUrl?: string | null
  mediaType?: string | null
  mediaName?: string | null
}

/** How many posts the browse feed loads per page. */
export const BUILD_LOG_PAGE = 50
/** Coalesce bursts of realtime events into a single refetch. */
const REFETCH_DEBOUNCE_MS = 500
/** Max ids per `.in(...)` filter, to keep request URLs within limits. */
const IN_CHUNK = 150

// profiles is an inner join (author_id is NOT NULL with an FK, so it never
// drops rows) — inner is what lets the author-name filter run server-side.
const POST_SELECT = `
  id,
  author_id,
  category,
  kind,
  note,
  created_at,
  event_id,
  project_id,
  link_url,
  media_url,
  media_type,
  media_name,
  profiles:author_id!inner ( name, avatar_url ),
  projects:project_id ( name )
` as const

function normalize(rows: any[] | null): BuildLogRow[] {
  return (rows ?? []).map((p: any) => ({
    id: p.id,
    author_id: p.author_id,
    category: p.category,
    kind: p.kind ?? "Update",
    note: p.note,
    created_at: p.created_at,
    event_id: p.event_id ?? null,
    project_id: p.project_id ?? null,
    link_url: p.link_url ?? null,
    media_url: p.media_url ?? null,
    media_type: p.media_type ?? null,
    media_name: p.media_name ?? null,
    author_name: p.profiles?.name ?? null,
    author_avatar: p.profiles?.avatar_url ?? null,
    project_name: p.projects?.name ?? null,
  }))
}

/** Start of the current UTC day, matching toDayKey()'s UTC convention. */
function startOfUtcDayISO(): string {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())).toISOString()
}

/**
 * Pass an event id to scope the feed to one episode; omit/null for the global feed.
 *
 * Scale notes (this hook is on the highest-traffic path during a live event):
 * - The browse feed (`posts`) is paginated with a LIMIT, so payload is bounded
 *   regardless of how much history accrues. Use `loadMore` to grow it.
 * - Cheer counts come from the `build_log_cheer_counts` aggregate view, scoped
 *   to only the posts on screen, instead of pulling the whole cheers table and
 *   counting in the browser.
 * - `todayPosts` (the spotlight + "shipped today" set) and `myPostDates` (the
 *   streak input) are fetched as their own bounded queries so feed pagination
 *   never truncates them.
 * - Realtime refetches are debounced so a burst of cheers is one refetch, not
 *   one per event.
 * - Filters (category / author name) run server-side on the browse feed, so
 *   they stay truthful across pagination instead of filtering one loaded page.
 */
export interface BuildLogFilter {
  /** Exact work category, or null for all. */
  category?: string | null
  /** Case-insensitive author-name fragment, or null for everyone. */
  author?: string | null
  /**
   * Fetch the paginated browse feed (`posts`). Surfaces that only need
   * today's ships + streak (Today, the event rail) pass false and skip the
   * archive page + its cheer counts entirely.
   */
  browse?: boolean
}

export function useBuildLog(eventId?: string | null, filter?: BuildLogFilter) {
  // Primitive deps so callers can pass a fresh object literal each render.
  const filterCategory = filter?.category ?? null
  const filterAuthor = filter?.author?.trim() || null
  const browse = filter?.browse ?? true

  const [posts, setPosts] = useState<BuildLogRow[]>([])
  const [todayPosts, setTodayPosts] = useState<BuildLogRow[]>([])
  const [myPostDates, setMyPostDates] = useState<string[]>([])
  const [cheerCounts, setCheerCounts] = useState<Record<string, number>>({})
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [mineCheers, setMineCheers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [limit, setLimit] = useState(BUILD_LOG_PAGE)
  const [hasMore, setHasMore] = useState(false)

  // A new filter restarts pagination at page one.
  useEffect(() => {
    setLimit(BUILD_LOG_PAGE)
  }, [filterCategory, filterAuthor])

  const fetchAll = useCallback(async () => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id ?? null
    setUserId(uid)

    // Browse feed: newest-first, bounded by the current page size. Filters
    // apply here only — todayPosts (spotlight) and streak dates stay unfiltered.
    // Skipped entirely when the caller doesn't render the archive.
    let pageQuery: any = null
    if (browse) {
      pageQuery = supabase
        .from("build_log")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .limit(limit)
      if (eventId) pageQuery = pageQuery.eq("event_id", eventId)
      if (filterCategory) pageQuery = pageQuery.eq("category", filterCategory)
      if (filterAuthor) pageQuery = pageQuery.ilike("profiles.name", `%${filterAuthor}%`)
    }

    // Today's ships (spotlight + counter): bounded to one UTC day, not the page.
    let todayQuery = supabase
      .from("build_log")
      .select(POST_SELECT)
      .gte("created_at", startOfUtcDayISO())
      .order("created_at", { ascending: false })
    if (eventId) todayQuery = todayQuery.eq("event_id", eventId)

    // The streak only needs the current user's own ship timestamps. Global (a
    // streak is not event-scoped) and tiny (one user's rows).
    const myDatesQuery = uid
      ? supabase
          .from("build_log")
          .select("created_at")
          .eq("author_id", uid)
          .order("created_at", { ascending: false })
      : null

    const [pageRes, todayRes, myDatesRes] = await Promise.all([
      pageQuery ?? Promise.resolve({ data: [], error: null } as any),
      todayQuery,
      myDatesQuery ?? Promise.resolve({ data: [], error: null } as any),
    ])

    if (pageRes.error) console.error("[useBuildLog] posts fetch error:", pageRes.error)
    if (todayRes.error) console.error("[useBuildLog] today fetch error:", todayRes.error)
    if (myDatesRes.error) console.error("[useBuildLog] my-dates fetch error:", myDatesRes.error)

    const pagePosts = normalize(pageRes.data)
    const today = normalize(todayRes.data)

    // Cheer counts only for the posts actually on screen (page + today), read
    // from the aggregate view so we never scan the whole cheers table. The id
    // list is chunked so a busy event day can't blow the request URL length.
    const visibleIds = Array.from(new Set([...pagePosts, ...today].map((p) => p.id)))
    const counts: Record<string, number> = {}
    const comments: Record<string, number> = {}
    const mine = new Set<string>()

    for (const ids of chunk(visibleIds, IN_CHUNK)) {
      const [countRes, commentRes, mineRes] = await Promise.all([
        supabase.from("build_log_cheer_counts").select("post_id, cheers").in("post_id", ids),
        supabase.from("ship_comment_counts").select("post_id, comments").in("post_id", ids),
        uid
          ? supabase.from("build_log_cheers").select("post_id").eq("user_id", uid).in("post_id", ids)
          : Promise.resolve({ data: [], error: null } as any),
      ])
      if (countRes.error) console.error("[useBuildLog] cheer counts fetch error:", countRes.error)
      if (commentRes.error) console.error("[useBuildLog] comment counts fetch error:", commentRes.error)
      if (mineRes.error) console.error("[useBuildLog] my-cheers fetch error:", mineRes.error)
      for (const row of (countRes.data ?? []) as { post_id: string; cheers: number }[]) {
        counts[row.post_id] = row.cheers
      }
      for (const row of (commentRes.data ?? []) as { post_id: string; comments: number }[]) {
        comments[row.post_id] = row.comments
      }
      for (const row of (mineRes.data ?? []) as { post_id: string }[]) {
        mine.add(row.post_id)
      }
    }

    setPosts(pagePosts)
    setHasMore(pagePosts.length >= limit)
    setTodayPosts(today)
    setMyPostDates(((myDatesRes.data ?? []) as { created_at: string }[]).map((r) => r.created_at))
    setCheerCounts(counts)
    setCommentCounts(comments)
    setMineCheers(mine)
    setLoading(false)
  }, [eventId, limit, filterCategory, filterAuthor, browse])

  // Keep the refetch pointing at the latest fetch (which closes over eventId +
  // limit) without re-subscribing the broadcast channel each time those change.
  const fetchRef = useRef(fetchAll)
  fetchRef.current = fetchAll

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefetch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchRef.current(), REFETCH_DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Live updates over a shared Broadcast topic instead of postgres_changes: a
  // write pings the topic and every client refetches with its own scoped query.
  useEffect(() => {
    const off = subscribeFeed(BUILD_LOG_TOPIC, scheduleRefetch)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      off()
    }
  }, [scheduleRefetch])

  const loadMore = useCallback(() => setLimit((l) => l + BUILD_LOG_PAGE), [])

  const post = useCallback(async (category: string, note: string, projectId?: string | null, attach?: ShipAttachment, kind?: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { error } = await supabase
      .from("build_log")
      .insert({
        author_id: user.id,
        category,
        kind: kind ?? "Update",
        note,
        event_id: eventId ?? null,
        project_id: projectId ?? null,
        link_url: attach?.linkUrl ?? null,
        media_url: attach?.mediaUrl ?? null,
        media_type: attach?.mediaType ?? null,
        media_name: attach?.mediaName ?? null,
      })

    if (error) throw error
    notifyFeed(BUILD_LOG_TOPIC)
    scheduleRefetch()
  }, [eventId, scheduleRefetch])

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
    notifyFeed(BUILD_LOG_TOPIC)
    scheduleRefetch()
  }, [mineCheers, scheduleRefetch])

  return {
    posts,
    todayPosts,
    myPostDates,
    loading,
    post,
    toggleCheer,
    cheerCounts,
    commentCounts,
    mineCheers,
    userId,
    loadMore,
    hasMore,
  }
}
