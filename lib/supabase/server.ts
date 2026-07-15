import { createServerClient as _createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Returns a Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. Reads and writes auth cookies via `next/headers`.
 *
 * Must be called inside an async server context — never at module top-level.
 */
export const createServerClient = () => {
  const cookieStore = cookies()

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // `setAll` is called from a Server Component where the response
            // headers are immutable. The session will still be refreshed by
            // the middleware on the next request.
          }
        },
      },
    },
  )
}
