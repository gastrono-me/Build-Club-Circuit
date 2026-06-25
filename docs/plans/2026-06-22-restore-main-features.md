# Restore main's Features into rebuild-v0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the features that the Next.js + Supabase rebuild (`rebuild-v0`) dropped from the original Vite prototype (`main`) — Pitch Coach, a live "Ask" assistant, 1:1 chat, catchup scheduling, connections, "who should I meet?", a Now nudge, message-from-radar, and a Devpost link — then make `main` canonical.

**Architecture:** Follow the rebuild's existing seams. Pure logic → `lib/` (Vitest). Persistence → Supabase-backed hooks copying the `useSavedSchedule.ts` shape (optimistic + revert, RLS-scoped to `auth.uid()`). AI → local fallbacks only, no network. Social state (connections/catchups/chat/modals) lives in one `SocialProvider` context mounted in `AppShell`; UI is built from `components/ui/*` primitives and `lib/design/tokens.ts`. Catchups/chats/connections reference a mock attendee by `person_id` (text); owner is the signed-in user.

**Tech Stack:** Next.js 14 (App Router, TypeScript), React, Supabase (Postgres + RLS), Vitest, lucide-react icons.

## Global Constraints

- **AI runtime: local fallbacks only.** No network calls, no API key. `api/claude.js` stays a stub. (Verbatim from spec decision 1.)
- **Persistence: Supabase-backed**, counterparty modeled as mock-attendee `person_id` (text); **no FK to `auth.users` for the other party**. RLS scopes every row to `auth.uid()`. (Spec decision 2.)
- **Copilot lives at `/clawbie`** (repurpose the placeholder). (Spec decision 3.)
- **Plain, factual copy. No em-dashes in user-facing strings.** (`CLAUDE.md`.)
- **The whole look tunes from `lib/design/tokens.ts`.** Build UI only from `components/ui/*` + `components/shell/*` primitives; never hardcode hex outside tokens.
- **The event clock is a user-controlled simulation** (`useSimClock()` → `{ day, mins, setDay, setMins }`). Do not use real time.
- **Profile uses `skills`, not `tags`.** For `matchScore`/fallbacks, map a `Profile` to `PersonLike` as `{ tags: profile.skills, industries: profile.industries, looking: profile.looking }`.
- **`createClient()`** from `@/lib/supabase/client` is called *inside* hooks/components, never at module top level.
- **Commit/push only when asked.** This branch is `rebuild-v0`. The cutover (Task 9) is gated on explicit user go-ahead.
- **Verification:** `npm run test` and `npm run build` must pass at every commit boundary. Live Supabase verification (Task 8) needs a project + `.env.local`.

---

## File Structure

**Create:**
- `db/migrations/005_social.sql` — connections, catchups, chat_messages, submissions tables + RLS.
- `lib/hooks/useConnections.ts` / `useCatchups.ts` / `useChat.ts` / `useSubmission.ts` — Supabase-backed state.
- `components/shell/SocialProvider.tsx` — context owning connections/catchups/chat + the two global modals; exposes `useSocial()`.
- `components/people/ChatModal.tsx` — 1:1 chat UI (local roleplay bot).
- `components/people/ScheduleCatchupModal.tsx` — 15-min slot picker with live conflict check.
- `components/pitch/PitchCoach.tsx` + `app/pitch/page.tsx` — Pitch Coach view + route.
- `components/clawbie/ClawbieChat.tsx` — live assistant chat (wires `localAnswer`).
- `components/deadline/DevpostLink.tsx` — persisted Devpost URL field.

**Modify:**
- `lib/ai/local-fallbacks.ts` — add `localPitchFeedback`, `localReason`, `openingLine`.
- `lib/schedule.ts` — add `buildAgenda` (merge sessions + catchups into `AgendaItem[]`).
- `tests/lib/ai.test.ts`, `tests/lib/schedule.test.ts` — new cases.
- `lib/mode.ts` (create) + `components/shell/Nav.tsx` + `components/shell/ModeToggle.tsx` — extract `deriveMode`, add `/pitch` Line item.
- `components/shell/AppShell.tsx` — wrap children in `SocialProvider`.
- `components/people/PersonCard.tsx` — wire Connect/Message/Catchup + match-reason badge.
- `components/people/PeopleDirectory.tsx` — "Who should I meet?" control; pass reasons to cards.
- `components/now/NowView.tsx` — smart nudge card.
- `components/schedule/ScheduleView.tsx` — render catchups alongside sessions.
- `components/radar/BlockerCard.tsx` — Message button → chat.
- `app/clawbie/page.tsx` — render `ClawbieChat`.
- `components/deadline/Checklist.tsx` or `app/deadline/page.tsx` — mount `DevpostLink`.

**Shared contracts (defined in Task 2/3, consumed later):**
```ts
// ChatPerson — minimal shape both modals + provider use
export interface ChatPerson {
  id: string
  name: string
  occupation?: string
  org?: string
  tags?: string[]
  industries?: string[]
  looking?: string[]
  bio?: string
  avatar?: string | null
}
// useSocial() context API
interface SocialApi {
  connections: Set<string>
  toggleConnection: (personId: string) => void
  catchups: CatchupRow[]
  openChat: (p: ChatPerson) => void
  openCatchup: (p: ChatPerson) => void
}
// CatchupRow (from useCatchups)
export interface CatchupRow { id: string; person_id: string; day: number; start_min: number; end_min: number }
```

---

## Task 1: Port the missing AI fallbacks (pure logic + tests)

**Files:**
- Modify: `lib/ai/local-fallbacks.ts`
- Test: `tests/lib/ai.test.ts`

**Interfaces:**
- Produces: `localPitchFeedback(text: string): string`, `localReason(me: PersonLike, person: PersonLike & { looking?: string[] }): string`, `openingLine(person: { name: string; tags?: string[]; looking?: string[] }): string`. `LOOKING_PAIRS` is needed by `localReason` — import it (see Step 3).

- [ ] **Step 1: Write failing tests**

Append to `tests/lib/ai.test.ts`:
```ts
import { localPitchFeedback, localReason, openingLine } from '@/lib/ai/local-fallbacks'

describe('localPitchFeedback', () => {
  it('reports an approximate spoken duration from word count', () => {
    const text = Array.from({ length: 130 }, () => 'word').join(' ')
    const out = localPitchFeedback(text)
    expect(out).toContain('130 words')
    expect(out).toContain('1.0 minutes')
  })
  it('always includes the structure reminder and judge questions', () => {
    const out = localPitchFeedback('short pitch')
    expect(out).toContain('the problem in one sentence')
    expect(out).toContain('Likely judge questions')
  })
})

describe('localReason', () => {
  it('names a shared tag when interests overlap', () => {
    const me = { tags: ['Agents', 'RAG'], industries: [], looking: ['Teammate'] }
    const p = { tags: ['Agents'], industries: [], looking: ['Teammate'] }
    expect(localReason(me, p)).toContain('Agents')
  })
  it('falls back to a generic line when there is no overlap', () => {
    const me = { tags: ['Mobile'], industries: [], looking: [] }
    const p = { tags: ['Backend'], industries: [], looking: [] }
    expect(localReason(me, p).length).toBeGreaterThan(0)
  })
})

describe('openingLine', () => {
  it('returns a non-empty opener mentioning the first tag when present', () => {
    const line = openingLine({ name: 'Mai Tran', tags: ['Frontend'], looking: ['Teammate'] })
    expect(line.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/lib/ai.test.ts`
Expected: FAIL — `localPitchFeedback`/`localReason`/`openingLine` are not exported.

- [ ] **Step 3: Implement the three functions**

