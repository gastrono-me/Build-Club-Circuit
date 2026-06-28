# Spotlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inclusive, day-rotated "Shipped today" recognition rail (faces strip + a rotating full-post spotlight) to the Today and event-detail pages, plus a per-post self-nomination opt-in that forms the consent pool for a future external feature.

**Architecture:** A pure selection function (`lib/spotlight/rotation.ts`) decides who is eligible and in what order, with a cold-start floor. A presentational, provider-agnostic `SpotlightRail` component renders the strip and the rotating featured ship; interactivity (cheer/message) is injected by the parent so the same component can render display-only on a future public page. A new `spotlight_nominations` table plus a small hook captures the self-nomination opt-in, curated manually out of band.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Supabase (Postgres + RLS + Realtime), Vitest, lucide-react, inline-styled components driven by `lib/design/tokens.ts`.

**Design spec:** `docs/specs/2026-06-28-spotlight-design.md`

## Global Constraints

- **Real calendar time only.** Use a `now: Date` resolved on mount; never the sim clock (`useSimClock`). Consistent with `lib/streak/streak.ts`.
- **RLS is the security boundary.** Every new table has RLS enabled; insert/delete policies pin ownership to `auth.uid()`. A client cannot write another user's row.
- **Edge middleware stays untouched.** No auth-model change in this slice (`lib/supabase/middleware.ts` must remain dependency-free; do not import `@supabase/ssr` there).
- **Styling tunes from tokens.** Use `lib/design/tokens.ts` values (`colors`, `fonts`, `fontSize`, `radii`, `spacing`, `shadows`, `motion`). No new hard-coded colors. Components are inline-styled, not className-based.
- **Copy: no em-dashes in user-facing strings.** Plain, factual voice.
- **Schema changes ship as a numbered migration** in `db/migrations/` plus a hand-regenerated `db/setup_all.sql`. The matching TypeScript row interface lives with its hook.
- **Migrations are applied by hand** in the Supabase SQL editor (no automated DB migration runner). Migrations must be idempotent (`create table if not exists`, `drop policy if exists` then `create policy`).
- **Test convention:** pure logic in `lib/` is unit-tested with Vitest (`tests/lib/*`); hooks and components are not unit-tested in this repo and are verified by `npm run build` (typecheck) plus manual QA.

---

### Task 1: Spotlight selection logic

**Files:**
- Create: `lib/spotlight/rotation.ts`
- Test: `tests/lib/spotlight.test.ts`

**Interfaces:**
- Consumes: `toDayKey` from `lib/streak/streak.ts`; `BuildLogRow` type from `lib/hooks/useBuildLog.ts`.
- Produces: `selectSpotlight(posts: BuildLogRow[], now: Date): BuildLogRow[]` and `SPOTLIGHT_MIN_BUILDERS: number`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/spotlight.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { selectSpotlight, SPOTLIGHT_MIN_BUILDERS } from "@/lib/spotlight/rotation"
import type { BuildLogRow } from "@/lib/hooks/useBuildLog"

const NOW = new Date("2026-06-28T12:00:00Z")

function ship(author: string, at: string, id = `${author}-${at}`): BuildLogRow {
  return { id, author_id: author, category: "ship", note: "did a thing", created_at: at }
}

