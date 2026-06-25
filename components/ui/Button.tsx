"use client";

import React from "react";
import { colors, radii, fonts, fontWeight, motion } from "@/lib/design/tokens";

export type ButtonVariant =
  | "primary"   // ink fill — default high-emphasis action
  | "accent"    // vector-blue fill — brand / structural action
  | "secondary" // paper outline — low-emphasis
  | "ghost"     // text only
  | "danger";   // oxblood — cancel / remove

export type ButtonSize = "sm" | "md";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon (e.g. a lucide node). */
  icon?: React.ReactNode;
  /** Stretch to fill the container width. */
  full?: boolean;
}

const sizeMap: Record<ButtonSize, { padding: string; fontSize: number }> = {
  sm: { padding: "6px 12px", fontSize: 12 },
  md: { padding: "11px 17px", fontSize: 12 },
};

function variantStyle(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case "accent":
      return {
        background: colors.violet,
        color: colors.onDark,
        border: `1.5px solid ${colors.violet}`,
      };
    case "secondary":
      return {
        background: "transparent",
        color: colors.ink,
        border: `1.5px solid ${colors.ink}`,
      };
    case "ghost":
      return {
        background: "transparent",
        color: colors.ink,
        border: "1.5px solid transparent",
      };
    case "danger":
      return {
        background: "transparent",
        color: colors.oxblood,
        border: `1.5px solid ${colors.oxblood}`,
      };
    case "primary":
    default:
      return {
        background: colors.ink,
        color: colors.onDark,
        border: `1.5px solid ${colors.ink}`,
      };
  }
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  full = false,
  children,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const s = sizeMap[size];
  return (
    <button
      {...rest}
      disabled={disabled}
      data-variant={variant}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        width: full ? "100%" : undefined,
        padding: s.padding,
        fontFamily: fonts.mono,
        fontSize: s.fontSize,
        fontWeight: fontWeight.semibold,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        lineHeight: 1,
        borderRadius: radii.md,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
        userSelect: "none",
        transition: `background ${motion.fast} ${motion.ease}, color ${motion.fast} ${motion.ease}, transform ${motion.fast} ${motion.ease}`,
        boxShadow: "none",
        ...variantStyle(variant),
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "translateY(1px)";
        rest.onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "";
        rest.onMouseUp?.(e);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        // restore original styles on leave
        if (!disabled) {
          const vs = variantStyle(variant);
          e.currentTarget.style.background = (vs.background as string) ?? "";
          e.currentTarget.style.color = (vs.color as string) ?? "";
        }
        rest.onMouseLeave?.(e);
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (variant === "primary") {
          e.currentTarget.style.background = colors.violet;
          e.currentTarget.style.color = colors.onDark;
        } else if (variant === "accent") {
          e.currentTarget.style.background = colors.ink;
        } else if (variant === "secondary" || variant === "ghost") {
          e.currentTarget.style.background = colors.ink;
          e.currentTarget.style.color = colors.onDark;
        }
        rest.onMouseEnter?.(e);
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export default Button;
