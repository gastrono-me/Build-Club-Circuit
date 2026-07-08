"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { Flame, Check, LifeBuoy, ArrowRight, CalendarClock } from "lucide-react"
import { useBuildLog } from "@/lib/hooks/useBuildLog"
import { useProfile } from "@/lib/hooks/useProfile"
import { useNow } from "@/lib/hooks/useNow"
import { usePostBlocker } from "@/lib/hooks/usePostBlocker"
import { computeStreak } from "@/lib/streak/streak"
import { PostUpdate } from "@/components/radar/PostUpdate"
import { PostBlocker } from "@/components/radar/PostBlocker"
import { SpotlightRail } from "@/components/spotlight/SpotlightRail"
import { MyProjectsStrip } from "@/components/projects/MyProjectsStrip"
import { UpcomingEventsStrip } from "@/components/events/UpcomingEventsStrip"
import { ProfileNudge } from "@/components/onboarding/ProfileNudge"
import { useActiveEvent } from "@/lib/hooks/useActiveEvent"
import { useSocial } from "@/components/shell/SocialProvider"
import { colors, fonts, fontSize, fontWeight, radii, spacing, shadows } from "@/lib/design/tokens"

/**
 * Circuit's home — the daily ship ritual.
 *
 * Replaces Vector's event "Now" dashboard. This is the evergreen spine: open
 * Circuit, see your streak, answer "did you ship today?", and watch the cohort
 * ship alongside you. Uses REAL time (not the sim clock) — streaks key off real
 * calendar days.
 */
