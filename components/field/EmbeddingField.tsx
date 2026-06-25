"use client"

import React from "react"
import { colors, fonts, fontSize, fontWeight, spacing, shadows, letterSpacing } from "@/lib/design/tokens"

/**
 * Shared visual scaffold for every "embedding field" plot in the app (Bottleneck
 * Radar, Build Log, People). Layout math (lib/radar/similarity.ts) and the
 * meaning of a node/link are owned by the caller; this component only owns the
 * SVG grid/axes, the live-blip chrome, node/link rendering, and the floating
 * detail panel slot — the part that was previously duplicated almost line for
 * line between EmbeddingPlot and PeopleField.
 *
 * Coordinates are normalised 0-1 (the same space layoutField() returns); this
 * component does the 0-1 -> SVG-viewBox transform once.
 */

// normalised (0-1) -> SVG user space (6px pad, 88/90% range)
function px(x: number) { return 6 + x * 88 }
function py(y: number) { return 96 - y * 90 } // invert: higher y plotted upward

export interface FieldLink {
  key: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  strokeWidth: number
  opacity: number
  active?: boolean
  color?: string
}

export interface FieldNode {
  id: string
  x: number
  y: number
  radius: number
  /** Dot fill color. Ignored when variant is "me". */
  fill: string
  /** "soft" draws a thin ring matching `fill`; "none" draws no idle ring. */
  ring?: "soft" | "none"
  selected: boolean
  /** Plays the ping animation (e.g. "just posted" / "just voted"). */
  pulsing?: boolean
  /** Cursor affordance only — the click handler still fires either way. */
  clickable?: boolean
  ariaLabel: string
  onClick?: () => void
  /** Special styling for a "this is you" node: surface fill, violet border, raised z-index. */
  variant?: "me"
  /** Optional small label rendered just below the node (e.g. "you"). */
  belowLabel?: string
}

export interface EmbeddingFieldProps {
  ariaLabel: string
  title: string
  headerRight?: React.ReactNode
  links: FieldLink[]
  nodes: FieldNode[]
  panel?: React.ReactNode
  panelAriaLabel?: string
  panelBottom?: number
  axisLabels?: { topLeft?: string; bottomRight?: string }
  originLabel?: string
  liveBlip?: boolean
  style?: React.CSSProperties
}

