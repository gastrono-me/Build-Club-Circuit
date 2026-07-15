"use client"

import React, { useMemo, useState } from "react"
import { CalendarClock, Check, ChevronDown, ChevronUp, LifeBuoy, MessageCircle, Plus, Radio, Users, X } from "lucide-react"
import { useCoworking } from "@/lib/hooks/useCoworking"
import { useProjects } from "@/lib/hooks/useProjects"
import { useProfile } from "@/lib/hooks/useProfile"
import { useSocial } from "@/components/shell/SocialProvider"
import { useIsAdmin } from "@/lib/hooks/useIsAdmin"
import { rankLiveMatches, huddlePhase } from "@/lib/coworking/matching"
import { COWORKING_GOALS, HUDDLE_KINDS, type CoworkingGoal, type HuddleKind } from "@/lib/coworking/types"
import { ALL_TAGS, INDUSTRIES } from "@/types/index"
import { Avatar } from "@/components/shell/Avatar"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Tag } from "@/components/ui/Tag"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

interface Props {
  eventId: string
  eventName: string
  startsAt: string
  endsAt: string
  capacity: number | null
  cancelled?: boolean
}

export function CoworkingEvent({ eventId, eventName, startsAt, endsAt, capacity, cancelled = false }: Props) {
  const coworking = useCoworking(eventId, startsAt, endsAt)
  const { isAdmin } = useIsAdmin()
  const now = new Date()
  const eventIsOpen = !cancelled && now >= new Date(startsAt) && now < new Date(endsAt)
  const isFull = capacity !== null && coworking.activeCheckins.length >= capacity
  const closedMessage = cancelled
    ? "This event was cancelled. Live coworking is closed."
    : now < new Date(startsAt)
    ? "Check-in opens when the event starts."
    : "Check-in has closed for this event."

  if (coworking.loading) {
    return <div style={quietStyle}>Loading live pulse…</div>
  }

  return (
    <section aria-label="Live coworking" style={{ marginBottom: spacing[8] }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: spacing[3], marginBottom: spacing[3], flexWrap: "wrap" }}>
        <div>
          <div style={kickerStyle}><Radio size={12} /> Live Pulse</div>
          <h2 style={{ margin: `${spacing[1]}px 0 0`, fontFamily: fonts.display, fontSize: fontSize.title, color: colors.ink }}>
            Work the room, then ship
          </h2>
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.go }}>
          {coworking.activeCheckins.length}{capacity ? `/${capacity}` : ""} here now
        </div>
      </div>

      {!coworking.myCheckin || coworking.myCheckin.checked_out_at ? (
        eventIsOpen && !isFull ? (
          <CheckInCard eventName={eventName} onCheckIn={coworking.checkIn} />
        ) : (
          <Card padding={spacing[4]}>
            <div style={quietStyle}>{isFull ? `This event is at its ${capacity}-builder capacity.` : closedMessage}</div>
          </Card>
        )
      ) : (
        <FocusSession coworking={coworking} />
      )}

      {coworking.activeCheckins.length > 0 && (
        <>
          <LiveRoom coworking={coworking} />
          {coworking.myCheckin && !coworking.myCheckin.checked_out_at && <LiveMatches coworking={coworking} />}
        </>
      )}

      <Huddles coworking={coworking} startsAt={startsAt} endsAt={endsAt} />
      <DemoQueue coworking={coworking} isAdmin={isAdmin} />
    </section>
  )
}

type CoworkingApi = ReturnType<typeof useCoworking>

