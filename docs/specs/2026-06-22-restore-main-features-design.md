# Restore `main`'s features into `rebuild-v0`, then cut `main` over

**Date:** 2026-06-22
**Status:** Approved (design) — implementation plan to follow
**Branch:** `rebuild-v0`

## Problem

The repo has two branches with **unrelated git histories** (`git merge-base main rebuild-v0` → no merge base):

- **`main`** — the original Vite + React prototype. The whole app is one 1843-line file, `src/App.jsx`, plus `src/main.jsx`, `index.html`, `vite.config.js`, and `api/claude.js`.
- **`rebuild-v0`** — a full Next.js 14 (App Router, TypeScript) + Supabase rewrite, decomposed into `app/`, `components/`, `lib/`, with DB migrations, Vitest tests, and docs. Adds real auth, persistence, and Supabase Realtime (the Bottleneck Radar / EmbeddingPlot hero).

A normal `git merge` is not viable or clean: the branches are two different apps (different frameworks) that share no history and collide on every config file. The only shared source file, `api/claude.js`, is byte-identical on both.

The goal is to **retain all of `main`'s features** in the rebuild, then make `main` canonical. But `rebuild-v0` is **not a feature superset** of `main` — the rewrite left several features behind. This spec closes that gap, then defines the cutover.

## Feature gap (verified against both branches)

| `main` feature | Logic already in rebuild? | What's missing |
|---|---|---|
| Copilot / "Ask Pulse" assistant | ✅ `localAnswer` in `lib/ai/local-fallbacks.ts` (unit-tested) | the chat UI + wiring |
| 1:1 chat with an attendee | ✅ `localChatReply` (unit-tested) | chat modal UI + wiring + persistence |
| Pitch Coach (3-min timer + feedback) | ❌ `localPitchFeedback` not ported | logic + `/pitch` view |
| "Who should I meet?" AI matching + reasons | ❌ `localReason` not ported | logic + button + match-reason badges |
| 1:1 catchup scheduling | ⚠️ catchup types referenced in fallbacks only | slot-picker modal, agenda-merge conflict check, schedule display, persistence |
| Connections ("Connect") | ❌ | button + persistence |
| Smart nudge on Now | ❌ | pure derive on `NowView` |
| Message-from-radar | ❌ | Message button on `BlockerCard` |
| Devpost link on deadline checklist | ❌ | persisted link field |

Note: `main`'s "AI" called `https://api.anthropic.com/v1/messages` directly from the browser with no key — those calls always failed (CORS + no key) and fell back to local logic. So **`main` only ever ran on its local fallbacks in practice.** Keeping local fallbacks in the port is parity-faithful, not a downgrade. This also matches the rebuild's documented convention (`CLAUDE.md`, `docs/ROADMAP.md`: AI on local fallbacks, no token spend; `api/claude.js` is a keyless stub).

## Decisions (locked with the user)

1. **AI runtime: local fallbacks only.** No network calls, no key, no token spend. `api/claude.js` stays a stub. (Real Claude wiring remains a deferred ROADMAP item.)
2. **Persistence: Supabase-backed** for catchups, chats, and connections (not ephemeral). Counterparty is modeled as a mock-attendee `person_id` (text); there is **no FK to `auth.users`** for the other party because attendees are mock/seed data. Owner is the signed-in user; RLS scopes every row to `auth.uid()`.
3. **Copilot home: repurpose `/clawbie`** into the live "Ask" assistant (drop the placeholder, wire the existing `localAnswer`).

## Architecture & integration principle

Follow the rebuild's existing seams — invent no new patterns:

- **Pure logic** → `lib/`, unit-tested with Vitest, mirroring `lib/ai/local-fallbacks.ts`, `lib/match.ts`, `lib/schedule.ts`.
- **Persistence** → one Supabase-backed hook per feature, copying the `lib/hooks/useSavedSchedule.ts` shape: load on mount for the signed-in user, optimistic local update, revert-on-error, RLS-scoped.
- **AI** → local fallbacks only (decision 1). Add the two missing fallback fns; no network.
- **UI** → App Router pages for full views; global modals mounted in `components/shell/AppShell.tsx` for chat/scheduling; built from `components/ui/*` primitives and `lib/design/tokens.ts`.
- **Counterparty** → catchups/chats/connections reference a mock attendee by `person_id` (text). Owner = signed-in user.

## Data model — new migration `db/migrations/005_social.sql`

Idempotent, in the style of `001`–`004`. RLS enabled; policies allow select/insert/delete only where `user_id = auth.uid()`. No Realtime (private to the user; the chat counterpart is a local roleplay bot).

| Table | Shape | RLS |
|---|---|---|
| `connections` | `(user_id uuid, person_id text)` PK, `created_at` | own rows only |
| `catchups` | `id uuid pk`, `user_id uuid`, `person_id text`, `day int`, `start_min int`, `end_min int`, `created_at` | own only |
| `chat_messages` | `id uuid pk`, `user_id uuid`, `person_id text`, `sender text check in ('me','them')`, `body text`, `created_at` | own only |
| `submissions` | `user_id uuid pk`, `devpost_url text`, `updated_at` | own only |

`user_id` defaults to `auth.uid()` / FKs to `auth.users(id)` on delete cascade (owner side only). `db/seed.sql` unchanged (no seed required).

## Feature port spec

