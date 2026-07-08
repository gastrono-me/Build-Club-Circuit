-- 027 onboarding: mark when a builder has been through the welcome setup, so
-- new users get a guided first run and existing ones don't. Nullable timestamp;
-- set when they finish (or skip) /welcome.
--
-- Backfill every existing profile as already-onboarded — they've been using the
-- app, so they must not be bounced into onboarding. New signups (the
-- handle_new_user trigger inserts only id + name) get null and are guided.

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

update public.profiles
  set onboarded_at = coalesce(created_at, now())
  where onboarded_at is null;