export function EmbeddingField({
  ariaLabel,
  title,
  headerRight,
  links,
  nodes,
  panel,
  panelAriaLabel,
  panelBottom = 28,
  axisLabels,
  originLabel,
  liveBlip,
  style,
}: EmbeddingFieldProps) {
  const [reduceMotion] = React.useState(
    () => typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  )

  return (
    <section
      aria-label={ariaLabel}
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
          {title}
        </span>
        {headerRight}
      </div>

      {/* Plot stage */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 0.82" }}>
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
        >
          {/* Grid lines */}
          {Array.from({ length: 9 }, (_, i) => i + 1).map((i) => {
            const v = i * 10
            const isCenter = i === 5
            const stroke = isCenter ? "#c2cad6" : "#dce2ea"
            const sw = isCenter ? 0.5 : 0.3
            const dash = isCenter ? undefined : "1.2 1.6"
            return (
              <React.Fragment key={i}>
                <line x1={v} y1={0} x2={v} y2={100} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
                <line x1={0} y1={v} x2={100} y2={v} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
              </React.Fragment>
            )
          })}
          {/* Axes */}
          <line x1={2} y1={98} x2={98} y2={98} stroke={colors.ink} strokeWidth={0.6} />
          <line x1={2} y1={98} x2={2} y2={2} stroke={colors.ink} strokeWidth={0.6} />

          {/* Links */}
          {links.map((l) => (
            <line
              key={l.key}
              x1={px(l.from.x)} y1={py(l.from.y)}
              x2={px(l.to.x)} y2={py(l.to.y)}
              stroke={l.color ?? colors.violet}
              strokeWidth={l.active ? Math.max(l.strokeWidth, 2.5) : l.strokeWidth}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity={l.active ? 0.85 : l.opacity}
              style={{ transition: reduceMotion ? "none" : "stroke-width 0.35s ease, opacity 0.35s ease" }}
            />
          ))}
        </svg>

        {/* Axis labels */}
        {axisLabels?.bottomRight && (
          <span
            aria-hidden
            style={{
              position: "absolute", bottom: 7, right: 11,
              fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: "0.07em",
              textTransform: "uppercase", color: colors.muted, pointerEvents: "none",
            }}
          >
            {axisLabels.bottomRight}
          </span>
        )}
        {axisLabels?.topLeft && (
          <span
            aria-hidden
            style={{
              position: "absolute", top: 11, left: 9,
              fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: "0.07em",
              textTransform: "uppercase", color: colors.muted, pointerEvents: "none",
              transformOrigin: "left top", transform: "rotate(90deg) translateY(-100%)", whiteSpace: "nowrap",
            }}
          >
            {axisLabels.topLeft}
          </span>
        )}
        {originLabel && (
          <span
            aria-hidden
            style={{
              position: "absolute", bottom: 7, left: 9,
              fontFamily: fonts.mono, fontSize: 9.5, color: "#9aa2af", pointerEvents: "none",
            }}
          >
            {originLabel}
          </span>
        )}

        {/* Live blip */}
        {liveBlip && (
          <span
            aria-hidden
            style={{
              position: "absolute", top: 11, right: 11, zIndex: 6,
              fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase",
              color: colors.violet, display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span
              style={{
                width: 7, height: 7, borderRadius: "50%", background: colors.violet, display: "inline-block",
                animation: reduceMotion ? "none" : "plotPing 1.9s ease-out infinite",
              }}
            />
            live
          </span>
        )}

        {/* Node buttons (overlaid HTML so they're keyboard focusable) */}
        {nodes.map((n) => {
          const isMe = n.variant === "me"
          const ring = n.ring ?? "soft"
          return (
            <React.Fragment key={n.id}>
              <button
                type="button"
                aria-label={n.ariaLabel}
                aria-pressed={n.selected}
                onClick={n.onClick}
                style={{
                  position: "absolute",
                  left: `${px(n.x)}%`,
                  top: `${py(n.y)}%`,
                  transform: "translate(-50%, -50%)",
                  width: 44, height: 44,
                  display: "grid", placeItems: "center",
                  background: "transparent", border: 0,
                  cursor: n.clickable === false ? "default" : "pointer",
                  padding: 0,
                  zIndex: isMe ? 6 : 5,
                  borderRadius: "50%",
                }}
              >
                <span
                  style={{
                    width: n.radius * 2,
                    height: n.radius * 2,
                    borderRadius: "50%",
                    background: isMe ? colors.surface : n.fill,
                    border: isMe ? `2.5px solid ${colors.violet}` : `2px solid #F4F6F9`,
                    boxShadow: n.selected
                      ? `0 0 0 2.5px ${colors.violet}, 0 0 0 5px rgba(43,43,245,0.18)`
                      : ring === "soft" ? `0 0 0 1.5px ${isMe ? colors.violet : n.fill}` : "none",
                    display: "block",
                    transition: reduceMotion
                      ? "none"
                      : "transform 0.18s ease, box-shadow 0.18s ease, width 0.32s cubic-bezier(0.34,1.56,0.64,1), height 0.32s cubic-bezier(0.34,1.56,0.64,1)",
                    transform: n.selected ? "scale(1.35)" : "scale(1)",
                    animation: n.pulsing && !reduceMotion ? "plotPing 1.9s ease-out infinite" : "none",
                  }}
                />
              </button>
              {n.belowLabel && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: `${px(n.x)}%`,
                    top: `${py(n.y)}%`,
                    transform: "translate(-50%, 14px)",
                    fontFamily: fonts.mono, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: colors.violet, pointerEvents: "none", whiteSpace: "nowrap",
                  }}
                >
                  {n.belowLabel}
                </span>
              )}
            </React.Fragment>
          )
        })}

        {/* Selection panel */}
        {panel && (
          <div
            role="region"
            aria-label={panelAriaLabel}
            style={{
              position: "absolute",
              bottom: panelBottom,
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(340px, 92%)",
              background: colors.surface,
              border: `1.5px solid ${colors.ink}`,
              borderRadius: 10,
              boxShadow: shadows.modal,
              padding: `${spacing[3]}px ${spacing[4]}px`,
              zIndex: 20,
            }}
          >
            {panel}
          </div>
        )}
      </div>

      <style>{`
        @keyframes plotPing {
          0%   { box-shadow: 0 0 0 1.5px #2B2BF5, 0 0 0 0 rgba(43,43,245,.45); }
          70%  { box-shadow: 0 0 0 1.5px #2B2BF5, 0 0 0 13px rgba(43,43,245,0); }
          100% { box-shadow: 0 0 0 1.5px #2B2BF5, 0 0 0 0 rgba(43,43,245,0); }
        }
      `}</style>
    </section>
  )
}

export default EmbeddingField
