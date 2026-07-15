-- 031 live coworking: bring Pulse's in-room operating layer into Circuit.
--
-- Circuit remains the system of record for profiles, projects, events, ships,
-- blockers, messages, and catchups. These tables only describe the temporary
-- state of a live coworking event: who is present, what they intend to do,
-- small focus items, bookable huddles, targeted alerts, and the demo queue.

alter table public.events
  add column if not exists capacity integer check (capacity is null or capacity > 0);

create table if not exists public.event_checkins (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  project_id     uuid references public.projects(id) on delete set null,
  goal           text not null default 'Open'
                 check (goal in ('Deep work','Feedback','Networking','Collaboration','Open')),
  intention      text not null,
  checked_in_at  timestamptz not null default now(),
  checked_out_at timestamptz,
  updated_at     timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_checkins_event_active_idx
  on public.event_checkins (event_id, checked_out_at, checked_in_at);
create index if not exists event_checkins_user_idx
  on public.event_checkins (user_id, checked_in_at desc);

-- Capacity is enforced transactionally, not just hidden in the UI. The
-- per-event advisory lock serializes two people taking the final place.
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
begin
  if new.checked_out_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.checked_out_at is null and old.event_id = new.event_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.event_id::text, 0));
  select capacity, starts_at, ends_at into event_capacity, event_starts, event_ends
  from public.events where id = new.event_id;
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

drop trigger if exists enforce_event_checkin_capacity on public.event_checkins;
create trigger enforce_event_checkin_capacity
  before insert or update of event_id, checked_out_at on public.event_checkins
  for each row execute function public.enforce_event_checkin_capacity();

