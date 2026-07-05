# Vector — roadmap, setup, and known issues

State today: a working, deployed app (Next.js + Supabase) with real auth/profiles, real cross-user messaging and catchup proposals, and two live realtime feeds (Bottleneck Radar, Build Log); the event calendar/people-seed/maps stay mock; AI runs on local fallbacks. This is what's left.

## Setup a new owner needs to finish (optional for the demo)
- **Google / GitHub OAuth.** The buttons exist but error until configured. Register an OAuth app in each provider's console, set the callback to `https://<ref>.supabase.co/auth/v1/callback`, and paste the client id/secret into Supabase → Authentication → Providers. Magic-link works without any of this.
- **Custom SMTP + branded email.** On the free tier with Supabase's default email provider, the magic-link email is rate-limited and its template can't be edited (the Management API returns "email template modification is not available… configure a custom SMTP provider"). Add SMTP (e.g. Resend) in Supabase → Auth → SMTP; then the template is editable (`mailer_subjects_magic_link`, `mailer_templates_magic_link_content`) and deliverability/limits improve.

## Next horizon (deferred features)
- **Live event calendar** — replace the mock `sessions` with a real source at the single `useEventData()` seam (`lib/data/useEventData.ts`); add a per-event link out. The mock is the snapshot fallback.
- **Real "Ask Clawbie" assistant** — `/clawbie` is a labelled placeholder; wire the organisers' assistant when access is granted.
- **Organizer mode** — a second audience: a live view of where builders are most stuck (organiser side of the Radar) and most/least-popular events. Needs the role split on top of the existing accounts.
- **Wire real AI** — point `askClaude`-style calls at the `api/claude.js` proxy with a funded key; keep the local fallback for every call. No token spend today by design.

## Known issues / polish
- **Dependency upgrade.** `npm audit` flags 7 vulnerabilities (1 critical in vitest's dev-only UI server — not exploitable in production; 2 high in Next.js 14.2.35 covering several DoS/cache-poisoning/XSS/middleware-bypass advisories). The Next.js fix is a major-version bump to 16 (`npm audit fix --force`), which is a breaking change and needs its own test pass before shipping.
- **Maps SVG** (`components/maps/*`) has a couple of decorative hex colours not pulled from tokens.
- **Fraunces optical sizing** depends on the variable-font axis being loaded by `next/font`; verify the display type sizes optically.

## Verifying the hero (the one thing worth checking live)
Sign in as two users (two browsers or one + incognito), open `/explore` (the "Stuck" tab) in both, post a blocker from Today in one and tap "me too" in the other — the node and count update live in both via Supabase Realtime. This is the demo centrepiece and the proof the database/realtime path works.

## Deploy
`vercel --prod` from the repo (CLI, not Git integration). Ensure `vercel.json` keeps `framework: nextjs`, the two `NEXT_PUBLIC_SUPABASE_*` env vars are set in Vercel, and the deployed URL is in Supabase's auth redirect allow-list. See `CLAUDE.md` → "Deploy gotchas".