describe("selectSpotlight", () => {
  it("knows the floor is 3", () => {
    expect(SPOTLIGHT_MIN_BUILDERS).toBe(3)
  })

  it("returns empty for no posts", () => {
    expect(selectSpotlight([], NOW)).toEqual([])
  })

  it("returns empty below the cold-start floor", () => {
    const posts = [ship("a", "2026-06-28T09:00:00Z"), ship("b", "2026-06-28T10:00:00Z")]
    expect(selectSpotlight(posts, NOW)).toEqual([])
  })

  it("returns all distinct shippers at or above the floor", () => {
    const posts = [
      ship("a", "2026-06-28T09:00:00Z"),
      ship("b", "2026-06-28T10:00:00Z"),
      ship("c", "2026-06-28T11:00:00Z"),
    ]
    const r = selectSpotlight(posts, NOW)
    expect(r.map((p) => p.author_id).sort()).toEqual(["a", "b", "c"])
  })

  it("keeps one entry per author, their latest ship of the day", () => {
    const posts = [
      ship("a", "2026-06-28T08:00:00Z", "a-early"),
      ship("a", "2026-06-28T15:00:00Z", "a-late"),
      ship("b", "2026-06-28T09:00:00Z"),
      ship("c", "2026-06-28T09:00:00Z"),
    ]
    const r = selectSpotlight(posts, NOW)
    expect(r.filter((p) => p.author_id === "a")).toHaveLength(1)
    expect(r.find((p) => p.author_id === "a")!.id).toBe("a-late")
  })

  it("ignores ships from other days", () => {
    const posts = [
      ship("a", "2026-06-28T09:00:00Z"),
      ship("b", "2026-06-28T09:00:00Z"),
      ship("c", "2026-06-28T09:00:00Z"),
      ship("d", "2026-06-27T09:00:00Z"),
    ]
    const r = selectSpotlight(posts, NOW)
    expect(r.map((p) => p.author_id)).not.toContain("d")
    expect(r).toHaveLength(3)
  })

  it("produces a stable order within a day", () => {
    const posts = [
      ship("a", "2026-06-28T09:00:00Z"),
      ship("b", "2026-06-28T09:00:00Z"),
      ship("c", "2026-06-28T09:00:00Z"),
    ]
    const morning = selectSpotlight(posts, new Date("2026-06-28T08:00:00Z"))
    const evening = selectSpotlight(posts, new Date("2026-06-28T20:00:00Z"))
    expect(morning.map((p) => p.author_id)).toEqual(evening.map((p) => p.author_id))
  })

  it("keeps the same members when the day-key changes", () => {
    const authors = ["a", "b", "c", "d", "e"]
    const mk = (now: Date) =>
      selectSpotlight(authors.map((x) => ship(x, now.toISOString())), now).map((p) => p.author_id)
    const d1 = mk(new Date("2026-06-28T09:00:00Z"))
    const d2 = mk(new Date("2026-07-15T09:00:00Z"))
    expect([...d1].sort()).toEqual([...d2].sort())
    expect(d1).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- spotlight`
Expected: FAIL — cannot resolve `@/lib/spotlight/rotation` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/spotlight/rotation.ts`:

```ts
/**
 * Spotlight selection: who gets featured on the "Shipped today" rail.
 *
 * Inclusive and effort-based, not ranked: every builder who shipped today is
 * eligible exactly once. The order is fair (a deterministic hash keyed on the
 * day), so it is stable within a day and rotates across days, giving everyone a
 * turn over time rather than crowning the same faces. There is no engagement
 * metric, by design.
 *
 * Like lib/streak/streak.ts this is pure and real-time: it keys off `now`, uses
 * UTC day boundaries, and has no I/O.
 */

import { toDayKey } from "@/lib/streak/streak"
import type { BuildLogRow } from "@/lib/hooks/useBuildLog"

/** Below this many distinct shippers in the window, the rail does not render. */
export const SPOTLIGHT_MIN_BUILDERS = 3

/** djb2 hash over a string (same family as the Avatar fill hash). */
function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

export function selectSpotlight(posts: BuildLogRow[], now: Date): BuildLogRow[] {
  const dayKey = toDayKey(now)

  // One entry per author: keep their latest ship of the day.
  const latestByAuthor = new Map<string, BuildLogRow>()
  for (const p of posts) {
    if (toDayKey(new Date(p.created_at)) !== dayKey) continue
    const existing = latestByAuthor.get(p.author_id)
    if (!existing || new Date(p.created_at) > new Date(existing.created_at)) {
      latestByAuthor.set(p.author_id, p)
    }
  }

  // Cold-start floor: render nothing until enough distinct builders have shipped.
  if (latestByAuthor.size < SPOTLIGHT_MIN_BUILDERS) return []

  return [...latestByAuthor.values()].sort(
    (a, b) => hash(a.author_id + dayKey) - hash(b.author_id + dayKey),
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- spotlight`
Expected: PASS (8 passing).

- [ ] **Step 5: Commit**

```bash
git add lib/spotlight/rotation.ts tests/lib/spotlight.test.ts
git commit -m "feat(spotlight): inclusive day-rotated selection logic with cold-start floor"
```

---

### Task 2: spotlight_nominations table

**Files:**
- Create: `db/migrations/011_spotlight_nominations.sql`
- Modify: `db/setup_all.sql` (insert the 011 block in migration order, before the seed section)

**Interfaces:**
- Produces: table `public.spotlight_nominations (id, post_id, user_id, status, created_at)` with RLS. Consumed by Task 3's hook.

- [ ] **Step 1: Write the migration**

Create `db/migrations/011_spotlight_nominations.sql`:

```sql
-- 011 spotlight nominations: a builder can opt a ship of theirs in for an
-- external "spotlight" (e.g. a Build Club feature). Default is OFF; nothing is
-- ever featured externally without this explicit, per-post opt-in.
--
-- Curation is manual: an operator reads this queue with the service role and
-- sets `status`. No automated publishing, no admin UI in this slice. Not added
-- to the realtime publication; it is a queue, not a live feed.

create table if not exists public.spotlight_nominations (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.build_log(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending',  -- 'pending' | 'featured' | 'declined' (operator-set)
  created_at timestamptz not null default now(),
  unique (post_id)
);

create index if not exists spotlight_nominations_user_id_idx on public.spotlight_nominations(user_id);

alter table public.spotlight_nominations enable row level security;

-- A builder reads only their own nominations. The operator reads all via the
-- service role, which bypasses RLS.
drop policy if exists spotlight_nominations_select_own on public.spotlight_nominations;
create policy spotlight_nominations_select_own on public.spotlight_nominations
  for select to authenticated using (auth.uid() = user_id);

-- Insert only your own nomination, and only for a post you authored.
drop policy if exists spotlight_nominations_insert_own on public.spotlight_nominations;
create policy spotlight_nominations_insert_own on public.spotlight_nominations
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.build_log b where b.id = post_id and b.author_id = auth.uid())
  );

-- Withdraw your own nomination.
drop policy if exists spotlight_nominations_delete_own on public.spotlight_nominations;
create policy spotlight_nominations_delete_own on public.spotlight_nominations
  for delete to authenticated using (auth.uid() = user_id);
```

- [ ] **Step 2: Mirror the block into the setup bundle**

Open `db/setup_all.sql`. It concatenates each migration (each one kept with its own comment header, under a `--`/divider line) followed by a `-- db/seed.sql` section of `insert`s. Insert the **full** contents of `011_spotlight_nominations.sql` (including its comment header, matching the existing per-migration divider style) in migration order: after the `010` event-scoping block (the two `create index` lines) and before the `-- db/seed.sql` section. This keeps the one-paste bundle current with `db/migrations/`.

- [ ] **Step 3: Apply and verify in Supabase**

In the Supabase SQL editor for the project, run `db/migrations/011_spotlight_nominations.sql`. Expected: no error. Then run:

```sql
select * from public.spotlight_nominations limit 1;
```

Expected: returns zero rows (table exists, empty). Re-run the migration once more to confirm it is idempotent (no error on second run).

- [ ] **Step 4: Commit**

```bash
git add db/migrations/011_spotlight_nominations.sql db/setup_all.sql
git commit -m "feat(spotlight): add spotlight_nominations table with RLS"
```

---

### Task 3: useSpotlightNominations hook

**Files:**
- Create: `lib/hooks/useSpotlightNominations.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/client.ts`; the `spotlight_nominations` table from Task 2.
- Produces: `useSpotlightNominations(): { mine: Set<string>; nominate(postId: string): Promise<void>; unnominate(postId: string): Promise<void>; userId: string | null }`.

- [ ] **Step 1: Write the hook**

Create `lib/hooks/useSpotlightNominations.ts`:

```ts
"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * The signed-in builder's spotlight nominations: the set of their own post ids
 * they have opted in for an external feature. Per-post, default off. Optimistic
 * with revert on error. Mirrors the persistence shape of useSubmission. Not
 * realtime: it is a personal opt-in queue, not a shared feed.
 */
export function useSpotlightNominations() {
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data, error } = await supabase
        .from("spotlight_nominations")
        .select("post_id")
        .eq("user_id", user.id)
      if (error) {
        console.error("[useSpotlightNominations] fetch error:", error)
        return
      }
      setMine(new Set((data ?? []).map((r) => r.post_id as string)))
    }
    init()
  }, [])

  const nominate = useCallback(async (postId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    setMine((prev) => new Set(prev).add(postId))
    const { error } = await supabase
      .from("spotlight_nominations")
      .insert({ post_id: postId, user_id: user.id })
    if (error) {
      setMine((prev) => { const n = new Set(prev); n.delete(postId); return n })
      throw error
    }
  }, [])

  const unnominate = useCallback(async (postId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    setMine((prev) => { const n = new Set(prev); n.delete(postId); return n })
    const { error } = await supabase
      .from("spotlight_nominations")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id)
    if (error) {
      setMine((prev) => new Set(prev).add(postId))
      throw error
    }
  }, [])

  return { mine, nominate, unnominate, userId }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: build completes with no TypeScript errors. (Hooks are not unit-tested in this repo; correctness is verified by typecheck plus the manual QA in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useSpotlightNominations.ts
git commit -m "feat(spotlight): useSpotlightNominations hook (per-post opt-in)"
```

---

### Task 4: SpotlightRail component

**Files:**
- Create: `components/spotlight/SpotlightRail.tsx`

**Interfaces:**
- Consumes: `selectSpotlight` (Task 1); `BuildLogRow` from `lib/hooks/useBuildLog.ts`; `Avatar`, `Card`, `Tag`, design tokens.
- Produces: `SpotlightRail` (default + named export) with props:
  `{ posts: BuildLogRow[]; now: Date; label?: string; interactive?: boolean; currentUserId?: string | null; cheerCounts?: Record<string, number>; mineCheers?: Set<string>; onCheer?: (postId: string) => void; onMessage?: (post: BuildLogRow) => void }`.
  Renders `null` when `selectSpotlight` returns empty. It is provider-agnostic: it never calls `useSocial`; interactive handlers are injected.

- [ ] **Step 1: Write the component**

Create `components/spotlight/SpotlightRail.tsx`:

```tsx
"use client"

import React, { useEffect, useMemo, useState } from "react"
import { MessageCircle } from "lucide-react"
import { Avatar } from "@/components/shell/Avatar"
import { Card } from "@/components/ui/Card"
import { Tag } from "@/components/ui/Tag"
import { selectSpotlight } from "@/lib/spotlight/rotation"
import type { BuildLogRow } from "@/lib/hooks/useBuildLog"
import { colors, fonts, fontSize, fontWeight, radii, spacing, motion } from "@/lib/design/tokens"

/** How many faces show before collapsing the rest into a +N chip. */
const FACES_VISIBLE = 10
/** Auto-advance interval for the featured ship. */
const CYCLE_MS = 7000

export interface SpotlightRailProps {
  posts: BuildLogRow[]
  now: Date
  /** Header label. Defaults to "Shipped today". */
  label?: string
  /** When true, the featured card shows cheer + message actions. */
  interactive?: boolean
  currentUserId?: string | null
  cheerCounts?: Record<string, number>
  mineCheers?: Set<string>
  onCheer?: (postId: string) => void
  onMessage?: (post: BuildLogRow) => void
}

export function SpotlightRail({
  posts,
  now,
  label = "Shipped today",
  interactive = false,
  currentUserId = null,
  cheerCounts = {},
  mineCheers,
  onCheer,
  onMessage,
}: SpotlightRailProps) {
  const eligible = useMemo(() => selectSpotlight(posts, now), [posts, now])
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = usePrefersReducedMotion()

  // Keep the index in range as the eligible set changes (realtime updates).
  useEffect(() => {
    if (eligible.length && index >= eligible.length) setIndex(0)
  }, [eligible.length, index])

  // Auto-cycle, unless paused, reduced-motion, or nothing to cycle.
  useEffect(() => {
    if (paused || reduceMotion || eligible.length <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % eligible.length), CYCLE_MS)
    return () => clearInterval(t)
  }, [paused, reduceMotion, eligible.length])

  if (eligible.length === 0) return null

  const featured = eligible[Math.min(index, eligible.length - 1)]
  const faces = eligible.slice(0, FACES_VISIBLE)
  const overflow = eligible.length - faces.length
  const isOwnFeatured = !!currentUserId && featured.author_id === currentUserId
  const cheered = mineCheers?.has(featured.id) ?? false

  return (
    <section
      aria-label={label}
      style={{ marginBottom: spacing[6] }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: spacing[2], marginBottom: spacing[3] }}>
        <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.muted }}>
          {label}
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: fontSize.meta, color: colors.go }}>
          {eligible.length} builders
        </div>
      </div>

      {/* faces strip */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: spacing[3] }}>
        {faces.map((p, i) => {
          const active = i === index
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${p.author_name ?? "builder"}'s ship`}
              aria-pressed={active}
              style={{
                marginLeft: i === 0 ? 0 : -8,
                borderRadius: radii.pill,
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                outline: active ? `2px solid ${colors.violet}` : "none",
                outlineOffset: 2,
                position: "relative",
                zIndex: active ? 2 : 1,
              }}
            >
              <Avatar name={p.author_name ?? "Builder"} photo={p.author_avatar} size={38} />
            </button>
          )
        })}
        {overflow > 0 && (
          <div style={{ marginLeft: -8, width: 38, height: 38, borderRadius: radii.pill, border: `1.4px dashed ${colors.line}`, background: colors.panel, color: colors.muted, fontFamily: fonts.mono, fontSize: fontSize.label, display: "flex", alignItems: "center", justifyContent: "center" }}>
            +{overflow}
          </div>
        )}
      </div>

      {/* featured full post */}
      <Card spine="go" padding={spacing[4]}>
        <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, letterSpacing: "0.1em", textTransform: "uppercase", color: colors.violet, fontWeight: fontWeight.semibold, marginBottom: spacing[3] }}>
          Featured ship
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: spacing[3], marginBottom: spacing[3] }}>
          <Avatar name={featured.author_name ?? "Builder"} photo={featured.author_avatar} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: fonts.body, fontWeight: fontWeight.semibold, fontSize: fontSize.body, color: colors.ink, lineHeight: 1.2 }}>
              {featured.author_name ?? "Builder"}
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft, marginTop: 2 }}>
              {timeAgo(featured.created_at, now)}
            </div>
          </div>
          <Tag tone="go">{featured.category}</Tag>
        </div>

        <p style={{ margin: 0, fontFamily: fonts.body, fontSize: fontSize.body, color: colors.ink, lineHeight: 1.6 }}>
          {featured.note}
        </p>

        {interactive && (
          <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginTop: spacing[4] }}>
            <button
              type="button"
              onClick={() => onCheer?.(featured.id)}
              disabled={!currentUserId || isOwnFeatured}
              aria-pressed={cheered}
              aria-label={`Cheer, ${cheerCounts[featured.id] ?? 0}`}
              style={cheerStyle(cheered, !currentUserId || isOwnFeatured)}
            >
              <span aria-hidden>👏</span> cheer
              {(cheerCounts[featured.id] ?? 0) > 0 && (
                <span style={{ marginLeft: 4, fontWeight: fontWeight.bold }}>{cheerCounts[featured.id]}</span>
              )}
            </button>
            {!isOwnFeatured && (
              <button
                type="button"
                onClick={() => onMessage?.(featured)}
                aria-label="Message author"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1.4px solid ${colors.line}`, background: colors.surface, color: colors.ink, borderRadius: radii.md, padding: "6px 10px", fontFamily: fonts.mono, fontSize: fontSize.label, cursor: "pointer" }}
              >
                <MessageCircle size={13} /> Message
              </button>
            )}
          </div>
        )}

        {/* dots / manual navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginTop: spacing[4], paddingTop: spacing[3], borderTop: `1px solid ${colors.lineSoft}` }}>
          <div style={{ display: "flex", gap: 6 }}>
            {eligible.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to ship ${i + 1}`}
                style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 999, border: "none", padding: 0, background: i === index ? colors.violet : colors.line, cursor: "pointer", transition: `width ${motion.fast} ${motion.ease}` }}
              />
            ))}
          </div>
          <span style={{ marginLeft: "auto", fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft }}>
            spotlight rotates
          </span>
        </div>
      </Card>
    </section>
  )
}

