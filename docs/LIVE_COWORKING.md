# Live coworking

## Product decision

Circuit is the single product and system of record; Pulse becomes its live coworking layer inside an event, not a separate destination or identity system. A builder keeps one Circuit profile and project history, checks into an event with a temporary intention and focus outcomes, uses explainable matching and targeted huddles to work with the room, and turns the session into durable Circuit ships and resolved blockers. Hosts operate the same event through capacity, spaces, attendee controls, a demo queue, live board, and exportable reporting. When the event ends, presence expires but the builder graph and work record remain.

## Builder flow

1. Join an event and open its page.
2. Check in with a project, goal, intention, and optional focus outcomes.
3. Work from the live room: update focus outcomes, contact suggested builders, and create or join huddles.
4. Log a Circuit ship linked to the event and optionally put it in the lightning-demo queue.
5. Check out. The temporary session closes; ships, blockers, projects, and relationships remain in Circuit.

Targeted huddle alerts are in-app notifications. Matches are deterministic and show their reason; there is no opaque AI ranker.

## Host flow

- `/admin`: create an event and set optional capacity.
- `/admin/events/[id]`: configure spaces, monitor metrics, moderate check-ins, operate huddles/demos, export attendee outcomes as CSV.
- `/events/[slug]/board`: projector view with QR check-in, live builders, huddles, event output, blockers, and demo queue.

## Roles

Circuit has one operational role: Build Club staff admin. Staff admins are the event organizers for every event and can create events, operate live sessions, access host boards, and moderate community work. Membership in `event_members` means participation only; it does not grant operational authority. Staff access is stored in `public.admins`, bootstrapped through the Supabase SQL editor or service role, and enforced by `public.is_admin()` in RLS. There is no self-promotion path or per-event organizer role.

## Data and security

Migration `031_live_coworking.sql` adds `event_checkins`, `focus_items`, `event_spaces`, `huddles`, `huddle_participants`, `event_demos`, and `event_notifications`, plus optional `events.capacity`. Migration `032_staff_event_operators.sql` removes the unused `event_members.role` column so membership cannot be confused with staff authorization. All live tables have RLS. Builders can write their own live state; staff admins update event operations through `public.is_admin()`. Capacity is enforced in Postgres under a per-event transaction lock. Huddle insertion creates targeted notification rows for currently checked-in builders whose profile skills or industries match the requested audience.

Migration `031` is additive; migration `032` only removes the unused membership-role field. The former Pulse app is not a runtime dependency and its SQLite/JWT data is not read by Circuit. If production Pulse records need preservation, migrate them explicitly after mapping Pulse users to Circuit profile UUIDs; do not import duplicate identities.

Production promotion is governed by [the production readiness contract](./PRODUCTION_READINESS.md). It defines the product defaults, release gates, required E2E journeys, ordered migration/deployment flow, and rollback expectations.
