-- 009 events: events as first-class episodes inside one Circuit + membership.
--
-- The pivot from Vector: instead of one deployment per event, a single Circuit
-- holds many events. A builder has one persistent identity (profiles) and joins
-- events over time (event_members). Events are time-boxed; phase (upcoming/live/
-- ended) is derived from starts_at/ends_at at read time, not stored.

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,            -- URL handle, e.g. 'aabw-hcmc'
  name        text not null,
  tagline     text,
  location    text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.event_members (
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member',   -- 'member' | 'organizer'
  joined_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- fast "which events am I in" lookups
create index if not exists event_members_user_id_idx on public.event_members(user_id);

alter table public.events        enable row level security;
alter table public.event_members enable row level security;

-- Events are public to signed-in users (browse + join). Any authenticated user
-- can create one (organizer-lite); only the creator can edit/remove it. A proper
-- organizer/admin role split can tighten this later.
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated using (true);
drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events for insert to authenticated with check (auth.uid() = created_by);
drop policy if exists events_update_own on public.events;
create policy events_update_own on public.events for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);
drop policy if exists events_delete_own on public.events;
create policy events_delete_own on public.events for delete to authenticated using (auth.uid() = created_by);

-- Membership is visible to all signed-in users (the "who's here" roll-up); you
-- can only add/remove yourself.
drop policy if exists event_members_select on public.event_members;
create policy event_members_select on public.event_members for select to authenticated using (true);
drop policy if exists event_members_insert_own on public.event_members;
create policy event_members_insert_own on public.event_members for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists event_members_delete_own on public.event_members;
create policy event_members_delete_own on public.event_members for delete to authenticated using (auth.uid() = user_id);

-- Realtime: add tables to the supabase_realtime publication (idempotent)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='events') then
    alter publication supabase_realtime add table public.events;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_members') then
    alter publication supabase_realtime add table public.event_members;
  end if;
end $$;
