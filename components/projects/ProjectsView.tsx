"use client"

import React, { useState } from "react"
import Link from "next/link"
import { ExternalLink, FolderGit2, Plus } from "lucide-react"
import { useProjects, type ProjectRow } from "@/lib/hooks/useProjects"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/shell/Avatar"
import { ProjectLabelPicker, ProjectLabelChips } from "@/components/projects/ProjectLabels"
import { LinksEditor } from "@/components/projects/LinksEditor"
import { SkeletonFeed } from "@/components/ui/Skeleton"
import { normalizeLink } from "@/lib/storage/shipMedia"
import { shipDate, shipTime } from "@/lib/time"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

export function ProjectsView() {
  const { projects, mine, loading, userId, create } = useProjects()
  const [now] = useState(() => new Date())
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState("")
  const [tagline, setTagline] = useState("")
  const [links, setLinks] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const others = projects.filter((p) => p.owner_id !== userId)

  function toggleLabel(group: "industries" | "tags", value: string) {
    const [get, set] = group === "industries" ? [industries, setIndustries] as const : [tags, setTags] as const
    set(get.includes(value) ? get.filter((v) => v !== value) : [...get, value])
  }

  function resetForm() {
    setName("")
    setTagline("")
    setLinks([])
    setIndustries([])
    setTags([])
    setError(null)
  }

  /** Normalize each link, drop blanks, de-duplicate. */
  function cleanLinks(raw: string[]): string[] {
    const out: string[] = []
    for (const r of raw) {
      const v = normalizeLink(r)
      if (v && !out.includes(v)) out.push(v)
    }
    return out
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await create(name, tagline, { industries, tags }, cleanLinks(links))
      resetForm()
      setFormOpen(false)
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: `${spacing[5]}px ${spacing[4]}px`, maxWidth: 760, margin: "0 auto" }}>
      <SectionTitle
        kicker="Projects"
        title="What you're building"
        note="Tag your ships with a project and its timeline becomes your progress log."
      />

      {/* Start a project */}
      <div style={{ margin: `${spacing[4]}px 0 ${spacing[6]}px` }}>
        {formOpen ? (
          <Card spine="violet" padding={spacing[4]}>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
              <Input label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Circuit mobile app" autoFocus required />
              <Input label="Tagline (optional)" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One line on what it is" />
              <LinksEditor links={links} onChange={setLinks} />
              <ProjectLabelPicker industries={industries} tags={tags} onToggle={toggleLabel} />
              {error && (
                <p style={{ margin: 0, fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.live }}>{error}</p>
              )}
              <div style={{ display: "flex", gap: spacing[2] }}>
                <Button type="submit" variant="accent" disabled={busy || !name.trim()}>
                  {busy ? "Creating…" : "Create project"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { resetForm(); setFormOpen(false) }}>Cancel</Button>
              </div>
            </form>
          </Card>
        ) : (
          <Button variant="accent" icon={<Plus size={15} />} onClick={() => setFormOpen(true)}>
            Start a project
          </Button>
        )}
      </div>

      {loading ? (
        <SkeletonFeed count={2} label="Loading projects" />
      ) : (
        <>
          {mine.length > 0 && (
            <ProjectGrid heading="Your projects" projects={mine} now={now} />
          )}
          {others.length > 0 && (
            <ProjectGrid heading="What the cohort is building" projects={others} now={now} />
          )}
          {projects.length === 0 && (
            <div style={{ fontFamily: fonts.body, fontSize: fontSize.body, color: colors.muted, textAlign: "center", padding: `${spacing[8]}px 0` }}>
              No projects yet. Start one and tag your next ship with it.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ProjectGrid({ heading, projects, now }: { heading: string; projects: ProjectRow[]; now: Date }) {
  return (
    <section aria-label={heading} style={{ marginBottom: spacing[6] }}>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: colors.muted,
          marginBottom: spacing[3],
        }}
      >
        {heading}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: spacing[4] }}>
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} now={now} />
        ))}
      </div>
    </section>
  )
}

function ProjectCard({ project, now }: { project: ProjectRow; now: Date }) {
  return (
    <Link href={`/projects/${project.id}`} style={{ textDecoration: "none" }}>
      <Card spine="violet" padding={spacing[4]} style={{ height: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: spacing[2] }}>
          <FolderGit2 size={16} color={colors.violet} />
          <span
            style={{
              fontFamily: fonts.display,
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.heading,
              color: colors.ink,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {project.name}
          </span>
        </div>
        {project.tagline && (
          <p style={{ margin: `0 0 ${spacing[3]}px`, fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, lineHeight: 1.45 }}>
            {project.tagline}
          </p>
        )}
        {(project.industries.length > 0 || project.tags.length > 0) && (
          <div style={{ marginBottom: spacing[3] }}>
            <ProjectLabelChips industries={project.industries} tags={project.tags} max={4} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: spacing[2], flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 9px",
              borderRadius: radii.pill,
              background: colors.goSoft,
              color: colors.go,
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
            }}
          >
            {project.ships} ship{project.ships === 1 ? "" : "s"}
          </span>
          <span style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft }}>
            {project.last_ship ? `last ship ${shipTime(project.last_ship, now)}` : `started ${shipDate(project.created_at, now)}`}
          </span>
          {project.links.length > 0 && (
            <span
              title="Has a live link"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 9px",
                borderRadius: radii.pill,
                background: colors.violetSoft,
                color: colors.violet,
                fontFamily: fonts.mono,
                fontSize: fontSize.label,
              }}
            >
              <ExternalLink size={11} /> site
            </span>
          )}
        </div>
        {project.owner_name && (
          <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginTop: spacing[3] }}>
            <Avatar name={project.owner_name} photo={project.owner_avatar} size={22} />
            <span style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted }}>{project.owner_name}</span>
          </div>
        )}
      </Card>
    </Link>
  )
}

export default ProjectsView
