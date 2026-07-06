"use client"

import React from "react"
import { Search, X } from "lucide-react"
import { useBuildLog } from "@/lib/hooks/useBuildLog"
import { useSpotlightNominations } from "@/lib/hooks/useSpotlightNominations"
import { WORK_CATEGORIES } from "@/lib/data/work-categories"
import { PostUpdate } from "@/components/radar/PostUpdate"
import { BuildLogCard } from "@/components/radar/BuildLogCard"
import { ShipsPlot } from "@/components/radar/ShipsPlot"
import { colors, fonts, fontSize, fontWeight, radii, spacing, motion, letterSpacing } from "@/lib/design/tokens"

/** Debounce for the builder-name search, so typing doesn't fire a query per key. */
const SEARCH_DEBOUNCE_MS = 300
/** The field is a recent-energy lens, not the archive: cap the nodes it plots. */
const PLOT_WINDOW = 60

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
      <ShipsPlot
        posts={posts.slice(0, PLOT_WINDOW)}
        cheerCounts={cheerCounts}
        mineCheers={mineCheers}
        userId={userId}
        onCheer={async (id) => { await toggleCheer(id) }}
      />

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
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
            {posts.map((p) => {
              const isOwn = !!userId && p.author_id === userId
              return (
                <BuildLogCard
                  key={p.id}
                  post={p}
                  cheerCount={cheerCounts[p.id] ?? 0}
                  commentCount={commentCounts[p.id] ?? 0}
                  isMine={mineCheers.has(p.id)}
                  isOwn={isOwn}
                  currentUserId={userId}
                  onCheer={() => toggleCheer(p.id)}
                  isNominated={nominated.has(p.id)}
                  onToggleNominate={
                    isOwn
                      ? () =>
                          (nominated.has(p.id) ? unnominate(p.id) : nominate(p.id)).catch((err) =>
                            console.error("[spotlight] nominate toggle failed:", err),
                          )
                      : undefined
                  }
                />
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
