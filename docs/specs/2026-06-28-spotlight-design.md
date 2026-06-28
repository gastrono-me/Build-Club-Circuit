# Spotlight — design spec

Date: 2026-06-28
Status: proposed (awaiting approval before implementation plan)
Feature owner: Build Club / Circuit

## Intent

Turn the daily ship feed into a recognition surface without turning it into a leaderboard. Builders already post what they shipped (the `build_log` feed). Spotlight features the day's shippers on the home page in a way that reinforces Circuit's effort-based daily habit (the streak spine) instead of competing with it, and creates an opt-in path to feature standout ships on a bigger platform later.

This was pressure-tested with a product council (five lenses plus an adversarial red-team). The headline finding: a ranked "top posters" carousel should not be built. It reintroduces the gameable ranking the team already removed from People on principle (see `docs/DEVPOST.md` lines 43 and 56), and it converts the non-comparative "Did you ship today?" habit into a comparative "be top" race that pressures the median builder the forgiving streak exists to retain. The design below is the inclusive, effort-based reshape the council recommended.

## Resolved product decisions

| Decision | Choice |
|---|---|
| Selection model | Inclusive, day-rotated. Eligibility is binary: you shipped today, you are eligible. No ranking, no cheers/volume metric. |
| Visual form | A faces strip (every shipper present as a face) plus a featured full-post spotlight beneath it that rotates through the day's shippers. |
| Featured card content | The entire ship post: author, category tag, timestamp, the complete note (no truncation). |
| Interactivity | Auth-conditional. Signed-in viewers get the cheer and message actions; logged-out viewers see the post display-only. This single seam lets one component serve both the in-app and the public surface. |
| Rotation | Auto-cycle plus manual navigation (tap a face or a dot to pin). Pause on hover and focus. Holds without auto-cycling when the OS reduced-motion setting is on. |
| Placement | Below the ship prompt on Today (never above it). Reused on the event detail page, scoped to that event. |
| Cadence | Daily on Today. No separate competitive cadence. |
| External featuring | Per-post self-nomination opt-in, default off, on your own ship. This is the consent gate. Curation is manual editorial by a human operator. No automated publishing pipeline in this feature. |
| Audience / scope | v1 ships in-app (signed-in). v2 (deferred) is a public pre-login landing carousel that reuses the same component in display-only mode, fed from the consented and approved nomination pool. |

## Scope

### In scope (v1)

1. A pure rotation/selection module with unit tests.
2. A `SpotlightRail` component (faces strip plus featured full-post card) with auto-cycle and manual navigation, and an `interactive` flag that gates the cheer/message actions.
3. Integration into the Today page (global scope) and the event detail page (event scope).
4. A per-post self-nomination opt-in on the builder's own ship card, persisted, plus its table and RLS.
5. A cold-start floor so the rail hides when too few builders have shipped.

### Explicitly deferred

- The v2 public pre-login landing carousel (new public route, restricted public-read path for consented ships, moderation). The v1 component is built so v2 reuses it; the v2 surface itself is a separate effort gated on a committed owner and cadence.
- Automated external publishing to X, newsletter, or a stage. Curation stays manual.
- An admin/organizer curation UI and an enforced `event_members.role`. The operator reads the nomination queue in the Supabase SQL editor.
- Milestone moments (first ship, streak milestones). Cheap and spine-reinforcing, kept as a later reversible add.
- A "prefer newer or quieter builders" rotation weighting. v1 rotation is fair and day-seeded; the weighting refinement is later.
- A "your ship was featured" notification back to the builder.
- Auto-scoping the Today rail to a live event via `pickActiveEvent()`. Today stays global in v1.

## Architecture

Layers follow the existing Circuit pattern: pure logic in `lib/` (unit tested), persistence and realtime through a hook, presentation in a component, wired into routes.

### Data model

New migration `db/migrations/011_spotlight_nominations.sql`. The rail itself needs no schema change (it reads existing `build_log` rows). Only the self-nomination feature adds a table.