function CheckInCard({
  eventName,
  onCheckIn,
}: {
  eventName: string
  onCheckIn: CoworkingApi["checkIn"]
}) {
  const { mine } = useProjects()
  const [projectId, setProjectId] = useState("")
  const [goal, setGoal] = useState<CoworkingGoal>("Deep work")
  const [intention, setIntention] = useState("")
  const [items, setItems] = useState<string[]>([""])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!intention.trim()) { setError("Say what you want to leave with."); return }
    setBusy(true); setError(null)
    try {
      await onCheckIn({ projectId: projectId || null, goal, intention, focusItems: items })
    } catch (err: any) {
      setError(err?.message ?? "Check-in failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card spine="go" padding={spacing[4]} style={{ marginBottom: spacing[5] }}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: spacing[4] }}>
        <div>
          <div style={kickerStyle}>Check in to {eventName}</div>
          <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, marginTop: 4 }}>
            Your live intention helps the room find useful ways to work with you.
          </div>
        </div>

        <label style={fieldLabelStyle}>
          <span style={labelTextStyle}>Project</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={selectStyle}>
            <option value="">No project</option>
            {mine.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>

        <div>
          <div style={labelTextStyle}>What are you here for?</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[2] }}>
            {COWORKING_GOALS.map((option) => (
              <Tag key={option} active={goal === option} onClick={() => setGoal(option)}>{option}</Tag>
            ))}
          </div>
        </div>

        <Input
          label="This session I want to…"
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          placeholder="Ship onboarding and get feedback on the flow"
          maxLength={240}
        />

        <div>
          <div style={labelTextStyle}>Optional focus items</div>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[2], marginTop: spacing[2] }}>
            {items.map((item, index) => (
              <div key={index} style={{ display: "flex", gap: spacing[2] }}>
                <input
                  value={item}
                  onChange={(e) => setItems((rows) => rows.map((row, i) => i === index ? e.target.value : row))}
                  placeholder={`Outcome ${index + 1}`}
                  maxLength={160}
                  style={plainInputStyle}
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))} aria-label="Remove focus item" style={iconButtonStyle}>
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            {items.length < 3 && (
              <button type="button" onClick={() => setItems((rows) => [...rows, ""])} style={textButtonStyle}>
                <Plus size={13} /> Add outcome
              </button>
            )}
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}
        <Button type="submit" variant="accent" disabled={busy || !intention.trim()}>{busy ? "Checking in…" : "Check in"}</Button>
      </form>
    </Card>
  )
}

function FocusSession({ coworking }: { coworking: CoworkingApi }) {
  const session = coworking.myCheckin!
  const [newItem, setNewItem] = useState("")
  const [busy, setBusy] = useState(false)
  const done = session.focus_items.filter((item) => item.completed_at).length
  const pct = session.focus_items.length ? Math.round((done / session.focus_items.length) * 100) : 0

  async function addItem() {
    if (!newItem.trim()) return
    setBusy(true)
    try { await coworking.addFocusItem(newItem); setNewItem("") }
    finally { setBusy(false) }
  }

  return (
    <Card spine="go" padding={spacing[4]} style={{ marginBottom: spacing[5] }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing[3], alignItems: "flex-start" }}>
        <div>
          <div style={kickerStyle}><span style={liveDotStyle} /> Checked in</div>
          <h3 style={{ fontFamily: fonts.display, fontSize: fontSize.heading, margin: `${spacing[2]}px 0 2px`, color: colors.ink }}>{session.intention}</h3>
          <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted }}>
            {[session.project_name, session.goal].filter(Boolean).join(" · ")}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => coworking.checkOut()}>Check out</Button>
      </div>

      {session.focus_items.length > 0 && (
        <div style={{ marginTop: spacing[4] }}>
          <div style={{ height: 5, borderRadius: radii.pill, background: colors.line, overflow: "hidden", marginBottom: spacing[3] }}>
            <div style={{ height: "100%", width: `${pct}%`, background: colors.go, transition: "width 180ms ease" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
            {session.focus_items.map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
                <button type="button" onClick={() => coworking.toggleFocusItem(item)} aria-label={item.completed_at ? "Mark incomplete" : "Mark complete"} style={checkButtonStyle(!!item.completed_at)}>
                  {item.completed_at && <Check size={13} />}
                </button>
                <span style={{ flex: 1, fontFamily: fonts.body, fontSize: fontSize.body, color: item.completed_at ? colors.mutedSoft : colors.ink, textDecoration: item.completed_at ? "line-through" : "none" }}>
                  {item.title}
                </span>
                <button type="button" onClick={() => coworking.removeFocusItem(item.id)} aria-label="Remove focus item" style={iconButtonStyle}><X size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: spacing[2], marginTop: spacing[4] }}>
        <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem() } }} placeholder="Add a focus item" maxLength={160} style={plainInputStyle} />
        <Button size="sm" variant="secondary" disabled={busy || !newItem.trim()} onClick={addItem}>Add</Button>
      </div>
      <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft, marginTop: spacing[3] }}>
        {session.focus_items.length ? `${done}/${session.focus_items.length} complete` : "Focus items are optional. Your ship is the durable outcome."}
      </div>
    </Card>
  )
}

