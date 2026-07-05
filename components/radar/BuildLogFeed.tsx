"use client"

import React from "react"
import { Search, X } from "lucide-react"
import { useBuildLog } from "@/lib/hooks/useBuildLog"
import { useSpotlightNominations } from "@/lib/hooks/useSpotlightNominations"
import { WORK_CATEGORIES } from "@/lib/data/work-categories"
import { PostUpdate } from "@/components/radar/PostUpdate"
import { BuildLogCard } from "@/components/radar/BuildLogCard"
import { ShipsPlot } from "@/components/radar/ShipsPlot"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { colors, fonts, fontSize, fontWeight, radii, spacing, motion } from "@/lib/design/tokens"

/** Debounce for the builder-name search, so typing doesn't fire a query per key. */
const SEARCH_DEBOUNCE_MS = 300
/** The map is a recent-energy lens, not the archive: cap the nodes it plots. */
const MAP_WINDOW = 60

export function BuildLogFeed({ eventId, compose = true }: { eventId?: string | null; compose?: boolean } = {}) {
  // Filters: category chip + builder-name search, both applied server-side.
  const [category, setCategory] = React.useState<string | null>(null)
  const [authorInput, setAuthorInput] = React.useState("")
  const [author, setAuthor] = React.useState<string | null>(null)
  // List is the workhorse; the map is a discovery lens over the same filtered set.
  const [view, setView] = React.useState<"list" | "map">("list")

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
      <SectionTitle
        kicker="Build log"
        title="What's shipping"
        note="Every ship the cohort has logged. Cheer the ones that made your day."
      />

      {compose && <PostUpdate onPost={post} />}

      {/* Filters: work category + builder name */}
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2] }}>
          <FilterChip label="All" active={!category} onClick={() => setCategory(null)} />
          {WORK_CATEGORIES.map((c) => (
            <FilterChip key={c} label={c} active={category === c} onClick={() => setCategory(category === c ? null : c)} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3], flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "1 1 220px",
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

        {/* List / Map view toggle */}
        <div
          role="group"
          aria-label="View"
          style={{ display: "inline-flex", alignItems: "center", gap: 2, background: colors.line, borderRadius: radii.pill, padding: 2 }}
        >
          {(["list", "map"] as const).map((v) => {
            const active = view === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={active}
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
                {v === "list" ? "List" : "Map"}
              </button>
            )
          })}
        </div>
        </div>
      </div>

      <section aria-label="All updates">
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
              "No updates yet. Be the first to post one."
            )}
          </div>
        ) : view === "map" ? (
          <ShipsPlot
            posts={posts.slice(0, MAP_WINDOW)}
            cheerCounts={cheerCounts}
            mineCheers={mineCheers}
            userId={userId}
            onCheer={async (id) => { await toggleCheer(id) }}
          />
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

        {!loading && hasMore && view === "list" && (
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
