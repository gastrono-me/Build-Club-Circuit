"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Flame, Check } from "lucide-react"
import { useBuildLog } from "@/lib/hooks/useBuildLog"
import { useProfile } from "@/lib/hooks/useProfile"
import { computeStreak, toDayKey } from "@/lib/streak/streak"
import { PostUpdate } from "@/components/radar/PostUpdate"
import { BuildLogCard } from "@/components/radar/BuildLogCard"
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
  const { posts, loading, post, toggleCheer, cheerCounts, mineCheers, userId } = useBuildLog()
  const { profile } = useProfile()

  // Resolve "now" on the client only, to keep streak math real-time without a
  // server/client hydration mismatch.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])

  const streak = useMemo(() => {
    if (!now) return null
    const mine = userId ? posts.filter((p) => p.author_id === userId).map((p) => p.created_at) : []
    return computeStreak(mine, now)
  }, [posts, userId, now])

  const cohortToday = useMemo(() => {
    if (!now) return { ships: 0, builders: 0 }
    const key = toDayKey(now)
    const todays = posts.filter((p) => toDayKey(new Date(p.created_at)) === key)
    return { ships: todays.length, builders: new Set(todays.map((p) => p.author_id)).size }
  }, [posts, now])

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
        <PostUpdate onPost={post} />
      </div>

      {/* Community feed */}
      <section aria-label="Cohort build log">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: spacing[2],
            marginBottom: spacing[3],
          }}
        >
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: colors.muted,
            }}
          >
            What the cohort is shipping
          </div>
          {now && cohortToday.ships > 0 && (
            <div style={{ fontFamily: fonts.mono, fontSize: fontSize.meta, color: colors.go }}>
              {cohortToday.ships} shipped today
              {cohortToday.builders > 1 ? ` · ${cohortToday.builders} builders` : ""}
            </div>
          )}
        </div>

        {loading ? (
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              color: colors.mutedSoft,
              letterSpacing: "0.06em",
              textAlign: "center",
              padding: `${spacing[8]}px 0`,
            }}
          >
            Loading…
          </div>
        ) : posts.length === 0 ? (
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: fontSize.body,
              color: colors.muted,
              textAlign: "center",
              padding: `${spacing[8]}px 0`,
            }}
          >
            No ships yet. Be the first to log one.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
            {posts.map((p) => (
              <BuildLogCard
                key={p.id}
                post={p}
                cheerCount={cheerCounts[p.id] ?? 0}
                isMine={mineCheers.has(p.id)}
                isOwn={!!userId && p.author_id === userId}
                currentUserId={userId}
                onCheer={() => toggleCheer(p.id)}
              />
            ))}
          </div>
        )}
      </section>
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
