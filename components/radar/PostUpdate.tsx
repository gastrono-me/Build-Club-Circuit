"use client"

import React, { useState } from "react"
import { BLOCKER_TAGS } from "@/types/index"
import { Button } from "@/components/ui/Button"
import { useProjects } from "@/lib/hooks/useProjects"
import { colors, fonts, fontSize, fontWeight, radii, spacing, shadows, motion } from "@/lib/design/tokens"

/** Sentinel option values for the project select. */
const NO_PROJECT = ""
const NEW_PROJECT = "__new__"

interface PostUpdateProps {
  onPost: (category: string, note: string, projectId?: string | null) => Promise<void>
}

export function PostUpdate({ onPost }: PostUpdateProps) {
  const [category, setCategory] = useState<string>(BLOCKER_TAGS[0])
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Optional project tag: pick one of your projects, or create one inline.
  const { mine, create } = useProjects()
  const [projectChoice, setProjectChoice] = useState<string>(NO_PROJECT)
  const [newProjectName, setNewProjectName] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    if (projectChoice === NEW_PROJECT && !newProjectName.trim()) {
      setError("Give the new project a name, or switch back to no project.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      let projectId: string | null = projectChoice || null
      if (projectChoice === NEW_PROJECT) {
        const created = await create(newProjectName)
        projectId = created.id
        setProjectChoice(created.id)
        setNewProjectName("")
      }
      await onPost(category, note.trim(), projectId)
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
          color: colors.go,
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
            background: colors.go,
            display: "inline-block",
          }}
        />
        Post an update
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

      {/* Project tag (optional) */}
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
          Project <span style={{ color: colors.mutedSoft, textTransform: "none" }}>(optional)</span>
        </label>
        <select
          value={projectChoice}
          onChange={(e) => setProjectChoice(e.target.value)}
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
          <option value={NO_PROJECT}>No project</option>
          {mine.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          <option value={NEW_PROJECT}>+ New project…</option>
        </select>
        {projectChoice === NEW_PROJECT && (
          <input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name"
            autoFocus
            style={{
              width: "100%",
              marginTop: spacing[2],
              padding: "10px 12px",
              fontFamily: fonts.body,
              fontSize: fontSize.body,
              color: colors.ink,
              background: colors.panel,
              border: `1px solid ${colors.violet}`,
              borderRadius: radii.md,
              outline: "none",
              boxSizing: "border-box" as const,
            }}
          />
        )}
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
          What did you ship?
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
            placeholder="Brief description: what did you just get working?"
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
        {submitting ? "Posting…" : "Post update"}
      </Button>
    </form>
  )
}

export default PostUpdate
