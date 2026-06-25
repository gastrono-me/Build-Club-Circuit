import React from "react"
import { colors, fonts } from "@/lib/design/tokens"

export function BuildFloorPlanSVG() {
  const tableGrid = (x0: number, y0: number, cols: number, rows: number) => {
    const items: { x: number; y: number }[] = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        items.push({ x: x0 + c * 60, y: y0 + r * 44 })
    return items
  }
  const zoneA = tableGrid(40, 170, 4, 3)
  const zoneB = tableGrid(350, 170, 4, 3)

  return (
    <svg viewBox="0 0 640 440" style={{ width: "100%", height: "auto", display: "block" }}>
      <rect x="20" y="20" width="600" height="400" rx="18" fill="#fff" stroke={colors.line} strokeWidth="2" />

      <rect x="20"  y="20"  width="110" height="60" rx="10" fill={colors.violetSoft} />
      <text x="35"  y="55"  fontFamily={fonts.display} fontWeight="600" fontSize="12" fill={colors.violet}>
        Registration
      </text>

      <rect x="150" y="20"  width="470" height="90" rx="10" fill={colors.liveSoft} />
      <text x="170" y="55"  fontFamily={fonts.display} fontWeight="700" fontSize="15" fill={colors.live}>
        Main Stage
      </text>
      <text x="170" y="75"  fontFamily={fonts.mono} fontSize="11" fill={colors.live} opacity="0.8">
        Keynotes · Talks · Demo Day
      </text>

      <rect x="20"  y="130" width="290" height="200" rx="10" fill={colors.surface} stroke={colors.line} />
      <text x="36"  y="155" fontFamily={fonts.display} fontWeight="600" fontSize="13" fill={colors.ink}>
        Build Zone A
      </text>
      {zoneA.map((t, i) => (
        <rect key={"a" + i} x={t.x} y={t.y} width="46" height="30" rx="5" fill="#fff" stroke={colors.line} />
      ))}

      <rect x="330" y="130" width="290" height="200" rx="10" fill={colors.surface} stroke={colors.line} />
      <text x="346" y="155" fontFamily={fonts.display} fontWeight="600" fontSize="13" fill={colors.ink}>
        Build Zone B
      </text>
      {zoneB.map((t, i) => (
        <rect key={"b" + i} x={t.x} y={t.y} width="46" height="30" rx="5" fill="#fff" stroke={colors.line} />
      ))}

      <rect x="20"  y="340" width="180" height="80" rx="10" fill={colors.goSoft} />
      <text x="36"  y="375" fontFamily={fonts.display} fontWeight="600" fontSize="13" fill={colors.go}>
        Mentor Lounge
      </text>

      <rect x="220" y="340" width="180" height="80" rx="10" fill="#FBE8C9" />
      <text x="236" y="375" fontFamily={fonts.display} fontWeight="600" fontSize="13" fill="#9A5B00">
        Snacks &amp; Coffee
      </text>

      <rect x="420" y="340" width="200" height="80" rx="10" fill={colors.violetSoft} />
      <text x="436" y="375" fontFamily={fonts.display} fontWeight="600" fontSize="13" fill={colors.violet}>
        Quiet / Focus Room
      </text>
    </svg>
  )
}

export default BuildFloorPlanSVG