function cheerStyle(mine: boolean, disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 999,
    border: `1.5px solid ${mine ? colors.go : colors.line}`,
    background: mine ? colors.goSoft : colors.panel,
    color: mine ? colors.go : colors.muted,
    fontFamily: fonts.mono,
    fontSize: fontSize.label,
    fontWeight: fontWeight.medium,
    letterSpacing: "0.04em",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
  }
}

function timeAgo(iso: string, now: Date): string {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(mq.matches)
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return reduce
}

export default SpotlightRail
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: build completes with no TypeScript errors. (Verified visually in Task 7's manual QA.)

- [ ] **Step 3: Commit**

```bash
git add components/spotlight/SpotlightRail.tsx
git commit -m "feat(spotlight): SpotlightRail component (faces strip + rotating featured ship)"
```

---

### Task 5: Self-nomination toggle on BuildLogCard

**Files:**
- Modify: `components/radar/BuildLogCard.tsx`

**Interfaces:**
- Produces: two new optional props on `BuildLogCardProps`: `isNominated?: boolean` and `onToggleNominate?: () => void`. When the viewer owns the post (`isOwn`) and `onToggleNominate` is provided, the action row shows a "Submit for a spotlight" toggle. Wired in Task 7.

- [ ] **Step 1: Add the imports**

In `components/radar/BuildLogCard.tsx`, add `Star` to the lucide import (line 7 currently `import { MessageCircle } from "lucide-react"`):

```tsx
import { MessageCircle, Star } from "lucide-react"
```

Add `violetSoft` and `surface` are already on `colors`; no token import change is needed (the file already imports `colors`).

- [ ] **Step 2: Extend the props interface**

In `BuildLogCardProps` (currently ends at `onCheer: () => Promise<void>`), add:

```tsx
interface BuildLogCardProps {
  post: BuildLogRow
  cheerCount: number
  isMine: boolean
  isOwn: boolean // current user is the author
  currentUserId: string | null
  onCheer: () => Promise<void>
  /** Spotlight self-nomination state for the viewer's own post. */
  isNominated?: boolean
  onToggleNominate?: () => void
}
```

And destructure them in the function signature:

```tsx
export function BuildLogCard({
  post,
  cheerCount,
  isMine,
  isOwn,
  currentUserId,
  onCheer,
  isNominated = false,
  onToggleNominate,
}: BuildLogCardProps) {
```

- [ ] **Step 3: Render the toggle in the action row**

In the action row `div` (the one that currently holds the cheer button and the `{!isOwn && ...}` Message button), add this as the last child, after the Message button block:

```tsx
{isOwn && onToggleNominate && (
  <button
    type="button"
    onClick={onToggleNominate}
    aria-pressed={isNominated}
    title="Build Club may feature standout ships, with your permission"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      border: `1.4px solid ${isNominated ? colors.violet : colors.line}`,
      background: isNominated ? colors.violetSoft : colors.surface,
      color: isNominated ? colors.violet : colors.muted,
      borderRadius: radii.md,
      padding: "6px 10px",
      fontFamily: fonts.mono,
      fontSize: fontSize.label,
      cursor: "pointer",
    }}
  >
    <Star size={13} /> {isNominated ? "Submitted for spotlight" : "Submit for a spotlight"}
  </button>
)}
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: build completes with no TypeScript errors. The toggle does not appear yet anywhere (no caller passes `onToggleNominate` until Task 7).

- [ ] **Step 5: Commit**

```bash
git add components/radar/BuildLogCard.tsx
git commit -m "feat(spotlight): own-post 'submit for a spotlight' toggle on BuildLogCard"
```

---

### Task 6: Harden useBuildLog realtime channel name

**Files:**
- Modify: `lib/hooks/useBuildLog.ts`

**Interfaces:**
- No public API change. Internal: the realtime channel name becomes unique per hook instance so two mounts (e.g. the rail and the feed on the same page in Task 8) do not collide on a shared channel topic. Mirrors how `useRadar` already randomizes its channel name.

- [ ] **Step 1: Add a per-instance channel name**

In `lib/hooks/useBuildLog.ts`, the hook currently calls `useState`/`useRef` near the top. Add a stable random channel name right after the existing state declarations (after the `userIdRef` line):

```tsx
const [channelName] = useState(() => `build-log-${Math.random().toString(36).slice(2)}`)
```

- [ ] **Step 2: Use it in the subscription**

Change the realtime subscription line from `.channel("build-log")` to `.channel(channelName)`, and add `channelName` to that effect's dependency array (make it `[fetchAll, channelName]`).

Caution: this file has two effects whose dependency array is `[fetchAll]`. Target the **second** one — the realtime subscription, identifiable by `.channel(...)` / `.subscribe()`. Anchor your edit on the unique `.channel("build-log")` line, not on the `[fetchAll]` array (the first effect, the data fetch, also ends in `[fetchAll]` and must be left unchanged). The full target effect after editing:

```tsx
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "build_log" },
        () => { fetchAll() }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "build_log_cheers" },
        () => { fetchAll() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll, channelName])
