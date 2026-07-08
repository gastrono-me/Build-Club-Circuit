"use client"

import React from "react"
import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { Tag } from "@/components/ui/Tag"
import { Avatar } from "@/components/shell/Avatar"
import { FolderGit2, MessageCircle, Star, Pencil, Trash2 } from "lucide-react"
import { useSocial } from "@/components/shell/SocialProvider"
import { PersonButton } from "@/components/shell/PersonButton"
import { ShipAttachments } from "@/components/radar/ShipAttachments"
import { ShipComments } from "@/components/radar/ShipComments"
import { ShipKindBadge } from "@/components/radar/ShipKindBadge"
import { WORK_CATEGORIES } from "@/lib/data/work-categories"
import { SHIP_KINDS } from "@/lib/data/ship-kinds"
import { useNow } from "@/lib/hooks/useNow"
import { shipTime } from "@/lib/time"
import { colors, fonts, fontSize, fontWeight, radii, spacing, motion } from "@/lib/design/tokens"
import type { BuildLogRow } from "@/lib/hooks/useBuildLog"

/** The subset of a ship a builder can edit in place. */
export interface ShipEdit {
  category: string
  note: string
  kind: string
}

interface BuildLogCardProps {
  post: BuildLogRow
  cheerCount: number
  commentCount?: number
  isMine: boolean
  isOwn: boolean // current user is the author
  currentUserId: string | null
  onCheer: () => Promise<void>
  /** Spotlight self-nomination state for the viewer's own post. */
  isNominated?: boolean
  onToggleNominate?: () => void
  /** Emphasize this card (deep-linked from a notification). */
  highlight?: boolean
  /** Start with the comment thread expanded (comment notifications). */
  defaultOpenComments?: boolean
  /** Author-only: save edits to the ship's category/note/type. */
  onEdit?: (patch: ShipEdit) => Promise<void>
  /** Author-only: delete the ship. */
  onDelete?: () => Promise<void>
}

/** Full local timestamp for the title tooltip, e.g. "Jul 2, 2026, 2:05 PM". */
function fullStamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  })
}

