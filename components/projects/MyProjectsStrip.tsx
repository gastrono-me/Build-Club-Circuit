"use client"

import React from "react"
import Link from "next/link"
import { FolderGit2, Plus, ArrowRight } from "lucide-react"
import { useProjects } from "@/lib/hooks/useProjects"
import { shipTime } from "@/lib/time"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

/** How many of your projects to surface on Today before linking out to all. */
const SHOWN = 3

/**
 * Compact "what you're building" strip for the home page: your projects with
 * ship counts and last-ship time, so the daily ship ritual visibly ladders into
 * a longer arc. Links out to the full Projects page.
 */
export function MyProjectsStrip({ now }: { now: Date }) {
  const { mine, loading } = useProjects()

  if (loading) return null

  return (
    <section aria-label="Your projects" style={{ marginBottom: spacing[6] }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: spacing[2], marginBottom: spacing[3] }}>
        <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.muted }}>
          Your projects
        </div>
        <Link href="/projects" style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.violet, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
          {mine.length > SHOWN ? `All ${mine.length}` : "All projects"} <ArrowRight size={12} />
        </Link>
      </div>

      {mine.length === 0 ? (
        <Link
          href="/projects"
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
            padding: `${spacing[3]}px ${spacing[4]}px`,
            border: `1.4px dashed ${colors.line}`,
            borderRadius: radii.lg,
            background: colors.panel,
            color: colors.muted,
            textDecoration: "none",
            fontFamily: fonts.body,
            fontSize: fontSize.meta,
          }}
        >
          <Plus size={15} color={colors.violet} />
          Start a project to group your ships into an arc you can track.
        </Link>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
          {mine.slice(0, SHOWN).map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing[3],
                padding: `${spacing[3]}px ${spacing[4]}px`,
                border: `1px solid ${colors.line}`,
                borderRadius: radii.lg,
                background: colors.panel,
                textDecoration: "none",
              }}
            >
              <FolderGit2 size={16} color={colors.violet} style={{ flexShrink: 0 }} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: fonts.body,
                  fontWeight: fontWeight.semibold,
                  fontSize: fontSize.body,
                  color: colors.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  padding: "2px 9px",
                  borderRadius: radii.pill,
                  background: colors.goSoft,
                  color: colors.go,
                  fontFamily: fonts.mono,
                  fontSize: fontSize.label,
                }}
              >
                {p.ships} ship{p.ships === 1 ? "" : "s"}
              </span>
              <span style={{ flexShrink: 0, fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft, minWidth: 62, textAlign: "right" }}>
                {p.last_ship ? shipTime(p.last_ship, now) : "no ships"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

export default MyProjectsStrip
