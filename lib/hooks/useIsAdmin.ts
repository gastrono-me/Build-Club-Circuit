"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Whether the signed-in user is staff (a row in public.admins). `loading`
 * stays true until resolved so gated UI doesn't flash. Admin status is only
 * a UI convenience here — the real enforcement is RLS (is_admin()), so a
 * spoofed client value buys nothing.
 */
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) { setIsAdmin(false); setLoading(false) }
        return
      }
      const { data } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle()
      if (!cancelled) { setIsAdmin(!!data); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  return { isAdmin, loading }
}
