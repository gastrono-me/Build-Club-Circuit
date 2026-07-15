"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import QRCode from "react-qr-code"
import { ArrowLeft, Check, MonitorPlay, Radio, Users } from "lucide-react"
import { useEvents } from "@/lib/hooks/useEvents"
import { useCoworking } from "@/lib/hooks/useCoworking"
import { useBuildLog } from "@/lib/hooks/useBuildLog"
import { useRadar } from "@/lib/hooks/useRadar"
import { huddlePhase } from "@/lib/coworking/matching"
import { Avatar } from "@/components/shell/Avatar"
import { colors, fonts, fontSize, fontWeight, radii, spacing, shadows } from "@/lib/design/tokens"

export function HostBoard({ slug }: { slug: string }) {
  const { events, loading: eventsLoading } = useEvents()
  const event = events.find((row) => row.slug === slug) ?? null
  const coworking = useCoworking(event?.id ?? null, event?.starts_at, event?.ends_at)
  const buildLog = useBuildLog(event?.id ?? null)
  const radar = useRadar(event?.id ?? null)
  const [origin, setOrigin] = useState("")
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    setOrigin(window.location.origin)
    const timer = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(timer)
  }, [])

  const completed = coworking.activeCheckins.reduce((sum, checkin) => sum + checkin.focus_items.filter((item) => item.completed_at).length, 0)
  const total = coworking.activeCheckins.reduce((sum, checkin) => sum + checkin.focus_items.length, 0)
  const liveHuddles = coworking.huddles.filter((huddle) => huddlePhase(huddle.starts_at, huddle.ends_at, huddle.status, now) === "live")
  const activeBlockers = radar.blockers.filter((blocker) => !blocker.resolved_at)
  const displayDemos = coworking.demos.filter((demo) => demo.status !== "skipped")

  if (eventsLoading || coworking.loading || !event) {
    return <div style={{ minHeight: "100vh", background: colors.ink }} />
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.ink, color: colors.onDark, paddingBottom: spacing[8] }}>
      <header style={{ display: "flex", alignItems: "center", gap: spacing[5], padding: `${spacing[5]}px ${spacing[6]}px`, borderBottom: "1px solid rgba(255,255,255,.15)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <Link href={`/events/${slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,.65)", textDecoration: "none", fontFamily: fonts.mono, fontSize: fontSize.label }}><ArrowLeft size={13} /> Event</Link>
          <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginTop: spacing[2] }}>
            <MonitorPlay size={22} color={colors.go} />
            <h1 style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 1, margin: 0 }}>{event.name}</h1>
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: "rgba(255,255,255,.65)", marginTop: spacing[2] }}>{event.location ?? "Build Club"} · {formatRange(event.starts_at, event.ends_at)}</div>
        </div>

        <div style={{ display: "flex", gap: spacing[6], textAlign: "center", alignItems: "center" }}>
          <Metric value={coworking.activeCheckins.length} label="Builders" />
          <Metric value={buildLog.posts.length} label="Ships" />
          <Metric value={activeBlockers.length} label="Blockers" />
          <Metric value={total ? `${Math.round((completed / total) * 100)}%` : "n/a"} label="Focus" />
          {origin && (
            <div style={{ background: "white", borderRadius: radii.lg, padding: 7, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <QRCode value={`${origin}/events/${slug}`} size={74} fgColor={colors.ink} bgColor="#ffffff" />
              <span style={{ color: colors.ink, fontFamily: fonts.mono, fontSize: 9, fontWeight: fontWeight.bold }}>SCAN TO JOIN</span>
            </div>
          )}
        </div>
      </header>

      {liveHuddles.length > 0 && (
        <section style={{ padding: `${spacing[4]}px ${spacing[6]}px`, borderBottom: "1px solid rgba(255,255,255,.12)" }}>
          <div style={boardKicker}><Radio size={12} /> Happening now</div>
          <div style={{ display: "flex", gap: spacing[3], overflowX: "auto", marginTop: spacing[3] }}>
            {liveHuddles.map((huddle) => (
              <div key={huddle.id} style={{ minWidth: 230, background: "rgba(255,255,255,.08)", border: `1px solid ${colors.go}`, borderRadius: radii.lg, padding: spacing[3] }}>
                <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.go }}>{huddle.kind.toUpperCase()}</div>
                <div style={{ fontFamily: fonts.body, fontSize: fontSize.body, fontWeight: fontWeight.semibold, marginTop: 4 }}>{huddle.topic}</div>
                <div style={{ fontFamily: fonts.body, fontSize: fontSize.micro, color: "rgba(255,255,255,.6)", marginTop: 3 }}>{huddle.space_name ?? "Anywhere"} · {huddle.host_name}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <main style={{ display: "grid", gridTemplateColumns: displayDemos.length ? "minmax(0, 2fr) minmax(280px, 1fr)" : "1fr", gap: spacing[5], padding: spacing[6] }}>
        <section>
          <div style={boardKicker}><Users size={12} /> Building now</div>
          {coworking.activeCheckins.length === 0 ? (
            <div style={boardEmpty}>Scan the QR code to check in.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: spacing[3], marginTop: spacing[3] }}>
              {coworking.activeCheckins.map((checkin) => {
                const done = checkin.focus_items.filter((item) => item.completed_at).length
                const pct = checkin.focus_items.length ? Math.round((done / checkin.focus_items.length) * 100) : 0
                return (
                  <div key={checkin.id} style={{ background: colors.panel, color: colors.ink, borderRadius: radii.xl, boxShadow: shadows.card, padding: spacing[4], borderTop: `3px solid ${colors.violet}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
                      <Avatar name={checkin.profile_name} photo={checkin.profile_avatar} size={42} />
                      <div style={{ minWidth: 0 }}><div style={{ fontFamily: fonts.body, fontWeight: fontWeight.semibold, fontSize: fontSize.body }}>{checkin.profile_name}</div><div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.violet }}>{checkin.goal}</div></div>
                    </div>
                    <div style={{ fontFamily: fonts.display, fontSize: fontSize.heading, margin: `${spacing[4]}px 0 ${spacing[2]}px`, lineHeight: 1.25 }}>{checkin.intention}</div>
                    {checkin.project_name && <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted }}>{checkin.project_name}{checkin.project_stage ? ` · ${checkin.project_stage}` : ""}</div>}
                    {checkin.focus_items.length > 0 && (
                      <div style={{ marginTop: spacing[4] }}>
                        <div style={{ height: 5, borderRadius: radii.pill, background: colors.line, overflow: "hidden" }}><div style={{ height: "100%", background: colors.go, width: `${pct}%` }} /></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.muted, marginTop: 6 }}><Check size={11} /> {done}/{checkin.focus_items.length} outcomes</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {displayDemos.length > 0 && (
          <aside>
            <div style={boardKicker}>Lightning demos</div>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[2], marginTop: spacing[3] }}>
              {displayDemos.map((demo, index) => (
                <div key={demo.id} style={{ display: "flex", alignItems: "center", gap: spacing[3], padding: spacing[3], border: "1px solid rgba(255,255,255,.16)", borderRadius: radii.lg, background: demo.status === "presented" ? "rgba(21,128,61,.18)" : "rgba(255,255,255,.06)" }}>
                  <span style={{ fontFamily: fonts.mono, color: colors.go, fontSize: fontSize.heading }}>{index + 1}</span>
                  <Avatar name={demo.builder_name} photo={demo.builder_avatar} size={34} />
                  <div style={{ minWidth: 0 }}><div style={{ fontFamily: fonts.body, fontWeight: fontWeight.semibold, fontSize: fontSize.meta }}>{demo.builder_name}</div><div style={{ fontFamily: fonts.body, fontSize: fontSize.micro, color: "rgba(255,255,255,.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{demo.ship_note}</div></div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </main>
    </div>
  )
}

function Metric({ value, label }: { value: React.ReactNode; label: string }) {
  return <div><div style={{ fontFamily: fonts.display, fontSize: 29, fontWeight: fontWeight.semibold }}>{value}</div><div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: "rgba(255,255,255,.6)", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div></div>
}

function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }
  return `${new Date(start).toLocaleTimeString([], opts)} to ${new Date(end).toLocaleTimeString([], opts)}`
}

const boardKicker: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.go, textTransform: "uppercase", letterSpacing: ".08em" }
const boardEmpty: React.CSSProperties = { marginTop: spacing[3], border: "1px dashed rgba(255,255,255,.2)", borderRadius: radii.xl, padding: spacing[8], textAlign: "center", fontFamily: fonts.body, color: "rgba(255,255,255,.55)" }

export default HostBoard
