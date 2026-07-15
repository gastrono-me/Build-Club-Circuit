import { NextResponse, type NextRequest } from 'next/server'

/**
 * Lightweight, dependency-free auth gate for the Edge middleware.
 *
 * We intentionally do NOT import @supabase/ssr / supabase-js here: pulling the
 * full client into the Edge middleware bundle fails to initialise in Vercel's
 * Edge runtime. Instead we gate protected routes on the presence of the
 * Supabase auth cookie. This is a UX gate only — real data access is enforced
 * by Row-Level Security, and the browser client auto-refreshes the session.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname
  // The landing ('/') is public to everyone; '/login' redirects to it; the OAuth
  // callback must stay reachable while signing in; and the health endpoint must
  // be observable without a user session during deployment and monitoring.
  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/api/health' ||
    pathname.startsWith('/auth/callback')

  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (c) =>
        c.name.startsWith('sb-') &&
        c.name.includes('-auth-token') &&
        !c.name.includes('-code-verifier'),
    )

  if (!hasAuthCookie && !isPublic) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next({ request })
}
