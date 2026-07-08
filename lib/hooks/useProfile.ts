"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/types/index"

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (data) {
        setProfile({
          name: data.name ?? "",
          occupation: data.occupation ?? "",
          org: data.org ?? "",
          tagline: data.tagline ?? "",
          bio: data.bio ?? "",
          skills: data.skills ?? [],
          industries: data.industries ?? [],
          looking: data.looking ?? [],
          links: data.links ?? {},
          avatar_url: data.avatar_url ?? undefined,
          onboarded_at: data.onboarded_at ?? null,
        })
      }
      setLoading(false)
    }

    load()
  }, [])

  const save = useCallback(async (patch: Partial<Profile>) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        ...patch,
        updated_at: new Date().toISOString(),
      })

    if (error) throw error
    setProfile(prev => prev ? { ...prev, ...patch } : (patch as Profile))
  }, [])

  return { profile, loading, save }
}
