"use client"

import React from "react"
import { useBuildLog } from "@/lib/hooks/useBuildLog"
import { PostUpdate } from "@/components/radar/PostUpdate"
import { BuildLogCard } from "@/components/radar/BuildLogCard"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

export function BuildLogFeed({ eventId }: { eventId?: string | null } = {}) {
  const { posts, loading, post, toggleCheer, cheerCounts, mineCheers, userId, loadMore, hasMore } = useBuildLog(eventId)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
      <SectionTitle
        kicker="Build log"
        title="What's shipping"
        note="Post a quick update when something starts working. Cheer the ones that made your day."
      />

      <PostUpdate onPost={post} />

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
            No updates yet. Be the first to post one.
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

export default BuildLogFeed