create table if not exists public.focus_items (
  id           uuid primary key default gen_random_uuid(),
  checkin_id   uuid not null references public.event_checkins(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  position     integer not null default 0,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists focus_items_checkin_idx
  on public.focus_items (checkin_id, position, created_at);

create table if not exists public.event_spaces (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  name        text not null,
  description text,
  capacity    integer check (capacity is null or capacity > 0),
  created_at  timestamptz not null default now(),
  unique (event_id, name)
);

create index if not exists event_spaces_event_idx on public.event_spaces (event_id, name);

create table if not exists public.huddles (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events(id) on delete cascade,
  space_id           uuid references public.event_spaces(id) on delete set null,
  host_id            uuid not null references public.profiles(id) on delete cascade,
  topic              text not null,
  kind               text not null default 'Discussion'
                     check (kind in ('Discussion','Presentation','Asking for help','Networking')),
  welcome_skills     text[] not null default '{}',
  welcome_industries text[] not null default '{}',
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  status             text not null default 'scheduled'
                     check (status in ('scheduled','live','ended','cancelled')),
  created_at         timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists huddles_event_time_idx on public.huddles (event_id, starts_at, ends_at);
create index if not exists huddles_space_time_idx on public.huddles (space_id, starts_at, ends_at);

-- Keep bookings inside the event and prevent two huddles claiming one named
-- space at the same time. The advisory lock closes the concurrent-booking gap.
create or replace function public.enforce_huddle_booking()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  event_starts timestamptz;
  event_ends timestamptz;
begin
  select starts_at, ends_at into event_starts, event_ends
  from public.events where id = new.event_id;
  if new.starts_at < event_starts or new.ends_at > event_ends then
    raise exception 'Choose a huddle time inside the event window.' using errcode = 'P0001';
  end if;

  if new.space_id is not null and new.status <> 'cancelled' then
    perform pg_advisory_xact_lock(hashtextextended(new.space_id::text, 0));
    if exists (
      select 1 from public.huddles h
      where h.space_id = new.space_id
        and h.id <> new.id
        and h.status <> 'cancelled'
        and h.starts_at < new.ends_at
        and new.starts_at < h.ends_at
    ) then
      raise exception 'That space is already booked then.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_huddle_booking on public.huddles;
create trigger enforce_huddle_booking
  before insert or update of space_id, starts_at, ends_at, status on public.huddles
  for each row execute function public.enforce_huddle_booking();

create table if not exists public.huddle_participants (
  huddle_id uuid not null references public.huddles(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (huddle_id, user_id)
);

create index if not exists huddle_participants_user_idx
  on public.huddle_participants (user_id, joined_at desc);

create or replace function public.enforce_huddle_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  space_capacity integer;
  participant_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.huddle_id::text, 0));
  select s.capacity into space_capacity
  from public.huddles h
  left join public.event_spaces s on s.id = h.space_id
  where h.id = new.huddle_id;
  if space_capacity is null then return new; end if;

  select count(*) into participant_count
  from public.huddle_participants where huddle_id = new.huddle_id;
  if participant_count >= space_capacity then
    raise exception 'This huddle space is at capacity.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_huddle_capacity on public.huddle_participants;
create trigger enforce_huddle_capacity
  before insert on public.huddle_participants
  for each row execute function public.enforce_huddle_capacity();

create table if not exists public.event_demos (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  post_id      uuid not null references public.build_log(id) on delete cascade,
  status       text not null default 'queued' check (status in ('queued','presented','skipped')),
  queued_at    timestamptz not null default now(),
  presented_at timestamptz,
  unique (event_id, user_id),
  unique (event_id, post_id)
);

create index if not exists event_demos_queue_idx on public.event_demos (event_id, status, queued_at);

create table if not exists public.event_notifications (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind         text not null default 'huddle',
  title        text not null,
  body         text not null,
  huddle_id    uuid references public.huddles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  unique (recipient_id, huddle_id)
);

create index if not exists event_notifications_recipient_idx
  on public.event_notifications (recipient_id, read_at, created_at desc);

-- RLS owns who may update a row; this trigger also keeps relationship identity
-- immutable so an allowed status/intention update cannot silently move the row
-- to another event or owner.
create or replace function public.prevent_live_identity_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  column_name text;
begin
  foreach column_name in array tg_argv loop
    if (to_jsonb(new) -> column_name) is distinct from (to_jsonb(old) -> column_name) then
      raise exception '% cannot be changed on %.', column_name, tg_table_name using errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists protect_event_checkin_identity on public.event_checkins;
create trigger protect_event_checkin_identity before update on public.event_checkins
  for each row execute function public.prevent_live_identity_change('event_id', 'user_id');
drop trigger if exists protect_focus_item_identity on public.focus_items;
create trigger protect_focus_item_identity before update on public.focus_items
  for each row execute function public.prevent_live_identity_change('checkin_id', 'owner_id');
drop trigger if exists protect_huddle_identity on public.huddles;
create trigger protect_huddle_identity before update on public.huddles
  for each row execute function public.prevent_live_identity_change('event_id', 'host_id');
drop trigger if exists protect_demo_identity on public.event_demos;
create trigger protect_demo_identity before update on public.event_demos
  for each row execute function public.prevent_live_identity_change('event_id', 'user_id');
drop trigger if exists protect_event_notification_content on public.event_notifications;
create trigger protect_event_notification_content before update on public.event_notifications
  for each row execute function public.prevent_live_identity_change(
    'event_id', 'recipient_id', 'kind', 'title', 'body', 'huddle_id', 'created_at'
  );

alter table public.event_checkins      enable row level security;
alter table public.focus_items         enable row level security;
alter table public.event_spaces        enable row level security;
alter table public.huddles             enable row level security;
alter table public.huddle_participants enable row level security;
alter table public.event_demos         enable row level security;
alter table public.event_notifications enable row level security;

-- Presence is visible to the signed-in cohort. Builders write only their row;
-- staff can correct any row from the organizer surface.
drop policy if exists event_checkins_select on public.event_checkins;
create policy event_checkins_select on public.event_checkins
  for select to authenticated using (true);
drop policy if exists event_checkins_insert_own on public.event_checkins;
create policy event_checkins_insert_own on public.event_checkins
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists event_checkins_update_own_or_admin on public.event_checkins;
create policy event_checkins_update_own_or_admin on public.event_checkins
  for update to authenticated using (auth.uid() = user_id or public.is_admin())
  with check (
    public.is_admin()
    or (
      auth.uid() = user_id
      and (
        checked_out_at is not null
        or exists (
          select 1 from public.events e
          where e.id = event_checkins.event_id
            and now() >= e.starts_at
            and now() < e.ends_at
        )
      )
    )
  );
drop policy if exists event_checkins_delete_own_or_admin on public.event_checkins;
create policy event_checkins_delete_own_or_admin on public.event_checkins
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists focus_items_select on public.focus_items;
create policy focus_items_select on public.focus_items
  for select to authenticated using (true);
drop policy if exists focus_items_insert_own on public.focus_items;
create policy focus_items_insert_own on public.focus_items
  for insert to authenticated with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.event_checkins c
      join public.events e on e.id = c.event_id
      where c.id = checkin_id
        and c.user_id = auth.uid()
        and c.checked_out_at is null
        and now() >= e.starts_at
        and now() < e.ends_at
    )
  );