```
create table if not exists public.spotlight_nominations (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.build_log(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending',   -- 'pending' | 'featured' | 'declined' (operator-set)
  created_at  timestamptz not null default now(),
  unique (post_id)
);
```

Row-level security (every table in Circuit has RLS; this matches the existing ownership pattern):

- select: a builder can read their own nominations (`auth.uid() = user_id`). The operator reads all via the service role in the SQL editor.
- insert: only your own nomination, and only for a post you authored:
  `with check (auth.uid() = user_id and exists (select 1 from public.build_log b where b.id = post_id and b.author_id = auth.uid()))`.
- delete: your own nomination (`auth.uid() = user_id`), so a builder can withdraw.
- No update policy for builders. Status transitions are operator-only (service role).

Not added to the `supabase_realtime` publication. It is a curation queue, not a live feed.

After adding the migration, regenerate `db/setup_all.sql` by hand (the repo has no generator script; this is a known step).

### Pure logic

New `lib/spotlight/rotation.ts`, in the same pure, real-time, UTC-day style as `lib/streak/streak.ts` and `lib/events/eventStatus.ts`.

```
selectSpotlight(posts, now) -> BuildLogRow[]
```

Algorithm:

1. Filter `posts` to those shipped on `toDayKey(now)` (reuse `toDayKey` from `lib/streak/streak.ts` for one UTC-day convention across the app).
2. Dedupe to one entry per author, keeping that author's latest ship of the day.
3. Order by a deterministic hash of `authorId + dayKey`. This gives a fair order that is stable within a day and rotates across days. No ranking, no engagement metric.
4. If the distinct-author count is below `SPOTLIGHT_MIN_BUILDERS` (default 3), return an empty array so the rail does not render during cold-start. Otherwise return the full ordered list of distinct shippers.

The module owns `SPOTLIGHT_MIN_BUILDERS` and is the single place that decides who is eligible and in what order. Display caps (how many faces show before a `+N` overflow chip, and how many the featured card rotates through) are a presentation concern and live in the component, so the inclusivity promise and the layout limits are not entangled with the selection rule.

### Persistence hook

New `lib/hooks/useSpotlightNominations.ts`: returns `{ mine: Set<postId>, nominate(postId), unnominate(postId) }` against `spotlight_nominations`, following the shape and error handling of the existing hooks (for example `useBuildLog.ts`). The rail reads ship data from the existing `useBuildLog(eventId)` hook; no change to its query is required for v1.

### Components

New `components/spotlight/` folder (a cross-surface component used by both Today and event detail, mirroring how `components/field/EmbeddingField.tsx` is shared):

- `SpotlightRail.tsx` — props: `posts: BuildLogRow[]`, `now: Date`, `eventId?: string | null`, `interactive: boolean`, plus the cheer/message wiring passed through when interactive. Renders the faces strip and the featured full-post card. Owns the auto-cycle timer, manual navigation (faces and dots), pause-on-hover/focus, and the reduced-motion hold. Returns null when `selectSpotlight` yields nothing (cold-start floor).
- Reuses existing primitives: `Avatar` (`components/shell/Avatar.tsx`), `Tag`, `Card`, and the design tokens. Cheer and message reuse the same patterns as `components/radar/BuildLogCard.tsx` (message opens the shared panel via `useSocial().openPanel`).

When `interactive` is false, the featured card renders the post with no action row. This is the mode the v2 public landing will use.

### Integration points

- `components/today/TodayView.tsx`: insert `<SpotlightRail>` between the ship prompt (`PostUpdate`, around line 114) and the existing "What the cohort is shipping" feed (around line 116). Global scope (`eventId` null). `interactive` is true (always a signed-in user in-app). Pass the `now` already resolved on mount, the `posts` from `useBuildLog`, and the existing cheer handlers. The "N shipped today" counter folds into the rail header.
- `components/events/EventDetailView.tsx`: insert `<SpotlightRail>` above `<RadarFeed>` (around line 187), scoped by the page's existing `scope` toggle (`event.id` when "This event", else null). `interactive` true.
- `components/radar/BuildLogCard.tsx`: in the action row, when `isOwn` is true, show a "Submit for a spotlight" toggle that calls `useSpotlightNominations().nominate/unnominate`. Default off. Honest copy, for example "Build Club may feature standout ships, with your permission." This is the only public-exposure consent path; default off, per post.

