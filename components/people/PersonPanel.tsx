"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { X, Send, AlertTriangle, Check, CalendarDays, Linkedin, Github, Twitter, Instagram, Pencil } from "lucide-react"
import { Avatar } from "@/components/shell/Avatar"
import { Button } from "@/components/ui/Button"
import { Tag } from "@/components/ui/Tag"
import { useDirectMessages } from "@/lib/hooks/useDirectMessages"
import { useCatchup, CATCHUP_MINUTES } from "@/lib/hooks/useCatchups"
import { useProfileById } from "@/lib/hooks/useProfileById"
import { useSocial, type ChatPerson } from "@/components/shell/SocialProvider"
import { fmt, catchupWhen } from "@/lib/time"
import { colors, radii, fonts, fontSize, fontWeight, spacing, shadows } from "@/lib/design/tokens"

const oxbloodSoft = colors.liveSoft

export interface PersonPanelProps {
  person: ChatPerson
  /** Which section to draw attention to on open — all always render. */
  focus: "profile" | "chat" | "catchup"
  onClose: () => void
}

export function PersonPanel({ person, focus, onClose }: PersonPanelProps) {
  const { thread, send, meId } = useDirectMessages(person.id)
  const { catchup, propose, accept, decline, cancel } = useCatchup(person.id)
  const { catchups: myCatchups } = useSocial()
  // Fill in the full profile by id, so opening from a bare avatar (id + name
  // only) still shows bio, skills, links, etc.
  const { profile } = useProfileById(person.id)

  const [input, setInput] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const catchupRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [thread])

  useEffect(() => {
    if (focus === "chat") inputRef.current?.focus()
    else if (focus === "catchup") catchupRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    // "profile" is the default view; the drawer already opens scrolled to top.
  }, [focus])

  // Prefer live profile fields, fall back to whatever the caller passed.
  const occupation = profile?.occupation ?? person.occupation ?? null
  const org = profile?.org ?? person.org ?? null
  const tagline = profile?.tagline ?? null
  const bio = profile?.bio ?? person.bio ?? null
  const skills = profile?.skills ?? person.tags ?? []
  const industries = profile?.industries ?? person.industries ?? []
  const looking = profile?.looking ?? person.looking ?? []
  const links = profile?.links ?? {}
  const socials = [
    links.linkedin && { href: links.linkedin, label: "LinkedIn", icon: <Linkedin size={14} /> },
    links.github && { href: links.github, label: "GitHub", icon: <Github size={14} /> },
    links.x && { href: links.x, label: "X", icon: <Twitter size={14} /> },
    links.instagram && { href: links.instagram, label: "Instagram", icon: <Instagram size={14} /> },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[]
  const isMe = meId != null && meId === person.id

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
      <div role="dialog" aria-modal="true" aria-label={`${person.name}'s profile`} onClick={e => e.stopPropagation()}
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

        {/* Profile block — bio, focus areas, links. Bounded + scrolls if long. */}
        {(tagline || bio || skills.length || industries.length || looking.length || socials.length > 0) && (
          <div style={{ padding: "14px 16px", borderBottom: `1.4px solid ${colors.line}`, flexShrink: 0, maxHeight: "42vh", overflowY: "auto" }}>
            {tagline && (
              <p style={{ margin: `0 0 ${spacing[2]}px`, fontFamily: fonts.body, fontStyle: "italic", fontSize: fontSize.body, color: colors.ink }}>{tagline}</p>
            )}
            {bio && (
              <p style={{ margin: `0 0 ${spacing[3]}px`, fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, lineHeight: 1.55 }}>{bio}</p>
            )}
            {skills.length > 0 && <TagRow label="Skills" items={skills} tone="ink" />}
            {industries.length > 0 && <TagRow label="Industries" items={industries} tone="violet" />}
            {looking.length > 0 && <TagRow label="Looking for" items={looking} tone="go" />}
            {socials.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[3] }}>
                {socials.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: radii.pill, border: `1.3px solid ${colors.line}`, background: colors.panel, color: colors.ink, fontFamily: fonts.mono, fontSize: fontSize.label, textDecoration: "none" }}>
                    {s.icon} {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* messaging — hidden for your own profile (can't message yourself) */}
        {!isMe && (
        <>
        {/* catchup status strip */}
        <div ref={catchupRef}>
          <CatchupStrip
            person={person}
            meId={meId}
            catchup={catchup}
            myCatchups={myCatchups}
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
        </>
        )}

        {isMe && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: spacing[3], padding: spacing[6], textAlign: "center" }}>
            <span style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.mutedSoft }}>This is how your profile looks to others.</span>
            <Link href="/profile" onClick={onClose} style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm" icon={<Pencil size={14} />}>Edit profile</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

