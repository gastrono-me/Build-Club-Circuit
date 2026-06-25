"use client"

import React from "react"
import { Card } from "@/components/ui/Card"
import { Tag } from "@/components/ui/Tag"
import { Avatar } from "@/components/shell/Avatar"
import { MessageCircle } from "lucide-react"
import { useSocial } from "@/components/shell/SocialProvider"
import { colors, fonts, fontSize, fontWeight, radii, spacing, motion } from "@/lib/design/tokens"
import type { BuildLogRow } from "@/lib/hooks/useBuildLog"

interface BuildLogCardProps {
  post: BuildLogRow
  cheerCount: number
  isMine: boolean
  isOwn: boolean // current user is the author
  currentUserId: string | null
  onCheer: () => Promise<void>
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

export function BuildLogCard({
  post,
  cheerCount,
  isMine,
  isOwn,
  currentUserId,
  onCheer,
}: BuildLogCardProps) {
  const [voting, setVoting] = React.useState(false)
  const { openPanel } = useSocial()

  const authorName = post.author_name ?? "Builder"

  async function handleCheer() {
    if (!currentUserId) return
    setVoting(true)
    try {
      await onCheer()
    } finally {
      setVoting(false)
    }
  }

  return (
    <Card spine="go" padding={spacing[4]}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: spacing[3] }}>
        <Avatar name={authorName} photo={post.author_avatar} size={32} />
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
            {timeAgo(post.created_at)}
          </div>
        </div>

        {/* Category tag */}
        <Tag tone="go">{post.category}</Tag>
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
        {post.note}
      </p>

      {/* Action row */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
        {/* Cheer button — disabled for own posts */}
        <button
          type="button"
          onClick={handleCheer}
          disabled={voting || !currentUserId || isOwn}
          aria-pressed={isMine}
          aria-label={`Cheer, ${cheerCount}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            border: `1.5px solid ${isMine ? colors.go : colors.line}`,
            background: isMine ? colors.goSoft : colors.panel,
            color: isMine ? colors.go : colors.muted,
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            fontWeight: fontWeight.medium,
            letterSpacing: "0.04em",
            cursor: (voting || !currentUserId || isOwn) ? "not-allowed" : "pointer",
            opacity: (!currentUserId || isOwn) ? 0.45 : 1,
            transition: `background ${motion.fast} ${motion.ease}, color ${motion.fast} ${motion.ease}, border-color ${motion.fast} ${motion.ease}`,
          }}
        >
          <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>👏</span>
          cheer
          {cheerCount > 0 && (
            <span
              style={{
                background: isMine ? colors.go : colors.line,
                color: isMine ? colors.onDark : colors.ink,
                borderRadius: 999,
                padding: "1px 6px",
                fontSize: fontSize.micro,
                fontWeight: fontWeight.bold,
                lineHeight: 1.6,
                transition: `background ${motion.fast} ${motion.ease}, color ${motion.fast} ${motion.ease}`,
              }}
            >
              {cheerCount}
            </span>
          )}
        </button>

        {!isOwn && (
          <button onClick={() => openPanel({ id: post.author_id, name: authorName, avatar: post.author_avatar }, "chat")}
            title={`Message ${authorName}`} aria-label="Message author"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1.4px solid ${colors.line}`, background: colors.surface, color: colors.ink, borderRadius: radii.md, padding: "6px 10px", fontFamily: fonts.mono, fontSize: fontSize.label, cursor: "pointer" }}>
            <MessageCircle size={13} /> Message
          </button>
        )}
      </div>
    </Card>
  )
}

export default BuildLogCard