drop policy if exists focus_items_update_own_or_admin on public.focus_items;
create policy focus_items_update_own_or_admin on public.focus_items
  for update to authenticated using (auth.uid() = owner_id or public.is_admin())
  with check (
    public.is_admin()
    or (
      auth.uid() = owner_id
      and exists (
        select 1 from public.event_checkins c
        join public.events e on e.id = c.event_id
        where c.id = focus_items.checkin_id
          and c.user_id = auth.uid()
          and c.checked_out_at is null
          and now() >= e.starts_at
          and now() < e.ends_at
      )
    )
  );
drop policy if exists focus_items_delete_own_or_admin on public.focus_items;
create policy focus_items_delete_own_or_admin on public.focus_items
  for delete to authenticated using (auth.uid() = owner_id or public.is_admin());

drop policy if exists event_spaces_select on public.event_spaces;
create policy event_spaces_select on public.event_spaces
  for select to authenticated using (true);
drop policy if exists event_spaces_insert_admin on public.event_spaces;
create policy event_spaces_insert_admin on public.event_spaces
  for insert to authenticated with check (public.is_admin());
drop policy if exists event_spaces_update_admin on public.event_spaces;
create policy event_spaces_update_admin on public.event_spaces
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists event_spaces_delete_admin on public.event_spaces;
create policy event_spaces_delete_admin on public.event_spaces
  for delete to authenticated using (public.is_admin());

drop policy if exists huddles_select on public.huddles;
create policy huddles_select on public.huddles
  for select to authenticated using (true);
drop policy if exists huddles_insert_own on public.huddles;
create policy huddles_insert_own on public.huddles
  for insert to authenticated with check (
    auth.uid() = host_id
    and exists (
      select 1 from public.event_checkins c
      join public.events e on e.id = c.event_id
      where c.event_id = huddles.event_id
        and c.user_id = auth.uid()
        and c.checked_out_at is null
        and now() >= e.starts_at
        and now() < e.ends_at
    )
  );
drop policy if exists huddles_update_own_or_admin on public.huddles;
create policy huddles_update_own_or_admin on public.huddles
  for update to authenticated using (auth.uid() = host_id or public.is_admin())
  with check (auth.uid() = host_id or public.is_admin());
drop policy if exists huddles_delete_own_or_admin on public.huddles;
create policy huddles_delete_own_or_admin on public.huddles
  for delete to authenticated using (auth.uid() = host_id or public.is_admin());

drop policy if exists huddle_participants_select on public.huddle_participants;
create policy huddle_participants_select on public.huddle_participants
  for select to authenticated using (true);
drop policy if exists huddle_participants_insert_own on public.huddle_participants;
create policy huddle_participants_insert_own on public.huddle_participants
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.huddles h
      join public.event_checkins c on c.event_id = h.event_id
      where h.id = huddle_id
        and c.user_id = auth.uid()
        and c.checked_out_at is null
        and h.status in ('scheduled', 'live')
        and now() < h.ends_at
    )
  );
