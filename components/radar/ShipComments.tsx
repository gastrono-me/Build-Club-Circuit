"use client"

import React from "react"
import { MessageSquare, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { subscribeFeed, notifyFeed, BUILD_LOG_TOPIC } from "@/lib/realtime/feedBus"
import { Avatar } from "@/components/shell/Avatar"
import { relTime } from "@/components/shell/NotificationItems"
import { colors, fonts, fontSize, fontWeight, radii, spacing, motion } from "@/lib/design/tokens"

interface CommentRow {
  id: string
  author_id: string
  body: string
  created_at: string
  author_name: string | null
  author_avatar: string | null
}

/**
 * Flat comments on one ship: a collapsed count button that expands into the
 * thread + a composer. Fetches lazily on first expand, and stays live over the
 * shared build-log broadcast topic while open. Used wherever ships render
 * (feed cards, the Spotlight featured card, project timelines).
 */
export function ShipComments({
  postId,
  count,
  currentUserId,
  defaultOpen = false,
}: {
  postId: string
  /** Collapsed badge count, usually from the ship_comment_counts view. */
  count: number
  currentUserId: string | null
  /** Start expanded (e.g. arriving from a comment notification). */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [comments, setComments] = React.useState<CommentRow[] | null>(null)
  const [body, setBody] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchComments = React.useCallback(async () => {
    const { data, error: err } = await createClient()
      .from("ship_comments")
      .select("id, author_id, body, created_at, profiles:author_id ( name, avatar_url )")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
    if (err) {
      console.error("[comments] fetch error:", err)
      return
    }
    setComments(((data ?? []) as any[]).map((c) => ({
      id: c.id,
      author_id: c.author_id,
      body: c.body,
      created_at: c.created_at,
      author_name: c.profiles?.name ?? null,
      author_avatar: c.profiles?.avatar_url ?? null,
    })))
  }, [postId])

  // Lazy-load on first expand; stay live while open (debounce is unnecessary —
  // the fetch is one bounded per-post query).
  React.useEffect(() => {
    if (!open) return
    fetchComments()
    return subscribeFeed(BUILD_LOG_TOPIC, fetchComments)
  }, [open, fetchComments])

  async function removeComment(id: string) {
    // Optimistic: drop it locally, then delete (RLS restricts to own comments).
    setComments((prev) => prev?.filter((c) => c.id !== id) ?? prev)
    const { error: err } = await createClient().from("ship_comments").delete().eq("id", id)
    if (err) {
      console.error("[comments] delete error:", err)
      fetchComments() // restore truth
      return
    }
    notifyFeed(BUILD_LOG_TOPIC)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text || !currentUserId) return
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await createClient()
        .from("ship_comments")
        .insert({ post_id: postId, author_id: currentUserId, body: text })
      if (err) throw err
      setBody("")
      notifyFeed(BUILD_LOG_TOPIC) // refreshes counts everywhere + open threads
      fetchComments()
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  const shown = comments?.length ?? count

  return (
    // display:contents so the toggle can sit inside a card's flex action row
    // while the expanded thread wraps to full width below it.
    <div style={{ display: "contents" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Comments, ${shown}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 999,
          border: `1.5px solid ${open ? colors.violet : colors.line}`,
          background: open ? colors.violetSoft : colors.panel,
          color: open ? colors.violet : colors.muted,
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          fontWeight: fontWeight.medium,
          letterSpacing: "0.04em",
          cursor: "pointer",
          transition: `background ${motion.fast} ${motion.ease}, border-color ${motion.fast} ${motion.ease}`,
        }}
      >
        <MessageSquare size={13} />
        {shown > 0 ? shown : "Comment"}
      </button>

      {open && (
        <div style={{ flex: "1 1 100%", width: "100%", marginTop: spacing[2], borderTop: `1px solid ${colors.lineSoft}`, paddingTop: spacing[3], display: "flex", flexDirection: "column", gap: spacing[3] }}>
          {comments === null ? (
            <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft, letterSpacing: "0.05em" }}>
              Loading…
            </div>
          ) : comments.length === 0 ? (
            <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.mutedSoft }}>
              No comments yet. Ask how they built it.
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: spacing[2], alignItems: "flex-start" }}>
                <Avatar name={c.author_name ?? "Builder"} photo={c.author_avatar} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: spacing[2] }}>
                    <span style={{ fontFamily: fonts.body, fontSize: fontSize.meta, fontWeight: fontWeight.semibold, color: colors.ink }}>
                      {c.author_name ?? "Builder"}
                    </span>
                    <span style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft }}>
                      {relTime(c.created_at)}
                    </span>
                  </div>
                  <p style={{ margin: "2px 0 0", fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.ink, lineHeight: 1.5, overflowWrap: "break-word" }}>
                    {c.body}
                  </p>
                </div>
                {currentUserId === c.author_id && (
                  <button
                    type="button"
                    onClick={() => removeComment(c.id)}
                    aria-label="Delete your comment"
                    title="Delete your comment"
                    style={{ border: "none", background: "transparent", color: colors.mutedSoft, cursor: "pointer", display: "flex", padding: 2, flexShrink: 0 }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))
          )}

          {currentUserId && (
            <form onSubmit={submit} style={{ display: "flex", gap: spacing[2] }}>
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add a comment"
                aria-label="Add a comment"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: `1.4px solid ${colors.line}`,
                  borderRadius: radii.md,
                  padding: "8px 11px",
                  fontFamily: fonts.body,
                  fontSize: fontSize.meta,
                  color: colors.ink,
                  background: colors.paper2,
                  outline: "none",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = colors.violet }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.line }}
              />
              <button
                type="submit"
                disabled={busy || !body.trim()}
                style={{
                  border: "none",
                  borderRadius: radii.md,
                  padding: "8px 14px",
                  background: colors.violet,
                  color: colors.onDark,
                  fontFamily: fonts.mono,
                  fontSize: fontSize.label,
                  fontWeight: fontWeight.semibold,
                  letterSpacing: "0.04em",
                  cursor: busy || !body.trim() ? "not-allowed" : "pointer",
                  opacity: busy || !body.trim() ? 0.5 : 1,
                }}
              >
                {busy ? "…" : "Post"}
              </button>
            </form>
          )}

          {error && (
            <p style={{ margin: 0, fontFamily: fonts.body, fontSize: fontSize.micro, color: colors.live }}>{error}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default ShipComments
