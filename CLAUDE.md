# Circuit — project guide

The everyday tool for Build Club builders. Circuit is **evergreen**: it works day-to-day (the async builder journey) and lights up during live events, so Build Club becomes part of the operating structure of being a founder/builder. Events are high-intensity *episodes* on a continuous arc, not the whole product.

**The daily spine is the ship ritual + streak.** Home (`/home` → `components/today/TodayView.tsx`) is **strictly today**: "Did you ship today?", your streak (`lib/streak/streak.ts`, computed from `build_log`), your projects, a quiet "I'm stuck" blocker composer, and today's Spotlight. Everything older lives on **Explore** (`/explore`), the browse/archive surface: all past ships (filterable by work category + builder) and all blockers (list + the embedding-field "stuck" graph). Composing happens on Today; Explore is browse-only.

One shell, one nav, every destination always reachable (no mode gate). `lib/nav.ts` is the single source of `NAV_GROUPS`, rendered by `Nav`/`MobileMenu` (plus `MobileTabBar` for the bottom tabs): **Your build** (Today · Projects) · **Community** (Explore · People · Events · Admin for staff). Ships and blockers share one taxonomy, `lib/data/work-categories.ts` (discipline-spanning: Product/Engineering/Design/Growth/Sales/…), which also drives the embedding-field anchors in `lib/config/event.ts`.

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
You need a Supabase project with the schema applied. **Migrations are automated**: pushing to `main` runs `.github/workflows/migrate.yml` (`scripts/migrate.mjs`), which applies any new `db/migrations/*.sql` and tracks them in `public._migrations` (needs the `SUPABASE_DB_URL` repo secret — the **Session pooler** connection string, port 5432). For a brand-new project you can instead paste `db/setup_all.sql` + `db/seed.sql` into the SQL editor once. Then in `.env.local`:
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
5. **Deploys are Git-integrated.** The Vercel project `buildclubvector/build-club-circuit` is connected to this repo (https://vercel.com/buildclubvector/build-club-circuit), so pushing to `main` auto-deploys Production and branches/PRs get Preview deploys — no CLI needed. (Vector used the `vercel --prod` CLI because that account lacked GitHub-org access; Circuit doesn't.) `.vercelignore` still keeps `.env*`, `docs`, and local scratch out of any manual CLI upload.

## What's real vs seeded (important context)
- **Real / persisted:** everything user-facing — accounts (magic-link; OAuth when configured), profiles, ships (with photo/file/link attachments in the public `ships` bucket) + cheers + spotlight nominations, blockers + me-toos, projects (labels, links), direct messages, calendar catchups, and the notifications bell (messages + catchup requests + cheers on your ships, read cursor in `activity_reads`). Live updates fan out over a shared Realtime **Broadcast** bus (`lib/realtime/feedBus.ts`), not per-row postgres_changes.
- **Seeded:** a few starter community blockers and the two events in `db/seed.sql`. Events are managed by staff from `/admin` (create/edit/delete). Staff = a row in `public.admins`, a deliberately separate table (not a self-grantable `profiles` flag); bootstrap the first admin from the SQL editor (`insert into public.admins (user_id) values ('<uuid>')`). Admin-only writes are enforced by RLS `is_admin()`; the `/admin` route + the "Admin" nav item are gated by `useIsAdmin`.
- **AI:** local-logic fallbacks only (no token spend) — match reasons in People (`lib/ai/local-fallbacks.ts`). There is no server-side AI proxy; add one deliberately if a real AI feature lands.

## Conventions
- **The whole look tunes from `lib/design/tokens.ts`** (mirrored as CSS vars in `app/globals.css`). Design system: "embedding field / architect plotter on paper" — paper `#EEF1F4`, ink `#14143C`, vector-blue accent `#2B2BF5`, Fraunces display + IBM Plex Sans/Mono. Build UI from the primitives in `components/ui/*` + `components/shell/*`. The embedding-field pattern (`components/field/EmbeddingField.tsx` scaffold; layout math in `lib/radar/similarity.ts`) is shared by the Explore stuck graph (`components/radar/EmbeddingPlot.tsx`) and People (`PeopleField.tsx`) — same layout idea, different similarity source. (Note: `components/radar/` and `lib/radar/` keep their folder names for history; the user-facing surface is Explore.)
- **Everything runs on real time** via `new Date()` — the sim clock was removed with the rest of the hackathon scaffolding. Streaks key off real calendar days; don't reintroduce simulated time into the daily loop.
- Plain, factual copy. No em-dashes in user-facing strings.
- Commit/push only when asked; the repo is `gastrono-me/Build-Club-Circuit`, default branch `main` (pushing `main` auto-deploys — see Deploy gotcha #5).
