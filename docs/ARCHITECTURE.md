# Vector — architecture

A Next.js (App Router) + Supabase app. Deterministic logic is pure TypeScript in `lib/`; persistence and realtime are Supabase; the look is a token-driven design system. Persistence now spans profiles, saved schedule, checklist state + DevPost URL, direct messages, catchup proposals, the blocker feed, and the build log — everything else (events, people directory seed, maps) is mock data behind a single data seam.

## One shell, one nav, two labelled clusters
`components/shell/AppShell.tsx` wraps every page (except `/login` and `/auth/callback`, which render bare). There is no mode-gating toggle — `lib/nav.ts` exports `PULSE_ITEMS`/`LINE_ITEMS` as the single source of truth, and `Nav` (desktop rail), `MobileMenu` (mobile slide-out drawer), and `TopBar` all render both groups together so nothing is hidden behind a switch:

- **Pulse:** `/` Now · `/discover` Calendar · `/schedule` · `/people` Directory (embedding field) · `/maps` · `/clawbie` (placeholder)
- **Line:** `/deadline` Deadline Guardian · `/radar` Bottleneck Radar (the hero, plus a Shipped/Build Log tab) · `/pitch` Pitch Coach

`TopBar` carries the wordmark, the **SimClock** (a user-controlled day+time simulation — `lib/hooks/useSimClock.tsx`), and notification indicators (`NotificationItems.tsx`) for unread messages/catchup requests via `useInbox`/`useCatchups`.

