"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

export type CatchupStatus = "proposed" | "accepted" | "declined" | "cancelled"

export interface CatchupRow {
  id: string
  proposer_id: string
  recipient_id: string
  day: number
  start_min: number
  end_min: number
  status: CatchupStatus
  created_at: string
  updated_at: string
}

const CATCHUP_COLUMNS = "id, proposer_id, recipient_id, day, start_min, end_min, status, created_at, updated_at"

/**
 * Per-pair catchup state — shaped like useDirectMessages. A propose/accept/decline/cancel
 * flow shared between both people, instead of each person's own private row.
 */
export function useCatchup(otherUserId: string | null): {
  catchup: CatchupRow | null
  propose: (day: number, startMin: number) => Promise<void>
  accept: () => Promise<void>
  decline: () => Promise<void>
  cancel: () => Promise<void>
  loading: boolean
  meId: string | null
} {
  const [catchup, setCatchup] = useState<CatchupRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const uid = user?.id ?? null
      userIdRef.current = uid
      setUserId(uid)
    })
  }, [])

  const fetchLatest = useCallback(async (me: string, other: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("catchups")
      .select(CATCHUP_COLUMNS)
      .or(`and(proposer_id.eq.${me},recipient_id.eq.${other}),and(proposer_id.eq.${other},recipient_id.eq.${me})`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) console.error("[useCatchup] fetch error:", error)
    setCatchup((data as CatchupRow | null) ?? null)
  }, [])

  useEffect(() => {
    if (!userId || !otherUserId) {
      setCatchup(null)
      setLoading(false)
      return
    }
    setLoading(true)
    fetchLatest(userId, otherUserId).then(() => setLoading(false))
  }, [userId, otherUserId, fetchLatest])

  useEffect(() => {
    if (!userId || !otherUserId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`catchup-${userId}-${otherUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "catchups" },
        (payload) => {
          const row = (payload.new ?? payload.old) as Partial<CatchupRow>
          const me = userIdRef.current
          const belongs =
            (row.proposer_id === me && row.recipient_id === otherUserId) ||
            (row.proposer_id === otherUserId && row.recipient_id === me)
          if (belongs && me) fetchLatest(me, otherUserId)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, otherUserId, fetchLatest])

  const propose = useCallback(async (day: number, startMin: number) => {
    const me = userIdRef.current
    if (!me || !otherUserId) return
    if (catchup && (catchup.status === "proposed" || catchup.status === "accepted")) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from("catchups")
      .insert({ proposer_id: me, recipient_id: otherUserId, day, start_min: startMin, end_min: startMin + 15, status: "proposed" })
      .select(CATCHUP_COLUMNS)
      .single()
    if (error) { console.error("[useCatchup] propose error:", error); return }
    setCatchup(data as CatchupRow)
  }, [otherUserId, catchup])

  const accept = useCallback(async () => {
    const me = userIdRef.current
    if (!catchup || catchup.status !== "proposed" || catchup.recipient_id !== me) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from("catchups")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", catchup.id)
      .select(CATCHUP_COLUMNS)
      .single()
    if (error) { console.error("[useCatchup] accept error:", error); return }
    setCatchup(data as CatchupRow)
  }, [catchup])

  const decline = useCallback(async () => {
    const me = userIdRef.current
    if (!catchup || catchup.status !== "proposed" || catchup.recipient_id !== me) return
    const supabase = createClient()
    const { error } = await supabase.from("catchups").delete().eq("id", catchup.id)
    if (error) { console.error("[useCatchup] decline error:", error); return }
    setCatchup(null)
  }, [catchup])

  const cancel = useCallback(async () => {
    if (!catchup) return
    const supabase = createClient()
    const { error } = await supabase.from("catchups").delete().eq("id", catchup.id)
    if (error) { console.error("[useCatchup] cancel error:", error); return }
    setCatchup(null)
  }, [catchup])

  return { catchup, propose, accept, decline, cancel, loading, meId: userId }
}

export interface CatchupAgendaRow {
  id: string
  otherId: string
  otherName: string | null
  otherAvatar: string | null
  day: number
  start_min: number
  end_min: number
  status: CatchupStatus
  /** "sent" = I proposed it; "received" = the other person proposed it. */
  direction: "sent" | "received"
}

/**
 * Aggregate catchup list across all pairs for the current user — mirrors useInbox's
 * aggregate-fetch + realtime-refetch shape. Used by ScheduleView and the bell.
 */
export function useCatchups(): {
  catchups: CatchupAgendaRow[]
  accept: (id: string) => void
  decline: (id: string) => void
  cancel: (id: string) => void
  loading: boolean
} {
  const [catchups, setCatchups] = useState<CatchupAgendaRow[]>([])
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const me = user?.id ?? null
    userIdRef.current = me
    if (!me) { setCatchups([]); setLoading(false); return }

    const { data, error } = await supabase
      .from("catchups")
      .select(CATCHUP_COLUMNS)
      .or(`proposer_id.eq.${me},recipient_id.eq.${me}`)
      .order("created_at", { ascending: false })
    if (error) console.error("[useCatchups] fetch error:", error)

    const rows = (data as CatchupRow[]) ?? []
    if (rows.length === 0) { setCatchups([]); setLoading(false); return }

    const otherIds = Array.from(new Set(rows.map(r => (r.proposer_id === me ? r.recipient_id : r.proposer_id))))
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", otherIds)
    if (profErr) console.error("[useCatchups] profiles fetch error:", profErr)

    const profileMap = new Map<string, { name: string | null; avatar_url: string | null }>()
    for (const p of profiles ?? []) profileMap.set(p.id, { name: p.name ?? null, avatar_url: p.avatar_url ?? null })

    const agenda: CatchupAgendaRow[] = rows.map(r => {
      const otherId = r.proposer_id === me ? r.recipient_id : r.proposer_id
      const profile = profileMap.get(otherId)
      return {
        id: r.id,
        otherId,
        otherName: profile?.name ?? null,
        otherAvatar: profile?.avatar_url ?? null,
        day: r.day,
        start_min: r.start_min,
        end_min: r.end_min,
        status: r.status,
        direction: r.proposer_id === me ? "sent" : "received",
      }
    })
    setCatchups(agenda)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("catchups-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "catchups" },
        (payload) => {
          const row = (payload.new ?? payload.old) as Partial<CatchupRow>
          const me = userIdRef.current
          if (row.proposer_id === me || row.recipient_id === me) fetchAll()
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchAll])

  const accept = useCallback((id: string) => {
    const supabase = createClient()
    setCatchups(prev => prev.map(c => (c.id === id ? { ...c, status: "accepted" } : c)))
    supabase.from("catchups").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", id)
      .then(({ error }) => { if (error) { console.error("[useCatchups] accept error:", error); fetchAll() } })
  }, [fetchAll])

  const decline = useCallback((id: string) => {
    const supabase = createClient()
    setCatchups(prev => prev.filter(c => c.id !== id))
    supabase.from("catchups").delete().eq("id", id)
      .then(({ error }) => { if (error) { console.error("[useCatchups] decline error:", error); fetchAll() } })
  }, [fetchAll])

  const cancel = useCallback((id: string) => {
    const supabase = createClient()
    setCatchups(prev => prev.filter(c => c.id !== id))
    supabase.from("catchups").delete().eq("id", id)
      .then(({ error }) => { if (error) { console.error("[useCatchups] cancel error:", error); fetchAll() } })
  }, [fetchAll])

  return { catchups, accept, decline, cancel, loading }
}
