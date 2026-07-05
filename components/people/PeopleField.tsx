"use client"

import React from "react"
import { CalendarDays, MessageCircle } from "lucide-react"
import type { NormalizedPerson } from "@/components/people/PersonCard"
import type { Profile } from "@/types/index"
import { useSocial } from "@/components/shell/SocialProvider"
import { complementScore, type ComplementResult } from "@/lib/match"
import { layoutField, type SimItem } from "@/lib/radar/similarity"
import { colors, fonts, fontSize, fontWeight, spacing } from "@/lib/design/tokens"
import { EmbeddingField, type FieldLink, type FieldNode } from "@/components/field/EmbeddingField"

const TOP_COMPLEMENTS = 5

export interface PeopleFieldProps {
  /** Everyone in the room except the signed-in user. */
  people: NormalizedPerson[]
  me: Profile | null
  meId: string | null
}

/**
 * The cohort as an embedding field of people — the People twin of the stuck
 * field. Builders are positioned by interest similarity (so domains cluster),
 * and vectors shoot from you to the few people who most *complete* you:
 * reciprocal intent + complementary skills, every link explained. Tap a node to
 * see why, then request a catchup. Degrades to nothing when the room is too
 * sparse to be meaningful.
 */
export function PeopleField({ people, me, meId }: PeopleFieldProps) {
  const { openPanel } = useSocial()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const meForMatch = React.useMemo(
    () => (me ? { tags: me.skills, industries: me.industries, looking: me.looking } : null),
    [me],
  )

  // Complement score for every other person, strongest first.
  const scored = React.useMemo(() => {
    const map: Record<string, ComplementResult> = {}
    for (const p of people) {
      map[p.id] = complementScore(meForMatch, { tags: p.tags, industries: p.industries, looking: p.looking })
    }
    return map
  }, [people, meForMatch])

  const topComplementIds = React.useMemo(() => {
    return [...people]
      .filter((p) => scored[p.id]?.score > 0)
      .sort((a, b) => scored[b.id].score - scored[a.id].score)
      .slice(0, TOP_COMPLEMENTS)
      .map((p) => p.id)
  }, [people, scored])
  const topSet = React.useMemo(() => new Set(topComplementIds), [topComplementIds])
  const maxScore = Math.max(1, ...topComplementIds.map((id) => scored[id].score))

  // Layout positions: position by interest space (skills + industries + looking),
  // anchored loosely by primary industry. Keyed on content so it's stable.
  const positions = React.useMemo(() => {
    if (!me || !meId) return {}
    const items: SimItem[] = [
      { id: meId, category: me.industries[0] ?? "Other", note: [...me.skills, ...me.industries, ...me.looking].join(" ") },
      ...people.map((p) => ({
        id: p.id,
        category: p.industries[0] ?? "Other",
        note: [...p.tags, ...p.industries, ...p.looking].join(" "),
      })),
    ]
    return layoutField(items)
  }, [people, me, meId])

  // Need a real profile and enough of a room for the field to mean anything.
  if (!me || !meId || people.length < 3) return null

  const selected = selectedId ? people.find((p) => p.id === selectedId) ?? null : null
  const selectedScore = selected ? scored[selected.id] : null
  const mePos = positions[meId]

  function asChatPerson(p: NormalizedPerson) {
    return { id: p.id, name: p.name, occupation: p.occupation, tags: p.tags, industries: p.industries, looking: p.looking, bio: p.bio, avatar: p.avatar }
  }

  // Complement vectors from you to your top people.
  const links: FieldLink[] = mePos
    ? topComplementIds.flatMap((id) => {
        const p = positions[id]
        if (!p) return []
        const strength = scored[id].score / maxScore
        return [{
          key: id,
          from: mePos,
          to: p,
          strokeWidth: 0.9 + strength * 1.8,
          opacity: 0.2 + strength * 0.5,
          active: selectedId === id,
        }]
      })
    : []

  const nodes: FieldNode[] = [{ id: meId, isMe: true }, ...people.map((p) => ({ id: p.id, isMe: false }))]
    .flatMap(({ id, isMe }) => {
      const pos = positions[id]
      if (!pos) return []
      const person = isMe ? null : people.find((p) => p.id === id)!
      const isTop = topSet.has(id)
      const radius = isMe ? 11 : isTop ? Math.min(8 + (scored[id].score / maxScore) * 6, 15) : 6
      const fill = isMe || isTop ? colors.violet : colors.mutedSoft
      const ariaLabel = isMe
        ? "This is you"
        : `${person!.name}${scored[id].score > 0 ? `. ${scored[id].headline ?? "complement"}.` : ""} Tap to ${selectedId === id ? "close" : "view"}.`
      return [{
        id,
        x: pos.x,
        y: pos.y,
        radius,
        fill,
        ring: isMe || isTop ? "soft" as const : "none" as const,
        selected: selectedId === id,
        ariaLabel,
        onClick: () => setSelectedId(isMe ? null : selectedId === id ? null : id),
        variant: isMe ? "me" as const : undefined,
        belowLabel: isMe ? "you" : undefined,
      }]
    })

  const panel = selected && selectedScore && (
    <>
      <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, color: colors.ink }}>
        {selected.name}
      </div>
      {selected.occupation && (
        <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, marginBottom: spacing[2] }}>
          {selected.occupation}
        </div>
      )}
      {/* Why you two — explained, never opaque */}
      {selectedScore.reasons.length > 0 ? (
        <ul style={{ margin: `0 0 ${spacing[3]}px`, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
          {selectedScore.reasons.map((r) => (
            <li key={r} style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.ink, display: "flex", gap: 7, alignItems: "baseline" }}>
              <span aria-hidden style={{ color: colors.violet, fontSize: 12, lineHeight: 1 }}>→</span>
              {r}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, marginBottom: spacing[3] }}>
          No strong overlap yet — say hi anyway.
        </div>
      )}
      <div style={{ display: "flex", gap: spacing[2] }}>
        <button
          type="button"
          onClick={() => openPanel(asChatPerson(selected), "catchup")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, border: "none", background: colors.violet, color: colors.onDark, fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.03em", cursor: "pointer" }}
        >
          <CalendarDays size={13} /> Request catchup
        </button>
        <button
          type="button"
          onClick={() => openPanel(asChatPerson(selected), "chat")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, border: `1.5px solid ${colors.line}`, background: "transparent", color: colors.ink, fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.03em", cursor: "pointer" }}
        >
          <MessageCircle size={13} /> Message
        </button>
      </div>
    </>
  )

  return (
    <EmbeddingField
      ariaLabel="Embedding field of people in the room"
      title="People field"
      headerRight={
        <span style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, letterSpacing: "0.04em", textTransform: "uppercase", color: colors.muted, display: "flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: colors.violet, display: "inline-block" }} />
          your top complements
        </span>
      }
      links={links}
      nodes={nodes}
      panel={panel}
      panelAriaLabel={selected ? `Detail: ${selected.name}` : undefined}
      panelBottom={14}
      style={{ marginBottom: spacing[5] }}
    />
  )
}

export default PeopleField
