import { createBrowserClient } from '@supabase/ssr'

/**
 * Returns a Supabase client for use in Client Components.
 * Must be called inside a component or hook — never at module top-level —
 * so the build succeeds even when env vars are unset.
 */
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