```

- [ ] **Step 3: Typecheck and confirm existing behavior**

Run: `npm run build`
Expected: build completes with no TypeScript errors. The home feed and Radar feed still update on new ships (verified in manual QA).

- [ ] **Step 4: Commit**

```bash
git add lib/hooks/useBuildLog.ts
git commit -m "fix(build-log): unique realtime channel name per hook instance"
```

---

### Task 7: Wire the rail and nomination into Today

**Files:**
- Modify: `components/today/TodayView.tsx`

**Interfaces:**
- Consumes: `SpotlightRail` (Task 4), `useSpotlightNominations` (Task 3), `useSocial` from `components/shell/SocialProvider.tsx`, the existing `useBuildLog` return values, and the `isNominated`/`onToggleNominate` props on `BuildLogCard` (Task 5).

- [ ] **Step 1: Add imports**

In `components/today/TodayView.tsx`, add to the import block:

```tsx
import { SpotlightRail } from "@/components/spotlight/SpotlightRail"
import { useSpotlightNominations } from "@/lib/hooks/useSpotlightNominations"
import { useSocial } from "@/components/shell/SocialProvider"
```

- [ ] **Step 2: Call the hooks**

Just below the existing `const { profile } = useProfile()` line, add:

```tsx
  const { mine: nominated, nominate, unnominate } = useSpotlightNominations()
  const { openPanel } = useSocial()
