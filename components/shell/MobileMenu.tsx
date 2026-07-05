"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, X } from "lucide-react"
import { colors, fonts, fontSize, fontWeight, spacing, radii, shadows, motion } from "@/lib/design/tokens"
import { NAV_GROUPS, isActivePath, type NavItem } from "@/lib/nav"
import { GroupLabel } from "@/components/shell/Nav"
import { Avatar } from "@/components/shell/Avatar"
import { CatchupRequestRow, ActivityNotificationRow, MessageRow } from "@/components/shell/NotificationItems"
import { useProfile } from "@/lib/hooks/useProfile"
import { useSocial } from "@/components/shell/SocialProvider"

/** Mobile-only hamburger trigger + slide-out drawer holding nav, mode/clock controls, and messages. */
export function MobileMenu() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const { profile, loading } = useProfile()
  const name = loading || !profile ? "Profile" : profile.name || "Profile"
  const avatar_url = profile?.avatar_url

  const { inbox, totalUnread, pendingCatchups, openPanel, activity, unreadActivity, markActivityRead } = useSocial()
  const notificationCount = totalUnread + pendingCatchups.length + unreadActivity
  const badgeCount = notificationCount > 9 ? "9+" : String(notificationCount)

  // Opening the drawer surfaces the cheers, so mark them seen (same rationale as
  // the desktop bell).
  function openDrawer() {
    setOpen(true)
    markActivityRead()
  }

  return (
    <>
      <style>{`
        .vec-mobile-menu-root { display: contents; }
        .vec-hamburger { display: none; }
        @media (max-width: 767px) {
          .vec-hamburger { display: flex; }
        }
        @media (min-width: 768px) {
          .vec-mobile-menu-root { display: none; }
        }
      `}</style>

      <button
        type="button"
        onClick={openDrawer}
        aria-label="Open menu"
        className="vec-hamburger"
        style={{
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: radii.md,
          border: `1.5px solid ${colors.line}`,
          background: "transparent",
          cursor: "pointer",
          color: colors.ink,
          padding: 0,
          flexShrink: 0,
        }}
      >
        <Menu size={18} strokeWidth={1.8} />
        {notificationCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: radii.pill,
              background: colors.violet,
              color: colors.onDark,
              fontFamily: fonts.mono,
              fontSize: fontSize.micro,
              fontWeight: fontWeight.semibold,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
            }}
          >
            {badgeCount}
          </span>
        )}
      </button>

      <div className="vec-mobile-menu-root">
        {open && (
          <div
            onClick={() => setOpen(false)}
            role="presentation"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(20,20,60,0.45)",
              backdropFilter: "blur(2px)",
              zIndex: 90,
            }}
          />
        )}

        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "min(82vw, 320px)",
            background: colors.surface,
            borderLeft: `1.5px solid ${colors.ink}`,
            boxShadow: shadows.modal,
            zIndex: 91,
            display: "flex",
            flexDirection: "column",
            transform: open ? "translateX(0)" : "translateX(100%)",
            transition: `transform ${motion.base} ${motion.ease}`,
            overflowY: "auto",
            visibility: open ? "visible" : "hidden",
          }}
        >
          {/* Header: profile + close */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[3],
              padding: spacing[4],
              borderBottom: `1.5px solid ${colors.ink}`,
              background: colors.panel,
              flexShrink: 0,
            }}
          >
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              style={{ display: "flex", alignItems: "center", gap: spacing[2], textDecoration: "none", flex: 1, minWidth: 0 }}
            >
              <Avatar name={name} photo={avatar_url} size={32} />
              <span
                style={{
                  fontFamily: fonts.body,
                  fontSize: fontSize.meta,
                  fontWeight: fontWeight.medium,
                  color: colors.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              style={{
                color: colors.muted,
                display: "flex",
                padding: 2,
                borderRadius: radii.sm,
                background: "none",
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Nav items — every destination always listed, grouped */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: spacing[3] }}>
            {NAV_GROUPS.map(group => (
              <React.Fragment key={group.label}>
                <GroupLabel>{group.label}</GroupLabel>
                {group.items.map(item => (
                  <MobileNavLink key={item.href} item={item} active={isActivePath(pathname, item.href)} onClick={() => setOpen(false)} />
                ))}
              </React.Fragment>
            ))}
          </div>

          <div style={{ height: 1, background: colors.line, margin: `0 ${spacing[3]}px` }} />

          {/* Catchup requests */}
          {pendingCatchups.length > 0 && (
            <div style={{ padding: spacing[3] }}>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: fontSize.label,
                  color: colors.mutedSoft,
                  letterSpacing: "0.06em",
                  marginBottom: spacing[2],
                }}
              >
                CATCHUP REQUESTS
              </div>
              {pendingCatchups.map((c) => (
                <CatchupRequestRow
                  key={c.id}
                  catchup={c}
                  variant="drawer"
                  onClick={() => {
                    openPanel({ id: c.otherId, name: c.otherName ?? "Builder", avatar: c.otherAvatar }, "catchup")
                    setOpen(false)
                  }}
                />
              ))}
            </div>
          )}

          {/* Cheers on my ships */}
          {activity.length > 0 && (
            <div style={{ padding: spacing[3] }}>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: fontSize.label,
                  color: colors.mutedSoft,
                  letterSpacing: "0.06em",
                  marginBottom: spacing[2],
                }}
              >
                YOUR SHIPS
              </div>
              {activity.map((a) => (
                <ActivityNotificationRow
                  key={`${a.kind}-${a.postId}`}
                  activity={a}
                  variant="drawer"
                  onClick={() => {
                    router.push("/explore")
                    setOpen(false)
                  }}
                />
              ))}
            </div>
          )}

          <div style={{ height: 1, background: colors.line, margin: `0 ${spacing[3]}px` }} />

          {/* Messages */}
          <div style={{ padding: spacing[3], flex: 1 }}>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: fontSize.label,
                color: colors.mutedSoft,
                letterSpacing: "0.06em",
                marginBottom: spacing[2],
              }}
            >
              MESSAGES
            </div>
            {inbox.length === 0 ? (
              <div
                style={{
                  fontFamily: fonts.body,
                  fontSize: fontSize.meta,
                  color: colors.muted,
                  padding: `${spacing[2]}px 0`,
                }}
              >
                No messages yet.
              </div>
            ) : (
              inbox.map((c) => (
                <MessageRow
                  key={c.otherId}
                  conversation={c}
                  variant="drawer"
                  onClick={() => {
                    openPanel({ id: c.otherId, name: c.name ?? "Builder", avatar: c.avatar }, "chat")
                    setOpen(false)
                  }}
                />
              ))
            )}
          </div>
        </aside>
      </div>
    </>
  )
}

function MobileNavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const { label, href, Icon } = item
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[3],
        padding: `${spacing[3]}px ${spacing[2]}px`,
        borderRadius: radii.md,
        textDecoration: "none",
        background: active ? colors.violetSoft : "transparent",
        color: active ? colors.violet : colors.ink,
      }}
    >
      <Icon size={18} strokeWidth={active ? 2.5 : 1.75} />
      <span
        style={{
          fontFamily: fonts.body,
          fontSize: fontSize.body,
          fontWeight: active ? fontWeight.semibold : fontWeight.regular,
        }}
      >
        {label}
      </span>
    </Link>
  )
}

export default MobileMenu
