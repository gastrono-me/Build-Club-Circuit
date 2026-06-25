"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type LucideIcon } from "lucide-react"
import { colors, fonts, fontSize, fontWeight, spacing, radii, motion, letterSpacing } from "@/lib/design/tokens"
import { NAV_GROUPS } from "@/lib/nav"

/** Mono section label above a nav group ("PULSE" / "LINE"). Shared with MobileMenu's drawer nav. */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: fonts.mono,
        fontSize: fontSize.label,
        fontWeight: fontWeight.medium,
        color: colors.mutedSoft,
        letterSpacing: letterSpacing.label,
        textTransform: "uppercase",
        padding: `${spacing[2]}px ${spacing[3]}px ${spacing[1]}px`,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Desktop-only left rail. Every destination is always listed (grouped, not gated)
 * so nothing is hidden from a first-time visitor. Mobile navigation lives in
 * MobileMenu's drawer.
 */
export function Nav() {
  const pathname = usePathname()

  return (
    <>
      <style>{`
        .vec-nav {
          display: none;
          position: fixed;
          z-index: 40;
          background: ${colors.surface};
          border-right: 1px solid ${colors.line};
        }
        @media (min-width: 768px) {
          .vec-nav {
            display: flex;
            top: 52px;
            left: 0;
            width: 200px;
            bottom: 0;
            flex-direction: column;
            padding: ${spacing[3]}px ${spacing[2]}px;
            gap: 2px;
            overflow-y: auto;
          }
        }
      `}</style>
      <nav className="vec-nav" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <React.Fragment key={group.label}>
            <GroupLabel>{group.label}</GroupLabel>
            {group.items.map(({ label, href, Icon }) => (
              <NavLink key={href} label={label} href={href} Icon={Icon} active={pathname === href} />
            ))}
          </React.Fragment>
        ))}
      </nav>
    </>
  )
}

interface NavLinkProps {
  label: string
  href: string
  Icon: LucideIcon
  active: boolean
}

function NavLink({ label, href, Icon, active }: NavLinkProps) {
  return (
    <>
      <style>{`
        .vec-nav-link {
          display: flex;
          align-items: center;
          gap: ${spacing[2]}px;
          padding: ${spacing[2]}px ${spacing[3]}px;
          border-radius: ${radii.md}px;
          text-decoration: none;
          transition: background ${motion.fast} ${motion.ease};
          white-space: nowrap;
          overflow: hidden;
        }
        .vec-nav-link:hover {
          background: ${colors.violetSoft};
        }
      `}</style>
      <Link
        href={href}
        className="vec-nav-link"
        style={{
          background: active ? colors.violetSoft : "transparent",
          color: active ? colors.violet : colors.muted,
        }}
      >
        <Icon size={16} strokeWidth={active ? 2.5 : 1.75} />
        <span
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.meta,
            fontWeight: active ? fontWeight.semibold : fontWeight.regular,
            color: active ? colors.violet : colors.muted,
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
      </Link>
    </>
  )
}

export default Nav
