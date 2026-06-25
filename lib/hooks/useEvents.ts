"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export interface EventRow {
  id: string
  slug: string
  name: string
  tagline: string | null
  location: string | null
  starts_at: string
  ends_at: string
  created_by: string | null
  created_at: string
}

/**
 * Events + the current user's memberships, live via Realtime. Mirrors
 * useBuildLog: fetch-all on mount, re-fetch on any change, plus join/leave
 * mutations that flip your own membership row.
 */
export function useEvents() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [joined, setJoined] = useState<Set<string>>(new Set())
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id ?? null
    setUserId(uid)

    const { data: eventData, error: eventErr } = await supabase
      .from("events")
      .select("id, slug, name, tagline, location, starts_at, ends_at, created_by, created_at")
      .order("starts_at", { ascending: true })

    if (eventErr) console.error("[useEvents] events fetch error:", eventErr)

    const { data: memberData, error: memberErr } = await supabase
      .from("event_members")
      .select("event_id, user_id")

    if (memberErr) console.error("[useEvents] members fetch error:", memberErr)

    const counts: Record<string, number> = {}
    const mine = new Set<string>()
    for (const row of memberData ?? []) {
      counts[row.event_id] = (counts[row.event_id] ?? 0) + 1
      if (uid && row.user_id === uid) mine.add(row.event_id)
    }

    setEvents((eventData ?? []) as EventRow[])
    setMemberCounts(counts)
    setJoined(mine)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("events")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => { fetchAll() })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_members" }, () => { fetchAll() })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const join = useCallback(async (eventId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    const { error } = await supabase
      .from("event_members")
      .insert({ event_id: eventId, user_id: user.id })
    if (error) throw error
  }, [])

  const leave = useCallback(async (eventId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    const { error } = await supabase
      .from("event_members")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user.id)
    if (error) throw error
  }, [])

  return { events, joined, memberCounts, loading, userId, join, leave }
}