export function BuildLogCard({
  post,
  cheerCount,
  commentCount = 0,
  isMine,
  isOwn,
  currentUserId,
  onCheer,
  isNominated = false,
  onToggleNominate,
  highlight = false,
  defaultOpenComments = false,
  onEdit,
  onDelete,
}: BuildLogCardProps) {
  const [voting, setVoting] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [draft, setDraft] = React.useState<ShipEdit>({ category: post.category, note: post.note, kind: post.kind })
  const { openPanel } = useSocial()

  function startEdit() {
    setDraft({ category: post.category, note: post.note, kind: post.kind })
    setEditing(true)
  }

  async function saveEdit() {
    if (!onEdit || !draft.note.trim()) return
    setBusy(true)
    try {
      await onEdit({ category: draft.category, note: draft.note.trim(), kind: draft.kind })
      setEditing(false)
    } catch (err) {
      console.error("[ship] edit failed:", err)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setBusy(true)
    try {
      await onDelete()
    } catch (err) {
      console.error("[ship] delete failed:", err)
      setBusy(false)
    }
  }
  // Ticks every minute so "2m ago" doesn't freeze. Cards render client-fetched
  // data only, so the pre-mount fallback never reaches the screen.
  const now = useNow() ?? new Date()

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
    <Card
      spine="go"
      padding={spacing[4]}
      style={highlight ? { boxShadow: `0 0 0 2px ${colors.violet}, 0 0 0 6px ${colors.violetSoft}` } : undefined}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: spacing[3] }}>
        <PersonButton person={{ id: post.author_id, name: authorName, avatar: post.author_avatar }} style={{ gap: spacing[2], flex: 1, minWidth: 0 }}>
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
            title={fullStamp(post.created_at)}
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.micro,
              color: colors.mutedSoft,
              marginTop: 2,
            }}
          >
            {shipTime(post.created_at, now)}
          </div>
        </div>
        </PersonButton>

        {/* Type badge (Feature/Milestone) + category tag */}
        <ShipKindBadge kind={post.kind} />
        <Tag tone="go">{post.category}</Tag>
      </div>

      {/* Project chip — the arc this ship belongs to */}
      {post.project_id && post.project_name && (
        <Link
          href={`/projects/${post.project_id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginBottom: spacing[3],
            padding: "3px 9px",
            borderRadius: radii.pill,
            background: colors.violetSoft,
            color: colors.violet,
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: "0.03em",
            textDecoration: "none",
          }}
        >
          <FolderGit2 size={12} /> {post.project_name}
        </Link>
      )}

      {/* Note body — or the inline editor when the owner is editing */}
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[2], marginBottom: spacing[3] }}>
          <textarea
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            rows={3}
            aria-label="Edit ship note"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: `1.4px solid ${colors.line}`,
              borderRadius: radii.md,
              padding: "10px 12px",
              fontFamily: fonts.body,
              fontSize: fontSize.body,
              color: colors.ink,
              background: colors.surface,
              outline: "none",
              resize: "vertical",
              lineHeight: 1.55,
            }}
          />
          <div style={{ display: "flex", gap: spacing[2], flexWrap: "wrap" }}>
            <select
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              aria-label="Category"
              style={editSelectStyle}
            >
              {WORK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={draft.kind}
              onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}
              aria-label="Type"
              style={editSelectStyle}
            >
              {SHIP_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: spacing[2] }}>
            <button
              type="button"
              onClick={saveEdit}
              disabled={busy || !draft.note.trim()}
              style={{ ...ownerBtnStyle(colors.go, colors.go, busy), opacity: (busy || !draft.note.trim()) ? 0.55 : 1 }}
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              style={{ border: "none", background: "transparent", color: colors.muted, fontFamily: fonts.mono, fontSize: fontSize.label, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
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
      )}

      {/* Attachments (image / file / link) */}
      {!editing && <ShipAttachments post={post} />}

      {/* Action row (wraps so an expanded comment thread takes the full width) */}
      {!editing && (
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2], flexWrap: "wrap" }}>
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
          Cheer
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

        {isOwn && onToggleNominate && (
          <button
            type="button"
            onClick={onToggleNominate}
            aria-pressed={isNominated}
            title="Build Club may feature standout ships, with your permission"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              border: `1.4px solid ${isNominated ? colors.violet : colors.line}`,
              background: isNominated ? colors.violetSoft : colors.surface,
              color: isNominated ? colors.violet : colors.muted,
              borderRadius: radii.md,
              padding: "6px 10px",
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              cursor: "pointer",
            }}
          >
            <Star size={13} /> {isNominated ? "Submitted for spotlight" : "Submit for a spotlight"}
          </button>
        )}

        {/* Author controls: edit + delete */}
        {isOwn && onEdit && (
          <button
            type="button"
            onClick={startEdit}
            title="Edit this ship"
            aria-label="Edit ship"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1.4px solid ${colors.line}`, background: colors.surface, color: colors.muted, borderRadius: radii.md, padding: "6px 10px", fontFamily: fonts.mono, fontSize: fontSize.label, cursor: "pointer" }}
          >
            <Pencil size={13} /> Edit
          </button>
        )}

        {onDelete && (
          confirmDelete ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                style={ownerBtnStyle(colors.live, colors.live, busy)}
              >
                <Trash2 size={13} /> {busy ? "Removing…" : isOwn ? "Confirm delete" : "Remove ship"}
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
              title={isOwn ? "Delete this ship" : "Remove this ship (admin)"}
              aria-label={isOwn ? "Delete ship" : "Remove ship (admin)"}
              style={{ display: "inline-flex", alignItems: "center", gap: isOwn ? 0 : 5, border: `1.4px solid ${isOwn ? colors.line : colors.live}`, background: colors.surface, color: isOwn ? colors.muted : colors.live, borderRadius: radii.md, padding: "6px 9px", fontFamily: fonts.mono, fontSize: fontSize.label, cursor: "pointer" }}
            >
              <Trash2 size={13} />{!isOwn && " Remove"}
            </button>
          )
        )}

        {/* Last in the row: its expanded thread wraps to the full width below */}
        <ShipComments postId={post.id} count={commentCount} currentUserId={currentUserId} defaultOpen={defaultOpenComments} />
      </div>
      )}
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

const editSelectStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontFamily: fonts.body,
  fontSize: fontSize.meta,
  color: colors.ink,
  background: colors.surface,
  border: `1.4px solid ${colors.line}`,
  borderRadius: radii.md,
  outline: "none",
  cursor: "pointer",
}

export default BuildLogCard
