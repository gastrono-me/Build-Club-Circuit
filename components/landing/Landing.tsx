"use client"

import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Flame, ArrowRight, CalendarClock, Users, Radar } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { LiveField } from "@/components/landing/LiveField"
import { AuthPanel } from "@/components/landing/AuthPanel"
import { colors, spacing, fonts, fontSize, fontWeight, radii, letterSpacing, shadows } from "@/lib/design/tokens"

const MAXW = 1080
/** The app home, behind the auth gate. */
const APP_HOME = "/home"

export function Landing() {
  const router = useRouter()
  const [authOpen, setAuthOpen] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const howRef = useRef<HTMLDivElement>(null)

  // The landing is the front door for everyone. Signed-in visitors still see it,
  // but their primary action enters the app directly instead of signing in.
  useEffect(() => {
    let cancelled = false
    createClient().auth.getUser().then(({ data }) => {
      if (!cancelled) setSignedIn(!!data.user)
    })
  }, [])

  const enter = () => router.push(APP_HOME)
  const onPrimary = () => (signedIn ? enter() : setAuthOpen(true))
  const primaryLabel = signedIn ? "Enter Circuit" : "Get started"

  return (
    <div style={{ minHeight: "100vh", background: colors.surface, color: colors.ink }}>
      {/* Nav */}
      <header
        style={{
          maxWidth: MAXW,
          margin: "0 auto",
          padding: `${spacing[5]}px ${spacing[4]}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing[3],
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: spacing[2] }}>
          <span style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: 22, letterSpacing: letterSpacing.display }}>
            Circuit
          </span>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              letterSpacing: letterSpacing.label,
              textTransform: "uppercase",
              color: colors.muted,
            }}
          >
            Build Club
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onPrimary}>
          {signedIn ? "Enter Circuit" : "Sign in"}
        </Button>
      </header>

      {/* Hero */}
      <section
        style={{
          maxWidth: MAXW,
          margin: "0 auto",
          padding: `${spacing[6]}px ${spacing[4]}px ${spacing[10]}px`,
          display: "flex",
          flexWrap: "wrap",
          gap: spacing[10],
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1 1 360px", minWidth: 300 }}>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              letterSpacing: letterSpacing.label,
              textTransform: "uppercase",
              color: colors.violet,
              marginBottom: spacing[4],
            }}
          >
            The everyday tool for builders
          </div>
          <h1
            style={{
              fontFamily: fonts.display,
              fontWeight: fontWeight.semibold,
              fontSize: "clamp(40px, 7.5vw, 66px)",
              lineHeight: 1.0,
              letterSpacing: "-0.035em",
              margin: 0,
            }}
          >
            Ship something<br />every day. Together.
          </h1>
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: 17,
              lineHeight: 1.55,
              color: colors.muted,
              margin: `${spacing[5]}px 0 ${spacing[6]}px`,
              maxWidth: "44ch",
            }}
          >
            Circuit turns building into a daily habit. Log what you shipped, keep your streak alive, and
            build in public alongside your cohort. It runs every day, and lights up when you are at a live event.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[3], alignItems: "center" }}>
            <Button variant="accent" icon={<ArrowRight size={16} />} onClick={onPrimary}>{primaryLabel}</Button>
            <Button
              variant="secondary"
              onClick={() => howRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              See how it works
            </Button>
          </div>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              letterSpacing: "0.04em",
              color: colors.mutedSoft,
              marginTop: spacing[4],
            }}
          >
            {signedIn ? "Welcome back. Pick up your streak." : "Magic link sign in. No password."}
          </div>
        </div>

        <div style={{ flex: "1 1 380px", minWidth: 300 }}>
          <LiveField />
        </div>
      </section>

      {/* How it works */}
      <div ref={howRef} style={{ background: colors.paper2, borderTop: `1.5px solid ${colors.line}`, borderBottom: `1.5px solid ${colors.line}` }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: `${spacing[12]}px ${spacing[4]}px` }}>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              letterSpacing: letterSpacing.label,
              textTransform: "uppercase",
              color: colors.muted,
              marginBottom: spacing[3],
            }}
          >
            How Circuit works
          </div>
          <h2
            style={{
              fontFamily: fonts.display,
              fontWeight: fontWeight.semibold,
              fontSize: "clamp(28px, 5vw, 40px)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              margin: `0 0 ${spacing[10]}px`,
              maxWidth: "18ch",
            }}
          >
            One loop, run daily, with the people building beside you.
          </h2>

          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[6] }}>
            <Feature
              icon={<Flame size={18} />}
              kicker="The daily spine"
              title="Did you ship today?"
              body="Log one thing you got working and your streak grows. No ranking, no leaderboard. The forgiving streak is built to keep the median builder going, not to crown the loudest."
              visual={<StreakVisual />}
            />
            <Feature
              icon={<Users size={18} />}
              kicker="The always-on graph"
              title="Find the people who complete you"
              body="Your cohort plotted as an embedding field. Vectors point to the builders whose skills and intent complement yours, every match explained. Reach out and set up a catchup."
              visual={<GraphVisual />}
            />
            <Feature
              icon={<CalendarClock size={18} />}
              kicker="Lights up at events"
              title="Your toolkit during the intensity"
              body="When you are at a live build week, Circuit becomes the room's instrument: the schedule, the deadline checklist, and a live radar of where everyone is stuck. Episodes on a continuous arc."
              visual={<EventVisual />}
            />
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <section style={{ maxWidth: MAXW, margin: "0 auto", padding: `${spacing[12]}px ${spacing[4]}px` }}>
        <div
          style={{
            background: colors.ink,
            color: colors.onDark,
            borderRadius: radii.xl,
            boxShadow: shadows.card,
            padding: "clamp(28px, 6vw, 56px)",
            display: "flex",
            flexWrap: "wrap",
            gap: spacing[6],
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: "1 1 320px", minWidth: 280 }}>
            <h2
              style={{
                fontFamily: fonts.display,
                fontWeight: fontWeight.semibold,
                fontSize: "clamp(26px, 4.5vw, 40px)",
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                margin: 0,
              }}
            >
              Make shipping a habit.
            </h2>
            <p style={{ fontFamily: fonts.body, fontSize: 16, color: "rgba(238,241,244,0.78)", margin: `${spacing[3]}px 0 0`, maxWidth: "40ch" }}>
              {signedIn
                ? "Your cohort is shipping right now. Jump back in and keep the streak going."
                : "Join the builders shipping every day on Circuit. It takes a magic link to start."}
            </p>
          </div>
          <Button variant="accent" icon={<ArrowRight size={16} />} onClick={onPrimary}>{primaryLabel}</Button>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          maxWidth: MAXW,
          margin: "0 auto",
          padding: `${spacing[6]}px ${spacing[4]}px ${spacing[10]}px`,
          display: "flex",
          flexWrap: "wrap",
          gap: spacing[3],
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          letterSpacing: "0.04em",
          color: colors.mutedSoft,
        }}
      >
        <span>Circuit · Build Club</span>
        <button
          type="button"
          onClick={onPrimary}
          style={{ background: "transparent", border: "none", color: colors.violet, cursor: "pointer", fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.04em" }}
        >
          {signedIn ? "Enter Circuit" : "Sign in"}
        </button>
      </footer>

      <AuthPanel open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Feature block                                                      */
/* ------------------------------------------------------------------ */
function Feature({
  icon,
  kicker,
  title,
  body,
  visual,
}: {
  icon: React.ReactNode
  kicker: string
  title: string
  body: string
  visual: React.ReactNode
}) {
  return (
    <div
      style={{
        flex: "1 1 300px",
        minWidth: 280,
        background: colors.surface,
        border: `1.5px solid ${colors.ink}`,
        borderRadius: radii.xl,
        boxShadow: shadows.card,
        padding: spacing[5],
        display: "flex",
        flexDirection: "column",
        gap: spacing[4],
      }}
    >
      <div style={{ height: 116, display: "flex", alignItems: "center", justifyContent: "center" }}>{visual}</div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          letterSpacing: letterSpacing.label,
          textTransform: "uppercase",
          color: colors.violet,
        }}
      >
        {icon}
        {kicker}
      </div>
      <h3 style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.title, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.1 }}>
        {title}
      </h3>
      <p style={{ fontFamily: fonts.body, fontSize: fontSize.body, lineHeight: 1.55, color: colors.muted, margin: 0 }}>
        {body}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Small section visuals (decorative, on-brand)                       */
/* ------------------------------------------------------------------ */
function StreakVisual() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
      {[3, 5, 4, 6, 7, 6, 8].map((h, i) => (
        <div
          key={i}
          style={{
            width: 12,
            height: h * 9,
            borderRadius: 3,
            background: i === 6 ? colors.violet : colors.violetSoft,
            border: `1.5px solid ${i === 6 ? colors.violet : colors.line}`,
          }}
        />
      ))}
      <div
        style={{
          marginLeft: spacing[3],
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: radii.pill,
          background: colors.violetSoft,
          color: colors.violet,
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          fontWeight: fontWeight.medium,
        }}
      >
        <Flame size={13} /> 7 day streak
      </div>
    </div>
  )
}

function GraphVisual() {
  const dots = [
    { x: 18, y: 30, me: false },
    { x: 70, y: 22, me: false },
    { x: 50, y: 52, me: true },
    { x: 84, y: 60, me: false },
    { x: 30, y: 70, me: false },
  ]
  const me = dots[2]
  return (
    <svg viewBox="0 0 100 86" width="150" height="116" aria-hidden>
      {dots.filter((d) => !d.me).map((d, i) => (
        <line key={i} x1={me.x} y1={me.y} x2={d.x} y2={d.y} stroke={colors.violet} strokeWidth={0.8} opacity={0.4} />
      ))}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.me ? 4 : 2.6}
          fill={d.me ? colors.surface : colors.mutedSoft}
          stroke={d.me ? colors.violet : "none"}
          strokeWidth={d.me ? 2 : 0}
        />
      ))}
    </svg>
  )
}

function EventVisual() {
  return (
    <div style={{ width: 168, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 9,
            fontWeight: fontWeight.semibold,
            letterSpacing: "0.08em",
            color: colors.oxblood,
            background: colors.liveSoft,
            padding: "2px 7px",
            borderRadius: radii.pill,
          }}
        >
          LIVE
        </span>
        <Radar size={13} color={colors.muted} />
      </div>
      {["Kickoff · 09:00", "Build block · 10:30", "Demos · 16:00"].map((t, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            color: i === 1 ? colors.ink : colors.muted,
            background: i === 1 ? colors.violetSoft : "transparent",
            border: `1.5px solid ${i === 1 ? colors.violet : colors.line}`,
            borderRadius: radii.sm,
            padding: "5px 9px",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: i === 1 ? colors.violet : colors.mutedSoft }} />
          {t}
        </div>
      ))}
    </div>
  )
}

export default Landing
