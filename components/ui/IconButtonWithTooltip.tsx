"use client"

import React, { useState } from "react"
import { colors, fonts, fontSize, letterSpacing, radii } from "@/lib/design/tokens"

/** Small circular icon button (or link) with a text bubble that appears on hover. */
export function IconButtonWithTooltip({
  tooltip,
  onClick,
  href,
  active,
  children,
  ariaLabel,
  size = 24,
  tooltipPosition = "bottom",
}: {
  tooltip: string
  onClick?: () => void
  href?: string
  active?: boolean
  children: React.ReactNode
  ariaLabel: string
  /** Diameter in px. Defaults to 24 (inline, e.g. session cards). Use 32+ for primary touch targets. */
  size?: number
  /** Side the tooltip bubble opens toward. Use "top" when the button sits at the bottom of a card with overflow:hidden, or the bubble gets clipped. */
  tooltipPosition?: "top" | "bottom"
}) {
  const [hover, setHover] = useState(false)
  const triggerStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: size,
    height: size,
    background: active ? colors.violet : "transparent",
    border: `1.5px solid ${active ? colors.violet : colors.line}`,
    borderRadius: radii.pill,
    color: active ? colors.onDark : colors.muted,
    cursor: "pointer",
    flexShrink: 0,
    textDecoration: "none",
  }
  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover && (
        <div
          style={{
            position: "absolute",
            ...(tooltipPosition === "top"
              ? { bottom: "calc(100% + 6px)" }
              : { top: "calc(100% + 6px)" }),
            right: 0,
            background: colors.ink,
            color: colors.onDark,
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: letterSpacing.label,
            textTransform: "uppercase" as const,
            whiteSpace: "nowrap",
            padding: "4px 8px",
            borderRadius: radii.sm,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {tooltip}
        </div>
      )}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
          style={triggerStyle}
          onFocus={() => setHover(true)}
          onBlur={() => setHover(false)}
        >
          {children}
        </a>
      ) : (
        <button
          type="button"
          onClick={onClick}
          aria-label={ariaLabel}
          aria-pressed={active}
          style={triggerStyle}
          onFocus={() => setHover(true)}
          onBlur={() => setHover(false)}
        >
          {children}
        </button>
      )}
    </div>
  )
}

export default IconButtonWithTooltip
