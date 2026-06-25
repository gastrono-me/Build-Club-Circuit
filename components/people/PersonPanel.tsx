"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Send, AlertTriangle, Check, CalendarDays } from "lucide-react"
import { Avatar } from "@/components/shell/Avatar"
import { Tag } from "@/components/ui/Tag"
import { Button } from "@/components/ui/Button"
import { useDirectMessages } from "@/lib/hooks/useDirectMessages"
import { useCatchup } from "@/lib/hooks/useCatchups"
import { useSocial, type ChatPerson } from "@/components/shell/SocialProvider"
import { useSavedSchedule } from "@/lib/hooks/useSavedSchedule"
import { useEventData } from "@/lib/data/useEventData"
import { buildAgenda, overlaps, type AgendaItem } from "@/lib/schedule"
import { hm, fmt } from "@/lib/time"
import { colors, radii, fonts, fontSize, fontWeight, spacing, shadows } from "@/lib/design/tokens"

const oxbloodSoft = colors.liveSoft

export interface PersonPanelProps {
  person: ChatPerson
  /** Which section to draw attention to on open — both always render. */
  focus: "chat" | "catchup"
  onClose: () => void
}

export function PersonPanel({ person, focus, onClose }: PersonPanelProps) {
  const { thread, send, meId } = useDirectMessages(person.id)
  const { catchup, propose, accept, decline, cancel } = useCatchup(person.id)
  const { catchups: myCatchups } = useSocial()
  const { saved } = useSavedSchedule()
  const { sessions, days } = useEventData()

  const [input, setInput] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const catchupRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [thread])

  useEffect(() => {
    if (focus === "chat") inputRef.current?.focus()
    else catchupRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [focus])

  async function submit() {
    const v = input.trim()
    if (!v) return
    setInput("")
    await send(v)
  }

  const firstName = person.name.split(" ")[0]

  return (
    <div onClick={onClose} role="presentation"
      style={{ position: "fixed", inset: 0, background: "rgba(20,20,60,0.45)", backdropFilter: "blur(2px)", zIndex: 50 }}>
      <div role="dialog" aria-modal="true" aria-label={`Conversation with ${person.name}`} onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(92vw, 420px)",
          background: colors.surface, borderLeft: `1.5px solid ${colors.ink}`, boxShadow: shadows.modal,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1.5px solid ${colors.ink}`, background: colors.panel, flexShrink: 0 }}>
          <Avatar name={person.name} photo={person.avatar} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, color: colors.ink }}>{person.name}</div>
            {(person.occupation || person.org) && (
              <div style={{ fontSize: fontSize.meta, color: colors.muted }}>{[person.occupation, person.org].filter(Boolean).join(" · ")}</div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", cursor: "pointer", color: colors.muted, flexShrink: 0 }}><X size={19} /></button>
        </div>

        {/* catchup status strip */}
        <div ref={catchupRef}>
          <CatchupStrip
            person={person}
            meId={meId}
            catchup={catchup}
            myCatchups={myCatchups}
            saved={saved}
            sessions={sessions}
            days={days}
            propose={propose}
            accept={accept}
            decline={decline}
            cancel={cancel}
          />
        </div>

        {/* messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {thread.map((m) => {
            const fromMe = m.sender_id === meId
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: fromMe ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "78%", padding: "9px 13px", borderRadius: 13, fontSize: fontSize.body, lineHeight: 1.45, background: fromMe ? colors.violet : colors.surface, color: fromMe ? colors.onDark : colors.ink, border: fromMe ? "none" : `1.4px solid ${colors.line}` }}>{m.body}</div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {/* input */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 12, borderTop: `1.4px solid ${colors.line}`, background: colors.panel, flexShrink: 0 }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit() }}
            placeholder={`Message ${firstName}`}
            style={{ flex: 1, border: `1.4px solid ${colors.line}`, borderRadius: radii.md, padding: "9px 12px", fontSize: fontSize.body, outline: "none", background: colors.surface, color: colors.ink }} />
          <button onClick={submit} disabled={!input.trim()}
            style={{ width: 36, height: 36, borderRadius: radii.md, border: "none", cursor: input.trim() ? "pointer" : "not-allowed", background: input.trim() ? colors.violet : colors.line, color: colors.onDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

interface CatchupStripProps {
  person: ChatPerson
  meId: string | null
  catchup: ReturnType<typeof useCatchup>["catchup"]
  myCatchups: ReturnType<typeof useSocial>["catchups"]
  saved: Set<string>
  sessions: { id: string; day: number; start: number; end: number; title: string }[]
  days: { idx: number; date: string; label: string }[]
  propose: (day: number, startMin: number) => Promise<void>
  accept: () => Promise<void>
  decline: () => Promise<void>
  cancel: () => Promise<void>
}

function CatchupStrip({ person, meId, catchup, myCatchups, saved, sessions, days, propose, accept, decline, cancel }: CatchupStripProps) {
  if (!catchup) {
    return <ProposeCatchupForm person={person} myCatchups={myCatchups} saved={saved} sessions={sessions} days={days} onPropose={propose} />
  }

  const dayMeta = days.find(d => d.idx === catchup.day)
  const dayLabel = dayMeta ? dayMeta.date : `Day ${catchup.day + 1}`
  const timeLabel = `${dayLabel} · ${fmt(catchup.start_min)}–${fmt(catchup.end_min)}`
  const firstName = person.name.split(" ")[0]

  if (catchup.status === "proposed") {
    const iAmRecipient = catchup.recipient_id === meId
    return (
      <div style={{ padding: "12px 16px", borderBottom: `1.4px solid ${colors.line}`, background: colors.violetSoft, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.violet, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          <CalendarDays size={13} /> {iAmRecipient ? "Catchup requested" : "Catchup proposed"}
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.ink, marginBottom: 10 }}>
          {iAmRecipient ? `${firstName} wants to catch up · ${timeLabel}` : `Waiting for ${firstName} to accept · ${timeLabel}`}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {iAmRecipient ? (
            <>
              <Button variant="accent" size="sm" icon={<Check size={14} />} onClick={accept}>Accept</Button>
              <Button variant="danger" size="sm" onClick={decline}>Decline</Button>
            </>
          ) : (
            <Button variant="danger" size="sm" onClick={cancel}>Cancel</Button>
          )}
        </div>
      </div>
    )
  }

  if (catchup.status === "accepted") {
    return (
      <div style={{ padding: "12px 16px", borderBottom: `1.4px solid ${colors.line}`, background: colors.goSoft, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.go, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          <Check size={13} /> Catchup confirmed
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.ink, marginBottom: 10 }}>{timeLabel}</div>
        <Button variant="danger" size="sm" onClick={cancel}>Cancel</Button>
      </div>
    )
  }

  return null
}

function ProposeCatchupForm({
  person, myCatchups, saved, sessions, days, onPropose,
}: {
  person: ChatPerson
  myCatchups: ReturnType<typeof useSocial>["catchups"]
  saved: Set<string>
  sessions: { id: string; day: number; start: number; end: number; title: string }[]
  days: { idx: number; date: string; label: string }[]
  onPropose: (day: number, startMin: number) => Promise<void>
}) {
  const [day, setDay] = useState<number>(days[0]?.idx ?? 1)
  const [start, setStart] = useState<number>(hm(11, 0))
  const [open, setOpen] = useState(false)

  const TIMES = useMemo(() => {
    const arr: number[] = []
    for (let m = hm(8, 0); m <= hm(22, 45); m += 15) arr.push(m)
    return arr
  }, [])

  const end = start + 15
  const savedItems: AgendaItem[] = sessions
    .filter(s => saved.has(s.id))
    .map(s => ({ id: s.id, day: s.day, start: s.start, end: s.end, title: s.title, kind: "session" as const }))
  const acceptedOtherCatchups = myCatchups.filter(c => c.status === "accepted")
  const agenda = buildAgenda(savedItems, acceptedOtherCatchups, () => "Builder").filter(it => it.day === day)
  const candidate = { id: "candidate", day, start, end }
  const conflicts = agenda.filter(it => overlaps(candidate, it))

  if (!open) {
    return (
      <div style={{ padding: "12px 16px", borderBottom: `1.4px solid ${colors.line}`, flexShrink: 0 }}>
        <Button variant="secondary" size="sm" icon={<CalendarDays size={14} />} onClick={() => setOpen(true)}>
          Propose a 15-min catchup
        </Button>
      </div>
    )
  }

  return (
    <div style={{ padding: "12px 16px", borderBottom: `1.4px solid ${colors.line}`, flexShrink: 0 }}>
      <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Day</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
        {days.map(d => <Tag key={d.idx} active={day === d.idx} onClick={() => setDay(d.idx)}>{d.date}</Tag>)}
      </div>

      <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Time</div>
      <select value={start} onChange={e => setStart(+e.target.value)}
        style={{ width: "100%", border: `1.4px solid ${colors.line}`, borderRadius: radii.md, padding: "9px 11px", fontSize: fontSize.body, background: colors.surface, color: colors.ink, outline: "none", marginBottom: 10 }}>
        {TIMES.map(m => <option key={m} value={m}>{fmt(m)} {"–"} {fmt(m + 15)}</option>)}
      </select>

      <div style={{ borderRadius: radii.lg, padding: "10px 12px", fontSize: fontSize.meta, lineHeight: 1.5, background: conflicts.length ? oxbloodSoft : colors.goSoft, color: conflicts.length ? colors.oxblood : colors.go, display: "flex", gap: 8, marginBottom: 10 }}>
        {conflicts.length ? <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <Check size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
        <div>
          {conflicts.length
            ? `Overlaps with ${conflicts.map(c => `"${c.title}" (${fmt(c.start)}-${fmt(c.end)})`).join(" and ")}.`
            : "This slot is free on your schedule."}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={() => { onPropose(day, start); setOpen(false) }}>
          {conflicts.length ? "Propose anyway" : `Propose to ${person.name.split(" ")[0]}`}
        </Button>
      </div>
    </div>
  )
}

export default PersonPanel