```

- [ ] **Step 3: Insert the rail below the ship prompt**

Immediately after the closing `</div>` of the "ritual prompt" block (the `<div style={{ marginBottom: spacing[6] }}>` that contains `<PostUpdate onPost={post} />`), and before the `{/* Community feed */}` section, add:

```tsx
      {/* Spotlight: who shipped today */}
      {now && (
        <SpotlightRail
          posts={posts}
          now={now}
          interactive
          currentUserId={userId}
          cheerCounts={cheerCounts}
          mineCheers={mineCheers}
          onCheer={toggleCheer}
          onMessage={(p) =>
            openPanel(
              { id: p.author_id, name: p.author_name ?? "Builder", avatar: p.author_avatar },
              "chat",
            )
          }
        />
      )}
```

- [ ] **Step 4: Pass nomination props to each feed card**

In the feed `.map`, update the `<BuildLogCard ... />` usage to also pass the nomination props:

```tsx
              <BuildLogCard
                key={p.id}
                post={p}
                cheerCount={cheerCounts[p.id] ?? 0}
                isMine={mineCheers.has(p.id)}
                isOwn={!!userId && p.author_id === userId}
                currentUserId={userId}
                onCheer={() => toggleCheer(p.id)}
                isNominated={nominated.has(p.id)}
                onToggleNominate={
                  !!userId && p.author_id === userId
                    ? () => (nominated.has(p.id) ? unnominate(p.id) : nominate(p.id))
                    : undefined
                }
              />
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: build completes with no TypeScript errors.