`lib/match.ts` does not export `LOOKING_PAIRS`. Add an export there first — change `const LOOKING_PAIRS` (line 1) to `export const LOOKING_PAIRS`. Then append to `lib/ai/local-fallbacks.ts`:
```ts
import { matchScore, LOOKING_PAIRS, type PersonLike } from '@/lib/match'

/** Heuristic 3-minute pitch feedback. Ported from main App.jsx:208-212. */
export function localPitchFeedback(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const minutes = (words / 130).toFixed(1)
  return `Roughly ${words} words. At a natural speaking pace that is about ${minutes} minutes aloud (target is 3).\n\nMake sure you hit, in order: the problem in one sentence, who actually has it, what you built, and a moment that shows it working live.\n\nLikely judge questions: "What happens when the AI call fails?" and "Why does this need AI at all, versus a simple form or lookup?"`
}

/** One-line "why meet them". Ported from main App.jsx:165-177. */
export function localReason(
  me: PersonLike,
  person: PersonLike & { looking?: string[] }
): string {
  const { shared, sharedIndustries } = matchScore(me, person)
  const bits: string[] = []
  if (shared.length) bits.push(`shares your interest in ${shared.slice(0, 2).join(' & ')}`)
  if (sharedIndustries.length) bits.push(`is also building in ${sharedIndustries[0]}`)
  const myLooking = me.looking ?? []
  const complementary = myLooking.some((l) =>
    (LOOKING_PAIRS[l] ?? []).some((x) => (person.looking ?? []).includes(x))
  )
  if (complementary && (person.looking ?? []).length) {
    bits.push(`is looking for a ${person.looking![0].toLowerCase()}`)
  }
  if (bits.length) return bits.join(' and ') + '.'
  return (person.looking ?? []).length
    ? `Looking for ${person.looking!.join('/').toLowerCase()}. Could be a complementary fit.`
    : 'Worth a hello. Overlapping circles at the event.'
}

/** Deterministic chat opener. Ported from main App.jsx:240-247. */
export function openingLine(person: { name: string; tags?: string[]; looking?: string[] }): string {
  const tag = (person.tags ?? [])[0]
  const lines = [
    tag ? `Hey! Saw we're both into ${tag}. Excited to connect at AABW.` : `Hey! Excited to connect at AABW.`,
    `Hi there! Looking forward to building this week. What are you working on?`,
    (person.looking ?? [])[0]
      ? `Hey! I'm looking for a ${person.looking![0].toLowerCase()}. What's your project idea?`
      : `Hey! I'm around all week. What's your project idea?`,
  ]
  return lines[person.name.length % lines.length]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/lib/ai.test.ts`
Expected: PASS (existing cases + 5 new ones).

- [ ] **Step 5: Commit**
```bash
git add lib/ai/local-fallbacks.ts lib/match.ts tests/lib/ai.test.ts
git commit -m "feat: port localPitchFeedback, localReason, openingLine fallbacks"
```

---

## Task 2: Agenda-merge helper (pure logic + tests)

**Files:**
- Modify: `lib/schedule.ts`
- Test: `tests/lib/schedule.test.ts`

**Interfaces:**
- Consumes: existing `overlaps`, `conflictIds`, `ScheduleItem` from `lib/schedule.ts`.
- Produces: `interface AgendaItem extends ScheduleItem { title: string; kind: 'session' | 'catchup' }` and `buildAgenda(sessions: AgendaItem[], catchups: { id: string; person_id: string; day: number; start_min: number; end_min: number }[], nameFor: (personId: string) => string, excludeCatchupId?: string): AgendaItem[]`.

- [ ] **Step 1: Write failing test**

Append to `tests/lib/schedule.test.ts`:
```ts
import { buildAgenda } from '@/lib/schedule'

describe('buildAgenda', () => {
  const sessions = [{ id: 's1', day: 1, start: 600, end: 660, title: 'Talk', kind: 'session' as const }]
  const catchups = [{ id: 'c1', person_id: 'a1', day: 1, start_min: 630, end_min: 645 }]

  it('merges sessions and catchups into one titled list', () => {
    const out = buildAgenda(sessions, catchups, () => 'Mai Tran')
    expect(out).toHaveLength(2)
    expect(out.find(i => i.kind === 'catchup')?.title).toBe('Catchup with Mai Tran')
    expect(out.find(i => i.kind === 'catchup')?.start).toBe(630)
  })

  it('excludes the catchup being edited', () => {
    const out = buildAgenda(sessions, catchups, () => 'Mai Tran', 'c1')
    expect(out.filter(i => i.kind === 'catchup')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/schedule.test.ts`
Expected: FAIL — `buildAgenda` not exported.

- [ ] **Step 3: Implement**

Append to `lib/schedule.ts`:
```ts
export interface AgendaItem extends ScheduleItem {
  title: string
  kind: 'session' | 'catchup'
}

/**
 * Merge saved sessions and 1:1 catchups into a single titled agenda for
 * conflict checks. Catchups expose start_min/end_min; map them to start/end.
 * Ported from main App.jsx:264-273.
 */
export function buildAgenda(
  sessions: AgendaItem[],
  catchups: { id: string; person_id: string; day: number; start_min: number; end_min: number }[],
  nameFor: (personId: string) => string,
  excludeCatchupId?: string
): AgendaItem[] {
  const catchupItems: AgendaItem[] = catchups
    .filter((c) => c.id !== excludeCatchupId)
    .map((c) => ({
      id: c.id,
      day: c.day,
      start: c.start_min,
      end: c.end_min,
      title: `Catchup with ${nameFor(c.person_id)}`,
      kind: 'catchup',
    }))
  return [...sessions, ...catchupItems]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/schedule.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/schedule.ts tests/lib/schedule.test.ts
git commit -m "feat: add buildAgenda for session+catchup conflict checks"
```

---

## Task 3: Migration 005 + persistence hooks

**Files:**
- Create: `db/migrations/005_social.sql`, `lib/hooks/useConnections.ts`, `lib/hooks/useCatchups.ts`, `lib/hooks/useChat.ts`, `lib/hooks/useSubmission.ts`

**Interfaces:**
- Produces:
  - `useConnections(): { connections: Set<string>; toggle: (personId: string) => void; loading: boolean }`
  - `useCatchups(): { catchups: CatchupRow[]; add: (personId: string, day: number, startMin: number) => void; cancel: (catchupId: string) => void; loading: boolean }` where `CatchupRow = { id: string; person_id: string; day: number; start_min: number; end_min: number }`
  - `useChat(personId: string | null): { thread: ChatMsg[]; append: (m: ChatMsg) => Promise<void>; loading: boolean }` where `ChatMsg = { sender: 'me' | 'them'; body: string }`
  - `useSubmission(): { devpostUrl: string; save: (url: string) => void; loading: boolean }`

- [ ] **Step 1: Write the migration**

Create `db/migrations/005_social.sql`:
```sql
-- 005 social: connections, 1:1 catchups, 1:1 chat transcripts, submission link.
-- person_id is a free-text mock-attendee id (no FK to auth.users for the other party).
create table if not exists public.connections (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  person_id  text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, person_id)
);

create table if not exists public.catchups (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  person_id  text not null,
  day        int  not null,
  start_min  int  not null,
  end_min    int  not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  person_id  text not null,
  sender     text not null check (sender in ('me','them')),
  body       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  devpost_url text,
  updated_at  timestamptz not null default now()
);

alter table public.connections  enable row level security;
alter table public.catchups      enable row level security;
alter table public.chat_messages enable row level security;
alter table public.submissions   enable row level security;

drop policy if exists connections_all_own on public.connections;
create policy connections_all_own on public.connections
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists catchups_all_own on public.catchups;
create policy catchups_all_own on public.catchups
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists chat_messages_all_own on public.chat_messages;
create policy chat_messages_all_own on public.chat_messages
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists submissions_all_own on public.submissions;
create policy submissions_all_own on public.submissions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists chat_messages_user_person_idx on public.chat_messages (user_id, person_id, created_at);
create index if not exists catchups_user_idx on public.catchups (user_id);
```

- [ ] **Step 2: Implement `useConnections.ts`** (copy `useSavedSchedule.ts` shape)

Create `lib/hooks/useConnections.ts`:
```ts
"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export function useConnections() {
  const [connections, setConnections] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data, error } = await supabase
        .from("connections").select("person_id").eq("user_id", user.id)
      if (error) console.error("[useConnections] fetch error:", error)
      if (data) setConnections(new Set(data.map((r: { person_id: string }) => r.person_id)))
      setLoading(false)
    }
    init()
  }, [])

  const toggle = useCallback((personId: string) => {
    if (!userId) return
    let had = false
    setConnections(prev => {
      had = prev.has(personId)
      const next = new Set(prev)
      had ? next.delete(personId) : next.add(personId)
      return next
    })
    const revert = () => setConnections(prev => {
      const next = new Set(prev)
      had ? next.add(personId) : next.delete(personId)
      return next
    })
    const supabase = createClient()
    if (had) {
      supabase.from("connections").delete()
        .match({ user_id: userId, person_id: personId })
        .then(({ error }) => { if (error) revert() })
    } else {
      supabase.from("connections").insert({ user_id: userId, person_id: personId })
        .then(({ error }) => { if (error) revert() })
    }
  }, [userId])

  return { connections, toggle, loading }
}
```

- [ ] **Step 3: Implement `useCatchups.ts`**

Create `lib/hooks/useCatchups.ts`:
```ts
"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export interface CatchupRow {
  id: string
  person_id: string
  day: number
  start_min: number
  end_min: number
}

