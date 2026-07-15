"use client"

import React from "react"
import Link from "next/link"
import { ArrowRight, Check, Radio, Users } from "lucide-react"
import type { EventRow } from "@/lib/hooks/useEvents"
import { useCoworking } from "@/lib/hooks/useCoworking"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

export function LivePulseCard({ event }: { event: EventRow | null }) {
  const coworking = useCoworking(event?.id ?? null, event?.starts_at, event?.ends_at)
  if (!event || coworking.loading) return null

  const mine = coworking.myCheckin && !coworking.myCheckin.checked_out_at ? coworking.myCheckin : null
  const done = mine?.focus_items.filter((item) => item.completed_at).length ?? 0

  return (
    <Link href={`/events/${event.slug}`} style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
        <Radio size={14} color={colors.go} />
        <span style={{ fontFamily: fonts.mono, fontSize: fontSize.label, fontWeight: fontWeight.semibold, color: colors.go, textTransform: "uppercase", letterSpacing: ".06em" }}>Live Pulse</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4, alignItems: "center", fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.muted }}><Users size={11} /> {coworking.activeCheckins.length}{event.capacity ? `/${event.capacity}` : ""}</span>
      </div>
      <div style={{ fontFamily: fonts.display, fontSize: fontSize.heading, fontWeight: fontWeight.semibold, color: colors.ink, marginTop: spacing[2] }}>{event.name}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing[3], alignItems: "center", marginTop: spacing[1] }}>
        <span style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {mine ? mine.intention : "Check in, set your intention, and find useful people in the room."}
        </span>
        {mine ? <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.go }}><Check size={11} /> {done}/{mine.focus_items.length}</span> : <ArrowRight size={14} color={colors.violet} />}
      </div>
    </Link>
  )
}

const cardStyle: React.CSSProperties = { display: "block", padding: spacing[4], marginBottom: spacing[4], border: `1.4px solid ${colors.go}`, borderRadius: radii.xl, background: colors.goSoft, textDecoration: "none" }

export default LivePulseCard
