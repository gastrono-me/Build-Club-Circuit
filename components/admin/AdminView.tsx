"use client"

import React, { useState } from "react"
import Link from "next/link"
import { CalendarRange, Pencil, Trash2, Plus, MonitorPlay, SlidersHorizontal } from "lucide-react"
import { useEvents, type EventRow } from "@/lib/hooks/useEvents"
import { eventStatus } from "@/lib/events/eventStatus"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"
import { SkeletonFeed } from "@/components/ui/Skeleton"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

/** ISO timestamp -> value for a <input type="datetime-local"> (local time). */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/** datetime-local value -> ISO. Empty -> "". */
function fromLocalInput(v: string): string {
  return v ? new Date(v).toISOString() : ""
}
/** Name -> URL slug. */
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60)
}

interface Draft {
  slug: string
  name: string
  tagline: string
  location: string
  capacity: string
  starts_at: string // datetime-local value
  ends_at: string
}

const EMPTY: Draft = { slug: "", name: "", tagline: "", location: "", capacity: "", starts_at: "", ends_at: "" }

export function AdminView() {
  const { events, memberCounts, loading, create, update, remove } = useEvents()
  const [now] = useState(() => new Date())

  const [editingId, setEditingId] = useState<string | null>(null) // null = closed, "new" = create
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openCreate() {
    setDraft(EMPTY); setSlugTouched(false); setError(null); setEditingId("new")
  }
  function openEdit(e: EventRow) {
    setDraft({
      slug: e.slug,
      name: e.name,
      tagline: e.tagline ?? "",
      location: e.location ?? "",
      capacity: e.capacity ? String(e.capacity) : "",
      starts_at: toLocalInput(e.starts_at),
      ends_at: toLocalInput(e.ends_at),
    })
    setSlugTouched(true); setError(null); setEditingId(e.id)
  }
  function close() { setEditingId(null); setDraft(EMPTY) }

  function setName(name: string) {
    setDraft((d) => ({ ...d, name, slug: slugTouched ? d.slug : slugify(name) }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.name.trim() || !draft.slug.trim()) { setError("Name and slug are required."); return }
    if (!draft.starts_at || !draft.ends_at) { setError("Start and end times are required."); return }
    if (new Date(draft.ends_at) <= new Date(draft.starts_at)) { setError("End must be after start."); return }
    setBusy(true); setError(null)
    try {
      const payload = {
        slug: draft.slug,
        name: draft.name,
        tagline: draft.tagline,
        location: draft.location,
        capacity: draft.capacity ? Number(draft.capacity) : null,
        starts_at: fromLocalInput(draft.starts_at),
        ends_at: fromLocalInput(draft.ends_at),
      }
      if (editingId === "new") await create(payload)
      else if (editingId) await update(editingId, payload)
      close()
    } catch (err: any) {
      // Unique-slug clashes surface here.
      setError(err?.message?.includes("duplicate") ? "That slug is already taken." : (err?.message ?? "Save failed"))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(ev: EventRow) {
    if (!window.confirm(`Delete "${ev.name}"? Members lose the event; their ships and blockers stay in the log.`)) return
    try {
      await remove(ev.id)
    } catch (err) {
      console.error("[admin] delete event failed:", err)
    }
  }

  return (
    <div>
      <SectionTitle kicker="Admin" title="Events" note="Create and manage the events that show on the Events tab. Only staff can see this." />

      <Link
        href="/admin/screen"
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          border: `1.4px solid ${colors.line}`, borderRadius: radii.md,
          padding: "8px 13px", margin: `${spacing[4]}px 0 0`, textDecoration: "none",
          fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.violet, background: colors.panel,
        }}
      >
        <MonitorPlay size={15} /> Open projector view — a rotating ship carousel for a screen
      </Link>

      {editingId === null && (
        <div style={{ margin: `${spacing[4]}px 0 ${spacing[6]}px` }}>
          <Button variant="accent" icon={<Plus size={15} />} onClick={openCreate}>New event</Button>
        </div>
      )}

      {editingId !== null && (
        <Card spine="violet" padding={spacing[4]} style={{ margin: `${spacing[4]}px 0 ${spacing[6]}px` }}>
          <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
            <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.06em", textTransform: "uppercase", color: colors.violet }}>
              {editingId === "new" ? "New event" : "Edit event"}
            </div>
            <Input label="Name" value={draft.name} onChange={(e) => setName(e.target.value)} placeholder="Circuit Launch Sprint" autoFocus required />
            <Input label="Slug (URL handle)" value={draft.slug} onChange={(e) => { setSlugTouched(true); setDraft((d) => ({ ...d, slug: slugify(e.target.value) })) }} placeholder="circuit-sprint" required />
            <Input label="Tagline (optional)" value={draft.tagline} onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))} placeholder="A weekend to ship your next thing." />
            <Input label="Location (optional)" value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} placeholder="Online, or a city" />
            <Input label="Capacity (optional)" type="number" min="1" value={draft.capacity} onChange={(e) => setDraft((d) => ({ ...d, capacity: e.target.value }))} placeholder="80" />
            <div style={{ display: "flex", gap: spacing[3], flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 160px", ...labelStyle }}>
                <span style={labelText}>Starts</span>
                <input type="datetime-local" value={draft.starts_at} onChange={(e) => setDraft((d) => ({ ...d, starts_at: e.target.value }))} required style={dateInputStyle} />
              </label>
              <label style={{ flex: "1 1 160px", ...labelStyle }}>
                <span style={labelText}>Ends</span>
                <input type="datetime-local" value={draft.ends_at} onChange={(e) => setDraft((d) => ({ ...d, ends_at: e.target.value }))} required style={dateInputStyle} />
              </label>
            </div>
            {error && <p style={{ margin: 0, fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.live }}>{error}</p>}
            <div style={{ display: "flex", gap: spacing[2] }}>
              <Button type="submit" variant="accent" disabled={busy}>{busy ? "Saving…" : editingId === "new" ? "Create event" : "Save changes"}</Button>
              <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <SkeletonFeed count={2} label="Loading events" />
      ) : events.length === 0 ? (
        <div style={{ fontFamily: fonts.body, fontSize: fontSize.body, color: colors.muted, textAlign: "center", padding: `${spacing[8]}px 0` }}>
          No events yet. Create the first one.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
          {events.map((ev) => {
            const { phase } = eventStatus(ev.starts_at, ev.ends_at, now)
            return (
              <Card key={ev.id} padding={spacing[4]}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: spacing[3] }}>
                  <CalendarRange size={18} color={colors.violet} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: spacing[2], flexWrap: "wrap" }}>
                      <span style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, color: colors.ink }}>{ev.name}</span>
                      <PhaseTag phase={phase} />
                    </div>
                    <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft, marginTop: 2 }}>
                      /{ev.slug} · {memberCounts[ev.id] ?? 0} member{(memberCounts[ev.id] ?? 0) === 1 ? "" : "s"} · {fmtRange(ev.starts_at, ev.ends_at)}
                    </div>
                    {ev.tagline && <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, marginTop: spacing[1] }}>{ev.tagline}</div>}
                  </div>
                  <div style={{ display: "flex", gap: spacing[1], flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Link href={`/admin/events/${ev.id}`} style={{ textDecoration: "none" }}>
                      <Button variant="ghost" size="sm" icon={<SlidersHorizontal size={13} />}>Operate</Button>
                    </Link>
                    <Link href={`/events/${ev.slug}/board`} style={{ textDecoration: "none" }}>
                      <Button variant="ghost" size="sm" icon={<MonitorPlay size={13} />}>Board</Button>
                    </Link>
                    <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(ev)}>Edit</Button>
                    <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => handleDelete(ev)}>Delete</Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PhaseTag({ phase }: { phase: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    live: { bg: colors.goSoft, fg: colors.go, label: "Live" },
    upcoming: { bg: colors.violetSoft, fg: colors.violet, label: "Upcoming" },
    ended: { bg: colors.panel, fg: colors.muted, label: "Ended" },
  }
  const s = map[phase] ?? map.ended
  return (
    <span style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, letterSpacing: "0.06em", textTransform: "uppercase", color: s.fg, background: s.bg, borderRadius: radii.pill, padding: "2px 9px" }}>
      {s.label}
    </span>
  )
}

function fmtRange(a: string, b: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  const start = new Date(a).toLocaleDateString(undefined, opts)
  const end = new Date(b).toLocaleDateString(undefined, opts)
  return start === end ? start : `${start} – ${end}`
}

const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: spacing[2] }
const labelText: React.CSSProperties = {
  fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.08em",
  textTransform: "uppercase", color: colors.muted,
}
const dateInputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px",
  border: `1.4px solid ${colors.line}`, borderRadius: radii.md,
  fontFamily: fonts.body, fontSize: fontSize.body, color: colors.ink, background: colors.paper2, outline: "none",
}

export default AdminView