drop policy if exists huddle_participants_delete_own_or_admin on public.huddle_participants;
create policy huddle_participants_delete_own_or_admin on public.huddle_participants
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists event_demos_select on public.event_demos;
create policy event_demos_select on public.event_demos
  for select to authenticated using (true);
drop policy if exists event_demos_insert_own on public.event_demos;
create policy event_demos_insert_own on public.event_demos
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.build_log b
      where b.id = post_id and b.author_id = auth.uid() and b.event_id = event_demos.event_id
    )
    and exists (
      select 1 from public.event_checkins c
      join public.events e on e.id = c.event_id
      where c.event_id = event_demos.event_id
        and c.user_id = auth.uid()
        and c.checked_out_at is null
        and now() >= e.starts_at
        and now() < e.ends_at
    )
  );
drop policy if exists event_demos_update_own_or_admin on public.event_demos;
create policy event_demos_update_own_or_admin on public.event_demos
  for update to authenticated using (auth.uid() = user_id or public.is_admin())
  with check (
    public.is_admin()
    or (
      auth.uid() = user_id
      and exists (
        select 1 from public.build_log b
        where b.id = post_id and b.author_id = auth.uid() and b.event_id = event_demos.event_id
      )
      and exists (
        select 1 from public.event_checkins c
        join public.events e on e.id = c.event_id
        where c.event_id = event_demos.event_id
          and c.user_id = auth.uid()
          and c.checked_out_at is null
          and now() >= e.starts_at
          and now() < e.ends_at
      )
    )
  );
drop policy if exists event_demos_delete_own_or_admin on public.event_demos;
create policy event_demos_delete_own_or_admin on public.event_demos
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists event_notifications_select_own on public.event_notifications;
create policy event_notifications_select_own on public.event_notifications
  for select to authenticated using (auth.uid() = recipient_id);
drop policy if exists event_notifications_update_own on public.event_notifications;
create policy event_notifications_update_own on public.event_notifications
  for update to authenticated using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
drop policy if exists event_notifications_delete_own on public.event_notifications;
create policy event_notifications_delete_own on public.event_notifications
  for delete to authenticated using (auth.uid() = recipient_id);

-- New huddles notify checked-in builders whose profile matches the requested
-- skills or industries. With no audience filters, everyone currently present
-- receives the alert. The host is excluded.
create or replace function public.notify_huddle_audience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_notifications (
    event_id, recipient_id, kind, title, body, huddle_id
  )
  select
    new.event_id,
    c.user_id,
    'huddle',
    new.kind || ': ' || new.topic,
    coalesce(p.name, 'A builder') || ' booked a huddle that may be relevant to you.',
    new.id
  from public.event_checkins c
  join public.profiles p on p.id = new.host_id
  join public.profiles recipient on recipient.id = c.user_id
  where c.event_id = new.event_id
    and c.checked_out_at is null
    and c.user_id <> new.host_id
    and (
      (cardinality(new.welcome_skills) = 0 and cardinality(new.welcome_industries) = 0)
      or recipient.skills && new.welcome_skills
      or recipient.industries && new.welcome_industries
    )
  on conflict (recipient_id, huddle_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_huddle_created on public.huddles;
create trigger on_huddle_created
  after insert on public.huddles
  for each row execute function public.notify_huddle_audience();

-- These event-sized streams remain small and benefit from immediate updates.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_checkins') then
    alter publication supabase_realtime add table public.event_checkins;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='focus_items') then
    alter publication supabase_realtime add table public.focus_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_spaces') then
    alter publication supabase_realtime add table public.event_spaces;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='huddles') then
    alter publication supabase_realtime add table public.huddles;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='huddle_participants') then
    alter publication supabase_realtime add table public.huddle_participants;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_demos') then
    alter publication supabase_realtime add table public.event_demos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_notifications') then
    alter publication supabase_realtime add table public.event_notifications;
  end if;
end $$;