- [ ] **Step 6: Manual QA (the real proof)**

Run `npm run dev`. With a Supabase project that has migrations `001`–`011` and `seed.sql` applied, and `NEXT_PUBLIC_SUPABASE_*` set in `.env.local`:

1. Sign in as three different users (use three browsers or normal + two incognito windows). Each posts one ship from the home prompt.
2. On `/`, confirm: the "Shipped today" rail appears below the prompt with three faces, and the featured card cycles through the three full posts every ~7s, pausing when you hover it.
3. Tap a face and a dot; confirm the featured ship changes to match.
4. On your own ship in the feed below, click "Submit for a spotlight"; confirm it flips to "Submitted for spotlight". In the Supabase table editor, confirm a row exists in `spotlight_nominations`. Click again to withdraw; confirm the row is removed.
5. With only one or two builders having shipped, confirm the rail does not render (cold-start floor).

- [ ] **Step 7: Commit**

```bash
git add components/today/TodayView.tsx
git commit -m "feat(spotlight): show the rail on Today and wire self-nomination"
```

---

### Task 8: Wire the rail into the event detail page

**Files:**
- Modify: `components/events/EventDetailView.tsx`

**Interfaces:**
- Consumes: `SpotlightRail` (Task 4), `useBuildLog` (event-scoped), `useSocial`. Depends on Task 6 (unique channel name) so the rail's `useBuildLog` and `RadarFeed`'s inner build-log feed can coexist on the same page.

