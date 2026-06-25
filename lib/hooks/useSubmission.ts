"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export function useSubmission() {
  const [devpostUrl, setDevpostUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data } = await supabase
        .from("submissions").select("devpost_url").eq("user_id", user.id).maybeSingle()
      if (data?.devpost_url) setDevpostUrl(data.devpost_url)
      setLoading(false)
    }
    init()
  }, [])

  const save = useCallback((url: string) => {
    setDevpostUrl(url)
    if (!userId) return
    createClient().from("submissions")
      .upsert({ user_id: userId, devpost_url: url, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .then(({ error }) => { if (error) console.error("[useSubmission] save error:", error) })
  }, [userId])

  return { devpostUrl, save, loading }
}
