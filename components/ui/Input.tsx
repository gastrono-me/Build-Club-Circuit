"use client";

import React from "react";
import { colors, radii, fonts, fontSize, motion, spacing } from "@/lib/design/tokens";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional label rendered above the field. */
  label?: string;
  /** Optional leading icon inside the field (e.g. a search glyph). */
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, icon, style, id, ...rest }, ref) {
    const fieldId = id ?? (label ? `in-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);

    const field = (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: colors.paper2,
          border: `1.4px solid ${colors.line}`,
          borderRadius: radii.md,
          padding: icon ? "0 12px" : 0,
          transition: `border-color ${motion.fast} ${motion.ease}`,
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = colors.violet;
          e.currentTarget.style.outline = `2px solid ${colors.violet}`;
          e.currentTarget.style.outlineOffset = "1px";
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = colors.line;
          e.currentTarget.style.outline = "none";
        }}
      >
        {icon && <span style={{ color: colors.mutedSoft, display: "flex" }}>{icon}</span>}
        <input
          ref={ref}
          id={fieldId}
          {...rest}
          style={{
            flex: 1,
            width: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            color: colors.ink,
            fontFamily: fonts.body,
            fontSize: fontSize.body,
            padding: icon ? "11px 0" : "11px 13px",
            borderRadius: radii.md,
            ...style,
          }}
        />
      </div>
    );

    if (!label) return field;
    return (
      <label
        htmlFor={fieldId}
        style={{ display: "block" }}
      >
        <span
          style={{
            display: "block",
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: colors.muted,
            marginBottom: spacing[2],
          }}
        >
          {label}
        </span>
        {field}
      </label>
    );
  }
);

export default Input;