### Pitch Coach — `/pitch` (Line mode)
- New route `app/pitch/page.tsx` + `components/pitch/PitchCoach.tsx`.
- 3-minute countdown timer (start / pause / reset) + pitch textarea + feedback panel.
- `localPitchFeedback` ported to `lib/ai/local-fallbacks.ts` (word count → ~minutes at 130 wpm, structure checklist, likely judge questions), unit-tested.
- Add to `components/shell/Nav.tsx` Line items. (A "Pitching Your Agent in 3 Minutes" session already exists in mock data.)

### "Ask" assistant — repurpose `/clawbie`
- Replace `components/clawbie/ClawbiePlaceholder.tsx` usage with a chat view wiring the existing `localAnswer`.
- Context built from `useEventData` (sessions/attendees/days/venues) + saved schedule + catchups + profile, matching `LocalAnswerCtx`.
- Quick-prompt chips ("What's happening right now?", "Plan my free time", "Who should I meet?", "Best path to Demo Day?").
- Chat is transient UI state (not persisted) — it is a stateless Q&A over current data, as in `main`.

### 1:1 chat — global `ChatModal`
- `components/people/ChatModal.tsx`, mounted once in `AppShell`, opened from People cards and Radar blocker cards.
- Uses `localChatReply` + `openingLine` (port `openingLine` to `lib/ai/local-fallbacks.ts`).
- Persists transcript via new `lib/hooks/useChat.ts` → `chat_messages` (load history for `person_id`, append on send/reply).

### Catchup scheduling
- `components/people/ScheduleCatchupModal.tsx`: 15-minute slot picker across event days.
- Conflict check against saved sessions **and** existing catchups via a new agenda-merge helper in `lib/schedule.ts` (pure, unit-tested) — port of `getAgendaItems`.
- Persists via `lib/hooks/useCatchups.ts` → `catchups`.
- Catchups render on `/schedule` alongside sessions (`components/schedule/CatchupCard.tsx`), with conflict flagging; `PersonCard` shows a "Booked" state when a catchup exists.

### People upgrades — `PersonCard` + `PeopleDirectory`
- `PersonCard` gains Connect / Message / Catchup buttons.
- `lib/hooks/useConnections.ts` → `connections`.
- **"Who should I meet?"** button: ranks attendees by `matchScore`, renders one-line match-reason badges from newly-ported `localReason` (`lib/ai/local-fallbacks.ts`), unit-tested.

### Smart nudge — `NowView`
- Pure derive: surface a soon-starting, tag-matching, not-yet-saved session as a nudge card with a one-tap add. No persistence.

### Message-from-radar — `BlockerCard`
- Add a Message button that opens the global `ChatModal`, shown only when the blocker's author maps to a known attendee.

### Devpost link — deadline checklist
- Add a persisted Devpost URL field on the Deadline Guardian view. `checklist_state` only stores booleans, so persist the URL in the new `submissions` table (`user_id` pk, `devpost_url`) via a small `useSubmission` hook in the `useSavedSchedule` shape (load on mount, upsert on change).

## AI fallback additions — `lib/ai/local-fallbacks.ts`
Port from `main` with Vitest coverage matching `tests/lib/ai.test.ts`:
- `localPitchFeedback(text)`
- `localReason(me, person)` (one-line "why meet them" grounded in shared tags/industries/goals)
- `openingLine(person)` (chat opener)

## Testing & verification
- Unit tests (Vitest) for every new pure fn: `localPitchFeedback`, `localReason`, `openingLine`, agenda-merge conflict.
- `npm run build` and `npm run test` green.
- Live pass against a Supabase project: login → schedule a catchup → observe a conflict → chat with an attendee (persists across refresh) → run Pitch Coach → ask the assistant → connect with someone (persists). **Requires a Supabase project + `.env.local`** (user to provide, or live-persistence check deferred to user; logic/build verified regardless).

## Cutover (mechanics delegated to the assistant)

**Recommended:** once `rebuild-v0` has all features ported and verified, merge it into `main` with `--allow-unrelated-histories`, resolving the tree wholesale to `rebuild-v0`, via a reviewable PR. Result: `main`'s tree becomes byte-identical to the finished `rebuild-v0` (old Vite `src/App.jsx` etc. removed), while both histories stay reachable under one merge commit — nothing lost, fully reviewable. Verify `git diff main rebuild-v0` is empty before finalizing.

**Alternative (not recommended):** `git branch -f main rebuild-v0` — cleaner graph but drops `main`'s 3-commit history from the branch tip (recoverable only via reflog).

No push/merge without explicit user go-ahead (repo convention: commit/push only when asked).

## Build order (decomposed; each slice independently shippable & verifiable)
1. Port missing fallbacks (`localPitchFeedback`, `localReason`, `openingLine`) + tests. No UI risk.
2. Migration `005_social.sql` + persistence hooks (`useConnections`, `useCatchups`, `useChat`, `useSubmission`).
3. Pitch Coach (`/pitch`) — self-contained.
4. People upgrades (connect/message/catchup + who-should-I-meet) + `ChatModal` + `ScheduleCatchupModal` + agenda-merge.
5. Schedule-view catchups + Now nudge + radar message button + Devpost link.
6. Repurpose `/clawbie` → live assistant.
7. Full verification pass → cutover PR.

## Out of scope
- Wiring real Claude / funding `api/claude.js` (deferred ROADMAP item).
- Organizer mode, live event calendar, OAuth/SMTP setup (ROADMAP items unrelated to this parity restore).
- Realtime on the new social tables (private per-user data).
