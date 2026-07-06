"use client"

import React from "react"
import { colors, radii, spacing, shadows } from "@/lib/design/tokens"

/** A shimmering placeholder bar. Compose these into surface-shaped skeletons. */
export function Skeleton({ width = "100%", height = 12, round = false, style }: {
  width?: number | string
  height?: number
  round?: boolean
  style?: React.CSSProperties
}) {
  return (
    <span
      aria-hidden
      className="vec-skeleton"
      style={{
        display: "block",
        width,
        height,
        borderRadius: round ? "50%" : radii.sm,
        background: colors.line,
        ...style,
      }}
    />
  )
}

/** A ship/blocker-card-shaped skeleton: avatar row, then two text lines. */
export function SkeletonCard() {
  return (
    <div
      aria-hidden
      style={{
        background: colors.panel,
        border: `1px solid ${colors.line}`,
        borderRadius: radii.xl,
        boxShadow: shadows.card,
        padding: spacing[4],
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
        <Skeleton width={32} height={32} round />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton width="38%" height={11} />
          <Skeleton width="22%" height={9} />
        </div>
        <Skeleton width={64} height={20} />
      </div>
      <Skeleton width="92%" />
      <Skeleton width="64%" />
    </div>
  )
}

/**
 * A feed of card skeletons + the shimmer keyframes (rendered once per list).
 * Use in place of "Loading…" text so slow networks read as intentional.
 */
export function SkeletonFeed({ count = 3, label = "Loading" }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
      <style>{`
        .vec-skeleton {
          animation: vecShimmer 1.4s ease-in-out infinite;
        }
        @keyframes vecShimmer {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vec-skeleton { animation: none; }
        }
      `}</style>
    </div>
  )
}

export default Skeleton
