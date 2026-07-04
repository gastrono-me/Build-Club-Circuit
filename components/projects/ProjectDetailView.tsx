"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, FolderGit2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { subscribeFeed, BUILD_LOG_TOPIC } from "@/lib/realtime/feedBus"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Tag } from "@/components/ui/Tag"
import { Avatar } from "@/components/shell/Avatar"
import { Button } from "@/components/ui/Button"
import { shipDate, shipDayHeading, shipClock, localDayKey } from "@/lib/time"
import { colors, fonts, fontSize, fontWeight, radii, spacing, shadows } from "@/lib/design/tokens"

const PAGE = 50

interface ProjectMeta {
  id: string
  owner_id: string
  name: string
  tagline: string | null
  created_at: string
  owner_name: string | null
  owner_avatar: string | null
}

interface ShipRow {
  id: string
  author_id: string
  category: string
  note: string
  created_at: string
  author_name: string | null
  author_avatar: string | null
}

/**
 * One project's page: its ships as a date-grouped timeline, newest day first.
 * This is the progress log the project exists for.
 */
export function ProjectDetailView({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [now] = useState(() => new Date())
  const [project, setProject] = useState<ProjectMeta | null>(null)
  const [ships, setShips] = useState<ShipRow[]>([])
  const [limit, setLimit] = useState(PAGE)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    const [projRes, shipRes] = await Promise.all([
      supabase
        .from("projects")
        .select("id, owner_id, name, tagline, created_at, profiles:owner_id ( name, avatar_url )")
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("build_log")
        .select("id, author_id, category, note, created_at, profiles:author_id ( name, avatar_url )")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ])

    if (projRes.error) console.error("[project] fetch error:", projRes.error)
    if (shipRes.error) console.error("[project] ships fetch error:", shipRes.error)

    const p: any = projRes.data
    if (!p) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setProject({
      id: p.id,
      owner_id: p.owner_id,
      name: p.name,
      tagline: p.tagline ?? null,
      created_at: p.created_at,
      owner_name: p.profiles?.name ?? null,
      owner_avatar: p.profiles?.avatar_url ?? null,
    })
    const rows: ShipRow[] = ((shipRes.data ?? []) as any[]).map((s) => ({
      id: s.id,
      author_id: s.author_id,
      category: s.category,
      note: s.note,
      created_at: s.created_at,
      author_name: s.profiles?.name ?? null,
      author_avatar: s.profiles?.avatar_url ?? null,
    }))
    setShips(rows)
    setHasMore(rows.length >= limit)
    setLoading(false)
  }, [projectId, limit])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // New ships land live (same broadcast topic the feeds use).
  useEffect(() => {
    return subscribeFeed(BUILD_LOG_TOPIC, fetchAll)
  }, [fetchAll])

  // Newest-first day groups, ships newest-first within each.
  const days = useMemo(() => {
    const map = new Map<string, ShipRow[]>()
    for (const s of ships) {
      const key = localDayKey(s.created_at)
      const list = map.get(key)
      if (list) list.push(s)
      else map.set(key, [s])
    }
    return [...map.entries()]
  }, [ships])

  async function handleDelete() {
    if (!project) return
    if (!window.confirm(`Delete "${project.name}"? Its ships stay in the log, they just lose the project tag.`)) return
    setDeleting(true)
    try {
      const { error } = await createClient().from("projects").delete().eq("id", project.id)
      if (error) throw error
      router.push("/projects")
    } catch (err) {
      console.error("[project] delete failed:", err)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.mutedSoft, letterSpacing: "0.06em", textAlign: "center", padding: `${spacing[8]}px 0` }}>
        Loading…
      </div>
    )
  }

  if (notFound || !project) {
    return (
      <div style={{ padding: `${spacing[5]}px ${spacing[4]}px`, maxWidth: 680, margin: "0 auto" }}>
        <SectionTitle kicker="Projects" title="Not found" note="This project doesn't exist or has been removed." />
        <Link href="/projects" style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.violet }}>
          ← Back to projects
        </Link>
      </div>
    )
  }

  const isOwner = !!userId && project.owner_id === userId

  return (
    <div style={{ padding: `${spacing[5]}px ${spacing[4]}px`, maxWidth: 680, margin: "0 auto" }}>
      <Link
        href="/projects"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          color: colors.muted,
          letterSpacing: "0.05em",
          marginBottom: spacing[4],
        }}
      >
        <ArrowLeft size={13} /> Projects
      </Link>

      {/* Header */}
      <header style={{ marginBottom: spacing[6] }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing[3] }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
              <FolderGit2 size={20} color={colors.violet} />
              <h1
                style={{
                  fontFamily: fonts.display,
                  fontWeight: fontWeight.semibold,
                  fontSize: "clamp(28px, 6vw, 40px)",
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  margin: 0,
                  color: colors.ink,
                }}
              >
                {project.name}
              </h1>
            </div>
            {project.tagline && (
              <p style={{ margin: `${spacing[2]}px 0 0`, fontFamily: fonts.body, fontSize: fontSize.body, color: colors.muted }}>
                {project.tagline}
              </p>
            )}
          </div>
          {isOwner && (
            <Button variant="danger" size="sm" icon={<Trash2 size={13} />} disabled={deleting} onClick={handleDelete}>
              {deleting ? "…" : "Delete"}
            </Button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[3],
            flexWrap: "wrap",
            marginTop: spacing[3],
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            color: colors.muted,
            letterSpacing: "0.04em",
          }}
        >
          {project.owner_name && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Avatar name={project.owner_name} photo={project.owner_avatar} size={20} />
              {project.owner_name}
            </span>
          )}
          <span>started {shipDate(project.created_at, now)}</span>
          <span style={{ color: colors.go }}>{ships.length}{hasMore ? "+" : ""} ship{ships.length === 1 ? "" : "s"}</span>
        </div>
      </header>

      {/* Timeline */}
      {ships.length === 0 ? (
        <div style={{ fontFamily: fonts.body, fontSize: fontSize.body, color: colors.muted, textAlign: "center", padding: `${spacing[8]}px 0` }}>
          No ships yet. Tag a ship with this project from Today and it lands here.
        </div>
      ) : (
        <section aria-label="Ship timeline" style={{ position: "relative" }}>
          {days.map(([key, dayShips]) => (
            <div key={key} style={{ marginBottom: spacing[5] }}>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: fontSize.label,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: colors.violet,
                  marginBottom: spacing[3],
                }}
              >
                {shipDayHeading(dayShips[0].created_at, now)}
              </div>
              <div style={{ borderLeft: `2px solid ${colors.line}`, marginLeft: 5, paddingLeft: spacing[4], display: "flex", flexDirection: "column", gap: spacing[3] }}>
                {dayShips.map((s) => (
                  <article
                    key={s.id}
                    style={{
                      position: "relative",
                      background: colors.panel,
                      border: `1px solid ${colors.line}`,
                      borderRadius: radii.lg,
                      boxShadow: shadows.card,
                      padding: spacing[4],
                    }}
                  >
                    {/* timeline dot */}
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: -(spacing[4] + 6),
                        top: 22,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: colors.violet,
                        border: `2px solid ${colors.surface}`,
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: spacing[2] }}>
                      <span style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.muted }}>
                        {shipClock(s.created_at)}
                      </span>
                      <Tag tone="go">{s.category}</Tag>
                      {s.author_name && (
                        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted }}>
                          <Avatar name={s.author_name} photo={s.author_avatar} size={18} />
                          {s.author_name}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontFamily: fonts.body, fontSize: fontSize.body, color: colors.ink, lineHeight: 1.55 }}>
                      {s.note}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: spacing[4] }}>
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                style={{
                  fontFamily: fonts.mono,
                  fontSize: fontSize.label,
                  fontWeight: fontWeight.semibold,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: colors.ink,
                  background: "transparent",
                  border: `1.5px solid ${colors.ink}`,
                  borderRadius: radii.md,
                  padding: `${spacing[2]}px ${spacing[4]}px`,
                  cursor: "pointer",
                }}
              >
                Load more
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default ProjectDetailView
