"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { MobileMenu } from "@/components/shell/MobileMenu"
import { Avatar } from "@/components/shell/Avatar"
import { CatchupRequestRow, ActivityNotificationRow, MessageRow } from "@/components/shell/NotificationItems"
import { useProfile } from "@/lib/hooks/useProfile"
import { useSocial } from "@/components/shell/SocialProvider"
import {
  colors,
  fonts,
  fontSize,
  fontWeight,
  spacing,
  radii,
  shadows,
  motion,
} from "@/lib/design/tokens"

export function TopBar() {
  const { profile, loading } = useProfile()
  const name = loading || !profile ? "Profile" : profile.name || "Profile"
  const avatar_url = profile?.avatar_url

  const { inbox, totalUnread, pendingCatchups, openPanel, activity, unreadActivity, markActivityRead } = useSocial()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const notificationCount = totalUnread + pendingCatchups.length + unreadActivity
  const badgeCount = notificationCount > 9 ? "9+" : String(notificationCount)

  // Opening the bell is the "seen" moment for cheers — there's no deeper view
  // to open, so mark them read here (messages mark read when their thread opens).
  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev
      if (next) markActivityRead()
      return next
    })
  }

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 52,
        zIndex: 50,
        background: colors.surface,
        borderBottom: `1px solid ${colors.line}`,
        display: "flex",
        alignItems: "center",
        padding: `0 ${spacing[4]}px`,
        gap: spacing[4],
      }}
    >
      {/* Brand */}
      <Link href="/home" aria-label="Circuit home" style={{ display: "flex", flexDirection: "column", flexShrink: 0, textDecoration: "none" }}>
        <span
          style={{
            fontFamily: fonts.display,
            fontWeight: fontWeight.bold,
            fontSize: fontSize.heading,
            color: colors.ink,
            lineHeight: 1.1,
          }}
        >
          Circuit
        </span>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: fontSize.micro,
            color: colors.mutedSoft,
            letterSpacing: "0.06em",
          }}
        >
          Build Club
        </span>
      </Link>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Mobile: hamburger trigger for the slide-out drawer (nav + controls + messages) */}
      <MobileMenu />

      <style>{`
        .vec-topbar-desktop { display: none; }
        @media (min-width: 768px) {
          .vec-topbar-desktop {
            display: flex;
            align-items: center;
            gap: ${spacing[4]}px;
          }
        }
      `}</style>
      <div className="vec-topbar-desktop">
      {/* Notifications bell */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {/* Click-away backdrop */}
        {open && (
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 98,
            }}
          />
        )}

        {/* Bell button */}
        <button
          onClick={toggleOpen}
          aria-label="Notifications"
          style={{
            position: "relative",
            display: "flex",
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
            transition: `background ${motion.fast} ${motion.ease}`,
            zIndex: 99,
          }}
        >
          <Bell size={16} strokeWidth={1.8} />
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

        {/* Dropdown panel */}
        {open && (
          <div
            style={{
              position: "absolute",
              top: 38,
              right: 0,
              width: 320,
              maxHeight: 360,
              overflowY: "auto",
              background: colors.surface,
              border: `1.5px solid ${colors.ink}`,
              borderRadius: radii.xl,
              boxShadow: shadows.card,
              zIndex: 99,
            }}
          >
            {pendingCatchups.map((c) => (
              <CatchupRequestRow
                key={`catchup-${c.id}`}
                catchup={c}
                variant="dropdown"
                onClick={() => {
                  openPanel({ id: c.otherId, name: c.otherName ?? "Builder", avatar: c.otherAvatar }, "catchup")
                  setOpen(false)
                }}
              />
            ))}

            {activity.map((a) => (
              <ActivityNotificationRow
                key={`${a.kind}-${a.postId}`}
                activity={a}
                variant="dropdown"
                onClick={() => {
                  // The archive holds every ship, however old the reaction target.
                  router.push("/explore")
                  setOpen(false)
                }}
              />
            ))}

            {inbox.length === 0 && pendingCatchups.length === 0 && activity.length === 0 ? (
              <div
                style={{
                  padding: `${spacing[4]}px`,
                  fontFamily: fonts.body,
                  fontSize: fontSize.meta,
                  color: colors.muted,
                  textAlign: "center",
                }}
              >
                No notifications yet.
              </div>
            ) : (
              inbox.map((c) => (
                <MessageRow
                  key={c.otherId}
                  conversation={c}
                  variant="dropdown"
                  onClick={() => {
                    openPanel({ id: c.otherId, name: c.name ?? "Builder", avatar: c.avatar }, "chat")
                    setOpen(false)
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Profile button */}
      <Link
        href="/profile"
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[2],
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        <Avatar name={name} photo={avatar_url} size={32} />
        <span
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.meta,
            fontWeight: fontWeight.medium,
            color: colors.ink,
          }}
        >
          {name}
        </span>
      </Link>
      </div>
    </header>
  )
}

export default TopBar
