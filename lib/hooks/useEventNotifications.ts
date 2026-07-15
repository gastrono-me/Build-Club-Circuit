"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { EventNotification } from "@/lib/coworking/types"

export function useEventNotifications() {
  const [notifications, setNotifications] = useState<EventNotification[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const topicRef = useRef(`event-alerts-${Math.random().toString(36).slice(2)}`)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id ?? null
    setUserId(uid)
    if (!uid) { setNotifications([]); return }
    const { data, error } = await supabase.from("event_notifications")
      .select("*")
      .eq("recipient_id", uid)
      .order("created_at", { ascending: false })
      .limit(20)
    if (error) console.error("[event notifications] fetch error:", error)
    const rows = (data ?? []) as EventNotification[]
    const eventIds = [...new Set(rows.map((row) => row.event_id))]
    if (!eventIds.length) { setNotifications(rows); return }
    const { data: events, error: eventsError } = await supabase.from("events").select("id,slug").in("id", eventIds)
    if (eventsError) console.error("[event notifications] event fetch error:", eventsError)
    const slugs = new Map((events ?? []).map((row: any) => [row.id, row.slug] as const))
    setNotifications(rows.map((row) => ({ ...row, event_slug: slugs.get(row.event_id) ?? null })))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase.channel(topicRef.current)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "event_notifications",
        filter: `recipient_id=eq.${userId}`,
      }, () => { fetchAll() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchAll])

  const markRead = useCallback(async (id: string) => {
    const { error } = await createClient().from("event_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
    if (error) throw error
    setNotifications((rows) => rows.map((row) => row.id === id ? { ...row, read_at: new Date().toISOString() } : row))
  }, [])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    const now = new Date().toISOString()
    const { error } = await createClient().from("event_notifications")
      .update({ read_at: now })
      .eq("recipient_id", userId)
      .is("read_at", null)
    if (error) throw error
    setNotifications((rows) => rows.map((row) => ({ ...row, read_at: row.read_at ?? now })))
  }, [userId])

  return {
    notifications,
    unread: notifications.filter((row) => !row.read_at).length,
    markRead,
    markAllRead,
  }
}
