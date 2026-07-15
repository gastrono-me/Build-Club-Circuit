# Production readiness contract

This is the go/no-go contract for promoting Circuit's live coworking release from the non-production Supabase project to production. It is deliberately short: promotion is routine only when every release gate below is green.

## Product contract

These defaults remove the remaining product ambiguity:

- Circuit is the single product and system of record; live coworking is an event mode inside Circuit.
- Build Club staff admins operate every event. `event_members` means RSVP/participation and never grants staff access.
- Event capacity means simultaneous checked-in builders, not total RSVPs.
- A checked-in builder must check out before leaving the event membership.
- A named space's capacity is a real limit and must be enforced when joining a huddle in that space.
- Builders may create and join huddles; only staff admins moderate the room, huddles, demos, and attendance.
- Normal event lifecycle is cancel, end, then archive. Hard delete is a support-only action, not the normal staff workflow.
- Ships, blockers, projects, and relationships remain durable after presence ends or an event is archived.
- Staff access is provisioned manually in `public.admins` for the first release, with a named approver and an offboarding checklist. There is no self-promotion path.

If these defaults are accepted, no further product decision blocks implementation or launch.

## Release gates

| Gate | Acceptance criteria | Current state |
|---|---|---|
| Product E2E | Builder, second-builder, and staff journeys pass against non-production on desktop and mobile, including permission denial, capacity contention, reload/realtime, and error recovery. | **Amber:** a real authenticated staff journey passed; non-admin and two-user concurrency remain unverified. |
| Automated verification | `npm test`, `npm run build`, and `npm run e2e` run from a clean checkout and gate every PR. | **Red:** 96 unit tests and the build pass, but no committed Playwright configuration/spec exists; `npm run e2e` currently discovers Vitest files and fails. There is no application CI workflow. |
| Product consistency | Space capacity is enforced, checked-in members cannot leave without checkout, event cancellation/archive replaces routine hard deletion, and concurrent capacity errors are user-readable. | **Red:** these edge cases are not implemented. |
| Security | RLS and role-denial tests pass; production dependencies have no unaccepted high-severity advisories. | **Red:** RLS is strong, but the installed Next.js version currently has a high-severity production audit finding; `postcss` has a moderate finding. |
| Environment isolation | Non-production and production Supabase project IDs, Vercel environments, OAuth redirect allowlists, secrets, and staff-admin records are documented and independently checked. No production secret is used by E2E. | **Amber:** non-production works, but the naming/redirect setup is easy to confuse and has no checked runbook. |
| Ordered deployment | Database migration succeeds and is verified before production application traffic can receive code that requires it. A migration failure prevents deployment. | **Red:** the migration workflow and Vercel deployment currently run independently after a push to `main`. |
| Recovery and operations | A pre-release database recovery point exists; code rollback is documented; post-deploy smoke and health checks run; failures have an owner and visible alert. | **Red:** transactional migrations help, but there is no release-level backup, automated smoke/health gate, alerting, or rollback runbook. |

Production is **no-go** while any red gate remains. The feature is usable in non-production; the red items are release-safety and lifecycle gaps, not evidence that the core journey is broken.

## Required E2E journeys

1. **Authentication:** signed-out access, sign-in callback, expired/reused callback, sign-out, and return to the intended event.
2. **Builder:** discover event, RSVP, check in, set project/intention/focus, see another builder, create/join/leave a huddle, ship work, queue a demo, check out, and retain durable work.
3. **Capacity:** two builders race for the final event and space slot; exactly one succeeds and the other gets a useful message.
4. **Staff:** create/edit/cancel/archive an event, configure spaces, manage attendance/huddles/demos, use the host board, and export CSV.
5. **Authorization:** a normal builder cannot access staff routes or mutate staff-only records; adding/removing `public.admins` grants/revokes access after session refresh.
6. **Resilience:** refresh and reconnect during an active room, two-tab realtime updates, empty/error/loading states, and a 390-pixel mobile viewport.

E2E data must use a uniquely named fixture event and be removed after the run. Test credentials and service-role keys must stay in CI/Vercel secrets.

## Promotion runbook

1. Cut a release commit only after all PR checks and the non-production E2E suite are green.
2. Confirm the target Supabase project reference, Vercel project/environment, redirect allowlist, and staff-admin list; record them in the release log.
3. Create or verify the production database recovery point and inspect the pending migration list.
4. Apply migrations to production. Verify migration history, required tables/functions/triggers, and representative RLS allow/deny checks.
5. Only after step 4 succeeds, deploy that exact release commit to production.
6. Run the builder and staff smoke journeys using a clearly marked production smoke event, then remove the fixture.
7. Monitor authentication failures, server errors, database errors, and the smoke result for the agreed observation window.

If migration fails, do not deploy. If application smoke fails, roll back the application to the previous release. Database migrations are forward-only by default: repair with a new migration unless a tested restore is explicitly safer. Any migration that is not backward-compatible with the previous application must use an expand/migrate/contract sequence across separate releases.

## Work needed to make promotion routine

1. Commit a Playwright configuration and deterministic multi-user E2E suite.
2. Add PR CI for unit tests, production build, audit policy, and E2E.
3. Implement the product-consistency defaults above with database-backed concurrency guarantees.
4. Upgrade or otherwise remediate the vulnerable production dependencies and record any temporary exception with an owner and expiry.
5. Replace parallel migration/deployment with an ordered release workflow and add environment/schema assertions, health smoke, and rollback instructions.

Once these five items are green, production promotion becomes an execution checklist rather than a judgment call.
