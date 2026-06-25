"use client"

import React, { useState } from "react"
import { BLOCKER_TAGS } from "@/types/index"
import { Button } from "@/components/ui/Button"
import { colors, fonts, fontSize, fontWeight, radii, spacing, shadows, motion } from "@/lib/design/tokens"

interface PostBlockerProps {
  onPost: (category: string, note: string) => Promise<void>
}

export function PostBlocker({ onPost }: PostBlockerProps) {
  const [category, setCategory] = useState<string>(BLOCKER_TAGS[0])
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onPost(category, note.trim())
      setNote("")
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: colors.panel,
        border: `1px solid ${colors.line}`,
        borderRadius: radii.xl,
        padding: spacing[4],
        boxShadow: shadows.card,
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
      }}
    >
      {/* Kicker */}
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          fontWeight: fontWeight.medium,
          color: colors.live,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: colors.live,
            display: "inline-block",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        Post a blocker
      </div>

      {/* Category select */}
      <div>
        <label
          style={{
            display: "block",
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            color: colors.muted,
            marginBottom: spacing[2],
          }}
        >
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontFamily: fonts.body,
            fontSize: fontSize.body,
            color: colors.ink,
            background: colors.panel,
            border: `1px solid ${colors.line}`,
            borderRadius: radii.md,
            outline: "none",
            cursor: "pointer",
            appearance: "none" as const,
            transition: `border-color ${motion.fast} ${motion.ease}`,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = colors.violet }}
          onBlur={(e) => { e.currentTarget.style.borderColor = colors.line }}
        >
          {BLOCKER_TAGS.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>

      {/* Note textarea */}
      <div>
        <label
          style={{
            display: "block",
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            color: colors.muted,
            marginBottom: spacing[2],
          }}
        >
          What&rsquo;s blocking you?
        </label>
        <div
          style={{
            border: `1px solid ${colors.line}`,
            borderRadius: radii.md,
            transition: `border-color ${motion.fast} ${motion.ease}, box-shadow ${motion.fast} ${motion.ease}`,
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = colors.violet
            e.currentTarget.style.boxShadow = shadows.focus
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = colors.line
            e.currentTarget.style.boxShadow = "none"
          }}
        >
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Brief description: what are you stuck on?"
            rows={3}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              color: colors.ink,
              fontFamily: fonts.body,
              fontSize: fontSize.body,
              padding: "11px 13px",
              borderRadius: radii.md,
              resize: "vertical" as const,
              boxSizing: "border-box" as const,
            }}
          />
        </div>
      </div>

      {error && (
        <p style={{ margin: 0, fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.live }}>
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="accent"
        disabled={submitting || !note.trim()}
        full
      >
        {submitting ? "Posting…" : "Post blocker"}
      </Button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </form>
  )
}

export default PostBlocker
