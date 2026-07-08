"use client"

import { useMemo } from "react"
import { useEvents, type EventRow } from "@/lib/hooks/useEvents"
import { eventStatus } from "@/lib/events/eventStatus"

/**
 * The event a builder is currently "in": one they've joined that is live right
 * now. This is what lets the daily ship on Today optionally attribute to an
 * event — no separate event mode, just a lens on the same ritual. If they're in
 * more than one live event, the most recently started wins.
 */
export function useActiveEvent(now: Date | null): { active: EventRow | null; loading: boolean } {
  const { events, joined, loading } = useEvents()

  const active = useMemo(() => {
    if (!now) return null
    const live = events
      .filter((e) => joined.has(e.id) && eventStatus(e.starts_at, e.ends_at, now).phase === "live")
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    return live[0] ?? null
  }, [events, joined, now])

  return { active, loading }
}
