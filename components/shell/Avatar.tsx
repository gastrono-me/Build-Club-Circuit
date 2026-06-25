import React from "react";
import { colors, radii, fonts, fontWeight, avatarPalette } from "@/lib/design/tokens";

export interface AvatarProps {
  /** Display name — drives initials and the deterministic fill color. */
  name: string;
  /** Optional photo URL. Falls back to initials when absent. */
  photo?: string | null;
  /** Square edge length in px. Defaults to 38. */
  size?: number;
}

function initialsOf(name: string): string {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({ name, photo, size = 38 }: AvatarProps) {
  // Circular avatars — consistent with the mockup mark style.
  const radius = radii.pill;

  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: "cover",
          flexShrink: 0,
          display: "block",
          border: `1.4px solid ${colors.line}`,
        }}
      />
    );
  }

  // djb2 hash over full name for uniform distribution
  const safeName = name || "?";
  let h = 5381;
  for (let i = 0; i < safeName.length; i++) {
    h = ((h << 5) + h + safeName.charCodeAt(i)) >>> 0;
  }
  const color = avatarPalette[h % avatarPalette.length];

  return (
    <div
      aria-label={name}
      role="img"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        background: color,
        color: colors.onDark,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: fonts.mono,
        fontWeight: fontWeight.semibold,
        fontSize: Math.round(size * 0.34),
        lineHeight: 1,
        userSelect: "none",
        border: `1.4px solid ${colors.line}`,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

export default Avatar;
