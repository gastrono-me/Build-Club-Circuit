"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface PublicProfile {
  id: string
  name: string | null
  occupation: string | null
  org: string | null
  tagline: string | null
  bio: string | null
  skills: string[]
  industries: string[]
  looking: string[]
  links: { linkedin?: string; github?: string; x?: string; instagram?: string }
  avatar_url: string | null
}

/**
 * Fetch one builder's public profile by id, for the profile popup. Any signed-in
 * user can read profiles (RLS profiles_select_authenticated). Returns null while
 * loading or if not found.
 */
export function useProfileById(id: string | null): { profile: PublicProfile | null; loading: boolean } {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { setProfile(null); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data, error } = await createClient()
        .from("profiles")
        .select("id, name, occupation, org, tagline, bio, skills, industries, looking, links, avatar_url")
        .eq("id", id)
        .maybeSingle()
      if (cancelled) return
      if (error) console.error("[useProfileById] fetch error:", error)
      setProfile(data ? {
        id: data.id,
        name: data.name ?? null,
        occupation: data.occupation ?? null,
        org: data.org ?? null,
        tagline: data.tagline ?? null,
        bio: data.bio ?? null,
        skills: data.skills ?? [],
        industries: data.industries ?? [],
        looking: data.looking ?? [],
        links: (data.links ?? {}) as PublicProfile["links"],
        avatar_url: data.avatar_url ?? null,
      } : null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id])

  return { profile, loading }
}