export function useCatchups() {
  const [catchups, setCatchups] = useState<CatchupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data, error } = await supabase
        .from("catchups").select("id, person_id, day, start_min, end_min").eq("user_id", user.id)
      if (error) console.error("[useCatchups] fetch error:", error)
      if (data) setCatchups(data as CatchupRow[])
      setLoading(false)
    }
    init()
  }, [])

  // One catchup per person: replace any existing one for that person.
  const add = useCallback((personId: string, day: number, startMin: number) => {
    if (!userId) return
    const endMin = startMin + 15
    const supabase = createClient()
    // Remove existing for this person locally + remotely, then insert.
    setCatchups(prev => prev.filter(c => c.person_id !== personId))
    supabase.from("catchups").delete().match({ user_id: userId, person_id: personId })
      .then(() =>
        supabase.from("catchups")
          .insert({ user_id: userId, person_id: personId, day, start_min: startMin, end_min: endMin })
          .select("id, person_id, day, start_min, end_min").single()
          .then(({ data, error }) => {
            if (error || !data) { console.error("[useCatchups] add error:", error); return }
            setCatchups(prev => [...prev.filter(c => c.person_id !== personId), data as CatchupRow])
          })
      )
  }, [userId])

  const cancel = useCallback((catchupId: string) => {
    if (!userId) return
    let removed: CatchupRow | undefined
    setCatchups(prev => {
      removed = prev.find(c => c.id === catchupId)
      return prev.filter(c => c.id !== catchupId)
    })
    createClient().from("catchups").delete().match({ user_id: userId, id: catchupId })
      .then(({ error }) => { if (error && removed) setCatchups(prev => [...prev, removed!]) })
  }, [userId])

  return { catchups, add, cancel, loading }
}
```

- [ ] **Step 4: Implement `useChat.ts`**

Create `lib/hooks/useChat.ts`:
```ts
"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export interface ChatMsg { sender: "me" | "them"; body: string }

export function useChat(personId: string | null) {
  const [thread, setThread] = useState<ChatMsg[]>([])
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!personId) { setThread([]); return }
    let cancelled = false
    setLoading(true)
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      if (!cancelled) setUserId(user.id)
      const { data, error } = await supabase
        .from("chat_messages").select("sender, body")
        .eq("user_id", user.id).eq("person_id", personId)
        .order("created_at", { ascending: true })
      if (cancelled) return
      if (error) console.error("[useChat] fetch error:", error)
      setThread((data as ChatMsg[]) ?? [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [personId])

  const append = useCallback(async (m: ChatMsg) => {
    if (!userId || !personId) return
    setThread(prev => [...prev, m])
    const { error } = await createClient()
      .from("chat_messages")
      .insert({ user_id: userId, person_id: personId, sender: m.sender, body: m.body })
    if (error) console.error("[useChat] insert error:", error)
  }, [userId, personId])

  return { thread, append, loading }
}
```

- [ ] **Step 5: Implement `useSubmission.ts`**

Create `lib/hooks/useSubmission.ts`:
```ts
"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export function useSubmission() {
  const [devpostUrl, setDevpostUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data } = await supabase
        .from("submissions").select("devpost_url").eq("user_id", user.id).maybeSingle()
      if (data?.devpost_url) setDevpostUrl(data.devpost_url)
      setLoading(false)
    }
    init()
  }, [])

  const save = useCallback((url: string) => {
    setDevpostUrl(url)
    if (!userId) return
    createClient().from("submissions")
      .upsert({ user_id: userId, devpost_url: url, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .then(({ error }) => { if (error) console.error("[useSubmission] save error:", error) })
  }, [userId])

  return { devpostUrl, save, loading }
}
```

- [ ] **Step 6: Verify build (no test for hooks; they need Supabase)**

Run: `npm run build`
Expected: compiles clean (types check). The hooks are not yet imported anywhere; that is fine.

- [ ] **Step 7: Commit**
```bash
git add db/migrations/005_social.sql lib/hooks/useConnections.ts lib/hooks/useCatchups.ts lib/hooks/useChat.ts lib/hooks/useSubmission.ts
git commit -m "feat: add 005 social migration + connections/catchups/chat/submission hooks"
```

---

## Task 4: Pitch Coach (self-contained route)

**Files:**
- Create: `components/pitch/PitchCoach.tsx`, `app/pitch/page.tsx`, `lib/mode.ts`
- Modify: `components/shell/Nav.tsx`, `components/shell/ModeToggle.tsx`

**Interfaces:**
- Consumes: `localPitchFeedback` (Task 1), `SectionTitle`, `Button`, tokens.
- Produces: `deriveMode(pathname: string): "pulse" | "line"` exported from `lib/mode.ts`; route `/pitch`.

- [ ] **Step 1: Extract `deriveMode` to `lib/mode.ts`**

Create `lib/mode.ts`:
```ts
/** Pulse vs Line is derived from the route. Line = build-focus pages. */
export function deriveMode(pathname: string): "pulse" | "line" {
  return pathname === "/deadline" || pathname === "/radar" || pathname === "/pitch"
    ? "line"
    : "pulse"
}
```
In `components/shell/Nav.tsx`: delete the local `deriveMode` (lines 19-21) and add `import { deriveMode } from "@/lib/mode"`. In `components/shell/ModeToggle.tsx`: delete its local `deriveMode` (lines 7-9) and add the same import. (Resolves the duplication flagged in ROADMAP.)

- [ ] **Step 2: Add the Pitch nav item**

In `components/shell/Nav.tsx`, import `Mic` from `lucide-react` (add to the existing lucide import), and append to `LINE_ITEMS` (after the Bottleneck Radar entry, line 40):
```ts
  { label: "Pitch Coach", href: "/pitch", Icon: Mic },
```

- [ ] **Step 3: Implement `PitchCoach.tsx`**

Create `components/pitch/PitchCoach.tsx`:
```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Loader2 } from "lucide-react"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Button } from "@/components/ui/Button"
import { localPitchFeedback } from "@/lib/ai/local-fallbacks"
import { colors, radii, fonts, fontSize, fontWeight, spacing } from "@/lib/design/tokens"