## Auth
- Sign-in: Supabase email **magic-link** (`app/login`), plus Google/GitHub OAuth buttons (need provider setup — see ROADMAP). `app/auth/callback/route.ts` exchanges the code for a session.
- **Route gate:** `middleware.ts` → `lib/supabase/middleware.ts`. It is deliberately **dependency-free** (no `@supabase/ssr` import — that crashes Vercel's Edge runtime). It redirects to `/login` when the Supabase auth cookie is absent. This is a UX gate only; **RLS is the real security boundary.** The browser client (`lib/supabase/client.ts`) auto-refreshes the session.

## Data model (Supabase, see `db/migrations/`)
| Table | Keys / shape | RLS | Realtime |
|---|---|---|---|
| `profiles` | `id` = `auth.users.id`; name, occupation, org, tagline, bio, skills[], industries[], looking[], links jsonb, avatar_url | authed read all; write own. A trigger auto-creates a blank row on signup. | — |
| `blockers` | id, author_id (nullable = community/seed), category, note, created_at | authed read all; insert/delete own | ✅ |
| `blocker_metoo` | (blocker_id, user_id) PK | authed read all; insert/delete own | ✅ |
| `saved_sessions` | (user_id, session_id) PK | own only | — |
| `checklist_state` | (user_id, item_id, checked) | own only | — |
| Storage `avatars` | public bucket | authed upload | — |
| `connections`, `catchups` (v1, dropped in 007), `chat_messages`, `submissions` | mock-attendee social: per-user simulated connect/catchup/chat against a free-text `person_id`, plus the DevPost URL | own only | — |
| `messages`, `message_reads` | real cross-user DMs (sender/recipient = `profiles.id`) + per-pair last-read marker | either party read; sender-only insert | ✅ |
| `catchups` (007, current) | proposer/recipient, day/start_min/end_min, status (`proposed`/`accepted`/`declined`/`cancelled`) — a real two-party proposal, replacing the one-sided v1 table | either party read/update/delete; proposer-only insert | ✅ |
| `build_log`, `build_log_cheers` | id, author_id (not null — no anon posts), category, note / (post_id, user_id) cheer | authed read all; insert/delete own | ✅ |

Migrations `001`–`008` + `seed.sql` are idempotent; apply in order in the Supabase SQL editor (or via the Management API). `007_shared_catchups.sql` explicitly drops `connections` and the v1 `catchups` table — see its header comment for why (the v1 model was private and let either party double-book without the other seeing it). `seed.sql` inserts a few authorless "community" starter blockers so the Radar feed is never empty. **Realtime** is enabled per-table by adding to the `supabase_realtime` publication (`blockers`/`blocker_metoo` in `002`, `messages` in `006`, `catchups` in `007`, `build_log`/`build_log_cheers` in `008`); if live updates don't fire, confirm Realtime is on for those tables in Supabase → Database → Replication.

## The hero: `components/field/EmbeddingField.tsx`
A 2D "embedding field" plot. Each node is positioned so similar items cluster, with deterministic per-id jitter; node radius scales with engagement count; tapping a node selects it and draws connecting vectors to neighbours. `EmbeddingField` is the shared scaffold (SVG grid/axes, node/link rendering, the floating detail panel slot) — layout math (`lib/radar/similarity.ts`) and the meaning of a node/link stay with each caller:
- **Radar** (`components/radar/EmbeddingPlot.tsx`, used by `RadarFeed.tsx`): live blocker feed from `useRadar()` — same-category blockers cluster, "me too" count drives radius, vector lines connect genuinely similar blockers (TF-IDF cosine) across category lines.
- **People** (`components/people/PeopleField.tsx`): attendees cluster by cosine similarity over a TF-IDF-style vector of skills/industries/looking-for, and vectors shoot from you to your top complement-scored matches (`lib/match.ts`).
- **Build Log** (`BuildLogFeed.tsx`/`useBuildLog.ts`) is a plain card list (`BuildLogCard.tsx`) with cheers instead of "me too" — it does **not** use the embedding field plot.

Both read live data via Supabase Realtime so they update across all signed-in clients without a refresh. Selecting a person in People opens `PersonPanel` (profile + connect + propose catchup + DM), backed by `useCatchups`/`useDirectMessages`/`useInbox`.

`lib/radar/similarity.ts` knows nothing about AABW — `layoutField()` takes a `category -> anchor` map as an argument and falls back to a deterministic hash-spread for any category it doesn't recognise. Radar supplies AABW's blocker-category anchors/colors from `lib/config/event.ts`; People supplies industries instead. Standing Vector up for a different event means editing `lib/config/event.ts` (deadline, checklist items, blocker categories + anchors/colors, radar axis labels) — the layout engine and the `EmbeddingField` scaffold don't change.

## Code map
```
app/                  routes (see clusters above) + api/claude (keyless proxy stub) + middleware.ts
components/
  shell/   AppShell TopBar SimClock Nav MobileMenu NotificationItems Avatar SocialProvider
  ui/      Button Card Tag SectionTitle Input Modal   (design-system primitives)
  field/   EmbeddingField                     (shared plot scaffold — grid/axes/nodes/links/panel slot)
  radar/   EmbeddingPlot RadarFeed BlockerCard PostBlocker BuildLogFeed BuildLogCard PostUpdate
  people/  PeopleDirectory PeopleField PersonCard PersonPanel
  pitch/   PitchCoach
  discover/ schedule/ deadline/ now/ maps/ clawbie/ profile/
lib/
  supabase/{client,server,middleware}.ts
  nav.ts social.ts time.ts schedule.ts match.ts search.ts   (pure, unit-tested)
  config/event.ts                            (per-event facts: deadline, checklist, blocker category colors/anchors, axis labels — the seam for standing up a new event)
  radar/similarity.ts                        (TF-IDF-style cosine similarity layout engine — event-agnostic, anchors passed in by the caller)
  ai/local-fallbacks.ts                      (AI fallbacks; no model calls)
  data/{sessions,attendees,days,venues,blocker-tags,tba-sessions}.ts + useEventData.ts  (mock seam)
  design/tokens.ts                           (the whole look)
  hooks/{useSimClock,useProfile,useRadar,useSavedSchedule,useChecklist,useBuildLog,useCatchups,useDirectMessages,useInbox,useSubmission}.ts
types/index.ts        Profile, Session, Attendee, Day, Venue, BLOCKER_TAGS, ALL_TAGS, INDUSTRIES, LOOKING
db/migrations/*.sql (001–008) + db/seed.sql
```

## Design system (`lib/design/tokens.ts` + `app/globals.css`)
"Embedding field / architect plotter on paper." Tune everything from `tokens.ts`; `globals.css` mirrors the values as CSS variables; primitives consume them.
- **Color:** paper `#EEF1F4`, ink `#14143C`, vector-blue accent `#2B2BF5` (used with restraint), oxblood `#8A2233`, graphite `#5A5F6B`.
- **Type:** Fraunces (display, italic accent), IBM Plex Sans (body), IBM Plex Mono (uppercase tracked labels/data) — wired via `next/font` in `app/layout.tsx`.
- **Devices:** faint 32px plotter grid on the page; 1.5px ink borders; hard offset shadow `6px 6px 0 rgba(20,20,60,.08)` (not soft blur); ink-fill active states.

## Mock vs real
Real/persisted: auth, profiles, saved schedule, checklist + DevPost URL, direct messages, catchup proposals, the Bottleneck Radar feed, the Build Log feed. Mock/seeded (via `useEventData`): sessions, attendees, maps, plus the per-user simulated chat/connect against mock attendees. AI: local fallbacks only. The `useEventData()` seam is the single swap point if/when real event data is wired in.