export function TodayView() {
  // browse:false — Today renders only today's ships; skip fetching the archive page.
  const { todayPosts, myPostDates, post, toggleCheer, cheerCounts, commentCounts, mineCheers, userId } = useBuildLog(null, { browse: false })
  const { profile } = useProfile()
  const { openPanel } = useSocial()

  // Compose-only blocker post ("I'm stuck"). Browsing blockers lives on Explore.
  const postBlocker = usePostBlocker()
  const [stuckOpen, setStuckOpen] = useState(false)

  // Client-only (no hydration mismatch) and ticking, so the streak and the
  // spotlight timestamps stay honest while the tab sits open.
  const now = useNow()

  // A live event you're in: the daily ship can attribute to it.
  const { active: activeEvent } = useActiveEvent(now)

  const streak = useMemo(() => {
    if (!now) return null
    // myPostDates is the user's full ship history (not the paginated feed), so the
    // streak stays correct no matter how little of the feed is loaded.
    return computeStreak(userId ? myPostDates : [], now)
  }, [myPostDates, userId, now])

  async function handleStuck(category: string, note: string) {
    await postBlocker(category, note)
    setStuckOpen(false)
  }

  const greeting = useMemo(() => greetFor(now), [now])
  const firstName = profile?.name?.trim().split(/\s+/)[0]

  return (
    <div style={{ padding: `${spacing[5]}px ${spacing[4]}px`, maxWidth: 680, margin: "0 auto" }}>
      {/* Hero: greeting + streak */}
      <header
        style={{
          background: colors.panel,
          border: `1px solid ${colors.line}`,
          borderRadius: radii.xl,
          boxShadow: shadows.card,
          padding: spacing[5],
          marginBottom: spacing[6],
        }}
      >
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: colors.muted,
            marginBottom: spacing[2],
          }}
        >
          {now ? longDate(now) : " "}
        </div>
        <h1
          style={{
            fontFamily: fonts.display,
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.display,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            margin: 0,
            color: colors.ink,
          }}
        >
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>

        <StreakRow streak={streak} />
      </header>

      {/* Recover thin profiles (usually onboarding skippers) */}
      <ProfileNudge />

      {/* The ritual prompt */}
      <div style={{ marginBottom: spacing[6] }}>
        <h2
          style={{
            fontFamily: fonts.display,
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.title,
            letterSpacing: "-0.03em",
            margin: `0 0 ${spacing[2]}px`,
            color: colors.ink,
          }}
        >
          {streak?.shippedToday ? "Shipped today. Anything else?" : "Did you ship today?"}
        </h2>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.body,
            color: colors.muted,
            margin: `0 0 ${spacing[4]}px`,
          }}
        >
          {streak?.shippedToday
            ? "Streak is safe. Log another win if the day kept moving."
            : "Log one thing you got working today to keep your streak alive."}
        </p>

        {activeEvent && (
          <Link
            href={`/events/${activeEvent.slug}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[2],
              marginBottom: spacing[3],
              padding: `${spacing[2]}px ${spacing[3]}px`,
              borderRadius: radii.md,
              background: colors.goSoft,
              border: `1.4px solid ${colors.go}`,
              textDecoration: "none",
              fontFamily: fonts.body,
              fontSize: fontSize.meta,
              color: colors.ink,
            }}
          >
            <CalendarClock size={15} color={colors.go} style={{ flexShrink: 0 }} />
            <span>You&rsquo;re in <strong style={{ fontWeight: fontWeight.semibold }}>{activeEvent.name}</strong> — ships count toward it while it&rsquo;s live.</span>
          </Link>
        )}

        <PostUpdate onPost={post} activeEvent={activeEvent ? { id: activeEvent.id, name: activeEvent.name } : null} />

        {/* Stuck action — being stuck is a "today" feeling; browsing blockers is on Explore */}
        {stuckOpen ? (
          <div style={{ marginTop: spacing[3] }}>
            <PostBlocker onPost={handleStuck} />
            <div style={{ textAlign: "center", marginTop: spacing[2] }}>
              <button type="button" onClick={() => setStuckOpen(false)} style={stuckLinkStyle}>
                Never mind
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setStuckOpen(true)} style={{ ...stuckLinkStyle, marginTop: spacing[3] }}>
            <LifeBuoy size={14} /> Stuck on something? Post a blocker
          </button>
        )}
      </div>

      {/* What you're building — ships ladder into projects */}
      {now && <MyProjectsStrip now={now} />}

      {/* Live + upcoming events you can join */}
      {now && <UpcomingEventsStrip now={now} />}

      {/* Shipped today — the day's cohort activity. History lives on Explore. */}
      {now && (
        todayPosts.length > 0 ? (
          <SpotlightRail
            posts={todayPosts}
            now={now}
            headerLink={{ href: "/explore", label: "Explore all" }}
            interactive
            currentUserId={userId}
            cheerCounts={cheerCounts}
            commentCounts={commentCounts}
            mineCheers={mineCheers}
            onCheer={toggleCheer}
            onMessage={(p) =>
              openPanel(
                { id: p.author_id, name: p.author_name ?? "Builder", avatar: p.author_avatar },
                "chat",
              )
            }
          />
        ) : (
          <div
            style={{
              background: colors.panel,
              border: `1px dashed ${colors.line}`,
              borderRadius: radii.xl,
              padding: `${spacing[6]}px ${spacing[4]}px`,
              textAlign: "center",
              marginBottom: spacing[6],
            }}
          >
            <div style={{ fontFamily: fonts.body, fontSize: fontSize.body, color: colors.muted }}>
              No ships logged today yet.
            </div>
            <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.mutedSoft, marginTop: spacing[1] }}>
              Be the first to ship, or see what the cohort has built before.
            </div>
          </div>
        )
      )}

      {/* Everything older lives in the archive */}
      <div style={{ textAlign: "center" }}>
        <Link href="/explore" style={seeAllStyle}>
          Explore all ships and blockers <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}

/** Streak badge row under the greeting. */
function StreakRow({ streak }: { streak: ReturnType<typeof computeStreak> | null }) {
  if (!streak) {
    // Reserve height so the hero doesn't jump when the streak resolves.
    return <div style={{ height: 34, marginTop: spacing[4] }} />
  }

  const alive = streak.current > 0
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing[3], marginTop: spacing[4], flexWrap: "wrap" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: spacing[2],
          padding: `6px 12px`,
          borderRadius: radii.pill,
          background: alive ? colors.violetSoft : colors.paper2,
          color: alive ? colors.violet : colors.muted,
          fontFamily: fonts.mono,
          fontSize: fontSize.meta,
          fontWeight: fontWeight.medium,
        }}
      >
        <Flame size={15} />
        {alive ? `${streak.current} day streak` : "No streak yet"}
      </div>

      {streak.shippedToday && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: colors.go,
            fontFamily: fonts.mono,
            fontSize: fontSize.meta,
            fontWeight: fontWeight.medium,
          }}
        >
          <Check size={15} /> Shipped today
        </div>
      )}

      {streak.longest > 1 && (
        <div style={{ fontFamily: fonts.mono, fontSize: fontSize.meta, color: colors.mutedSoft }}>
          best {streak.longest}
        </div>
      )}
    </div>
  )
}

/** The quiet "Stuck?" toggle under the ship composer. */
const stuckLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: colors.muted,
  fontFamily: fonts.mono,
  fontSize: fontSize.label,
  letterSpacing: "0.03em",
}

/** Link into the archive from the bottom of Today. */
const seeAllStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  textDecoration: "none",
  color: colors.violet,
  fontFamily: fonts.mono,
  fontSize: fontSize.label,
  fontWeight: fontWeight.semibold,
  letterSpacing: "0.04em",
}

function greetFor(now: Date | null): string {
  if (!now) return "Welcome back"
  const h = now.getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

function longDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
}

export default TodayView