export function PitchCoach() {
  const [pitch, setPitch] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(180)
  const [running, setRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => { if (t <= 1) { setRunning(false); return 0 } return t - 1 })
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running])

  function reset() { setRunning(false); setTimeLeft(180) }

  function getFeedback() {
    if (!pitch.trim()) return
    setLoading(true)
    setFeedback(null)
    // Local fallback only (no token spend, by design).
    setFeedback(localPitchFeedback(pitch))
    setLoading(false)
  }

  const mm = Math.floor(timeLeft / 60)
  const ss = String(timeLeft % 60).padStart(2, "0")

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: spacing[4] }}>
      <SectionTitle kicker="Line · lock in" title="Pitch Coach"
        note="Three minutes, judged on the same rubric the real judges use. Practice it, then get torn apart before they do." />

      <div style={{ background: colors.ink, color: colors.onDark, borderRadius: radii["2xl"], padding: 20, marginBottom: spacing[5], display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.06em", opacity: 0.8 }}>PRACTICE TIMER</div>
          <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.bold, fontSize: 34, marginTop: 4 }}>{mm}:{ss}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="accent" onClick={() => setRunning(r => !r)}>{running ? "Pause" : "Start"}</Button>
          <Button variant="secondary" onClick={reset} style={{ color: colors.onDark, borderColor: colors.onDark }}>Reset</Button>
        </div>
      </div>

      <div style={{ background: colors.surface, border: `1.5px solid ${colors.line}`, borderRadius: radii["2xl"], padding: 18 }}>
        <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, marginBottom: 6, display: "flex", alignItems: "center", gap: 7, color: colors.ink }}>
          <Mic size={16} /> Your pitch
        </div>
        <textarea value={pitch} onChange={e => setPitch(e.target.value)} rows={7}
          placeholder="Paste your pitch script or talking points"
          style={{ width: "100%", border: `1.4px solid ${colors.line}`, borderRadius: radii.md, padding: "10px 12px", fontSize: fontSize.body, outline: "none", resize: "vertical", fontFamily: fonts.body, color: colors.ink, background: colors.paper2 }} />
        <div style={{ marginTop: 10 }}>
          <Button variant="primary" onClick={getFeedback} disabled={loading || !pitch.trim()}
            icon={loading ? <Loader2 size={15} className="vec-spin" /> : undefined}>
            {loading ? "Judging" : "Get torn apart"}
          </Button>
        </div>
        {feedback && (
          <div style={{ marginTop: 14, background: colors.panel, borderRadius: radii.lg, padding: 14, fontSize: fontSize.body, lineHeight: 1.6, whiteSpace: "pre-wrap", color: colors.ink }}>
            {feedback}
          </div>
        )}
      </div>
    </div>
  )
}

export default PitchCoach
```
Note: if `colors.paper2`/`colors.panel`/`radii.lg` are absent in `tokens.ts`, substitute the nearest existing token (check `lib/design/tokens.ts` exports before writing — the Modal/Input files import `paper2`, `panel`, `radii.lg` so they exist).

- [ ] **Step 4: Implement the route**

Create `app/pitch/page.tsx`:
```tsx
import { PitchCoach } from "@/components/pitch/PitchCoach"

export default function PitchPage() {
  return <PitchCoach />
}
```

- [ ] **Step 5: Verify build + manual smoke**

Run: `npm run build`
Expected: compiles. `/pitch` route present in the build output route list. Then `npm run dev`, visit `http://127.0.0.1:3000/pitch`: timer starts/pauses/resets; pasting text + "Get torn apart" shows feedback. Nav shows "Pitch Coach" under Line mode.

- [ ] **Step 6: Commit**
```bash
git add lib/mode.ts components/shell/Nav.tsx components/shell/ModeToggle.tsx components/pitch/PitchCoach.tsx app/pitch/page.tsx
git commit -m "feat: add Pitch Coach (/pitch) and extract deriveMode to lib/mode"
```

---

## Task 5: SocialProvider + ChatModal + ScheduleCatchupModal

This task delivers the shared social context and both modals. It is the largest task; the two modals are only meaningfully testable together with the provider.

**Files:**
- Create: `components/shell/SocialProvider.tsx`, `components/people/ChatModal.tsx`, `components/people/ScheduleCatchupModal.tsx`
- Modify: `components/shell/AppShell.tsx`

**Interfaces:**
- Consumes: `useConnections`, `useCatchups`, `useChat`, `CatchupRow`, `ChatMsg` (Task 3); `buildAgenda`, `overlaps`, `AgendaItem` (Task 2); `localChatReply`, `openingLine` (Tasks 1 + existing); `useSavedSchedule`, `useEventData`, `useProfile`; `Avatar`, `Modal`/inline modal, tokens.
- Produces: `useSocial(): SocialApi` and `<SocialProvider>` (see Shared contracts). `ChatPerson` exported from `SocialProvider.tsx`.

- [ ] **Step 1: Implement `SocialProvider.tsx`**

Create `components/shell/SocialProvider.tsx`:
```tsx
"use client"

import React, { createContext, useContext, useState } from "react"
import { useConnections } from "@/lib/hooks/useConnections"
import { useCatchups, type CatchupRow } from "@/lib/hooks/useCatchups"
import { ChatModal } from "@/components/people/ChatModal"
import { ScheduleCatchupModal } from "@/components/people/ScheduleCatchupModal"

export interface ChatPerson {
  id: string
  name: string
  occupation?: string
  org?: string
  tags?: string[]
  industries?: string[]
  looking?: string[]
  bio?: string
  avatar?: string | null
}

interface SocialApi {
  connections: Set<string>
  toggleConnection: (personId: string) => void
  catchups: CatchupRow[]
  cancelCatchup: (catchupId: string) => void
  addCatchup: (personId: string, day: number, startMin: number) => void
  openChat: (p: ChatPerson) => void
  openCatchup: (p: ChatPerson) => void
}

const SocialContext = createContext<SocialApi | null>(null)

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const { connections, toggle: toggleConnection } = useConnections()
  const { catchups, add: addCatchup, cancel: cancelCatchup } = useCatchups()
  const [chatPerson, setChatPerson] = useState<ChatPerson | null>(null)
  const [catchupPerson, setCatchupPerson] = useState<ChatPerson | null>(null)

  const api: SocialApi = {
    connections,
    toggleConnection,
    catchups,
    cancelCatchup,
    addCatchup,
    openChat: (p) => setChatPerson(p),
    openCatchup: (p) => setCatchupPerson(p),
  }

  return (
    <SocialContext.Provider value={api}>
      {children}
      {chatPerson && (
        <ChatModal
          person={chatPerson}
          onClose={() => setChatPerson(null)}
          onOpenSchedule={() => { setCatchupPerson(chatPerson); setChatPerson(null) }}
        />
      )}
      {catchupPerson && (
        <ScheduleCatchupModal
          person={catchupPerson}
          onClose={() => setCatchupPerson(null)}
        />
      )}
    </SocialContext.Provider>
  )
}

export function useSocial(): SocialApi {
  const ctx = useContext(SocialContext)
  if (!ctx) throw new Error("useSocial must be used within a SocialProvider")
  return ctx
}
```

- [ ] **Step 2: Implement `ChatModal.tsx`** (ported from main App.jsx:1598-1659, persisted via `useChat`)

