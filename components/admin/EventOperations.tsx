"use client"

import React, { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Download, MonitorPlay, Plus, Trash2, Users } from "lucide-react"
import { useEvents } from "@/lib/hooks/useEvents"
import { useCoworking } from "@/lib/hooks/useCoworking"
import { useBuildLog } from "@/lib/hooks/useBuildLog"
import { useRadar } from "@/lib/hooks/useRadar"
import { huddlePhase } from "@/lib/coworking/matching"
import { Avatar } from "@/components/shell/Avatar"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

export function EventOperations({ eventId }: { eventId: string }) {
  const { events, loading: eventsLoading } = useEvents()
  const event = events.find((row) => row.id === eventId) ?? null
  const coworking = useCoworking(event?.id ?? null, event?.starts_at, event?.ends_at)
  const buildLog = useBuildLog(event?.id ?? null)
  const radar = useRadar(event?.id ?? null)
  const [spaceName, setSpaceName] = useState("")
  const [spaceCapacity, setSpaceCapacity] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const now = new Date()

  if (eventsLoading || coworking.loading || buildLog.loading || radar.loading) {
    return <div style={quietStyle}>Loading event operations…</div>
  }

  if (!event) {
    return <SectionTitle kicker="Admin" title="Event not found" note="It may have been removed." />
  }

  const focusItems = coworking.checkins.flatMap((row) => row.focus_items)
  const focusComplete = focusItems.filter((row) => row.completed_at).length
  const blockersResolved = radar.blockers.filter((row) => row.resolved_at).length
  const liveHuddles = coworking.huddles.filter((row) => huddlePhase(row.starts_at, row.ends_at, row.status, now) === "live").length

  async function addSpace(e: React.FormEvent) {
    e.preventDefault()
    if (!spaceName.trim()) return
    setBusy(true); setError(null)
    try {
      await coworking.createSpace({ name: spaceName, capacity: spaceCapacity ? Number(spaceCapacity) : null })
      setSpaceName(""); setSpaceCapacity("")
    } catch (err: any) {
      setError(err?.message?.includes("duplicate") ? "That space already exists." : (err?.message ?? "Could not add space."))
    } finally {
      setBusy(false)
    }
  }

  function exportCsv() {
    const rows = [
      ["Builder", "Goal", "Intention", "Project", "Checked in", "Checked out", "Focus complete", "Focus total"],
      ...coworking.checkins.map((row) => [
        row.profile_name,
        row.goal,
        row.intention,
        row.project_name ?? "",
        row.checked_in_at,
        row.checked_out_at ?? "",
        String(row.focus_items.filter((item) => item.completed_at).length),
        String(row.focus_items.length),
      ]),
    ]
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${event?.slug ?? eventId}-coworking-report.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <Link href="/admin" style={backStyle}><ArrowLeft size={13} /> Events</Link>
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing[3], alignItems: "flex-start", flexWrap: "wrap" }}>
        <SectionTitle kicker="Event operations" title={event.name} note="Live controls and an exportable record of the coworking session." />
        <div style={{ display: "flex", gap: spacing[2], flexWrap: "wrap" }}>
          <Link href={`/events/${event.slug}/board`} style={{ textDecoration: "none" }}><Button variant="secondary" size="sm" icon={<MonitorPlay size={13} />}>Host board</Button></Link>
          <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={exportCsv}>Export CSV</Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: spacing[3], marginBottom: spacing[6] }}>
        <Metric label="Here now" value={coworking.activeCheckins.length} note={event.capacity ? `of ${event.capacity}` : `${coworking.checkins.length} total`} />
        <Metric label="Focus" value={focusItems.length ? `${Math.round((focusComplete / focusItems.length) * 100)}%` : "n/a"} note={`${focusComplete}/${focusItems.length} outcomes`} />
        <Metric label="Ships" value={buildLog.posts.length} note="event-linked" />
        <Metric label="Blockers" value={radar.blockers.length} note={`${blockersResolved} resolved`} />
        <Metric label="Huddles" value={coworking.huddles.length} note={`${liveHuddles} live`} />
        <Metric label="Demos" value={coworking.demos.length} note={`${coworking.demos.filter((row) => row.status === "presented").length} presented`} />
      </div>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>Spaces</h2>
        <form onSubmit={addSpace} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: spacing[2], alignItems: "end" }}>
          <Input label="Name" value={spaceName} onChange={(e) => setSpaceName(e.target.value)} placeholder="Quiet room" maxLength={80} />
          <Input label="Capacity" type="number" min="1" value={spaceCapacity} onChange={(e) => setSpaceCapacity(e.target.value)} placeholder="12" />
          <Button type="submit" variant="accent" disabled={busy || !spaceName.trim()} icon={<Plus size={13} />}>Add</Button>
        </form>
        {error && <div style={errorStyle}>{error}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[3] }}>
          {coworking.spaces.length === 0 ? <span style={quietStyle}>No named spaces yet.</span> : coworking.spaces.map((space) => (
            <div key={space.id} style={pillStyle}>
              <span>{space.name}{space.capacity ? ` · ${space.capacity}` : ""}</span>
              <button type="button" aria-label={`Delete ${space.name}`} onClick={() => { if (window.confirm(`Delete ${space.name}? Existing huddles will become unassigned.`)) coworking.removeSpace(space.id) }} style={iconStyle}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}><Users size={17} /> Builders</h2>
        {coworking.checkins.length === 0 ? <div style={quietStyle}>No one has checked in yet.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
            {coworking.checkins.map((row) => (
              <Card key={row.id} padding={spacing[3]}>
                <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
                  <Avatar name={row.profile_name} photo={row.profile_avatar} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: fonts.body, fontWeight: fontWeight.semibold, color: colors.ink }}>{row.profile_name}</div>
                    <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.intention}</div>
                    <div style={metaStyle}>{row.goal} · {row.focus_items.filter((item) => item.completed_at).length}/{row.focus_items.length} focus · {row.checked_out_at ? "checked out" : coworking.activeCheckins.some((active) => active.id === row.id) ? "active" : "session ended"}</div>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => { if (window.confirm(`Remove ${row.profile_name}'s check-in?`)) coworking.removeCheckin(row.id) }}>Remove</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: spacing[5] }}>
        <section style={sectionStyle}>
          <h2 style={headingStyle}>Huddles</h2>
          {coworking.huddles.length === 0 ? <div style={quietStyle}>No huddles yet.</div> : coworking.huddles.map((row) => (
            <div key={row.id} style={listRowStyle}>
              <div style={{ flex: 1 }}><strong>{row.topic}</strong><div style={metaStyle}>{row.kind} · {row.space_name ?? "Unassigned"} · {row.participant_ids.length} joined</div></div>
              <select value={row.status} onChange={(e) => coworking.setHuddleStatus(row.id, e.target.value as typeof row.status)} style={selectStyle}>
                <option value="scheduled">Scheduled</option><option value="live">Live</option><option value="ended">Ended</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
          ))}
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Demo queue</h2>
          {coworking.demos.length === 0 ? <div style={quietStyle}>No demos queued yet.</div> : coworking.demos.map((row, index) => (
            <div key={row.id} style={listRowStyle}>
              <span style={{ fontFamily: fonts.mono, color: colors.violet }}>{index + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}><strong>{row.builder_name}</strong><div style={{ ...metaStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.ship_note}</div></div>
              <select value={row.status} onChange={(e) => coworking.setDemoStatus(row.id, e.target.value as typeof row.status)} style={selectStyle}>
                <option value="queued">Queued</option><option value="presented">Presented</option><option value="skipped">Skipped</option>
              </select>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

function Metric({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return <Card padding={spacing[3]}><div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.muted, textTransform: "uppercase" }}>{label}</div><div style={{ fontFamily: fonts.display, fontSize: 27, fontWeight: fontWeight.semibold, color: colors.ink }}>{value}</div><div style={{ fontFamily: fonts.body, fontSize: fontSize.micro, color: colors.mutedSoft }}>{note}</div></Card>
}

function csvCell(value: string): string { return `"${value.replace(/"/g, '""')}"` }

const sectionStyle: React.CSSProperties = { marginBottom: spacing[6] }
const headingStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: spacing[2], margin: `0 0 ${spacing[3]}px`, fontFamily: fonts.display, fontSize: fontSize.heading, color: colors.ink }
const quietStyle: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, padding: `${spacing[4]}px 0` }
const errorStyle: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.live, marginTop: spacing[2] }
const metaStyle: React.CSSProperties = { fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft, marginTop: 3 }
const backStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, color: colors.muted, fontFamily: fonts.mono, fontSize: fontSize.label, marginBottom: spacing[4] }
const pillStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: spacing[2], padding: "7px 10px", border: `1px solid ${colors.line}`, borderRadius: radii.pill, fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.ink }
const iconStyle: React.CSSProperties = { display: "flex", border: 0, background: "transparent", color: colors.live, padding: 0, cursor: "pointer" }
const listRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: spacing[2], padding: `${spacing[2]}px 0`, borderBottom: `1px solid ${colors.line}`, fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.ink }
const selectStyle: React.CSSProperties = { border: `1px solid ${colors.line}`, borderRadius: radii.md, background: colors.paper2, color: colors.ink, fontFamily: fonts.body, fontSize: fontSize.meta, padding: "6px 8px" }

export default EventOperations
