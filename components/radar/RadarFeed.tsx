"use client"

import React from "react"
import { useRadar } from "@/lib/hooks/useRadar"
import { PostBlocker } from "@/components/radar/PostBlocker"
import { BlockerCard } from "@/components/radar/BlockerCard"
import { EmbeddingPlot } from "@/components/radar/EmbeddingPlot"
import { BuildLogFeed } from "@/components/radar/BuildLogFeed"
import { colors, fonts, fontSize, fontWeight, radii, spacing, letterSpacing } from "@/lib/design/tokens"

type FeedTab = "stuck" | "shipped"

export function RadarFeed({ eventId, compose = true }: { eventId?: string | null; compose?: boolean } = {}) {
  const [tab, setTab] = React.useState<FeedTab>("stuck")
  const { blockers, loading, post, toggleMeToo, meTooCounts, mineMeToo, userId, bump, loadMore, hasMore } = useRadar(eventId)
  // Your just-posted blocker (id-stable, set from post()'s returned id).
  const [latestId, setLatestId] = React.useState<string | null>(null)
  // A node that just took a cross-client "me too" (transient pulse).
  const [pulseId, setPulseId] = React.useState<string | null>(null)
  const [toast, setToast] = React.useState<string | null>(null)
  const latestTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pulseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Post a blocker and highlight it by the id the insert returned — no
  // created_at/clock-skew guesswork, so the "just posted" emphasis is reliable.
  const handlePost = React.useCallback(async (category: string, note: string) => {
    const id = await post(category, note)
    if (id) {
      setLatestId(id)
      if (latestTimer.current) clearTimeout(latestTimer.current)
      latestTimer.current = setTimeout(() => setLatestId(null), 8_000)
    }
  }, [post])

  // When a me-too lands from another client, pulse that exact node. If it's on
  // a blocker YOU authored, surface it — you can't me-too your own, so the rise
  // is necessarily someone else in the cohort.
  React.useEffect(() => {
    if (!bump) return
    setPulseId(bump.id)
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setPulseId(null), 2_600)

    const b = blockers.find((x) => x.id === bump.id)
    if (b && userId && b.author_id === userId) {
      setToast("Someone in the cohort hit “me too” on your blocker.")
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(null), 5_000)
    }
  }, [bump, blockers, userId])

  React.useEffect(() => {
    return () => {
      if (latestTimer.current) clearTimeout(latestTimer.current)
      if (pulseTimer.current) clearTimeout(pulseTimer.current)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
      {/* Stuck / Shipped toggle */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          background: colors.line,
          borderRadius: radii.pill,
          padding: 2,
        }}
      >
        {(["stuck", "shipped"] as FeedTab[]).map(t => {
          const active = tab === t
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontFamily: fonts.mono,
                fontSize: fontSize.label,
                fontWeight: fontWeight.semibold,
                padding: `${spacing[1]}px ${spacing[3]}px`,
                borderRadius: radii.pill,
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.05em",
                lineHeight: 1.4,
                background: active ? colors.violet : "transparent",
                color: active ? colors.onDark : colors.mutedSoft,
                textTransform: "uppercase",
              }}
            >
              {t === "stuck" ? "Stuck" : "Shipped"}
            </button>
          )
        })}
      </div>

      {tab === "shipped" && <BuildLogFeed eventId={eventId} compose={compose} />}

      {tab === "stuck" && (
        <>
      {/* Heading */}
      <header>
        <h1
          style={{
            fontFamily: fonts.display,
            fontWeight: fontWeight.semibold,
            fontSize: "clamp(38px, 9vw, 60px)",
            lineHeight: 0.96,
            letterSpacing: "-0.035em",
            margin: 0,
            color: colors.ink,
          }}
        >
          Where the cohort is{" "}
          <em style={{ fontStyle: "italic", color: colors.violet }}>stuck</em>.
        </h1>
        <p
          style={{
            marginTop: spacing[3],
            maxWidth: "46ch",
            color: colors.muted,
            fontSize: 15.5,
            fontFamily: fonts.body,
          }}
        >
          Every blocker is a point in the field. Tap{" "}
          <strong style={{ color: colors.ink, fontWeight: fontWeight.semibold }}>me too</strong>{" "}
          and a vector links you to whoever&rsquo;s stuck on the same thing.
        </p>
        {/* Live pulse indicator */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            color: colors.violet,
            letterSpacing: letterSpacing.label,
            marginTop: spacing[2],
          }}
        >
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: colors.violet,
              display: "inline-block",
              animation: "radarPulse 2s ease-in-out infinite",
            }}
          />
          LIVE
        </div>
      </header>

      {/* Hero: Embedding Plot */}
      <EmbeddingPlot
        blockers={blockers}
        meTooCounts={meTooCounts}
        mineMeToo={mineMeToo}
        userId={userId}
        onMeToo={toggleMeToo}
        latestId={latestId}
        pulseId={pulseId}
      />

      {/* Post blocker composer (Today owns "I'm stuck"; hidden on the browse-only Explore) */}
      {compose && <PostBlocker onPost={handlePost} />}

      {/* Compact blocker list */}
      <section aria-label="All blockers">
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: letterSpacing.label,
            textTransform: "uppercase",
            color: colors.muted,
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: spacing[3],
          }}
        >
          <span
            aria-hidden
            style={{ color: colors.violet, fontSize: 13, lineHeight: 1 }}
          >
            →
          </span>
          All blockers
          {!loading && (
            <span style={{ color: colors.mutedSoft, fontSize: fontSize.micro }}>
              {blockers.length}
            </span>
          )}
        </div>

        {loading ? (
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              color: colors.mutedSoft,
              letterSpacing: letterSpacing.label,
              textAlign: "center",
              padding: `${spacing[8]}px 0`,
            }}
          >
            Loading…
          </div>
        ) : blockers.length === 0 ? (
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: fontSize.body,
              color: colors.muted,
              textAlign: "center",
              padding: `${spacing[8]}px 0`,
            }}
          >
            No blockers yet. Be the first to post one.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
            {blockers.map((blocker) => (
              <BlockerCard
                key={blocker.id}
                blocker={blocker}
                metooCount={meTooCounts[blocker.id] ?? 0}
                isMine={mineMeToo.has(blocker.id)}
                isOwn={!!userId && blocker.author_id === userId}
                currentUserId={userId}
                onMeToo={() => toggleMeToo(blocker.id)}
              />
            ))}
          </div>
        )}

        {!loading && hasMore && (
          <div style={{ textAlign: "center", marginTop: spacing[4] }}>
            <button
              type="button"
              onClick={loadMore}
              style={{
                fontFamily: fonts.mono,
                fontSize: fontSize.label,
                fontWeight: fontWeight.semibold,
                letterSpacing: letterSpacing.label,
                textTransform: "uppercase",
                color: colors.ink,
                background: "transparent",
                border: `1.5px solid ${colors.ink}`,
                borderRadius: radii.md,
                padding: `${spacing[2]}px ${spacing[4]}px`,
                cursor: "pointer",
              }}
            >
              Load more
            </button>
          </div>
        )}
      </section>
        </>
      )}

      {/* Live cross-client toast — the "you're not stuck alone" moment, landed */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 84,
            transform: "translateX(-50%)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: "calc(100vw - 32px)",
            background: colors.ink,
            color: colors.onDark,
            border: `1.5px solid ${colors.ink}`,
            borderRadius: radii.md,
            boxShadow: "8px 8px 0 rgba(20,20,60,0.18)",
            padding: "11px 15px",
            fontFamily: fonts.body,
            fontSize: fontSize.meta,
            lineHeight: 1.35,
            animation: "radarToastIn 0.26s cubic-bezier(0.2,0,0,1)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: colors.violet,
              flexShrink: 0,
              boxShadow: "0 0 0 3px rgba(43,43,245,0.35)",
            }}
          />
          {toast}
        </div>
      )}

      <style>{`
        @keyframes radarPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes radarToastIn {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}

export default RadarFeed