Create `components/people/ChatModal.tsx`:
```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { X, Send, CalendarDays, Loader2 } from "lucide-react"
import { Avatar } from "@/components/shell/Avatar"
import { useChat } from "@/lib/hooks/useChat"
import { useProfile } from "@/lib/hooks/useProfile"
import { localChatReply, openingLine } from "@/lib/ai/local-fallbacks"
import type { ChatPerson } from "@/components/shell/SocialProvider"
import { colors, radii, fonts, fontSize, fontWeight } from "@/lib/design/tokens"

export function ChatModal({
  person, onClose, onOpenSchedule,
}: { person: ChatPerson; onClose: () => void; onOpenSchedule: () => void }) {
  const { thread, append, loading } = useChat(person.id)
  const { profile } = useProfile()
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // Seed an opening line once if there is no prior history.
  useEffect(() => {
    if (loading || seeded) return
    setSeeded(true)
    if (thread.length === 0) append({ sender: "them", body: openingLine(person) })
  }, [loading, seeded, thread.length, person, append])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [thread, busy])

  async function submit() {
    const v = input.trim()
    if (!v || busy) return
    setInput("")
    await append({ sender: "me", body: v })
    setBusy(true)
    const me = profile
      ? { tags: profile.skills, industries: profile.industries, looking: profile.looking }
      : { tags: [], industries: [], looking: [] }
    const reply = localChatReply(me, person, v)
    await append({ sender: "them", body: reply })
    setBusy(false)
  }

  const firstName = person.name.split(" ")[0]

  return (
    <div onClick={onClose} role="presentation"
      style={{ position: "fixed", inset: 0, background: "rgba(20,20,60,0.45)", backdropFilter: "blur(2px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={`Chat with ${person.name}`} onClick={e => e.stopPropagation()}
        style={{ background: colors.surface, border: `1.5px solid ${colors.ink}`, borderRadius: radii["2xl"], width: "100%", maxWidth: 420, height: "min(560px, 82vh)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1.5px solid ${colors.ink}`, background: colors.panel, flexShrink: 0 }}>
          <Avatar name={person.name} photo={person.avatar} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, color: colors.ink }}>{person.name}</div>
            {(person.occupation || person.org) && (
              <div style={{ fontSize: fontSize.meta, color: colors.muted }}>{[person.occupation, person.org].filter(Boolean).join(" · ")}</div>
            )}
          </div>
          <button onClick={onOpenSchedule} title="Schedule a catchup" aria-label="Schedule a catchup"
            style={{ border: `1.4px solid ${colors.line}`, background: colors.surface, borderRadius: radii.sm, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: colors.ink, flexShrink: 0 }}>
            <CalendarDays size={16} />
          </button>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", cursor: "pointer", color: colors.muted, flexShrink: 0 }}><X size={19} /></button>
        </div>
        {/* messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {thread.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.sender === "me" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "78%", padding: "9px 13px", borderRadius: 13, fontSize: fontSize.body, lineHeight: 1.45, background: m.sender === "me" ? colors.violet : colors.surface, color: m.sender === "me" ? colors.onDark : colors.ink, border: m.sender === "me" ? "none" : `1.4px solid ${colors.line}` }}>{m.body}</div>
            </div>
          ))}
          {busy && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", color: colors.muted, fontSize: fontSize.meta }}>
              <Loader2 size={13} className="vec-spin" /> {firstName} is typing
            </div>
          )}
          <div ref={endRef} />
        </div>
        {/* input */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 12, borderTop: `1.4px solid ${colors.line}`, background: colors.panel, flexShrink: 0 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit() }}
            placeholder={`Message ${firstName}`}
            style={{ flex: 1, border: `1.4px solid ${colors.line}`, borderRadius: radii.md, padding: "9px 12px", fontSize: fontSize.body, outline: "none", background: colors.surface, color: colors.ink }} />
          <button onClick={submit} disabled={busy || !input.trim()}
            style={{ width: 36, height: 36, borderRadius: radii.md, border: "none", cursor: input.trim() ? "pointer" : "not-allowed", background: input.trim() ? colors.violet : colors.line, color: colors.onDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatModal
```

- [ ] **Step 3: Implement `ScheduleCatchupModal.tsx`** (ported from main App.jsx:1664-1730)

Create `components/people/ScheduleCatchupModal.tsx`:
```tsx
"use client"

import { useMemo, useState } from "react"
import { X, AlertTriangle, Check } from "lucide-react"
import { Avatar } from "@/components/shell/Avatar"
import { Tag } from "@/components/ui/Tag"
import { Button } from "@/components/ui/Button"
import { useSocial, type ChatPerson } from "@/components/shell/SocialProvider"
import { useSavedSchedule } from "@/lib/hooks/useSavedSchedule"
import { useEventData } from "@/lib/data/useEventData"
import { buildAgenda, overlaps, type AgendaItem } from "@/lib/schedule"
import { hm, fmt } from "@/lib/time"
import { colors, radii, fonts, fontSize, fontWeight } from "@/lib/design/tokens"

export function ScheduleCatchupModal({ person, onClose }: { person: ChatPerson; onClose: () => void }) {
  const { catchups, addCatchup, cancelCatchup } = useSocial()
  const { saved } = useSavedSchedule()
  const { sessions, days, attendees } = useEventData()

  const existing = catchups.find(c => c.person_id === person.id)
  const [day, setDay] = useState<number>(existing?.day ?? 1)
  const [start, setStart] = useState<number>(existing?.start_min ?? hm(11, 0))

  const TIMES = useMemo(() => {
    const arr: number[] = []
    for (let m = hm(8, 0); m <= hm(22, 45); m += 15) arr.push(m)
    return arr
  }, [])

  const nameFor = (id: string) => attendees.find(a => a.id === id)?.name ?? "someone"
  const savedItems: AgendaItem[] = sessions
    .filter(s => saved.has(s.id))
    .map(s => ({ id: s.id, day: s.day, start: s.start, end: s.end, title: s.title, kind: "session" as const }))
  const end = start + 15
  const agenda = buildAgenda(savedItems, catchups, nameFor, existing?.id).filter(it => it.day === day)
  const candidate = { id: "candidate", day, start, end }
  const conflicts = agenda.filter(it => overlaps(candidate, it))

  return (
    <div onClick={onClose} role="presentation"
      style={{ position: "fixed", inset: 0, background: "rgba(20,20,60,0.45)", backdropFilter: "blur(2px)", zIndex: 51, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={`Schedule a catchup with ${person.name}`} onClick={e => e.stopPropagation()}
        style={{ background: colors.surface, border: `1.5px solid ${colors.ink}`, borderRadius: radii["2xl"], padding: 26, maxWidth: 420, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Avatar name={person.name} photo={person.avatar} size={36} />
            <div>
              <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.violet, letterSpacing: "0.08em" }}>15-MIN CATCHUP</div>
              <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.bold, fontSize: 17, color: colors.ink }}>{person.name}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", cursor: "pointer", color: colors.muted }}><X size={19} /></button>
        </div>

        <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "18px 0 6px" }}>Day</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {days.map(d => <Tag key={d.idx} active={day === d.idx} onClick={() => setDay(d.idx)}>{d.date}</Tag>)}
        </div>

        <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "16px 0 6px" }}>Time</div>
        <select value={start} onChange={e => setStart(+e.target.value)}
          style={{ width: "100%", border: `1.4px solid ${colors.line}`, borderRadius: radii.md, padding: "10px 12px", fontSize: fontSize.body, background: colors.surface, color: colors.ink, outline: "none" }}>
          {TIMES.map(m => <option key={m} value={m}>{fmt(m)} – {fmt(m + 15)}</option>)}
        </select>

        <div style={{ marginTop: 16, borderRadius: radii.lg, padding: "12px 14px", fontSize: fontSize.meta, lineHeight: 1.5, background: conflicts.length ? colors.oxbloodSoft : colors.goSoft, color: conflicts.length ? colors.oxblood : colors.go, display: "flex", gap: 9 }}>
          {conflicts.length ? <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> : <Check size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
          <div>
            {conflicts.length
              ? `Overlaps with ${conflicts.map(c => `"${c.title}" (${fmt(c.start)}–${fmt(c.end)})`).join(" and ")}.`
              : "This slot is free on your schedule."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {existing && (
            <Button variant="danger" full onClick={() => { cancelCatchup(existing.id); onClose() }}>Cancel catchup</Button>
          )}
          <Button variant="primary" full onClick={() => { addCatchup(person.id, day, start); onClose() }}>
            {conflicts.length ? "Schedule anyway" : existing ? "Save changes" : "Schedule catchup"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ScheduleCatchupModal
```
Note on tokens: this uses `colors.oxbloodSoft` / `colors.goSoft` / `colors.go` / `colors.oxblood`. Before writing, confirm the soft variants exist in `lib/design/tokens.ts`; if a `*Soft` variant is missing, use the base color at reduced opacity via an `rgba(...)` derived from the token, or the nearest existing soft token. Do not invent a hex literal.

- [ ] **Step 4: Mount the provider in `AppShell.tsx`**

In `components/shell/AppShell.tsx`, import the provider and wrap the non-bare return. Replace lines 21-44 (`return ( <> ... </> )`) so that `<SocialProvider>` wraps `TopBar`/`Nav`/`main`:
```tsx
import { SocialProvider } from "@/components/shell/SocialProvider"
// ...
  return (
    <SocialProvider>
      <style>{/* unchanged */}</style>
      <TopBar />
      <Nav />
      <main className="vec-main">{children}</main>
    </SocialProvider>
  )
```
Keep the existing `<style>` block content exactly as-is. The bare-path early return (lines 17-19) is unchanged — login/callback do not get the provider.

- [ ] **Step 5: Add the spin animation class (once)**

`ChatModal`/`PitchCoach` use `className="vec-spin"`. Confirm `app/globals.css` has a `@keyframes` spin + `.vec-spin { animation: spin 1s linear infinite }`. If absent, add:
```css
@keyframes vec-spin { to { transform: rotate(360deg) } }
.vec-spin { animation: vec-spin 1s linear infinite }
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: compiles. Nothing opens the modals yet (wired in Task 6); the provider is mounted and inert.

- [ ] **Step 7: Commit**
```bash
git add components/shell/SocialProvider.tsx components/people/ChatModal.tsx components/people/ScheduleCatchupModal.tsx components/shell/AppShell.tsx app/globals.css
git commit -m "feat: SocialProvider context + ChatModal + ScheduleCatchupModal (mounted, inert)"
```

---

## Task 6: People upgrades — connect, message, catchup, who-should-I-meet

**Files:**
- Modify: `components/people/PersonCard.tsx`, `components/people/PeopleDirectory.tsx`

**Interfaces:**
- Consumes: `useSocial`, `ChatPerson` (Task 5); `localReason`, `matchScore`; `NormalizedPerson` (existing).
- Produces: `PersonCard` accepts an added optional prop `reason?: string`.

- [ ] **Step 1: Wire `PersonCard` buttons + reason badge**

In `components/people/PersonCard.tsx`:
1. Add imports: `import { useSocial } from "@/components/shell/SocialProvider"`, and `MessageCircle, CalendarDays, Handshake, Check, Sparkles` from `lucide-react`.
2. Extend props: `interface PersonCardProps { person: NormalizedPerson; me: Profile | null; reason?: string }` and destructure `reason`.
3. Inside the component, after `const { shared } = matchScore(...)` (line 49), add:
```tsx
  const { connections, toggleConnection, openChat, openCatchup, catchups } = useSocial()
  const connected = connections.has(person.id)
  const hasCatchup = catchups.some(c => c.person_id === person.id)
  const chatPerson = {
    id: person.id, name: person.name, occupation: person.occupation,
    tags: person.tags, industries: person.industries, looking: person.looking,
    bio: person.bio, avatar: person.avatar,
  }
```
4. Replace the match-reason area: after the "Shared overlap badge" block (line 142), add:
```tsx
      {reason && (
        <div style={{ background: colors.violetSoft, borderRadius: radii.md, padding: "8px 11px", marginBottom: spacing[2], fontSize: fontSize.meta, color: colors.violet, display: "flex", gap: 7 }}>
          <Sparkles size={14} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{reason}</span>
        </div>
      )}
```
(If `colors.violetSoft` is absent, use the nearest soft token; check tokens first.)
5. Replace the Action buttons block (lines 177-180) with:
```tsx
      <div style={{ display: "flex", gap: spacing[2] }}>
        <Button variant={connected ? "secondary" : "accent"} size="sm"
          icon={connected ? <Check size={14} /> : <Handshake size={14} />}
          onClick={() => toggleConnection(person.id)}>
          {connected ? "Connected" : "Connect"}
        </Button>
        <Button variant="secondary" size="sm" icon={<MessageCircle size={14} />}
          onClick={() => openChat(chatPerson)}>Message</Button>
        <Button variant={hasCatchup ? "secondary" : "secondary"} size="sm" icon={<CalendarDays size={14} />}
          onClick={() => openCatchup(chatPerson)}>{hasCatchup ? "Booked" : "Catchup"}</Button>
      </div>
```

- [ ] **Step 2: Add "Who should I meet?" to `PeopleDirectory`**

In `components/people/PeopleDirectory.tsx`:
1. Add imports: `import { useState } from "react"` (already present), `import { localReason } from "@/lib/ai/local-fallbacks"`, `import { matchScore } from "@/lib/match"`, `import { Sparkles, ArrowRight, Loader2 } from "lucide-react"`, `import { Button } from "@/components/ui/Button"`.
2. Add state near the other useState calls: `const [reasons, setReasons] = useState<Record<string, string> | null>(null)`.
3. Add the handler (uses the same `me`/profile mapping the cards use):
```tsx
  function findMatches() {
    const meForMatch = profile
      ? { tags: profile.skills, industries: profile.industries, looking: profile.looking }
      : { tags: [], industries: [], looking: [] }
    const ranked = [...filtered]
      .sort((a, b) => matchScore(meForMatch, b).score - matchScore(meForMatch, a).score)
      .slice(0, 6)
    const map: Record<string, string> = {}
    ranked.forEach(p => { map[p.id] = localReason(meForMatch, { tags: p.tags, industries: p.industries, looking: p.looking }) })
    setReasons(map)
  }
```
(Use whatever the existing variable for the filtered list is — the file calls it `filtered`. Use the existing `profile` from `useProfile()`; if the directory does not already read it, add `const { profile } = useProfile()`.)
4. Insert the CTA banner just above the filter rows (around line 143):
```tsx
      <div style={{ background: colors.ink, borderRadius: radii["2xl"], padding: 16, marginBottom: spacing[5], display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, color: colors.onDark }}>
          <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, display: "flex", alignItems: "center", gap: 8 }}><Sparkles size={17} /> Who should I meet?</div>
          <div style={{ fontSize: fontSize.meta, opacity: 0.8, marginTop: 3 }}>Match-picked intros based on your skills and what you are looking for.</div>
        </div>
        <Button variant="accent" icon={<ArrowRight size={15} />} onClick={findMatches}>Find my matches</Button>
      </div>
```
5. Pass the reason into each card (the grid map, ~line 256): `<PersonCard key={person.id} person={person} me={profile} reason={reasons?.[person.id]} />`.

- [ ] **Step 3: Verify build + manual smoke**

Run: `npm run build` then `npm run dev`. On `/people`: Connect toggles and persists across refresh; Message opens the chat modal (opener appears, replies come back, persists across refresh); Catchup opens the schedule modal and shows "Booked" after scheduling; "Find my matches" renders sparkle reason badges on the top cards.

- [ ] **Step 4: Commit**
```bash
git add components/people/PersonCard.tsx components/people/PeopleDirectory.tsx
git commit -m "feat: wire connect/message/catchup + who-should-I-meet on People"
```

---

## Task 7: Schedule catchups, Now nudge, radar message, Devpost link

**Files:**
- Modify: `components/schedule/ScheduleView.tsx`, `components/now/NowView.tsx`, `components/radar/BlockerCard.tsx`
- Create: `components/deadline/DevpostLink.tsx`; Modify `app/deadline/page.tsx`

**Interfaces:**
- Consumes: `useSocial`, `useSubmission` (Task 3), `useEventData`, `useSimClock`, tokens, `Avatar`, `Tag`, `Button`, `Input`, `fmt`.

- [ ] **Step 1: Render catchups in `ScheduleView`**

In `components/schedule/ScheduleView.tsx`:
1. Add `import { useSocial } from "@/components/shell/SocialProvider"` and read `const { catchups, cancelCatchup, openChat } = useSocial()` plus `const { attendees } = useEventData()` (extend the existing `useEventData()` destructure to include `attendees`).
2. After computing `savedSessions` (line 19), build catchup display rows grouped into the same `byDay` map. After the existing `byDay` population loop, add catchups:
```tsx
  // Merge catchups into the per-day groups as pseudo-items.
  for (const c of catchups) {
    if (!byDay.has(c.day)) byDay.set(c.day, [])
  }
```
3. Within each day group's render (after the `daySessions.map(...)` that renders `SessionCard`s, before the day `</div>`), render that day's catchups:
```tsx
              {catchups.filter(c => c.day === dayIdx).sort((a, b) => a.start_min - b.start_min).map(c => {
                const a = attendees.find(at => at.id === c.person_id)
                return (
                  <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "center", background: colors.surface, border: `1.5px solid ${colors.line}`, borderRadius: radii.xl, padding: 16, marginBottom: spacing[3] }}>
                    <Avatar name={a?.name ?? "Builder"} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.go, textTransform: "uppercase", letterSpacing: "0.06em" }}>1:1 Catchup</div>
                      <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, color: colors.ink }}>{a?.name ?? "Builder"}</div>
                      <div style={{ fontFamily: fonts.mono, fontSize: fontSize.meta, color: colors.ink, marginTop: 6 }}>{fmt(c.start_min)}–{fmt(c.end_min)}</div>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => cancelCatchup(c.id)}>Cancel</Button>
                  </div>
                )
              })}
```
4. Update the "empty schedule" guard: it should also consider catchups (only show the empty state when `savedSessions.length === 0 && catchups.length === 0`). Adjust the existing empty-state condition accordingly. (Confirm the exact variable; the file derives day indices from `byDay` — including catchup-only days now means the empty state must key off both arrays.)

Add any missing imports (`Avatar`, `Button`, `fmt`, `fonts`, `fontWeight`, `radii`, `spacing`).

- [ ] **Step 2: Add the smart nudge to `NowView`** (ported from main App.jsx:722-770)

In `components/now/NowView.tsx`:
1. Read the profile and saved schedule: add `import { useProfile } from "@/lib/hooks/useProfile"`, `import { useSavedSchedule } from "@/lib/hooks/useSavedSchedule"`, `import { Sparkles, Plus } from "lucide-react"`. Inside the component: `const { profile } = useProfile()` and `const { saved, toggle } = useSavedSchedule()`.
2. Compute the nudge (uses sim clock `{ day, mins }` already in scope as the day/mins values the view uses — match the existing names):
```tsx
  const mySkills = new Set(profile?.skills ?? [])
  const nudge = sessions
    .filter(s => s.day === day && s.start > mins && !saved.has(s.id) && s.tags.some(t => mySkills.has(t)))
    .sort((a, b) => a.start - b.start)[0]
```
(Use the existing variable names for the current day/mins in this file; the file already calls `useSimClock()` and `useEventData()`.)
3. Insert the nudge card between the "happening now" section and "up next" (around line 141):
```tsx
      {nudge && (
        <div style={{ background: colors.violet, color: colors.onDark, borderRadius: radii["2xl"], padding: 18, marginBottom: 24, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 38, height: 38, borderRadius: radii.md, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Sparkles size={20} /></div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, opacity: 0.8, letterSpacing: "0.06em" }}>MATCHES YOUR INTERESTS</div>
            <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, marginTop: 3 }}>{nudge.title}</div>
            <div style={{ fontSize: fontSize.meta, opacity: 0.9, marginTop: 2 }}>{fmt(nudge.start)} · {nudge.tags.filter(t => mySkills.has(t)).join(", ")}</div>
          </div>
          <button onClick={() => toggle(nudge.id)} style={{ background: colors.onDark, color: colors.violet, border: "none", borderRadius: radii.md, padding: "9px 14px", fontFamily: fonts.mono, fontWeight: fontWeight.semibold, fontSize: fontSize.meta, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Add to schedule</button>
        </div>
      )}
```

- [ ] **Step 3: Add a Message button to `BlockerCard`**

In `components/radar/BlockerCard.tsx`, add `import { useSocial } from "@/components/shell/SocialProvider"` and `import { MessageCircle } from "lucide-react"`. Read `const { openChat } = useSocial()`. After the existing "Talk" link block (line 202), add a Message button shown only when the blocker has a real author who is not the current user:
```tsx
      {blocker.author_id && !isOwn && (
        <button onClick={() => openChat({ id: blocker.author_id!, name: blocker.author_name ?? "Attendee", avatar: blocker.author_avatar })}
          title={`Message ${blocker.author_name ?? "attendee"}`} aria-label="Message author"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1.4px solid ${colors.line}`, background: colors.surface, color: colors.ink, borderRadius: radii.md, padding: "6px 10px", fontFamily: fonts.mono, fontSize: fontSize.label, cursor: "pointer" }}>
          <MessageCircle size={13} /> Message
        </button>
      )}
