"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

export interface InboxConversation {
  otherId: string
  name: string | null
  avatar: string | null
  lastBody: string
  lastAt: string
  unread: number
}

export function useInbox(): {
  conversations: InboxConversation[]
  totalUnread: number
  markRead: (otherId: string) => void
  loading: boolean
} {
  const [conversations, setConversations] = useState<InboxConversation[]>([])
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)

  const fetchInbox = useCallback(async () => {
    const supabase = createClient()

    // Resolve current user
    const { data: { user } } = await supabase.auth.getUser()
    const me = user?.id ?? null
    userIdRef.current = me

    if (!me) {
      setConversations([])
      setLoading(false)
      return
    }

    // Fetch all messages involving me, newest first
    const { data: msgs, error: msgsErr } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at")
      .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
      .order("created_at", { ascending: false })

    if (msgsErr) {
      console.error("[useInbox] messages fetch error:", msgsErr)
    }

    const allMessages = (msgs ?? []) as {
      id: string
      sender_id: string
      recipient_id: string
      body: string
      created_at: string
    }[]

    // Group by the OTHER party — first occurrence per partner is the most recent (desc order)
    const partnerMap = new Map<
      string,
      { lastBody: string; lastAt: string; messages: typeof allMessages }
    >()

    for (const msg of allMessages) {
      const other = msg.sender_id === me ? msg.recipient_id : msg.sender_id
      if (!partnerMap.has(other)) {
        partnerMap.set(other, { lastBody: msg.body, lastAt: msg.created_at, messages: [] })
      }
      partnerMap.get(other)!.messages.push(msg)
    }

    if (partnerMap.size === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    const partnerIds = Array.from(partnerMap.keys())

    // Fetch profile name/avatar for all partners in one query
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", partnerIds)

    if (profErr) {
      console.error("[useInbox] profiles fetch error:", profErr)
    }

    const profileMap = new Map<string, { name: string | null; avatar_url: string | null }>()
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { name: p.name ?? null, avatar_url: p.avatar_url ?? null })
    }

    // Fetch read cursors for the current user
    const { data: reads, error: readsErr } = await supabase
      .from("message_reads")
      .select("other_id, last_read_at")
      .eq("user_id", me)

    if (readsErr) {
      console.error("[useInbox] message_reads fetch error:", readsErr)
    }

    const readMap = new Map<string, string>()
    for (const r of reads ?? []) {
      readMap.set(r.other_id, r.last_read_at)
    }

    // Build InboxConversation[]
    const convs: InboxConversation[] = partnerIds.map((otherId) => {
      const { lastBody, lastAt, messages } = partnerMap.get(otherId)!
      const profile = profileMap.get(otherId)
      const lastReadAt = readMap.get(otherId) ?? new Date(0).toISOString()

      const unread = messages.filter(
        (msg) =>
          msg.recipient_id === me &&
          msg.sender_id === otherId &&
          msg.created_at > lastReadAt
      ).length

      return {
        otherId,
        name: profile?.name ?? null,
        avatar: profile?.avatar_url ?? null,
        lastBody,
        lastAt,
        unread,
      }
    })

    setConversations(convs)
    setLoading(false)
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchInbox()
  }, [fetchInbox])

  // Realtime: refetch inbox when any new message arrives addressed to me
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as { recipient_id: string }
          if (row.recipient_id === userIdRef.current) {
            fetchInbox()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchInbox])

  const markRead = useCallback((otherId: string) => {
    const me = userIdRef.current
    if (!me) return

    const now = new Date().toISOString()

    // Optimistic update
    setConversations((prev) =>
      prev.map((c) => (c.otherId === otherId ? { ...c, unread: 0 } : c))
    )

    // Persist to database
    createClient()
      .from("message_reads")
      .upsert(
        { user_id: me, other_id: otherId, last_read_at: now },
        { onConflict: "user_id,other_id" }
      )
      .then(({ error }) => {
        if (error) {
          console.error("[useInbox] markRead error:", error)
          // No revert needed — a stale unread count is recoverable on next fetch
        }
      })
  }, [])

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0)

  return { conversations, totalUnread, markRead, loading }
}
