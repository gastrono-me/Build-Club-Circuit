"use client"

import React from "react"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Tag } from "@/components/ui/Tag"
import { Avatar } from "@/components/shell/Avatar"
import { MessageCircle, Check, RotateCcw, Trash2 } from "lucide-react"
import { useSocial, type ChatPerson } from "@/components/shell/SocialProvider"
import { PersonButton } from "@/components/shell/PersonButton"
import { colors, fonts, fontSize, fontWeight, radii, spacing, motion } from "@/lib/design/tokens"
import type { BlockerRow } from "@/lib/hooks/useRadar"

/** Wrap the header in a profile-opening button, unless the post is anonymous. */
function MaybePerson({ enabled, person, children }: { enabled: boolean; person: ChatPerson; children: React.ReactNode }) {
  if (!enabled) return <div style={{ display: "flex", alignItems: "center", gap: spacing[2], flex: 1, minWidth: 0 }}>{children}</div>
  return <PersonButton person={person} style={{ gap: spacing[2], flex: 1, minWidth: 0 }}>{children}</PersonButton>
}

interface BlockerCardProps {
  blocker: BlockerRow
  metooCount: number
  isMine: boolean
  isOwn: boolean         // current user is the author
  currentUserId: string | null
  onMeToo: () => Promise<void>
  /** Author-only: mark resolved / reopen. */
  onResolve?: (resolved: boolean) => Promise<void>
  /** Author-only: delete the blocker. */
  onDelete?: () => Promise<void>
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function BlockerCard({
  blocker,
  metooCount,
  isMine,
  isOwn,
  currentUserId,
  onMeToo,
  onResolve,
  onDelete,
}: BlockerCardProps) {
  const [voting, setVoting] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const { openPanel } = useSocial()

  const authorName = blocker.author_id == null
    ? "Community"
    : (blocker.author_name ?? "Builder")

  const isAnonymous = blocker.author_id == null
  const isResolved = !!blocker.resolved_at

  async function handleMeToo() {
    if (!currentUserId) return
    setVoting(true)
    try {
      await onMeToo()
    } finally {
      setVoting(false)
    }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      console.error("[blocker] action failed:", err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card spine={isResolved ? "go" : "live"} padding={spacing[4]} style={isResolved ? { opacity: 0.72 } : undefined}>
      {/* Header row — clickable to the author's profile, unless anonymous */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: spacing[3] }}>
        <MaybePerson
          enabled={!isAnonymous && !!blocker.author_id}
          person={{ id: blocker.author_id ?? "", name: authorName, avatar: blocker.author_avatar }}
        >
        <Avatar
          name={authorName}
          photo={isAnonymous ? undefined : blocker.author_avatar}
          size={32}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: fonts.body,
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.body,
              color: colors.ink,
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {authorName}
            {isOwn && (
              <span
                style={{
                  marginLeft: spacing[2],
                  fontFamily: fonts.mono,
                  fontSize: fontSize.micro,
                  color: colors.muted,
                  fontWeight: fontWeight.regular,
                  letterSpacing: "0.06em",
                }}
              >
                (you)
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.micro,
              color: colors.mutedSoft,
              marginTop: 2,
            }}
          >
            {timeAgo(blocker.created_at)}
          </div>
        </div>
        </MaybePerson>

        {/* Resolved badge + category tag */}
        {isResolved && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: radii.pill,
              background: colors.goSoft,
              color: colors.go,
              fontFamily: fonts.mono,
              fontSize: fontSize.micro,
              fontWeight: fontWeight.semibold,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            <Check size={11} /> Resolved
          </span>
        )}
        <Tag tone="live">{blocker.category}</Tag>
      </div>

      {/* Note body */}
      <p
        style={{
          margin: `0 0 ${spacing[3]}px`,
          fontFamily: fonts.body,
          fontSize: fontSize.body,
          color: colors.ink,
          lineHeight: 1.55,
        }}
      >
        {blocker.note}
      </p>

      {/* Action row */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
        {/* Me too button — disabled for own posts */}
        <button
          type="button"
          onClick={handleMeToo}
          disabled={voting || !currentUserId || isOwn}
          aria-pressed={isMine}
          aria-label={`Me too, ${metooCount}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            border: `1.5px solid ${isMine ? colors.live : colors.line}`,
            background: isMine ? colors.liveSoft : colors.panel,
            color: isMine ? colors.live : colors.muted,
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            fontWeight: fontWeight.medium,
            letterSpacing: "0.04em",
            cursor: (voting || !currentUserId || isOwn) ? "not-allowed" : "pointer",
            opacity: (!currentUserId || isOwn) ? 0.45 : 1,
            transition: `background ${motion.fast} ${motion.ease}, color ${motion.fast} ${motion.ease}, border-color ${motion.fast} ${motion.ease}`,
          }}
        >
          {/* Hand emoji as lightweight icon */}
          <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>✋</span>
          Me too
          {metooCount > 0 && (
            <span
              style={{
                background: isMine ? colors.live : colors.line,
                color: isMine ? colors.onDark : colors.ink,
                borderRadius: 999,
                padding: "1px 6px",
                fontSize: fontSize.micro,
                fontWeight: fontWeight.bold,
                lineHeight: 1.6,
                transition: `background ${motion.fast} ${motion.ease}, color ${motion.fast} ${motion.ease}`,
              }}
            >
              {metooCount}
            </span>
          )}
        </button>

        {blocker.author_id && !isOwn && (
          <button onClick={() => openPanel({ id: blocker.author_id!, name: blocker.author_name ?? "Builder", avatar: blocker.author_avatar }, "chat")}
            title={`Message ${blocker.author_name ?? "builder"}`} aria-label="Message author"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1.4px solid ${colors.line}`, background: colors.surface, color: colors.ink, borderRadius: radii.md, padding: "6px 10px", fontFamily: fonts.mono, fontSize: fontSize.label, cursor: "pointer" }}>
            <MessageCircle size={13} /> Message
          </button>
        )}

        {/* Author controls: resolve / reopen + delete */}
        {isOwn && onResolve && (
          <button
            type="button"
            onClick={() => run(() => onResolve(!isResolved))}
            disabled={busy}
            title={isResolved ? "Move back to still stuck" : "Mark this blocker solved"}
            style={ownerBtnStyle(isResolved ? colors.line : colors.go, isResolved ? colors.muted : colors.go, busy)}
          >
            {isResolved ? <><RotateCcw size={13} /> Reopen</> : <><Check size={13} /> Resolve</>}
          </button>
        )}

        {isOwn && onDelete && (
          confirmDelete ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => run(onDelete)}
                disabled={busy}
                style={ownerBtnStyle(colors.live, colors.live, busy)}
              >
                <Trash2 size={13} /> {busy ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                style={{ border: "none", background: "transparent", color: colors.muted, fontFamily: fonts.mono, fontSize: fontSize.label, cursor: "pointer" }}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              title="Delete this blocker"
              aria-label="Delete blocker"
              style={{ display: "inline-flex", alignItems: "center", border: `1.4px solid ${colors.line}`, background: colors.surface, color: colors.muted, borderRadius: radii.md, padding: "6px 9px", cursor: "pointer" }}
            >
              <Trash2 size={13} />
            </button>
          )
        )}
      </div>
    </Card>
  )
}

/** Shared style for the small author-only action buttons. */
function ownerBtnStyle(border: string, fg: string, busy: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    border: `1.4px solid ${border}`,
    background: colors.surface,
    color: fg,
    borderRadius: radii.md,
    padding: "6px 10px",
    fontFamily: fonts.mono,
    fontSize: fontSize.label,
    cursor: busy ? "wait" : "pointer",
    opacity: busy ? 0.6 : 1,
  }
}

export default BlockerCard