```
Note: radar authors are real users (uuid), so the roleplay reply has only a name to work with — `localChatReply` handles empty tags and returns a generic warm reply. This is the documented limitation (chat is always a local simulation, never real delivery), consistent with main.

- [ ] **Step 4: Implement `DevpostLink` + mount it**

Create `components/deadline/DevpostLink.tsx`:
```tsx
"use client"

import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { ExternalLink } from "lucide-react"
import { useSubmission } from "@/lib/hooks/useSubmission"
import { colors, fonts, fontSize, fontWeight, spacing } from "@/lib/design/tokens"

export function DevpostLink() {
  const { devpostUrl, save } = useSubmission()
  return (
    <Card>
      <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, color: colors.ink, marginBottom: spacing[2] }}>
        Your DevPost link
      </div>
      <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, marginBottom: spacing[3] }}>
        Keep it handy so you can jump straight to your submission.
      </div>
      <Input value={devpostUrl} onChange={e => save(e.target.value)} placeholder="https://devpost.com/software/your-project" />
      {devpostUrl && (
        <a href={devpostUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: spacing[3], color: colors.violet, fontFamily: fonts.mono, fontSize: fontSize.label, textDecoration: "none" }}>
          Open submission <ExternalLink size={12} />
        </a>
      )}
    </Card>
  )
}

