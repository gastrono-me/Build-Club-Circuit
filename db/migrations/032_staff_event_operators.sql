-- 032 staff event operators: one operational role for Circuit.
--
-- Build Club staff (public.admins) create and operate every event. The legacy
-- event_members.role column was never read or enforced, and its original join
-- policy allowed a builder to choose its value. Removing it prevents a second,
-- misleading authorization path: event_members now represents participation
-- only, while public.is_admin() remains the sole staff capability check.

alter table public.event_members
  drop column if exists role;
