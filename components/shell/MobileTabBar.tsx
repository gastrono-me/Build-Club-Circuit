"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, FolderGit2, Activity, Users, type LucideIcon } from "lucide-react"
import { isActivePath } from "@/lib/nav"
import { colors, fonts, fontSize, fontWeight, spacing } from "@/lib/design/tokens"

/** The core destinations, one tap away on mobile. The hamburger holds the rest. */
const TABS: { label: string; href: string; Icon: LucideIcon }[] = [
  { label: "Today", href: "/home", Icon: Home },
  { label: "Projects", href: "/projects", Icon: FolderGit2 },
  { label: "Radar", href: "/radar", Icon: Activity },
  { label: "People", href: "/people", Icon: Users },
]

/**
 * Fixed bottom tab bar for mobile only (the desktop left rail handles ≥768px).
 * Persistent one-tap access to the most-used destinations, so day-to-day
 * navigation doesn't require opening the drawer.
 */
export function MobileTabBar() {
  const pathname = usePathname()

  return (
    <>
      <style>{`
        .vec-tabbar { display: none; }
        @media (max-width: 767px) {
          .vec-tabbar {
            display: flex;
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 45;
            height: 56px;
            background: ${colors.surface};
            border-top: 1px solid ${colors.line};
            padding-bottom: env(safe-area-inset-bottom);
          }
        }
      `}</style>
      <nav className="vec-tabbar" aria-label="Primary">
        {TABS.map(({ label, href, Icon }) => {
          const active = isActivePath(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                textDecoration: "none",
                color: active ? colors.violet : colors.muted,
                paddingTop: spacing[2],
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: fontSize.micro,
                  fontWeight: active ? fontWeight.semibold : fontWeight.regular,
                  letterSpacing: "0.02em",
                }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

export default MobileTabBar
