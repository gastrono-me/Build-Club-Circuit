# Circuit

Circuit is Build Club's everyday builder operating system: projects, a daily ship ritual and streak, blockers, people, events, messages, and catchups in one continuous community record. Live events switch on an integrated coworking layer for check-ins, focus outcomes, explainable matching, huddles, targeted alerts, lightning demos, host controls, and reporting. Events are high-intensity episodes inside Circuit, not a separate product mode.

## Product surfaces

- **Today:** ship, keep a streak, post a blocker, and resume a live coworking session.
- **Projects:** durable build records that ships and event sessions attach to.
- **Explore:** browse cohort ships and the shared blocker field.
- **People:** profile-based discovery, messaging, and catchups.
- **Events:** join an episode; while live, check in with an intention, work through focus outcomes, meet useful builders, join targeted huddles, and queue an event ship for demo.
- **Admin:** create events, set capacity/spaces, operate attendees/huddles/demos, project the live board, and export a CSV report.

The concise merge decision and operating model are in [`docs/LIVE_COWORKING.md`](docs/LIVE_COWORKING.md).

## Stack

Next.js 14 App Router + TypeScript, Supabase Postgres/Auth/Realtime/RLS, and Vercel. Vitest covers deterministic domain logic.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Apply `db/migrations/*.sql` in order and then `db/seed.sql`, or paste the generated `db/setup_all.sql` bundle into a new Supabase project's SQL editor. Regenerate the bundle after schema changes with:

```bash
npm run db:bundle
```

## Verification

```bash
npm test
npm run build
```

## Deployment

The GitHub-connected Vercel project creates previews for branches/PRs and deploys production from `main`. The migration workflow applies new SQL migrations after pushes to `main` using the `SUPABASE_DB_URL` repository secret. See [`CLAUDE.md`](CLAUDE.md) for deployment guardrails and the current architecture orientation.
