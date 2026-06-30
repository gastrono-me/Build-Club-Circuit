"use client"

import React from "react"
import { colors, fonts, fontSize, fontWeight, letterSpacing, shadows, spacing } from "@/lib/design/tokens"

/**
 * The landing hero artifact: Circuit's embedding-field motif reworked to read as
 * a live instrument rather than a static graphic. Builders are plotted points on
 * technical paper; every couple of seconds one "ships" — its node pings, a vector
 * snaps to a neighbour (the "together" of the daily ritual), the shipped-today
 * counter ticks up, and the activity line rolls. Decorative, so it is aria-hidden
 * to assistive tech, and it holds still under prefers-reduced-motion.
 *
 * Positions are derived from a deterministic hash (no Math.random in render), so
 * the server and client markup match and there is no hydration flash.
 */

const NODE_COUNT = 22
const SHIP_INTERVAL_MS = 1900
const SHIP_BASE = 137 // a believable "already shipped today" starting count

// normalised 0-1 -> SVG/percentage space, matching components/field/EmbeddingField
const px = (x: number) => 6 + x * 88
const py = (y: number) => 96 - y * 90

const FIRST_NAMES = ["maya", "deon", "priya", "sam", "arjun", "lena", "kojo", "ines", "yuki", "tariq", "noor", "beck"]
const ACTIONS = [
  "shipped a feature",
  "logged a win",
  "cleared a blocker",
  "pushed to prod",
  "shipped the MVP",
  "kept a 7 day streak",
]

/** Deterministic [0,1) hash so SSR and client agree on the layout. */
function frac(n: number): number {
  return n - Math.floor(n)
}
function hashPoint(i: number): { x: number; y: number } {
  // Keep points off the very edges so nodes and labels stay inside the stage.
  const x = 0.08 + frac(Math.sin((i + 1) * 12.9898) * 43758.5453) * 0.84
  const y = 0.1 + frac(Math.sin((i + 1) * 78.233) * 12345.6789) * 0.8
  return { x, y }
}

interface Node {
  id: number
  x: number
  y: number
  nearest: number
}

function buildNodes(): Node[] {
  const pts = Array.from({ length: NODE_COUNT }, (_, i) => ({ id: i, ...hashPoint(i) }))
  return pts.map((p) => {
    let nearest = -1
    let best = Infinity
    for (const q of pts) {
      if (q.id === p.id) continue
      const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2
      if (d < best) { best = d; nearest = q.id }
    }
    return { ...p, nearest }
  })
}

interface Activity {
  seq: number
  nodeId: number
  neighborId: number
  name: string
  action: string
}