## Data flow

`useBuildLog(eventId)` already fetches ship rows with author name and avatar joined from `profiles`, and refetches on realtime changes. `TodayView` and `EventDetailView` resolve `now` on mount (the established hydration-safe pattern). `selectSpotlight(posts, { now })` derives the eligible, day-rotated set client-side. `SpotlightRail` renders it and cycles. New ships arrive through the existing realtime subscription and re-flow into the rail. Self-nomination writes go through `useSpotlightNominations` to `spotlight_nominations`; the operator reads that table out of band to curate external features.

## Accessibility and motion

- Auto-cycle pauses on hover and on keyboard focus within the rail, and does not run at all when `prefers-reduced-motion: reduce` is set (the app already respects this in `app/globals.css`).
- Faces and dots are real buttons, keyboard reachable, with the vector-blue focus ring the app uses globally. Each face has an accessible label (the builder's name).
- The featured card is a live region update on rotation should be polite, not assertive, so it does not interrupt a screen reader mid-read.

## Edge cases

- Zero ships today, or fewer than `SPOTLIGHT_MIN_BUILDERS`: rail does not render; the existing empty state and counter remain.
- Exactly one or two shippers: below the floor, so hidden (avoids crowning one person during habit formation).
- Many shippers: faces show up to a visible cap with a `+N` overflow chip; the featured card rotates through the day-ordered list (itself capped to a sensible number for a calm cycle).
- The viewer's own ship can appear in the rail; that is fine and inclusive. Cheer stays disabled on your own post, consistent with `BuildLogCard`.
- Event scope with no event-tagged ships: same floor behavior, rail hidden.

## Invariants respected

- Real calendar time only, via `now` resolved on mount. The sim clock is never used here, consistent with the daily spine.
- RLS enforces nomination ownership; a client cannot nominate another builder's post.
- All styling tunes from `lib/design/tokens.ts` (and its `app/globals.css` mirror). No new hard-coded colors.
- No em-dashes in user-facing copy; plain factual voice.
- Schema change ships as a numbered migration plus a hand-regenerated `db/setup_all.sql`, and the new row interface lives with its hook.
- The Edge middleware is untouched (no auth-model change in v1).

## Testing

- Unit (`tests/lib/spotlight.test.ts`, mirroring `tests/lib/streak.test.ts`): day filtering, dedupe-per-author keeps the latest, deterministic order is stable within a day and changes across days, cold-start floor returns empty, `max` cap and rotation of the carried subset.
- Manual end-to-end (the council flagged this as the real proof): sign in as three users, each ships once, confirm the rail appears with all three as faces and the featured card cycling through full posts; nominate your own ship and confirm the row persists in `spotlight_nominations`; open an event detail page and confirm the rail scopes to that event.

## v2 (deferred) public landing, sketch only

A new public route renders the same `SpotlightRail` with `interactive={false}`, fed by a restricted public-read path that exposes only consented (`status = 'featured'`) ships to the anonymous role (a Postgres view or a narrow `anon` policy, fetched server-side). This requires opening a public route in the middleware allow-list and a moderation step. It is a separate effort and should ship only once a named owner and a fixed featuring cadence are committed, so the opt-in is never a dangling promise.

## Open questions (operational, not blocking v1)

- Who owns external featuring, and on what cadence? Needed before any public surface or any "may be featured" copy goes live.
- Current daily-active shipper count, to tune `SPOTLIGHT_MIN_BUILDERS`. If single-digit, the floor matters more.
