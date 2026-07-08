"use client"

import { useEffect, useState, useCallback, useRef } from "react"
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

  // A unique channel topic per hook instance. supabase.channel(topic) *reuses*
  // an existing channel with the same topic, so two useEvents() on one page
  // (e.g. Today mounts it via useActiveEvent + UpcomingEventsStrip) would grab
  // the same already-subscribed "events" channel and throw "cannot add
  // postgres_changes callbacks ... after subscribe()". Distinct topics keep each
  // instance's subscription independent.
  const topicRef = useRef<string>()
  if (!topicRef.current) topicRef.current = `events-${Math.random().toString(36).slice(2)}`

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
      .channel(topicRef.current!)
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

  /** The editable fields of an event. Phase/status is derived from the dates. */
  interface EventInput {
    slug: string
    name: string
    tagline?: string | null
    location?: string | null
    starts_at: string
    ends_at: string
  }

  // Admin-only at the DB layer (RLS is_admin()); the client gates the UI too.
  const create = useCallback(async (input: EventInput): Promise<EventRow> => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    const { data, error } = await supabase
      .from("events")
      .insert({
        slug: input.slug.trim(),
        name: input.name.trim(),
        tagline: input.tagline?.trim() || null,
        location: input.location?.trim() || null,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        created_by: user.id,
      })
      .select("id, slug, name, tagline, location, starts_at, ends_at, created_by, created_at")
      .single()
    if (error) throw error
    await fetchAll()
    return data as EventRow
  }, [fetchAll])

  const update = useCallback(async (eventId: string, input: EventInput): Promise<void> => {
    const { error } = await createClient()
      .from("events")
      .update({
        slug: input.slug.trim(),
        name: input.name.trim(),
        tagline: input.tagline?.trim() || null,
        location: input.location?.trim() || null,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
      })
      .eq("id", eventId)
    if (error) throw error
    await fetchAll()
  }, [fetchAll])

  const remove = useCallback(async (eventId: string): Promise<void> => {
    const { error } = await createClient().from("events").delete().eq("id", eventId)
    if (error) throw error
    await fetchAll()
  }, [fetchAll])

  return { events, joined, memberCounts, loading, userId, join, leave, create, update, remove }
}
