import React from "react"
import { colors, fonts } from "@/lib/design/tokens"
import { VENUES } from "@/lib/data/venues"

/** Fixed pin positions for the illustrative city map. Not to scale. */
const VENUE_MAP_POS: Record<string, { x: number; y: number }> = {
  sihub: { x: 130, y: 90 },
  gem:   { x: 260, y: 255 },
  dream: { x: 190, y: 210 },
  hive:  { x: 530, y: 190 },
  rmit:  { x: 260, y: 400 },
}

export function CityMapSVG({ activeKeys }: { activeKeys: Set<string> }) {
  return (
    <svg viewBox="0 0 640 460" style={{ width: "100%", height: "auto", display: "block" }}>
      <rect width="640" height="460" rx="20" fill={colors.surface} />
      <path
        d="M 430 -10 C 400 80 460 160 420 240 C 390 320 450 380 415 470"
        stroke="#BFE0EE"
        strokeWidth="46"
        fill="none"
        strokeLinecap="round"
        opacity="0.8"
      />

      <rect x="40"  y="30"  width="200" height="130" rx="22" fill="#fff" stroke={colors.line} />
      <text x="58"  y="54"  fontFamily={fonts.mono} fontSize="11" fill={colors.muted} letterSpacing="0.06em">DISTRICT 3</text>

      <rect x="120" y="170" width="260" height="170" rx="22" fill="#fff" stroke={colors.line} />
      <text x="138" y="194" fontFamily={fonts.mono} fontSize="11" fill={colors.muted} letterSpacing="0.06em">DISTRICT 1</text>

      <rect x="460" y="110" width="150" height="170" rx="22" fill="#fff" stroke={colors.line} />
      <text x="475" y="134" fontFamily={fonts.mono} fontSize="11" fill={colors.muted} letterSpacing="0.06em">DISTRICT 2</text>

      <rect x="150" y="365" width="220" height="75"  rx="22" fill="#fff" stroke={colors.line} />
      <text x="168" y="389" fontFamily={fonts.mono} fontSize="11" fill={colors.muted} letterSpacing="0.06em">DISTRICT 7</text>

      {Object.entries(VENUES).map(([key, v]) => {
        const pos = VENUE_MAP_POS[key]
        if (!pos) return null
        const active = activeKeys.has(key)
        return (
          <g key={key} opacity={active ? 1 : 0.35}>
            {active && (
              <circle cx={pos.x} cy={pos.y} r="15" fill={colors.violet} opacity="0.16" />
            )}
            <circle
              cx={pos.x}
              cy={pos.y}
              r="9"
              fill={active ? colors.violet : colors.mutedSoft}
              stroke="#fff"
              strokeWidth="2.5"
            />
            <text
              x={pos.x}
              y={pos.y + 24}
              textAnchor="middle"
              fontFamily={fonts.display}
              fontWeight="600"
              fontSize="12.5"
              fill={active ? colors.ink : colors.mutedSoft}
            >
              {v.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default CityMapSVG
