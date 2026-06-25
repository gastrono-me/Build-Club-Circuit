# Circuit

Circuit is the everyday tool for Build Club builders. It is **evergreen**: it works day-to-day in your async builder journey and lights up during live events. The aim is for Build Club to become part of the operating structure of being a founder/builder, with events as high-intensity episodes on a continuous arc rather than the whole product.

All tools live in one shell and one nav — there is no mode gate; everything is always reachable, grouped into three clusters.

**The daily spine: ship ritual + streak.** Home asks "Did you ship today?", shows your streak (consecutive days you shipped something, computed in real time from your Build Log), and the cohort's ships for the day. This is the loop you return to whether or not an event is running.

**Your build** (the daily loop)
- **Today**: the ship ritual, your streak, and the live cohort build feed.
- **Bottleneck Radar**: a shared, live feed of where builders are stuck, laid out as an embedding-field plot. Post a blocker, hit "me too" on someone else's, and watch counts update in real time. You are never stuck alone.
- **Pitch Coach**: a 3-minute pitch timer with local-logic feedback on your run.

**Community** (the always-on graph)
- **People**: an embedding-field view of the cohort — people cluster by shared skills/industries/what-they're-looking-for (cosine similarity over a TF-IDF-style profile vector), plus keyword search and a per-person panel (profile, connect, propose a catchup, direct message). You decide who to reach out to; there is no opaque ranking.
- **Discover**: the event calendar in one place, filterable by day.
- **Ask Clawbie**: a placeholder for Build Club's own assistant (integration is a later step).

**At an event** (episode-scoped — these run on seeded/sim data until events become first-class)
- **Schedule**: save sessions; clashes are flagged automatically.
- **Maps**: per-day venue maps plus a build-day floor plan (illustrative).
- **Deadline**: a countdown, a submission checklist mirroring the real DevPost fields, a DevPost URL field, and a readiness self-check on your write-up.

Cross-cutting: real-time direct messages and catchup proposals between signed-in users (proposer/recipient, accept/decline/cancel), with an inbox/unread-count notification in the top bar.

## What is real vs mock

- **Real and persisted**: accounts (email magic-link, plus Google and GitHub when configured), your profile, your saved schedule, your checklist state and DevPost URL, the Bottleneck Radar feed, the Build Log feed, direct messages between signed-in users, and catchup proposals between signed-in users — all live via Supabase Realtime where it matters (Radar, Build Log, messages, catchups).
- **Mock seed data**: the session calendar, the people directory's example attendees, and the maps. Signed-in users appear in People alongside the seed. Note: chatting with a *mock* attendee (as opposed to a real signed-in user) uses a separate, per-user-only simulated thread (`chat_messages`/`connections` tables) — it is not a real two-way conversation, since the mock attendee isn't a real account.
- **AI**: the readiness check and Pitch Coach feedback run on local logic. Connecting a live model is a later, funded step; there is no token spend in this build.

## Stack

Next.js 14 (App Router) + Supabase (Postgres, Auth, Realtime, Row-Level Security), deployed on Vercel.

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

Open http://localhost:3000. You need a Supabase project with the schema applied (see `db/migrations/`, run in order, then `db/seed.sql`) and these values in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your publishable / anon key>
```

Email magic-link sign-in works with no extra setup. Google and GitHub sign-in require registering OAuth apps in those providers' consoles and adding the credentials in the Supabase dashboard.

## Tests

```bash
npm run test
```

Unit tests cover the deterministic logic (time helpers, schedule conflicts, keyword search, profile-similarity scoring, readiness review).

## Deploy

Deployed on Vercel via the CLI: `vercel --prod` from the repo root. Before deploying, know the gotchas (full list in `CLAUDE.md` → "Deploy gotchas") — they will bite otherwise:

- The Vercel project framework **must** be Next.js. It's pinned in `vercel.json`; if it reverts to another preset, every route 500s/404s despite a green build.
- The Edge middleware (`lib/supabase/middleware.ts`) is intentionally dependency-free — do not import `@supabase/ssr` there (it fails to initialise in Vercel's Edge runtime).
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Vercel project (Production + Preview).
- Add the deployed URL to Supabase Auth → URL Configuration so magic-link/OAuth redirects resolve.

See `docs/ARCHITECTURE.md` for the system map and `docs/ROADMAP.md` for what's left.