function LiveRoom({ coworking }: { coworking: CoworkingApi }) {
  const [open, setOpen] = useState(false)
  const visible = open ? coworking.activeCheckins : coworking.activeCheckins.slice(0, 6)
  return (
    <div style={{ marginBottom: spacing[5] }}>
      <button type="button" onClick={() => setOpen((value) => !value)} style={{ ...textButtonStyle, width: "100%", justifyContent: "space-between", color: colors.ink }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: spacing[2] }}><Users size={14} /> In the room ({coworking.activeCheckins.length})</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: spacing[2], marginTop: spacing[3] }}>
        {visible.map((person) => (
          <div key={person.id} style={{ display: "flex", gap: spacing[2], alignItems: "center", padding: spacing[3], border: `1px solid ${colors.line}`, borderRadius: radii.lg, background: colors.panel }}>
            <Avatar name={person.profile_name} photo={person.profile_avatar} size={34} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: fonts.body, fontWeight: fontWeight.semibold, fontSize: fontSize.meta, color: colors.ink }}>{person.profile_name}</div>
              <div style={{ fontFamily: fonts.body, fontSize: fontSize.micro, color: colors.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.intention}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LiveMatches({ coworking }: { coworking: CoworkingApi }) {
  const { openPanel } = useSocial()
  const matches = useMemo(() => rankLiveMatches(coworking.myCheckin, coworking.activeCheckins, 3), [coworking.myCheckin, coworking.activeCheckins])
  if (!matches.length) return null
  return (
    <div style={{ marginBottom: spacing[6] }}>
      <div style={{ ...kickerStyle, marginBottom: spacing[3] }}>People to meet now</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: spacing[3] }}>
        {matches.map(({ checkin, reason }) => (
          <Card key={checkin.id} padding={spacing[3]}>
            <div style={{ display: "flex", gap: spacing[2], alignItems: "center" }}>
              <Avatar name={checkin.profile_name} photo={checkin.profile_avatar} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: fonts.body, fontWeight: fontWeight.semibold, fontSize: fontSize.meta, color: colors.ink }}>{checkin.profile_name}</div>
                <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.violet }}>{checkin.goal}</div>
              </div>
            </div>
            <p style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, lineHeight: 1.45, margin: `${spacing[3]}px 0` }}>{reason}</p>
            <Button size="sm" variant="secondary" icon={<MessageCircle size={13} />} onClick={() => openPanel({
              id: checkin.user_id,
              name: checkin.profile_name,
              occupation: checkin.profile_occupation ?? undefined,
              tags: checkin.profile_skills,
              industries: checkin.profile_industries,
              looking: checkin.profile_looking,
              avatar: checkin.profile_avatar,
            }, "chat")}>Connect</Button>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Huddles({ coworking, startsAt, endsAt }: { coworking: CoworkingApi; startsAt: string; endsAt: string }) {
  const { profile } = useProfile()
  const [open, setOpen] = useState(false)
  const [spaceId, setSpaceId] = useState("")
  const [topic, setTopic] = useState("")
  const [kind, setKind] = useState<HuddleKind>("Discussion")
  const [start, setStart] = useState(() => toLocalInput(nextQuarter(new Date())))
  const [skills, setSkills] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyHuddleId, setBusyHuddleId] = useState<string | null>(null)
  const now = new Date()
  const shown = coworking.huddles.filter((huddle) => huddlePhase(huddle.starts_at, huddle.ends_at, huddle.status, now) !== "cancelled")

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    const startDate = new Date(start)
    const endDate = new Date(startDate.getTime() + 15 * 60_000)
    if (startDate < new Date(startsAt) || endDate > new Date(endsAt)) {
      setError("Choose a time inside the event window."); return
    }
    setBusy(true); setError(null)
    try {
      await coworking.createHuddle({ spaceId: spaceId || null, topic, kind, welcomeSkills: skills, welcomeIndustries: industries, startsAt: startDate.toISOString(), endsAt: endDate.toISOString() })
      setTopic(""); setOpen(false)
    } catch (err: any) {
      setError(err?.message ?? "Could not start huddle")
    } finally { setBusy(false) }
  }

  function toggle(list: string[], setList: (value: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value])
  }

  async function toggleHuddle(huddleId: string, joined: boolean) {
    setBusyHuddleId(huddleId)
    setError(null)
    try {
      await (joined ? coworking.leaveHuddle(huddleId) : coworking.joinHuddle(huddleId))
    } catch (err: any) {
      setError(err?.message ?? "Could not update huddle attendance")
    } finally {
      setBusyHuddleId(null)
    }
  }

  return (
    <div style={{ marginBottom: spacing[6] }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing[3], marginBottom: spacing[3] }}>
        <div>
          <div style={kickerStyle}><CalendarClock size={12} /> Huddles</div>
          <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, marginTop: 3 }}>Book 15 minutes to present, ask for help, or gather people around a topic.</div>
        </div>
        {coworking.myCheckin && !coworking.myCheckin.checked_out_at && (
          <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={() => setOpen((value) => !value)}>Huddle</Button>
        )}
      </div>

      {open && (
        <Card spine="violet" padding={spacing[4]} style={{ marginBottom: spacing[3] }}>
          <form onSubmit={create} style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
            <Input label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Need feedback on onboarding" maxLength={160} autoFocus />
            <div style={{ display: "flex", gap: spacing[3], flexWrap: "wrap" }}>
              <label style={{ ...fieldLabelStyle, flex: "1 1 180px" }}><span style={labelTextStyle}>Space</span><select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} style={selectStyle}><option value="">Anywhere</option>{coworking.spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
              <label style={{ ...fieldLabelStyle, flex: "1 1 180px" }}><span style={labelTextStyle}>Starts</span><input type="datetime-local" value={start} min={toLocalInput(new Date(startsAt))} max={toLocalInput(new Date(endsAt))} onChange={(e) => setStart(e.target.value)} style={plainInputStyle} /></label>
            </div>
            <div><div style={labelTextStyle}>Type</div><div style={{ display: "flex", gap: spacing[2], flexWrap: "wrap", marginTop: spacing[2] }}>{HUDDLE_KINDS.map((option) => <Tag key={option} active={kind === option} onClick={() => setKind(option)}>{option}</Tag>)}</div></div>
            <details>
              <summary style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.muted, cursor: "pointer" }}>Target an audience (optional)</summary>
              <div style={{ marginTop: spacing[3] }}>
                <div style={labelTextStyle}>Skills</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: `${spacing[2]}px 0 ${spacing[3]}px` }}>{ALL_TAGS.map((value) => <Tag key={value} active={skills.includes(value)} onClick={() => toggle(skills, setSkills, value)}>{value}</Tag>)}</div>
                <div style={labelTextStyle}>Industries</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: spacing[2] }}>{INDUSTRIES.map((value) => <Tag key={value} active={industries.includes(value)} onClick={() => toggle(industries, setIndustries, value)}>{value}</Tag>)}</div>
                {profile && <div style={{ fontFamily: fonts.body, fontSize: fontSize.micro, color: colors.mutedSoft, marginTop: spacing[2] }}>Matching checked-in builders receive an in-app alert.</div>}
              </div>
            </details>
            {error && <div style={errorStyle}>{error}</div>}
            <div style={{ display: "flex", gap: spacing[2] }}><Button type="submit" variant="accent" disabled={busy || !topic.trim()}>{busy ? "Booking…" : "Book 15 min"}</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
          </form>
        </Card>
      )}

      {!open && error && <div role="alert" style={{ ...errorStyle, marginBottom: spacing[3] }}>{error}</div>}

      {shown.length === 0 ? (
        <div style={emptyStyle}>No huddles booked yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
          {shown.map((huddle) => {
            const phase = huddlePhase(huddle.starts_at, huddle.ends_at, huddle.status, now)
            const joined = !!coworking.userId && huddle.participant_ids.includes(coworking.userId)
            const own = coworking.userId === huddle.host_id
            return (
              <Card key={huddle.id} padding={spacing[3]} spine={phase === "live" ? "go" : "none"} data-testid="huddle-card">
                <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
                  <Avatar name={huddle.host_name} photo={huddle.host_avatar} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: spacing[2], alignItems: "center", flexWrap: "wrap" }}><strong style={{ fontFamily: fonts.body, fontSize: fontSize.body, color: colors.ink }}>{huddle.topic}</strong><span style={{ ...phaseStyle(phase) }}>{phase}</span></div>
                    <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.muted, marginTop: 2 }}>{huddle.kind} · {huddle.space_name ?? "Anywhere"} · {formatTime(huddle.starts_at)} to {formatTime(huddle.ends_at)} · {huddle.participant_ids.length} joined</div>
                  </div>
                  {own ? (
                    phase !== "ended" && <Button size="sm" variant="danger" onClick={() => coworking.setHuddleStatus(huddle.id, "cancelled")}>Cancel</Button>
                  ) : coworking.myCheckin && phase !== "ended" ? (
                    <Button size="sm" variant={joined ? "ghost" : "secondary"} disabled={busyHuddleId === huddle.id} onClick={() => toggleHuddle(huddle.id, joined)}>{busyHuddleId === huddle.id ? "…" : joined ? "Leave" : "Join"}</Button>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DemoQueue({ coworking, isAdmin }: { coworking: CoworkingApi; isAdmin: boolean }) {
  const [shipId, setShipId] = useState(coworking.myDemo?.post_id ?? "")
  if (!coworking.myCheckin && coworking.demos.length === 0) return null
  return (
    <div style={{ marginBottom: spacing[6] }}>
      <div style={{ ...kickerStyle, marginBottom: spacing[3] }}>Lightning demo queue</div>
      {coworking.myCheckin && !coworking.myCheckin.checked_out_at && (
        coworking.myShips.length > 0 ? (
          <Card padding={spacing[3]} style={{ marginBottom: spacing[3] }}>
            <div style={{ display: "flex", gap: spacing[2], alignItems: "center", flexWrap: "wrap" }}>
              <select aria-label="Ship for lightning demo" value={shipId} onChange={(e) => setShipId(e.target.value)} style={{ ...selectStyle, flex: "1 1 240px" }}>
                <option value="">Choose one of your event ships</option>
                {coworking.myShips.map((ship) => <option key={ship.id} value={ship.id}>{ship.note.slice(0, 80)}</option>)}
              </select>
              <Button size="sm" variant="accent" disabled={!shipId} onClick={() => coworking.queueDemo(shipId)}>{coworking.myDemo ? "Update demo" : "Join queue"}</Button>
              {coworking.myDemo && <Button size="sm" variant="ghost" onClick={coworking.unqueueDemo}>Leave queue</Button>}
            </div>
          </Card>
        ) : (
          <div style={{ ...emptyStyle, marginBottom: spacing[3] }}>Log a ship in this event, then bring it to the lightning demo queue.</div>
        )
      )}
      {coworking.demos.length === 0 ? <div style={emptyStyle}>The demo queue is empty.</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
          {coworking.demos.map((demo, index) => (
            <div key={demo.id} style={{ display: "flex", alignItems: "center", gap: spacing[3], padding: spacing[3], border: `1px solid ${colors.line}`, background: colors.panel, borderRadius: radii.lg }}>
              <span style={{ fontFamily: fonts.mono, fontSize: fontSize.heading, color: colors.violet, width: 24 }}>{index + 1}</span>
              <Avatar name={demo.builder_name} photo={demo.builder_avatar} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: fonts.body, fontWeight: fontWeight.semibold, fontSize: fontSize.meta, color: colors.ink }}>{demo.builder_name}</div><div style={{ fontFamily: fonts.body, fontSize: fontSize.micro, color: colors.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{demo.ship_note}</div></div>
              <span style={phaseStyle(demo.status)}>{demo.status}</span>
              {isAdmin && demo.status === "queued" && <Button size="sm" variant="secondary" onClick={() => coworking.setDemoStatus(demo.id, "presented")}>Presented</Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function nextQuarter(date: Date): Date {
  const next = new Date(date)
  next.setSeconds(0, 0)
  next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15)
  return next
}

function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

const kickerStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontFamily: fonts.mono, fontSize: fontSize.label, fontWeight: fontWeight.semibold, color: colors.violet, letterSpacing: "0.07em", textTransform: "uppercase" }
const labelTextStyle: React.CSSProperties = { display: "block", fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.muted }
const fieldLabelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: spacing[2] }
const plainInputStyle: React.CSSProperties = { flex: 1, minWidth: 0, boxSizing: "border-box", border: `1.4px solid ${colors.line}`, borderRadius: radii.md, background: colors.paper2, color: colors.ink, fontFamily: fonts.body, fontSize: fontSize.body, padding: "10px 12px", outline: "none" }
const selectStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: `1.4px solid ${colors.line}`, borderRadius: radii.md, background: colors.paper2, color: colors.ink, fontFamily: fonts.body, fontSize: fontSize.body, padding: "10px 12px", outline: "none" }
const iconButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: radii.md, border: `1px solid ${colors.line}`, background: "transparent", color: colors.muted, cursor: "pointer", flexShrink: 0 }
const textButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: colors.violet, fontFamily: fonts.mono, fontSize: fontSize.label, cursor: "pointer", padding: 0 }
const quietStyle: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, padding: `${spacing[4]}px 0` }
const emptyStyle: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, border: `1px dashed ${colors.line}`, borderRadius: radii.lg, padding: spacing[4], textAlign: "center" }
const errorStyle: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.oxblood, background: colors.liveSoft, borderRadius: radii.md, padding: spacing[3] }
const liveDotStyle: React.CSSProperties = { width: 7, height: 7, borderRadius: radii.pill, background: colors.go, display: "inline-block" }
const checkButtonStyle = (checked: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 21, height: 21, borderRadius: radii.pill, border: `1.5px solid ${checked ? colors.go : colors.line}`, background: checked ? colors.go : "transparent", color: colors.onDark, cursor: "pointer", padding: 0, flexShrink: 0 })
const phaseStyle = (phase: string): React.CSSProperties => ({ fontFamily: fonts.mono, fontSize: fontSize.micro, textTransform: "uppercase", letterSpacing: "0.05em", color: phase === "live" || phase === "presented" ? colors.go : phase === "cancelled" || phase === "skipped" ? colors.oxblood : colors.violet, background: phase === "live" || phase === "presented" ? colors.goSoft : phase === "cancelled" || phase === "skipped" ? colors.liveSoft : colors.violetSoft, borderRadius: radii.pill, padding: "2px 7px", whiteSpace: "nowrap" })

export default CoworkingEvent