export default DevpostLink
```
In `app/deadline/page.tsx`, import it and render `<DevpostLink />` between `<Checklist />` and `<ReadinessReview />` (after line 30).

- [ ] **Step 5: Verify build + manual smoke**

Run: `npm run build` then `npm run dev`. `/schedule` shows scheduled catchups under their day and Cancel removes them; `/` shows a nudge when an unsaved tag-matching session is upcoming, and Add moves it into the schedule; `/radar` shows a Message button on others' blockers that opens the chat; `/deadline` shows the DevPost field that persists across refresh.

- [ ] **Step 6: Commit**
```bash
git add components/schedule/ScheduleView.tsx components/now/NowView.tsx components/radar/BlockerCard.tsx components/deadline/DevpostLink.tsx app/deadline/page.tsx
git commit -m "feat: schedule catchups, Now nudge, radar message, DevPost link"
```

---

## Task 8: Repurpose /clawbie into the live assistant + full verification

**Files:**
- Create: `components/clawbie/ClawbieChat.tsx`
- Modify: `app/clawbie/page.tsx`

**Interfaces:**
- Consumes: `localAnswer` + `LocalAnswerCtx` (existing in `lib/ai/local-fallbacks.ts`), `useEventData`, `useSimClock`, `useSavedSchedule`, `useProfile`, `useSocial` (for catchups), tokens.

- [ ] **Step 1: Implement `ClawbieChat.tsx`**

Create `components/clawbie/ClawbieChat.tsx`:
```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Send, Loader2 } from "lucide-react"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Tag } from "@/components/ui/Tag"
import { localAnswer, type LocalAnswerCtx } from "@/lib/ai/local-fallbacks"
import { useEventData } from "@/lib/data/useEventData"
import { useSimClock } from "@/lib/hooks/useSimClock"
import { useSavedSchedule } from "@/lib/hooks/useSavedSchedule"
import { useProfile } from "@/lib/hooks/useProfile"
import { useSocial } from "@/components/shell/SocialProvider"
import { colors, radii, fonts, fontSize } from "@/lib/design/tokens"

