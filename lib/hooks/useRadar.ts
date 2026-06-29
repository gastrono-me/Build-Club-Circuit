"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { chunk } from "@/lib/util/chunk"
import { subscribeFeed, notifyFeed, BLOCKERS_TOPIC } from "@/lib/realtime/feedBus"

export interface BlockerRow {
  id: string
  author_id: string | null
  category: string
  note: string
  created_at: string
  event_id?: string | null
  /** Joined from profiles — may be null for seed/community posts */
  author_name?: string | null
  author_avatar?: string | null
}

/** Emitted when a blocker's me-too count rises (id-stable; `seq` re-fires repeats). */
export interface RadarBump {
  id: string
  n: number
  seq: number
}

/** How many blockers the feed loads per page. */
export const RADAR_PAGE = 60
/** Coalesce bursts of realtime events into a single refetch. */
const REFETCH_DEBOUNCE_MS = 500
/** Max ids per `.in(...)` filter, to keep request URLs within limits. */
const IN_CHUNK = 150

/** Pass an event id to scope the feed to one episode; omit/null for the global feed. */
export function useRadar(eventId?: string | null) {
  const [blockers, setBlockers] = useState<BlockerRow[]>([])
  const [meTooCounts, setMeTooCounts] = useState<Record<string, number>>({})
  const [mineMeToo, setMineMeToo] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [limit, setLimit] = useState(RADAR_PAGE)
  const [hasMore, setHasMore] = useState(false)
  // Cross-client "me too" landed — drives the live pulse + toast on the radar.
  const [bump, setBump] = useState<RadarBump | null>(null)
  // Previous me-too counts, to detect which node a realtime change bumped.
  const prevCountsRef = useRef<Record<string, number>>({})
  const loadedOnceRef = useRef(false)
  const bumpSeqRef = useRef(0)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id ?? null
    setUserId(uid)

    // Blockers + author profile, newest-first, bounded by the current page size.
    let blockerQuery = supabase
      .from("blockers")
      .select(`
        id,
        author_id,
        category,
        note,
        created_at,
        event_id,
        profiles:author_id ( name, avatar_url )
      `)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (eventId) blockerQuery = blockerQuery.eq("event_id", eventId)
    const { data: blockerData, error: blockerErr } = await blockerQuery

    if (blockerErr) {
      console.error("[useRadar] blockers fetch error:", blockerErr)
    }

    const normalized: BlockerRow[] = (blockerData ?? []).map((b: any) => ({
      id: b.id,
      author_id: b.author_id,
      category: b.category,
      note: b.note,
      created_at: b.created_at,
      event_id: b.event_id ?? null,
      author_name: b.profiles?.name ?? null,
      author_avatar: b.profiles?.avatar_url ?? null,
    }))

    // Me-too counts only for the visible blockers, read from the aggregate view
    // instead of scanning the whole blocker_metoo table in the browser.
    const visibleIds = normalized.map((b) => b.id)
    const counts: Record<string, number> = {}
    const mine = new Set<string>()

    for (const ids of chunk(visibleIds, IN_CHUNK)) {
      const [countRes, mineRes] = await Promise.all([
        supabase.from("blocker_metoo_counts").select("blocker_id, metoo").in("blocker_id", ids),
        uid
          ? supabase.from("blocker_metoo").select("blocker_id").eq("user_id", uid).in("blocker_id", ids)
          : Promise.resolve({ data: [], error: null } as any),
      ])
      if (countRes.error) console.error("[useRadar] me-too counts fetch error:", countRes.error)
      if (mineRes.error) console.error("[useRadar] my-me-too fetch error:", mineRes.error)
      for (const row of (countRes.data ?? []) as { blocker_id: string; metoo: number }[]) {
        counts[row.blocker_id] = row.metoo
      }
      for (const row of (mineRes.data ?? []) as { blocker_id: string }[]) {
        mine.add(row.blocker_id)
      }
    }

    // Detect a cross-client me-too rise so the UI can pulse that exact node.
    // Only consider blockers that were already visible last fetch — newly loaded
    // ones (loadMore) or brand-new posts must not register as a "rise".
    if (loadedOnceRef.current) {
      const prev = prevCountsRef.current
      let bumpedId: string | null = null
      let bestDelta = 0
      for (const id in counts) {
        if (!(id in prev)) continue
        const delta = counts[id] - prev[id]
        if (delta > bestDelta) { bestDelta = delta; bumpedId = id }
      }
      if (bumpedId) {
        bumpSeqRef.current += 1
        setBump({ id: bumpedId, n: counts[bumpedId], seq: bumpSeqRef.current })
      }
    }
    prevCountsRef.current = counts
    loadedOnceRef.current = true

    setBlockers(normalized)
    setHasMore(normalized.length >= limit)
    setMeTooCounts(counts)
    setMineMeToo(mine)
    setLoading(false)
  }, [eventId, limit])

  // Keep the refetch pointing at the latest fetch (which closes over eventId +
  // limit) without re-subscribing the broadcast channel when those change.
  const fetchRef = useRef(fetchAll)
  fetchRef.current = fetchAll

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefetch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchRef.current(), REFETCH_DEBOUNCE_MS)
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Live updates over a shared Broadcast topic instead of postgres_changes: a
  // write pings the topic and every client refetches with its own scoped query.
  useEffect(() => {
    const off = subscribeFeed(BLOCKERS_TOPIC, scheduleRefetch)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      off()
    }
  }, [scheduleRefetch])

  const loadMore = useCallback(() => setLimit((l) => l + RADAR_PAGE), [])

  const post = useCallback(async (category: string, note: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("blockers")
      .insert({ author_id: user.id, category, note, event_id: eventId ?? null })
      .select("id")
      .single()

    if (error) throw error
    notifyFeed(BLOCKERS_TOPIC)
    scheduleRefetch()
    // Return the new id so the caller can highlight it reliably (no clock-skew
    // heuristic). The refetch above renders it.
    return (data?.id ?? null) as string | null
  }, [eventId, scheduleRefetch])

  const toggleMeToo = useCallback(async (blockerId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const alreadyIn = mineMeToo.has(blockerId)

    if (alreadyIn) {
      const { error } = await supabase
        .from("blocker_metoo")
        .delete()
        .eq("blocker_id", blockerId)
        .eq("user_id", user.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from("blocker_metoo")
        .insert({ blocker_id: blockerId, user_id: user.id })
      if (error) throw error
    }
    notifyFeed(BLOCKERS_TOPIC)
    scheduleRefetch()
  }, [mineMeToo, scheduleRefetch])

  return { blockers, loading, post, toggleMeToo, meTooCounts, mineMeToo, userId, bump, loadMore, hasMore }
}