- [ ] **Step 1: Add imports**

In `components/events/EventDetailView.tsx`, add:

```tsx
import { SpotlightRail } from "@/components/spotlight/SpotlightRail"
import { useBuildLog } from "@/lib/hooks/useBuildLog"
import { useSocial } from "@/components/shell/SocialProvider"
```

- [ ] **Step 2: Call the hooks before the early returns**

Hooks must run unconditionally. Right after the `const event = useMemo(...)` line (and before the `if (loading || !now)` early return), add:

```tsx
  const railEventId = scope === "event" ? (event?.id ?? null) : null
  const { posts, cheerCounts, mineCheers, toggleCheer, userId } = useBuildLog(railEventId)
  const { openPanel } = useSocial()
```

- [ ] **Step 3: Render the rail above the feed**

In the JSX, between the scope-toggle block (the `inline-flex` segmented control ending in its closing `</div>`) and `<RadarFeed eventId={scope === "event" ? event.id : null} />`, insert:

```tsx
      {now && (
        <SpotlightRail
          posts={posts}
          now={now}
          label={scope === "event" ? "Shipped in this event" : "Shipped today"}
          interactive
          currentUserId={userId}
          cheerCounts={cheerCounts}
          mineCheers={mineCheers}
          onCheer={toggleCheer}
          onMessage={(p) =>
            openPanel(
              { id: p.author_id, name: p.author_name ?? "Builder", avatar: p.author_avatar },
              "chat",
            )
          }
        />
      )}
```

