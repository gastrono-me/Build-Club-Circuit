import React from "react";
import { colors, radii, shadows, spacing } from "@/lib/design/tokens";

/**
 * Spine prop kept for backward compatibility.
 * The new look uses ink border + hard offset shadow on all cards.
 * spine maps to a thin top accent rule in the relevant color
 * (or vector-blue for "violet", oxblood for "live").
 */
export type CardSpine = "violet" | "live" | "go" | "ink" | "none";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Accent spine color. Now rendered as a thin top rule rather than a left stripe. */
  spine?: CardSpine;
  /** Inner padding; defaults to 16px. */
  padding?: number;
}

const spineColor: Record<Exclude<CardSpine, "none">, string> = {
  violet: colors.violet,
  live: colors.oxblood,
  go: colors.go,
  ink: colors.ink,
};

export function Card({
  spine = "none",
  padding = spacing[4],
  children,
  style,
  ...rest
}: CardProps) {
  const hasSpine = spine !== "none";
  return (
    <div
      {...rest}
      style={{
        position: "relative",
        background: colors.panel,
        border: `1.5px solid ${colors.ink}`,
        borderRadius: radii.xl,
        padding,
        boxShadow: shadows.card,
        overflow: "hidden",
        ...style,
      }}
    >
      {hasSpine && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            height: 3,
            background: spineColor[spine],
            borderRadius: `${radii.xl}px ${radii.xl}px 0 0`,
          }}
        />
      )}
      {children}
    </div>
  );
}

export default Card;
