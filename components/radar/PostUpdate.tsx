"use client"

import React, { useRef, useState } from "react"
import { Paperclip, Link2, Plus, X } from "lucide-react"
import { WORK_CATEGORIES } from "@/types/index"
import { Button } from "@/components/ui/Button"
import { useProjects } from "@/lib/hooks/useProjects"
import { uploadShipMedia, normalizeLink, type ShipMedia } from "@/lib/storage/shipMedia"
import type { ShipAttachment } from "@/lib/hooks/useBuildLog"
import { colors, fonts, fontSize, fontWeight, radii, spacing, shadows, motion } from "@/lib/design/tokens"

/** Sentinel option values for the project select. */
const NO_PROJECT = ""
const NEW_PROJECT = "__new__"

interface PostUpdateProps {
  onPost: (category: string, note: string, projectId?: string | null, attach?: ShipAttachment) => Promise<void>
}

export function PostUpdate({ onPost }: PostUpdateProps) {
  // The daily ritual is note-first: one box, one button. Category, project,
  // link, and file live behind a single "Add details" reveal so logging a ship
  // costs one decision, not six. An untouched category files as "Other".
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [category, setCategory] = useState<string>("Other")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Optional project tag: pick one of your projects, or create one inline.
  const { mine, create } = useProjects()
  const [projectChoice, setProjectChoice] = useState<string>(NO_PROJECT)
  const [newProjectName, setNewProjectName] = useState("")

  // Optional attachments: a pasted link and/or one uploaded file.
  const [linkUrl, setLinkUrl] = useState("")
  const [media, setMedia] = useState<ShipMedia | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file later
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      setMedia(await uploadShipMedia(file))
    } catch (err: any) {
      setError(err?.message ?? "Upload failed")
    } finally {
      setUploading(false)
    }
  }

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
      await onPost(category, note.trim(), projectId, {
        linkUrl: normalizeLink(linkUrl),
        mediaUrl: media?.url ?? null,
        mediaType: media?.type ?? null,
        mediaName: media?.name ?? null,
      })
      setNote("")
      setLinkUrl("")
      setMedia(null)
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const isImage = media?.type.startsWith("image/") ?? false

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

      {/* Note first — the ritual is one box */}
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

      {/* Everything optional stays behind one reveal */}
      {!detailsOpen && (
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            border: "none",
            background: "transparent",
            color: colors.muted,
            padding: 0,
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: "0.03em",
            cursor: "pointer",
          }}
        >
          <Plus size={13} /> Add details (category, project, link, photo)
        </button>
      )}

      {detailsOpen && (
        <>
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
          {WORK_CATEGORIES.map((tag) => (
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

      {/* Optional attachments: a link + one file */}
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
            border: `1px solid ${colors.line}`,
            borderRadius: radii.md,
            padding: "0 10px",
          }}
        >
          <Link2 size={15} color={colors.mutedSoft} style={{ flexShrink: 0 }} />
          <input
            type="url"
            inputMode="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Add a link (demo, repo, tweet)…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              color: colors.ink,
              fontFamily: fonts.body,
              fontSize: fontSize.body,
              padding: "10px 0",
            }}
          />
        </div>

        <input ref={fileRef} type="file" onChange={handleFile} style={{ display: "none" }} />

        {media ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[2],
              border: `1px solid ${colors.line}`,
              borderRadius: radii.md,
              padding: spacing[2],
            }}
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.url} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: radii.sm, flexShrink: 0 }} />
            ) : (
              <Paperclip size={16} color={colors.violet} style={{ flexShrink: 0 }} />
            )}
            <span style={{ flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {media.name}
            </span>
            <button
              type="button"
              onClick={() => setMedia(null)}
              aria-label="Remove attachment"
              style={{ border: "none", background: "transparent", color: colors.muted, cursor: "pointer", display: "flex", flexShrink: 0 }}
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              alignSelf: "flex-start",
              border: `1.4px solid ${colors.line}`,
              background: colors.surface,
              color: colors.muted,
              borderRadius: radii.md,
              padding: "6px 11px",
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              cursor: uploading ? "wait" : "pointer",
            }}
          >
            <Paperclip size={13} /> {uploading ? "Uploading…" : "Add a photo or file"}
          </button>
        )}
      </div>
        </>
      )}

      {error && (
        <p style={{ margin: 0, fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.live }}>
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="accent"
        disabled={submitting || uploading || !note.trim()}
        full
      >
        {submitting ? "Posting…" : "Post update"}
      </Button>
    </form>
  )
}

export default PostUpdate
