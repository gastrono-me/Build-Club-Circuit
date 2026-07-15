-- 033 event lifecycle: cancellation/archive are the normal staff controls.
-- Hard deletion remains available to support staff through SQL, but the app
-- preserves events and their operational history by default.

alter table public.events
  add column if not exists cancelled_at timestamptz,
  add column if not exists archived_at timestamptz;

create index if not exists events_archived_starts_idx
  on public.events (archived_at, starts_at);

-- A cancelled or archived event cannot accept a new/reopened check-in. Keep the
-- transaction lock from migration 031 so two builders cannot take the final
-- event slot concurrently.
create or replace function public.enforce_event_checkin_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  event_capacity integer;
  active_count integer;
  event_starts timestamptz;
  event_ends timestamptz;
  event_cancelled_at timestamptz;
  event_archived_at timestamptz;
begin
  if new.checked_out_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.checked_out_at is null and old.event_id = new.event_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.event_id::text, 0));
  select capacity, starts_at, ends_at, cancelled_at, archived_at
    into event_capacity, event_starts, event_ends, event_cancelled_at, event_archived_at
  from public.events where id = new.event_id;

  if event_cancelled_at is not null or event_archived_at is not null then
    raise exception 'Check-in is closed for this event.' using errcode = 'P0001';
  end if;
  if now() < event_starts or now() >= event_ends then
    raise exception 'Check-in is only open while the event is live.' using errcode = 'P0001';
  end if;
  if event_capacity is null then return new; end if;

  select count(*) into active_count
  from public.event_checkins
  where event_id = new.event_id
    and checked_out_at is null
    and id <> new.id;

  if active_count >= event_capacity then
    raise exception 'This event is at capacity.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Membership is the durable RSVP link. A builder must close their live
-- presence before removing that link, avoiding a checked-in non-member state.
create or replace function public.prevent_active_member_leave()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.event_checkins
    where event_id = old.event_id
      and user_id = old.user_id
      and checked_out_at is null
  ) then
    raise exception 'Check out before leaving this event.' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_active_member_leave on public.event_members;
create trigger prevent_active_member_leave
  before delete on public.event_members
  for each row execute function public.prevent_active_member_leave();

-- Cancelling or archiving closes ephemeral room state immediately while
-- retaining the durable event, ships, blockers, and session record.
create or replace function public.close_event_presence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.cancelled_at is not null or new.archived_at is not null)
     and (old.cancelled_at is distinct from new.cancelled_at
       or old.archived_at is distinct from new.archived_at) then
    update public.event_checkins
      set checked_out_at = coalesce(checked_out_at, now()), updated_at = now()
      where event_id = new.id and checked_out_at is null;
    update public.huddles
      set status = 'cancelled'
      where event_id = new.id and status in ('scheduled', 'live');
  end if;
  return new;
end;
$$;

drop trigger if exists close_event_presence on public.events;
create trigger close_event_presence
  after update of cancelled_at, archived_at on public.events
  for each row execute function public.close_event_presence();
