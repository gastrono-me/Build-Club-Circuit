-- 015 catchups → calendar time: Circuit is evergreen, so catchups move off the
-- event-relative model (day index + minutes-since-midnight) to real timestamps.
--
-- Additive and non-destructive: new columns are added, and the legacy
-- day/start_min/end_min columns are only relaxed to nullable (kept, not dropped)
-- so any existing rows survive. New catchups carry starts_at/ends_at.

alter table public.catchups
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz;

alter table public.catchups alter column day       drop not null;
alter table public.catchups alter column start_min drop not null;
alter table public.catchups alter column end_min   drop not null;
