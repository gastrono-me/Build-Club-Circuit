# Production readiness contract

Circuit's merged live-coworking release is **merge-ready and verified in non-production**. Production remains intentionally untouched. Elevation is a controlled, manual action after the short production preflight below; no unresolved product or schema decision is known to block it.

## Product contract

- Circuit is the single product and system of record; live coworking is an event mode inside Circuit.
- Build Club staff admins operate every event. `event_members` means RSVP/participation and never grants staff access.
- Staff access is provisioned and revoked manually in `public.admins`; there is no self-promotion path.
- Event capacity means simultaneous checked-in builders, not total RSVPs.
- A checked-in builder must check out before leaving event membership.
- A named space's capacity is enforced when joining a huddle in that space.
- Builders may create and join huddles; staff admins moderate the room, huddles, demos, and attendance.
- Normal event lifecycle is cancel, end, then archive. Hard delete is support-only.
- Ships, blockers, projects, and relationships remain durable after presence ends or an event is archived.

## Verified release gates

| Gate | State | Evidence |
|---|---|---|
| Non-production E2E | **Green** | Five authenticated Playwright journeys pass against the designated non-production Supabase project: health/auth denial, durable builder flow, two-user final-slot race, staff operations/lifecycle, and 390px mobile. Fixtures are uniquely named and removed after every run. |
| Automated verification | **Green** | Every PR runs clean install, 98 unit tests, production audit policy, guarded non-production migration, production build, Chromium install, and E2E. Failure traces/screenshots are retained without committing credentials. |
| Product consistency | **Green** | Database-backed event and named-space capacity, checkout-before-leave, cancel/archive lifecycle, durable ships/demos, and readable contention errors are implemented and exercised. |
| Security | **Green for release policy** | Staff denial and RLS-backed mutations are exercised. Production audit has zero high/critical findings. Two moderate transitive PostCSS findings remain visible because the current supported Next.js tree has no available remediation. |
| Environment isolation | **Green in non-production** | Database migration and fixture setup refuse a connection whose project reference does not match `E2E_SUPABASE_PROJECT_REF`. E2E credentials are dedicated CI secrets. No production credential or database was used. |
| Ordered deployment | **Green in code; not yet exercised in production** | `main` automatic Vercel production deployment is disabled. The manual production workflow builds an exact tested `main` commit, migrates the asserted production project first, deploys only after migration succeeds, then calls `/api/health`. |
| Recovery and operations | **Manual preflight required** | Health smoke and code rollback path are documented. A production recovery point, environment secrets/reviewer, OAuth redirects, staff list, and post-release observation still require one-time production setup/confirmation. |

The branch is ready to merge. Production is a **no-go only until the production preflight is checked**, not because of a known application-code blocker.

## Automated non-production journeys

1. Health endpoint responds; signed-out users are redirected; a normal builder is denied `/admin`.
2. A builder joins, checks in with intention/focus, survives a reload, cannot leave while checked in, creates a capacity-bound huddle, logs an event-attributed ship, queues it for a demo, checks out, and leaves.
3. Staff and builder race for the last event slot; exactly one succeeds and the loser receives a useful capacity message.
4. Staff checks in, observes named-space capacity enforcement, opens the host board, and cancels, archives, restores, and reopens the event while durable work remains.
5. The event journey renders without horizontal overflow at a 390x844 viewport.

Password authentication is used only for deterministic CI identities. Before the first production release, manually smoke the real magic-link/OAuth callback once—including recovery from an expired state—because email delivery and the production redirect allowlist are external configuration, not reproducible by the database E2E fixture.

## Simple production preflight

Complete these checks once before running the release workflow:

1. Create the GitHub `production` environment and require the intended reviewer.
2. Add environment secrets `PRODUCTION_SUPABASE_DB_URL`, `PRODUCTION_SUPABASE_PROJECT_REF`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.
3. Confirm the Supabase project ref and Vercel project are production, and that the Supabase Site URL/redirect allowlist contains the production auth callback.
4. Add the approved Build Club staff user IDs to production `public.admins`; confirm departed staff are absent.
5. Create or verify a production database recovery point and inspect the pending migration list.
6. Confirm this exact commit is on `main` and its PR `nonprod-e2e` and Vercel preview checks are green.

## Elevation

Run **Release production** manually with the tested `main` commit SHA. The workflow then:

1. Rejects a commit that is not on `main`.
2. Repeats unit and high-severity dependency checks.
3. Pulls production Vercel configuration and builds the exact commit without changing traffic.
4. Verifies the database connection matches `PRODUCTION_SUPABASE_PROJECT_REF` and applies migrations transactionally.
5. Deploys the prebuilt application only after migration succeeds.
6. Fails unless `/api/health` responds successfully.

After the workflow is green, manually complete a builder magic-link smoke and a staff event smoke using clearly marked, removable production data. Observe authentication failures, server errors, and database errors for the agreed window.

If migration fails, the application is not deployed. If deployment or smoke fails, restore the previous Vercel application deployment. Migrations are forward-only by default: repair with a new migration unless a tested database restore is explicitly safer. Any future non-backward-compatible schema change must use expand/migrate/contract across separate releases.
