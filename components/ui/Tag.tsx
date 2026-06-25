"use client";

import React from "react";
import { colors, radii, fonts, fontSize, letterSpacing, motion } from "@/lib/design/tokens";

export type TagTone = "ink" | "violet" | "live" | "go";

export interface TagProps {
  children: React.ReactNode;
  /** Selected state — ink fill on paper text. */
  active?: boolean;
  /** Makes the tag a filter/toggle; renders as a button when set. */
  onClick?: () => void;
  /** Resting tone when not active. */
  tone?: TagTone;
}

const tones: Record<TagTone, { bg: string; bd: string; fg: string }> = {
  ink: { bg: "transparent", bd: colors.line, fg: colors.muted },
  violet: { bg: colors.violetSoft, bd: "transparent", fg: colors.violet },
  live: { bg: colors.liveSoft, bd: "transparent", fg: colors.live },
  go: { bg: colors.goSoft, bd: "transparent", fg: colors.go },
};

export function Tag({ children, active = false, onClick, tone = "ink" }: TagProps) {
  const t = active
    ? { bg: colors.ink, bd: colors.ink, fg: colors.onDark }
    : tones[tone];
  const interactive = Boolean(onClick);

  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    fontFamily: fonts.mono,
    fontSize: fontSize.label,
    letterSpacing: letterSpacing.tag,
    textTransform: "uppercase",
    padding: "4px 10px",
    borderRadius: radii.pill,
    background: t.bg,
    border: `1.4px solid ${t.bd}`,
    color: t.fg,
    whiteSpace: "nowrap",
    userSelect: "none",
    lineHeight: 1.4,
    cursor: interactive ? "pointer" : "default",
    transition: `background ${motion.fast} ${motion.ease}, color ${motion.fast} ${motion.ease}, border-color ${motion.fast} ${motion.ease}`,
  };

  if (interactive) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} style={style}>
        {children}
      </button>
    );
  }
  return <span style={style}>{children}</span>;
}

export default Tag;
