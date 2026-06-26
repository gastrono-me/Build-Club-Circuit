"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

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

/** Pass an event id to scope the feed to one episode; omit/null for the global feed. */
export function useRadar(eventId?: string | null) {
  const [blockers, setBlockers] = useState<BlockerRow[]>([])
  const [meTooCounts, setMeTooCounts] = useState<Record<string, number>>({})
  const [mineMeToo, setMineMeToo] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  // Cross-client "me too" landed — drives the live pulse + toast on the radar.
  const [bump, setBump] = useState<RadarBump | null>(null)
  // Keep userId in a ref so realtime callback can access latest value without stale closure
  const userIdRef = useRef<string | null>(null)
  // Previous me-too counts, to detect which node a realtime change bumped.
  const prevCountsRef = useRef<Record<string, number>>({})
  const loadedOnceRef = useRef(false)
  const bumpSeqRef = useRef(0)
  // Unique channel name per hook instance, so two concurrent subscribers
  // (e.g. the Now-page pulse and the radar page) don't collide on one name.
  const channelNameRef = useRef(`radar-${Math.random().toString(36).slice(2)}`)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()

    // Get current user (may be null during initial load)
    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id ?? null
    userIdRef.current = uid
    setUserId(uid)

    // Fetch blockers + author profile in one join
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
    if (eventId) blockerQuery = blockerQuery.eq("event_id", eventId)
    const { data: blockerData, error: blockerErr } = await blockerQuery

    if (blockerErr) {
      console.error("[useRadar] blockers fetch error:", blockerErr)
    }

    // Fetch all me-too rows
    const { data: metooData, error: metooErr } = await supabase
      .from("blocker_metoo")
      .select("blocker_id, user_id")

    if (metooErr) {
      console.error("[useRadar] me-too fetch error:", metooErr)
    }

    // Build meTooCounts map
    const counts: Record<string, number> = {}
    const mine = new Set<string>()
    for (const row of metooData ?? []) {
      counts[row.blocker_id] = (counts[row.blocker_id] ?? 0) + 1
      if (uid && row.user_id === uid) {
        mine.add(row.blocker_id)
      }
    }

    // Normalize blocker rows — profiles join returns object or null
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

    // Detect a cross-client me-too rise so the UI can pulse that exact node.
    // Skip the first load (everything would look "new") and any count that fell.
    if (loadedOnceRef.current) {
      const prev = prevCountsRef.current
      let bumpedId: string | null = null
      let bestDelta = 0
      for (const id in counts) {
        const delta = counts[id] - (prev[id] ?? 0)
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
    setMeTooCounts(counts)
    setMineMeToo(mine)
    setLoading(false)
  }, [eventId])

  // Initial fetch
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blockers" },
        () => { fetchAll() }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blocker_metoo" },
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

    const { data, error } = await supabase
      .from("blockers")
      .insert({ author_id: user.id, category, note, event_id: eventId ?? null })
      .select("id")
      .single()

    if (error) throw error
    // Return the new id so the caller can highlight it reliably (no clock-skew
    // heuristic). Realtime still triggers the refetch that renders it.
    return (data?.id ?? null) as string | null
  }, [eventId])

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
    // Realtime will trigger refetch
  }, [mineMeToo])

  return { blockers, loading, post, toggleMeToo, meTooCounts, mineMeToo, userId, bump }
}
