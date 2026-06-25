# Circuit — project guide

The everyday tool for Build Club builders. Circuit is **evergreen**: it works day-to-day (the async builder journey) and lights up during live events, so Build Club becomes part of the operating structure of being a founder/builder. Events are high-intensity *episodes* on a continuous arc, not the whole product.

**The daily spine is the ship ritual + streak.** Home (`/` → `components/today/TodayView.tsx`) asks "Did you ship today?", shows your streak (`lib/streak/streak.ts`, computed from `build_log`), and the cohort's ships. This runs on **real time**, not the sim clock.

One shell, one nav, every destination always reachable (no mode gate). `lib/nav.ts` is the single source of `NAV_GROUPS`, rendered by `Nav`/`MobileMenu`: **Your build** (the daily loop) · **Community** (the always-on graph) · **At an event** (episode-scoped surfaces — schedule/maps/deadline — still on seeded/sim data until Phase 3 makes events first-class).

> Heritage: Circuit grew out of **Vector**, an in-event toolkit built for Agentic AI Build Week (AABW). `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and `docs/DEVPOST.md` still describe the Vector era and are accurate for the event-side architecture, but predate the Circuit pivot — read them with that in mind.

**Read next:** `docs/ARCHITECTURE.md` (how it's built) and `docs/ROADMAP.md` (what's left + known issues). This file is the orientation; those have the detail.

## Stack
Next.js 14 (App Router, TypeScript) + Supabase (Postgres, Auth, Realtime, Row-Level Security) + Vercel. Unit tests in Vitest.

## Run it
```bash
npm install
cp .env.example .env.local      # fill in the two NEXT_PUBLIC_SUPABASE_* values
npm run dev                     # http://localhost:3000
npm run test                    # vitest (pure logic in lib/)
npm run build                   # production build
```
You need a Supabase project with the schema applied (`db/migrations/*.sql` then `db/seed.sql`, run in the Supabase SQL editor) and in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable / anon key>
```
Email magic-link sign-in works with no extra setup. Google/GitHub OAuth need provider apps registered + creds added in the Supabase dashboard (see `docs/ROADMAP.md`).

## Deploy gotchas (read before deploying — these cost real time blind)
1. **Vercel framework preset must be Next.js.** It's pinned in `vercel.json` (`{"framework":"nextjs"}`). If it ever reverts to another preset, every route 500s/404s even though the build is green.
2. **The Edge middleware must stay dependency-free.** `lib/supabase/middleware.ts` does NOT import `@supabase/ssr` — that import fails to initialise in Vercel's Edge runtime and 500s the whole site. The middleware is a cookie-presence auth gate only; real security is enforced by RLS, and the browser client auto-refreshes the session.
3. **Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel** (Production + Preview). They're inlined at build into the client bundle.
4. **Add the deployed URL to Supabase Auth → URL Configuration** redirect allow-list, or magic-link/OAuth redirects fail.
5. Deploys are done via the Vercel CLI (`vercel --prod`), not Git integration (the Vercel account lacks access to the GitHub org). `.vercelignore` keeps `.env*`, `docs`, and local scratch out of the upload.

## What's real vs mock (important context)
- **Real / persisted:** accounts (magic-link; OAuth when configured), profiles, saved schedule, deadline checklist + DevPost URL, direct messages and catchup proposals between signed-in users, the **Bottleneck Radar** feed, and the **Build Log** feed (all live across users via Supabase Realtime). The Build Log now also powers the home **ship ritual + streak** — Circuit's daily spine.
- **Mock / seeded:** the event calendar, the People directory's example attendees (real signed-in users appear alongside them), and the Maps (illustrative SVG). Chatting with a mock attendee uses a separate per-user-only simulated thread (`chat_messages`/`connections`), not a real two-way conversation — don't confuse it with the real `messages` table.
- **AI:** runs on local-logic fallbacks (no token spend) — readiness review and Pitch Coach feedback. `api/claude.js` is a server proxy stub, currently unused/keyless.

## Conventions
- **The whole look tunes from `lib/design/tokens.ts`** (mirrored as CSS vars in `app/globals.css`). Design system: "embedding field / architect plotter on paper" — paper `#EEF1F4`, ink `#14143C`, vector-blue accent `#2B2BF5`, Fraunces display + IBM Plex Sans/Mono. Build UI from the primitives in `components/ui/*` + `components/shell/*`. The embedding-field plot pattern (`components/radar/EmbeddingPlot.tsx`) is shared by People (`PeopleField.tsx`) and Radar/Build Log — same layout idea, different similarity source.
- **Time: the daily loop uses real time; the sim clock is event-only.** The ship ritual + streak (`TodayView`, `lib/streak/streak.ts`) key off real calendar days via `new Date()`. The user-controlled simulation (`lib/hooks/useSimClock.tsx`) survives only for event-episode surfaces (schedule/now/deadline) so their countdowns can still be demoed; it is no longer in the global chrome (removed from `TopBar`/`MobileMenu`). Do not wire the daily loop to the sim clock.
- Plain, factual copy. No em-dashes in user-facing strings.
- Commit/push only when asked; the working branch is `Build-Club-Circuit`.
