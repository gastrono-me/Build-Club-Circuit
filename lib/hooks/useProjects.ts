"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface ProjectRow {
  id: string
  owner_id: string
  name: string
  tagline: string | null
  industries: string[]
  tags: string[]
  created_at: string
  /** Joined from profiles */
  owner_name?: string | null
  owner_avatar?: string | null
  /** From the project_ship_counts view; 0 / null when the project has no ships. */
  ships: number
  last_ship: string | null
}

/** The label fields a builder can set on their project. */
export interface ProjectLabels {
  industries?: string[]
  tags?: string[]
}

/**
 * Projects: a builder's ongoing piece of work that ships accrue under.
 * Personal ownership, public to the cohort. Ship counts come from the
 * project_ship_counts aggregate view (one row per project, never a table scan).
 */
export function useProjects() {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id ?? null
    setUserId(uid)

    const [projRes, countRes] = await Promise.all([
      supabase
        .from("projects")
        .select("id, owner_id, name, tagline, industries, tags, created_at, profiles:owner_id ( name, avatar_url )")
        .order("created_at", { ascending: false }),
      supabase.from("project_ship_counts").select("project_id, ships, last_ship"),
    ])

    if (projRes.error) console.error("[useProjects] projects fetch error:", projRes.error)
    if (countRes.error) console.error("[useProjects] counts fetch error:", countRes.error)

    const counts = new Map<string, { ships: number; last_ship: string | null }>()
    for (const row of (countRes.data ?? []) as any[]) {
      counts.set(row.project_id, { ships: row.ships, last_ship: row.last_ship })
    }

    setProjects(
      ((projRes.data ?? []) as any[]).map((p) => ({
        id: p.id,
        owner_id: p.owner_id,
        name: p.name,
        tagline: p.tagline ?? null,
        industries: p.industries ?? [],
        tags: p.tags ?? [],
        created_at: p.created_at,
        owner_name: p.profiles?.name ?? null,
        owner_avatar: p.profiles?.avatar_url ?? null,
        ships: counts.get(p.id)?.ships ?? 0,
        last_ship: counts.get(p.id)?.last_ship ?? null,
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const create = useCallback(async (name: string, tagline?: string, labels?: ProjectLabels): Promise<ProjectRow> => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("projects")
      .insert({
        owner_id: user.id,
        name: name.trim(),
        tagline: tagline?.trim() || null,
        industries: labels?.industries ?? [],
        tags: labels?.tags ?? [],
      })
      .select("id, owner_id, name, tagline, industries, tags, created_at")
      .single()
    if (error) throw error

    const row: ProjectRow = { ...(data as any), owner_name: null, owner_avatar: null, ships: 0, last_ship: null }
    setProjects((prev) => [row, ...prev])
    return row
  }, [])

  const update = useCallback(async (projectId: string, patch: ProjectLabels): Promise<void> => {
    const supabase = createClient()
    const { error } = await supabase
      .from("projects")
      .update({
        ...(patch.industries !== undefined ? { industries: patch.industries } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      })
      .eq("id", projectId)
    if (error) throw error
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, industries: patch.industries ?? p.industries, tags: patch.tags ?? p.tags }
          : p,
      ),
    )
  }, [])

  const remove = useCallback(async (projectId: string) => {
    const supabase = createClient()
    const { error } = await supabase.from("projects").delete().eq("id", projectId)
    if (error) throw error
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
  }, [])

  const mine = userId ? projects.filter((p) => p.owner_id === userId) : []

  return { projects, mine, loading, userId, create, update, remove, refetch: fetchAll }
}
