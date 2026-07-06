"use client"

import React from "react"
import { useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { useBuildLog } from "@/lib/hooks/useBuildLog"
import { useSpotlightNominations } from "@/lib/hooks/useSpotlightNominations"
import { WORK_CATEGORIES } from "@/lib/data/work-categories"
import { PostUpdate } from "@/components/radar/PostUpdate"
import { BuildLogCard } from "@/components/radar/BuildLogCard"
import { ShipsPlot } from "@/components/radar/ShipsPlot"
import { CollapsibleField } from "@/components/field/CollapsibleField"
import { SkeletonFeed } from "@/components/ui/Skeleton"
import { colors, fonts, fontSize, fontWeight, radii, spacing, motion, letterSpacing } from "@/lib/design/tokens"

/** Debounce for the builder-name search, so typing doesn't fire a query per key. */
const SEARCH_DEBOUNCE_MS = 300
/** The field is a recent-energy lens, not the archive: cap the nodes it plots. */
const PLOT_WINDOW = 60
/** How many extra pages to pull looking for a deep-linked ship before giving up. */
const DEEP_LINK_MAX_PAGES = 3

/**
 * The Shipped tab, structured as the mirror of the Stuck tab: display header,
 * the embedding field as hero, composer (event pages only), then the filterable
 * list. Same instrument, other polarity.
 */
export function BuildLogFeed({ eventId, compose = true }: { eventId?: string | null; compose?: boolean } = {}) {
  // Filters: category chip + builder-name search, both applied server-side.
  // They drive the field and the list together (same filtered set).
  const [category, setCategory] = React.useState<string | null>(null)
  const [authorInput, setAuthorInput] = React.useState("")
  const [author, setAuthor] = React.useState<string | null>(null)

  React.useEffect(() => {
    const t = setTimeout(() => setAuthor(authorInput.trim() || null), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [authorInput])

  const { posts, loading, post, toggleCheer, cheerCounts, commentCounts, mineCheers, userId, loadMore, hasMore } = useBuildLog(eventId, { category, author })
  const { mine: nominated, nominate, unnominate } = useSpotlightNominations()

  const filtering = !!category || !!author
  const clearFilters = () => { setCategory(null); setAuthorInput(""); setAuthor(null) }

  // Dim the list while a filter change is refetching, so results never look
  // current when they aren't. Cleared as soon as new posts land.
  const [filterPending, setFilterPending] = React.useState(false)
  const filterMountRef = React.useRef(false)
  React.useEffect(() => {
    if (filterMountRef.current) setFilterPending(true)
    filterMountRef.current = true
  }, [category, author])
  React.useEffect(() => {
    setFilterPending(false)
  }, [posts])

  // Deep link from a notification: /explore?ship=<id>[&comments=1] scrolls to
  // and highlights that card (opening its thread for comment notifications).
  // If the ship is older than the loaded page, pull a few more pages before
  // giving up.
  const searchParams = useSearchParams()
  const shipParam = searchParams.get("ship")
  const openComments = searchParams.get("comments") === "1"
  const deepPagesRef = React.useRef(0)
  const scrolledRef = React.useRef<string | null>(null)
  const targetRef = React.useRef<HTMLDivElement | null>(null)

  const shipFound = !!shipParam && posts.some((p) => p.id === shipParam)
  React.useEffect(() => {
    if (!shipParam || loading || shipFound) return
    if (hasMore && deepPagesRef.current < DEEP_LINK_MAX_PAGES) {
      deepPagesRef.current += 1
      loadMore()
    }
  }, [shipParam, loading, shipFound, hasMore, loadMore])

  React.useEffect(() => {
    if (!shipParam || !shipFound || scrolledRef.current === shipParam) return
    scrolledRef.current = shipParam
    // Let the card render before scrolling.
    requestAnimationFrame(() => {
      targetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }, [shipParam, shipFound])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
      {/* Heading — mirrors the Stuck tab's */}
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
          What the cohort is{" "}
          <em style={{ fontStyle: "italic", color: colors.go }}>shipping</em>.
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
          Every ship is a point in the field. Tap one to{" "}
          <strong style={{ color: colors.ink, fontWeight: fontWeight.semibold }}>cheer</strong>{" "}
          it or message the builder behind it.
        </p>
        {/* Live pulse indicator */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            color: colors.go,
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
              background: colors.go,
              display: "inline-block",
              animation: "radarPulse 2s ease-in-out infinite",
            }}
          />
          LIVE
        </div>
      </header>

      {/* Hero: the ship field (plots the filtered set, most recent first) */}
      <CollapsibleField>
        <ShipsPlot
          posts={posts.slice(0, PLOT_WINDOW)}
          cheerCounts={cheerCounts}
          mineCheers={mineCheers}
          userId={userId}
          onCheer={async (id) => { await toggleCheer(id) }}
        />
      </CollapsibleField>

      {compose && <PostUpdate onPost={post} />}

      {/* Filters: work category + builder name (drive the field and the list) */}
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2] }}>
          <FilterChip label="All" active={!category} onClick={() => setCategory(null)} />
          {WORK_CATEGORIES.map((c) => (
            <FilterChip key={c} label={c} active={category === c} onClick={() => setCategory(category === c ? null : c)} />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            maxWidth: 320,
            border: `1.4px solid ${colors.line}`,
            borderRadius: radii.md,
            padding: "0 12px",
            background: colors.panel,
            transition: `border-color ${motion.fast} ${motion.ease}`,
          }}
          onFocusCapture={(e) => { e.currentTarget.style.borderColor = colors.violet }}
          onBlurCapture={(e) => { e.currentTarget.style.borderColor = colors.line }}
        >
          <Search size={14} color={colors.mutedSoft} style={{ flexShrink: 0 }} />
          <input
            value={authorInput}
            onChange={(e) => setAuthorInput(e.target.value)}
            placeholder="Filter by builder name"
            aria-label="Filter by builder name"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              color: colors.ink,
              fontFamily: fonts.body,
              fontSize: fontSize.meta,
              padding: "9px 0",
            }}
          />
          {authorInput && (
            <button
              type="button"
              onClick={() => setAuthorInput("")}
              aria-label="Clear builder filter"
              style={{ border: "none", background: "transparent", color: colors.muted, cursor: "pointer", display: "flex", padding: 2, flexShrink: 0 }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Compact ship list — mirrors "All blockers" */}
      <section aria-label="All ships">
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
          <span aria-hidden style={{ color: colors.go, fontSize: 13, lineHeight: 1 }}>
            →
          </span>
          All ships
          {!loading && (
            <span style={{ color: colors.mutedSoft, fontSize: fontSize.micro }}>
              {posts.length}{hasMore ? "+" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <SkeletonFeed count={3} label="Loading ships" />
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
            {filtering ? (
              <>
                No ships match these filters.{" "}
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: colors.violet,
                    fontFamily: fonts.body,
                    fontSize: fontSize.body,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  Clear filters
                </button>
              </>
            ) : (
              "No ships yet. Be the first to log one."
            )}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing[3],
              opacity: filterPending ? 0.5 : 1,
              transition: `opacity ${motion.fast} ${motion.ease}`,
            }}
          >
            {posts.map((p) => {
              const isOwn = !!userId && p.author_id === userId
              const isTarget = p.id === shipParam
              return (
                <div key={p.id} ref={isTarget ? targetRef : undefined}>
                  <BuildLogCard
                    post={p}
                    cheerCount={cheerCounts[p.id] ?? 0}
                    commentCount={commentCounts[p.id] ?? 0}
                    isMine={mineCheers.has(p.id)}
                    isOwn={isOwn}
                    currentUserId={userId}
                    onCheer={() => toggleCheer(p.id)}
                    isNominated={nominated.has(p.id)}
                    highlight={isTarget}
                    defaultOpenComments={isTarget && openComments}
                    onToggleNominate={
                      isOwn
                        ? () =>
                            (nominated.has(p.id) ? unnominate(p.id) : nominate(p.id)).catch((err) =>
                              console.error("[spotlight] nominate toggle failed:", err),
                            )
                        : undefined
                    }
                  />
                </div>
              )
            })}
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
                letterSpacing: "0.05em",
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
    </div>
  )
}

/** A small toggleable category pill. */
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "4px 11px",
        borderRadius: radii.pill,
        border: `1.4px solid ${active ? colors.violet : colors.line}`,
        background: active ? colors.violetSoft : colors.panel,
        color: active ? colors.violet : colors.muted,
        fontFamily: fonts.mono,
        fontSize: fontSize.label,
        fontWeight: active ? fontWeight.semibold : fontWeight.regular,
        letterSpacing: "0.03em",
        cursor: "pointer",
        transition: `background ${motion.fast} ${motion.ease}, border-color ${motion.fast} ${motion.ease}, color ${motion.fast} ${motion.ease}`,
      }}
    >
      {label}
    </button>
  )
}

export default BuildLogFeed
