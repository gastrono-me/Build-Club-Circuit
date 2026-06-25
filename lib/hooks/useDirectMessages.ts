"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

export interface DirectMessage {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  created_at: string
}

export function useDirectMessages(otherUserId: string | null): {
  thread: DirectMessage[]
  send: (body: string) => Promise<void>
  loading: boolean
  meId: string | null
} {
  const [thread, setThread] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  // Keep userId in a ref so the realtime callback sees the latest value without stale closure
  const userIdRef = useRef<string | null>(null)

  // Resolve current user once on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const uid = user?.id ?? null
      userIdRef.current = uid
      setUserId(uid)
    })
  }, [])

  // Load thread whenever userId or otherUserId changes
  useEffect(() => {
    if (!userId || !otherUserId) {
      setThread([])
      setLoading(false)
      return
    }

    const supabase = createClient()
    setLoading(true)

    supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at")
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`
      )
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("[useDirectMessages] fetch error:", error)
        }
        setThread((data as DirectMessage[]) ?? [])
        setLoading(false)
      })
  }, [userId, otherUserId])

  // Realtime subscription — tear down when otherUserId changes or on unmount
  useEffect(() => {
    if (!userId || !otherUserId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`dm-${userId}-${otherUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as DirectMessage
          const me = userIdRef.current
          const other = otherUserId

          // Only append if this row belongs to the current conversation pair
          const belongs =
            (row.sender_id === me && row.recipient_id === other) ||
            (row.sender_id === other && row.recipient_id === me)

          if (!belongs) return

          // Deduplicate by id — the optimistic append from send() may have already added it
          setThread((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [...prev, row]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, otherUserId])

  const send = useCallback(
    async (body: string) => {
      const trimmed = body.trim()
      if (!trimmed) return

      const me = userIdRef.current
      if (!me || !otherUserId) return

      const supabase = createClient()

      const { data, error } = await supabase
        .from("messages")
        .insert({ sender_id: me, recipient_id: otherUserId, body: trimmed })
        .select("id, sender_id, recipient_id, body, created_at")
        .single()

      if (error) {
        console.error("[useDirectMessages] send error:", error)
        return
      }

      if (data) {
        // Optimistic append — deduplicated by id in case Realtime echo arrives first
        setThread((prev) => {
          if (prev.some((m) => m.id === (data as DirectMessage).id)) return prev
          return [...prev, data as DirectMessage]
        })
      }
    },
    [otherUserId]
  )

  return { thread, send, loading, meId: userId }
}
