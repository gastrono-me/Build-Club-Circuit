"use client"

import React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useRadar } from "@/lib/hooks/useRadar"
import { colors, fonts, fontSize, fontWeight, radii, shadows, spacing, letterSpacing } from "@/lib/design/tokens"

/**
 * Live Bottleneck Radar pulse for the Now page. Surfaces the real, realtime
 * hero from inside Pulse so a first-time visitor sees the room is active and
 * has one tap to the centrepiece. Reads live data from useRadar(); renders
 * nothing until there's something true to show.
 */
export function RadarPulse() {
  const { blockers, meTooCounts, loading } = useRadar()

  if (loading || blockers.length === 0) return null

  // Most common live category, and total me-too engagement across the board.
  const byCategory: Record<string, number> = {}
  for (const b of blockers) byCategory[b.category] = (byCategory[b.category] ?? 0) + 1
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const totalMeToo = Object.values(meTooCounts).reduce((a, b) => a + b, 0)

  const count = blockers.length
  const blockerWord = count === 1 ? "blocker" : "blockers"

  return (
    <Link href="/radar" className="now-radar-pulse" aria-label={`Bottleneck Radar: ${count} ${blockerWord} on the board right now. Open radar.`}>
      <style>{`
        .now-radar-pulse {
          display: flex;
          align-items: center;
          gap: ${spacing[4]}px;
          text-decoration: none;
          background: ${colors.panel};
          border: 1.5px solid ${colors.ink};
          border-radius: ${radii.xl}px;
          box-shadow: ${shadows.card};
          padding: ${spacing[4]}px;
          margin-bottom: ${spacing[5]}px;
          transition: transform 150ms cubic-bezier(0.2,0,0,1), box-shadow 150ms cubic-bezier(0.2,0,0,1);
        }
        .now-radar-pulse:hover {
          transform: translate(-2px, -2px);
          box-shadow: 8px 8px 0 rgba(20,20,60,0.12);
        }
        @media (prefers-reduced-motion: reduce) {
          .now-radar-pulse { transition: none; }
          .now-radar-pulse:hover { transform: none; }
          .now-radar-pulse .now-radar-blip { animation: none; }
        }
        @keyframes nowRadarBlip {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Live kicker */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: letterSpacing.label,
            textTransform: "uppercase",
            color: colors.violet,
            marginBottom: spacing[2],
          }}
        >
          <span
            className="now-radar-blip"
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: colors.violet,
              display: "inline-block",
              animation: "nowRadarBlip 2s ease-in-out infinite",
            }}
          />
          Live · Bottleneck Radar
        </div>

        {/* Count */}
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: fontWeight.semibold,
            fontSize: 30,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: colors.ink,
          }}
        >
          {count} {blockerWord} on the board
        </div>

        {/* Detail line */}
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.meta,
            color: colors.muted,
            marginTop: spacing[1],
          }}
        >
          {topCategory ? <>Most common: <strong style={{ color: colors.ink, fontWeight: fontWeight.semibold }}>{topCategory}</strong></> : "See where the room is stuck"}
          {totalMeToo > 0 && <> · {totalMeToo} me-too signal{totalMeToo === 1 ? "" : "s"}</>}
        </div>
      </div>

      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 38,
          height: 38,
          borderRadius: radii.md,
          background: colors.violet,
          color: colors.onDark,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ArrowRight size={18} strokeWidth={2.25} />
      </div>
    </Link>
  )
}

export default RadarPulse