Note: `now` is non-null here because the `if (loading || !now)` guard returns earlier, but the `{now && ...}` keeps the prop type as `Date`.

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: build completes with no TypeScript errors.

- [ ] **Step 5: Manual QA**

Run `npm run dev`. Open an event detail page (for example `/events/aabw-hcmc` from the seed). With at least three builders having posted ships tagged to that event:

1. Confirm the "Shipped in this event" rail renders above the Radar/Build Log feed and cycles through the event's full ships.
2. Toggle "All builders"; confirm the rail label changes to "Shipped today" and reflects the global set.
3. Confirm new ships still arrive live in both the rail and the feed below (no realtime channel collision).

- [ ] **Step 6: Commit**

```bash
git add components/events/EventDetailView.tsx
git commit -m "feat(spotlight): event-scoped rail on the event detail page"
```

---

## Scope notes

- The self-nomination toggle is wired on the Today feed in this slice (Task 7). The same `BuildLogCard` props make adopting it inside `components/radar/BuildLogFeed.tsx` (the Radar "Shipped" tab and the event feed) a trivial same-pattern follow-up; it is intentionally left out of v1 to keep the change surface small.
- The v2 public pre-login landing carousel reuses `SpotlightRail` with `interactive={false}` and a restricted public-read path. It is out of scope here (see the design spec) and gated on a committed external-featuring owner and cadence.

## Definition of done

- `npm run test` passes (including the new `tests/lib/spotlight.test.ts`).
- `npm run build` passes with no TypeScript errors.
- Migration `011` is applied to the Supabase project and the manual QA steps in Tasks 7 and 8 pass.
- All eight task commits are on the branch.