interface Msg { role: "user" | "assistant"; text: string }

export function ClawbieChat() {
  const { sessions, attendees, days, venues } = useEventData()
  const { day, mins } = useSimClock()
  const { saved } = useSavedSchedule()
  const { profile } = useProfile()
  const { catchups } = useSocial()
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Hi there. I can see the full programme, the people here, and your schedule. Ask me what is on now, what to do with a free hour, or who to meet." },
  ])
  const [input, setInput] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs])

  const quick = ["What's happening right now?", "Plan my free time today", "Who should I meet?", "What's the best path to Demo Day?"]

  function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q) return
    setInput("")
    setMsgs(m => [...m, { role: "user", text: q }])
    const me = profile
      ? { tags: profile.skills, industries: profile.industries, looking: profile.looking }
      : { tags: [], industries: [], looking: [] }
    const ctx: LocalAnswerCtx = {
      attendees: attendees.map(a => ({ id: a.id, name: a.name, occupation: a.role, bio: a.bio, tags: a.tags, industries: a.industries, looking: a.looking })),
      sessions: sessions.map(s => ({ id: s.id, day: s.day, start: s.start, end: s.end, title: s.title, venue: s.venue, tags: s.tags })),
      days: days.map(d => ({ idx: d.idx, label: d.label, date: d.date })),
      venues,
      schedule: saved,
      catchups: catchups.map(c => ({ id: c.id, day: c.day, start: c.start_min, end: c.end_min, personId: c.person_id })),
      currentDay: day,
      currentMins: mins,
    }
    const answer = localAnswer(me, ctx, q)
    setMsgs(m => [...m, { role: "assistant", text: answer }])
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)", maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <SectionTitle kicker="Your event copilot" title="Ask Clawbie" />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 4 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "82%", padding: "11px 14px", borderRadius: 14, fontSize: fontSize.body, lineHeight: 1.5, background: m.role === "user" ? colors.ink : colors.surface, color: m.role === "user" ? colors.onDark : colors.ink, border: m.role === "user" ? "none" : `1.4px solid ${colors.line}` }}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "12px 0 10px" }}>
        {quick.map(q => <Tag key={q} onClick={() => send(q)}>{q}</Tag>)}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: colors.surface, border: `1.4px solid ${colors.line}`, borderRadius: 14, padding: "8px 8px 8px 14px" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send() }}
          placeholder="Ask about sessions, people, or your day"
          style={{ border: "none", outline: "none", flex: 1, fontSize: fontSize.body, background: "transparent", color: colors.ink }} />
        <button onClick={() => send()} disabled={!input.trim()}
          style={{ width: 38, height: 38, borderRadius: radii.md, border: "none", cursor: input.trim() ? "pointer" : "not-allowed", background: input.trim() ? colors.violet : colors.line, color: colors.onDark, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Send size={17} />
        </button>
      </div>
    </div>
  )
}

export default ClawbieChat
```

- [ ] **Step 2: Point the route at it**

Replace `app/clawbie/page.tsx` contents:
```tsx
import { ClawbieChat } from "@/components/clawbie/ClawbieChat"

export default function ClawbiePage() {
  return <ClawbieChat />
}
```
Leave `components/clawbie/ClawbiePlaceholder.tsx` in the tree (unused) so nothing else breaks; it can be deleted in a later cleanup.

- [ ] **Step 3: Full unit + build verification**

Run: `npm run test` (all suites) and `npm run build`.
Expected: all tests pass; build is clean. Fix any type errors before continuing.

- [ ] **Step 4: Live end-to-end verification (needs Supabase project + `.env.local`)**

Apply `db/migrations/005_social.sql` in the Supabase SQL editor (after `001`-`004` + `seed.sql`). Then `npm run dev` and, signed in:
1. `/people`: Connect someone → refresh → still connected. Find my matches → reason badges. Message → opener + reply → refresh → transcript persists. Catchup → schedule a slot.
2. `/schedule`: the catchup appears under its day; create a clashing slot in the modal → conflict warning; Cancel removes it.
3. `/` (Now): a nudge appears for an upcoming tag-matching unsaved session; Add moves it to the schedule.
4. `/radar`: Message on someone else's blocker opens chat.
5. `/pitch`: timer + feedback.
6. `/clawbie`: each quick prompt returns a grounded answer.
7. `/deadline`: DevPost link persists across refresh.

If no Supabase project is available, run Steps 3 (unit + build) and verify all non-persistent UI (`/pitch`, `/clawbie` answers, nudge render, modals open) against a signed-in dev session, and hand the persistence checks to the user. Record which checks were run vs deferred in the commit message.

- [ ] **Step 5: Commit**
```bash
git add components/clawbie/ClawbieChat.tsx app/clawbie/page.tsx
git commit -m "feat: live Ask Clawbie assistant wired to localAnswer"
```

---

## Task 9: Cutover — make `main` the finished rebuild (GATED on explicit user go-ahead)

**Do not run any of this without the user explicitly saying to proceed.** Pushing/merging is outward-facing and irreversible-ish.

**Files:** none (git operations only).

- [ ] **Step 1: Confirm `rebuild-v0` is complete and green**

Run: `npm run test && npm run build`
Expected: both pass on the current `rebuild-v0` tip. Working tree clean (`git status`).

- [ ] **Step 2: Create the merge into `main` (unrelated histories, take rebuild's tree)**
```bash
git checkout main
git merge --allow-unrelated-histories -X theirs rebuild-v0 -m "merge: adopt rebuild-v0 (Next.js + Supabase) as main, with main's features restored"
```
If git leaves any path from `main`'s old tree that `rebuild-v0` deleted (e.g. `src/App.jsx`, `index.html`, `vite.config.js`, `src/main.jsx`), remove them so `main`'s tree equals `rebuild-v0`'s:
```bash
git rm -f src/App.jsx src/main.jsx index.html vite.config.js 2>/dev/null || true
git commit --amend --no-edit
```

- [ ] **Step 3: Verify trees are identical**

Run: `git diff --stat main rebuild-v0`
Expected: **empty output** (zero differences). If not empty, `git checkout rebuild-v0 -- <path>` for each stray file, re-commit, and re-check until empty.

- [ ] **Step 4: Verify the app still builds on `main`**

Run: `npm run test && npm run build` (now on `main`)
Expected: both pass.

- [ ] **Step 5: Push (only if the user asks to push)**
```bash
git push origin main
```
State clearly to the user that `main`'s old Vite history remains reachable in the merge commit's second parent; nothing was discarded.

---

## Self-Review (completed by plan author)

- **Spec coverage:** Pitch Coach (T4), Ask assistant (T8), 1:1 chat (T5+T6), catchup scheduling (T2+T3+T5+T6+T7), connections (T3+T6), who-should-I-meet (T1+T6), smart nudge (T7), message-from-radar (T7), DevPost link (T3+T7), cutover (T9). All four migration tables (T3). AI-local-only, Supabase persistence, /clawbie repurpose constraints carried into Global Constraints. ✓
- **Placeholder scan:** No TBD/TODO; every code step shows full code. Token-name caveats (`*Soft`, `paper2`, `panel`, `radii.lg`) are explicit "verify against tokens.ts" notes, not vague hand-waves — they instruct checking a concrete file before substituting. ✓
- **Type consistency:** `CatchupRow` uses `start_min`/`end_min` everywhere; `buildAgenda` maps them to `start`/`end` for `ScheduleItem`. `ChatPerson` defined in `SocialProvider`, imported by both modals + cards. `useSocial` API (`openChat`, `openCatchup`, `toggleConnection`, `connections`, `catchups`, `cancelCatchup`, `addCatchup`) consistent across T5/T6/T7/T8. Profile→PersonLike mapping (`skills`→`tags`) stated once in Global Constraints and reused. ✓
- **Known follow-ups (out of scope, noted for the engineer):** `ClawbiePlaceholder.tsx` left orphaned (deletable later); radar chat has name-only persona fidelity for real-user authors.
