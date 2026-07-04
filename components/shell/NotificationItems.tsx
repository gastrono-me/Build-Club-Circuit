"use client"

import React from "react"
import { CalendarDays } from "lucide-react"
import { Avatar } from "@/components/shell/Avatar"
import type { CatchupAgendaRow } from "@/lib/hooks/useCatchups"
import type { InboxConversation } from "@/components/shell/SocialProvider"
import { catchupWhen } from "@/lib/time"
import { colors, fonts, fontSize, fontWeight, spacing, radii } from "@/lib/design/tokens"

/** <60s "now", <60m "Nm", <24h "Nh", else "Nd" */
export function relTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diffMs / 1000)
  if (s < 60) return "now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

export type NotificationVariant = "dropdown" | "drawer"

/** A pending catchup request row, shared between TopBar's bell dropdown and MobileMenu's drawer. */
export function CatchupRequestRow({
  catchup,
  variant,
  onClick,
}: {
  catchup: CatchupAgendaRow
  variant: NotificationVariant
  onClick: () => void
}) {
  const dropdown = variant === "dropdown"
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[2],
        width: "100%",
        padding: dropdown ? `${spacing[3]}px ${spacing[3]}px` : `${spacing[2]}px ${spacing[2]}px`,
        background: colors.violetSoft,
        border: "none",
        borderRadius: dropdown ? 0 : radii.md,
        borderBottom: dropdown ? `1px solid ${colors.line}` : "none",
        marginBottom: dropdown ? 0 : spacing[1],
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ flexShrink: 0, color: colors.violet }}>
        <CalendarDays size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: fonts.body,
            fontSize: fontSize.meta,
            fontWeight: fontWeight.medium,
            color: colors.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {catchup.otherName ?? "Builder"} wants to catch up
        </span>
        <span style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.violet }}>
          {catchupWhen(catchup.starts_at, catchup.ends_at, new Date())}
        </span>
      </div>
    </button>
  )
}

/** An inbox conversation row, shared between TopBar's bell dropdown and MobileMenu's drawer. */
export function MessageRow({
  conversation,
  variant,
  onClick,
}: {
  conversation: InboxConversation
  variant: NotificationVariant
  onClick: () => void
}) {
  const dropdown = variant === "dropdown"
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[2],
        width: "100%",
        padding: dropdown ? `${spacing[3]}px ${spacing[3]}px` : `${spacing[2]}px 0`,
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${colors.line}`,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <Avatar name={conversation.name ?? "Builder"} photo={conversation.avatar} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing[1] }}>
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
            {conversation.name ?? "Builder"}
          </span>
          <span style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft, flexShrink: 0 }}>
            {relTime(conversation.lastAt)}
          </span>
        </div>
        <span
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.micro,
            color: colors.muted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {conversation.lastBody}
        </span>
      </div>
      {conversation.unread > 0 && (
        <div style={{ width: 8, height: 8, borderRadius: radii.pill, background: colors.violet, flexShrink: 0 }} />
      )}
    </button>
  )
}