/** A labeled row of tags in the profile block. */
function TagRow({ label, items, tone }: { label: string; items: string[]; tone: "ink" | "violet" | "go" }) {
  return (
    <div style={{ marginBottom: spacing[3] }}>
      <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.mutedSoft, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((t) => <Tag key={t} tone={tone}>{t}</Tag>)}
      </div>
    </div>
  )
}

interface CatchupStripProps {
  person: ChatPerson
  meId: string | null
  catchup: ReturnType<typeof useCatchup>["catchup"]
  myCatchups: ReturnType<typeof useSocial>["catchups"]
  propose: (startsAtISO: string) => Promise<void>
  accept: () => Promise<void>
  decline: () => Promise<void>
  cancel: () => Promise<void>
}

function CatchupStrip({ person, meId, catchup, myCatchups, propose, accept, decline, cancel }: CatchupStripProps) {
  if (!catchup) {
    return <ProposeCatchupForm person={person} myCatchups={myCatchups} onPropose={propose} />
  }

  const timeLabel = catchupWhen(catchup.starts_at, catchup.ends_at, new Date())
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

/** yyyy-mm-dd for a Date in local time (for <input type="date">). */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function ProposeCatchupForm({
  person, myCatchups, onPropose,
}: {
  person: ChatPerson
  myCatchups: ReturnType<typeof useSocial>["catchups"]
  onPropose: (startsAtISO: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const today = useMemo(() => toDateInput(new Date()), [])
  const [date, setDate] = useState<string>(today)
  const [startMin, setStartMin] = useState<number>(11 * 60) // 11:00

  const TIMES = useMemo(() => {
    const arr: number[] = []
    for (let m = 8 * 60; m <= 22 * 60 + 45; m += 15) arr.push(m)
    return arr
  }, [])

  // Compose the proposed window as real timestamps.
  const [y, mo, d] = date.split("-").map(Number)
  const startsAt = new Date(y, (mo ?? 1) - 1, d ?? 1, Math.floor(startMin / 60), startMin % 60)
  const startMs = startsAt.getTime()
  const endMs = startMs + CATCHUP_MINUTES * 60_000

  // Warn if it overlaps one of your already-accepted catchups.
  const conflict = myCatchups.find((c) => {
    if (c.status !== "accepted" || !c.starts_at) return false
    const cs = new Date(c.starts_at).getTime()
    const ce = c.ends_at ? new Date(c.ends_at).getTime() : cs + CATCHUP_MINUTES * 60_000
    return cs < endMs && startMs < ce
  })

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
      <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Date</div>
      <input
        type="date"
        value={date}
        min={today}
        onChange={(e) => setDate(e.target.value)}
        style={{ width: "100%", border: `1.4px solid ${colors.line}`, borderRadius: radii.md, padding: "9px 11px", fontSize: fontSize.body, background: colors.surface, color: colors.ink, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
      />

      <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Time</div>
      <select value={startMin} onChange={(e) => setStartMin(+e.target.value)}
        style={{ width: "100%", border: `1.4px solid ${colors.line}`, borderRadius: radii.md, padding: "9px 11px", fontSize: fontSize.body, background: colors.surface, color: colors.ink, outline: "none", marginBottom: 10 }}>
        {TIMES.map((m) => <option key={m} value={m}>{fmt(m)} {"–"} {fmt(m + CATCHUP_MINUTES)}</option>)}
      </select>

      {conflict && (
        <div style={{ borderRadius: radii.lg, padding: "10px 12px", fontSize: fontSize.meta, lineHeight: 1.5, background: oxbloodSoft, color: colors.oxblood, display: "flex", gap: 8, marginBottom: 10 }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>You already have a catchup with {conflict.otherName ?? "someone"} at that time.</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={() => { onPropose(startsAt.toISOString()); setOpen(false) }}>
          {conflict ? "Propose anyway" : `Propose to ${person.name.split(" ")[0]}`}
        </Button>
      </div>
    </div>
  )
}

export default PersonPanel