export function LiveField({ style }: { style?: React.CSSProperties }) {
  const nodes = React.useMemo(buildNodes, [])
  const [reduceMotion] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )
  const [shipped, setShipped] = React.useState(SHIP_BASE)
  const [activity, setActivity] = React.useState<Activity | null>(null)
  const seqRef = React.useRef(0)

  React.useEffect(() => {
    if (reduceMotion) {
      // Hold a single representative activity so the field is legible but still.
      setActivity({ seq: 1, nodeId: 4, neighborId: nodes[4]?.nearest ?? 0, name: "maya", action: "shipped a feature" })
      return
    }
    const tick = () => {
      const nodeId = Math.floor(Math.random() * nodes.length)
      seqRef.current += 1
      setActivity({
        seq: seqRef.current,
        nodeId,
        neighborId: nodes[nodeId].nearest,
        name: FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)],
        action: ACTIONS[Math.floor(Math.random() * ACTIONS.length)],
      })
      setShipped((s) => s + 1)
    }
    tick()
    const t = setInterval(tick, SHIP_INTERVAL_MS)
    return () => clearInterval(t)
  }, [reduceMotion, nodes])

  const active = activity ? nodes[activity.nodeId] : null
  const neighbor = activity ? nodes[activity.neighborId] : null

  return (
    <section
      aria-label="Live view of Build Club builders shipping today"
      style={{
        position: "relative",
        background: "#F4F6F9",
        border: `1.5px solid ${colors.ink}`,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: shadows.card,
        ...style,
      }}
    >
      {/* Header strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing[3],
          padding: "9px 13px",
          borderBottom: `1.5px solid ${colors.ink}`,
          background: colors.surface,
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: letterSpacing.label,
            textTransform: "uppercase",
            fontWeight: fontWeight.semibold,
            color: colors.ink,
          }}
        >
          Build Club · ship log
        </span>
        <span
          aria-hidden
          style={{
            fontFamily: fonts.mono,
            fontSize: 9.5,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: colors.violet,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: colors.violet,
              display: "inline-block",
              animation: reduceMotion ? "none" : "lfPing 1.9s ease-out infinite",
            }}
          />
          live
        </span>
      </div>

      {/* Plot stage */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 0.8" }}>
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
        >
          {/* Grid */}
          {Array.from({ length: 9 }, (_, i) => i + 1).map((i) => {
            const v = i * 10
            const isCenter = i === 5
            return (
              <React.Fragment key={i}>
                <line x1={v} y1={0} x2={v} y2={100} stroke={isCenter ? "#c2cad6" : "#dce2ea"} strokeWidth={isCenter ? 0.5 : 0.3} strokeDasharray={isCenter ? undefined : "1.2 1.6"} />
                <line x1={0} y1={v} x2={100} y2={v} stroke={isCenter ? "#c2cad6" : "#dce2ea"} strokeWidth={isCenter ? 0.5 : 0.3} strokeDasharray={isCenter ? undefined : "1.2 1.6"} />
              </React.Fragment>
            )
          })}
          {/* Axes */}
          <line x1={2} y1={98} x2={98} y2={98} stroke={colors.ink} strokeWidth={0.6} />
          <line x1={2} y1={98} x2={2} y2={2} stroke={colors.ink} strokeWidth={0.6} />

          {/* Active "together" vector */}
          {active && neighbor && (
            <line
              key={activity!.seq}
              x1={px(active.x)} y1={py(active.y)}
              x2={px(neighbor.x)} y2={py(neighbor.y)}
              stroke={colors.violet}
              strokeWidth={1.6}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ animation: reduceMotion ? "none" : "lfVector 1.9s ease-out forwards" }}
              opacity={reduceMotion ? 0.5 : undefined}
            />
          )}

          {/* Idle nodes */}
          {nodes.map((n) => {
            const isActive = active?.id === n.id
            return (
              <circle
                key={n.id}
                cx={px(n.x)}
                cy={py(n.y)}
                r={isActive ? 2.1 : 1.5}
                fill={isActive ? colors.violet : colors.mutedSoft}
                vectorEffect="non-scaling-stroke"
                style={{
                  transition: reduceMotion ? "none" : "fill 0.4s ease, r 0.4s ease",
                  opacity: reduceMotion ? 1 : undefined,
                  animation: reduceMotion ? "none" : `lfBreathe ${3 + (n.id % 5) * 0.6}s ease-in-out ${n.id * 0.18}s infinite`,
                }}
              />
            )
          })}
        </svg>

        {/* Ping ring on the shipping node (HTML overlay so it can scale cleanly) */}
        {active && !reduceMotion && (
          <span
            key={activity!.seq}
            aria-hidden
            style={{
              position: "absolute",
              left: `${px(active.x)}%`,
              top: `${py(active.y)}%`,
              width: 10,
              height: 10,
              marginLeft: -5,
              marginTop: -5,
              borderRadius: "50%",
              border: `1.5px solid ${colors.violet}`,
              animation: "lfRing 1.9s ease-out forwards",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Floating activity chip near the shipping node */}
        {activity && active && (
          <span
            key={`chip-${activity.seq}`}
            aria-hidden
            style={{
              position: "absolute",
              left: `${Math.min(Math.max(px(active.x), 16), 84)}%`,
              top: `${Math.min(Math.max(py(active.y) - 9, 6), 84)}%`,
              transform: "translate(-50%, -100%)",
              background: colors.ink,
              color: colors.onDark,
              fontFamily: fonts.mono,
              fontSize: 9.5,
              letterSpacing: "0.03em",
              padding: "3px 7px",
              borderRadius: 6,
              whiteSpace: "nowrap",
              boxShadow: "3px 3px 0 rgba(20,20,60,0.16)",
              animation: reduceMotion ? "none" : "lfChip 1.9s ease-out forwards",
              pointerEvents: "none",
            }}
          >
            {activity.name} {activity.action}
          </span>
        )}

        {/* Shipped-today readout */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            bottom: 8,
            right: 11,
            fontFamily: fonts.mono,
            fontSize: 9.5,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: colors.muted,
            pointerEvents: "none",
          }}
        >
          {shipped} shipped today
        </span>
        <span
          aria-hidden
          style={{
            position: "absolute",
            bottom: 8,
            left: 9,
            fontFamily: fonts.mono,
            fontSize: 9.5,
            color: "#9aa2af",
            pointerEvents: "none",
          }}
        >
          the cohort, right now
        </span>
      </div>

      <style>{`
        @keyframes lfPing {
          0%   { box-shadow: 0 0 0 0 rgba(43,43,245,.5); }
          70%  { box-shadow: 0 0 0 7px rgba(43,43,245,0); }
          100% { box-shadow: 0 0 0 0 rgba(43,43,245,0); }
        }
        @keyframes lfRing {
          0%   { transform: scale(1); opacity: .8; }
          100% { transform: scale(4.2); opacity: 0; }
        }
        @keyframes lfVector {
          0%   { opacity: 0; }
          22%  { opacity: .85; }
          100% { opacity: 0; }
        }
        @keyframes lfChip {
          0%   { opacity: 0; transform: translate(-50%, -90%); }
          14%  { opacity: 1; transform: translate(-50%, -100%); }
          78%  { opacity: 1; transform: translate(-50%, -100%); }
          100% { opacity: 0; transform: translate(-50%, -116%); }
        }
        @keyframes lfBreathe {
          0%, 100% { opacity: .55; }
          50%      { opacity: .9; }
        }
      `}</style>
    </section>
  )
}

export default LiveField
