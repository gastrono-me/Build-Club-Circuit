-- ============================================================
-- Circuit — full schema setup bundle (generated)
-- Paste into the Supabase SQL editor of the NEW project and run.
-- Idempotent: safe to re-run after adding migrations.
-- Source of truth is db/migrations/*.sql + db/seed.sql.
-- ============================================================


-- ─────────────────────────────────────────────────────────
-- db/migrations/001_profiles.sql
-- ─────────────────────────────────────────────────────────
-- 001 profiles: per-user profile keyed to auth.users, RLS, new-user trigger
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text,
  occupation  text,
  org         text,
  tagline     text,
  bio         text,
  skills      text[]      not null default '{}',
  industries  text[]      not null default '{}',
  looking     text[]      not null default '{}',
  links       jsonb       not null default '{}',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- auto-create a blank profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─────────────────────────────────────────────────────────
-- db/migrations/002_radar.sql
-- ─────────────────────────────────────────────────────────
-- 002 radar: shared blocker feed + "me too", RLS, Realtime (the hero)
create table if not exists public.blockers (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid references public.profiles(id) on delete cascade,  -- nullable: seed/community posts
  category   text not null,
  note       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.blocker_metoo (
  blocker_id uuid references public.blockers(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, user_id)
);

alter table public.blockers      enable row level security;
alter table public.blocker_metoo enable row level security;

-- signed-in users read the whole feed
drop policy if exists blockers_select on public.blockers;
create policy blockers_select on public.blockers for select to authenticated using (true);
drop policy if exists blockers_insert_own on public.blockers;
create policy blockers_insert_own on public.blockers for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists blockers_delete_own on public.blockers;
create policy blockers_delete_own on public.blockers for delete to authenticated using (auth.uid() = author_id);

drop policy if exists metoo_select on public.blocker_metoo;
create policy metoo_select on public.blocker_metoo for select to authenticated using (true);
drop policy if exists metoo_insert_own on public.blocker_metoo;
create policy metoo_insert_own on public.blocker_metoo for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists metoo_delete_own on public.blocker_metoo;
create policy metoo_delete_own on public.blocker_metoo for delete to authenticated using (auth.uid() = user_id);

-- Realtime: add tables to the supabase_realtime publication (idempotent)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='blockers') then
    alter publication supabase_realtime add table public.blockers;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='blocker_metoo') then
    alter publication supabase_realtime add table public.blocker_metoo;
  end if;
end $$;


-- ─────────────────────────────────────────────────────────
-- db/migrations/003_user_state.sql
-- ─────────────────────────────────────────────────────────
-- 003 user state: saved schedule + deadline checklist, persisted per user
create table if not exists public.saved_sessions (
  user_id    uuid references public.profiles(id) on delete cascade,
  session_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

create table if not exists public.checklist_state (
  user_id  uuid references public.profiles(id) on delete cascade,
  item_id  text not null,
  checked  boolean not null default false,
  primary key (user_id, item_id)
);

alter table public.saved_sessions  enable row level security;
alter table public.checklist_state enable row level security;

drop policy if exists saved_sessions_all_own on public.saved_sessions;
create policy saved_sessions_all_own on public.saved_sessions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists checklist_state_all_own on public.checklist_state;
create policy checklist_state_all_own on public.checklist_state
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────
-- db/migrations/004_storage.sql
-- ─────────────────────────────────────────────────────────
-- 004 storage: public avatars bucket + policies
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_auth_insert on storage.objects;
create policy avatars_auth_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

drop policy if exists avatars_auth_update on storage.objects;
create policy avatars_auth_update on storage.objects
  for update to authenticated using (bucket_id = 'avatars');


-- ─────────────────────────────────────────────────────────
-- db/migrations/005_social.sql
-- ─────────────────────────────────────────────────────────
-- 005 social: connections, 1:1 catchups, 1:1 chat transcripts, submission link.
-- person_id is a free-text mock-attendee id (no FK to auth.users for the other party).
create table if not exists public.connections (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  person_id  text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, person_id)
);

create table if not exists public.catchups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  person_id   text not null,
  person_name text,
  day         int  not null,
  start_min   int  not null,
  end_min     int  not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  person_id  text not null,
  sender     text not null check (sender in ('me','them')),
  body       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  devpost_url text,
  updated_at  timestamptz not null default now()
);

alter table public.connections  enable row level security;
alter table public.catchups      enable row level security;
alter table public.chat_messages enable row level security;
alter table public.submissions   enable row level security;

drop policy if exists connections_all_own on public.connections;
create policy connections_all_own on public.connections
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists catchups_all_own on public.catchups;
create policy catchups_all_own on public.catchups
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists chat_messages_all_own on public.chat_messages;
create policy chat_messages_all_own on public.chat_messages
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists submissions_all_own on public.submissions;
create policy submissions_all_own on public.submissions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists chat_messages_user_person_idx on public.chat_messages (user_id, person_id, created_at);
create index if not exists catchups_user_idx on public.catchups (user_id);


-- ─────────────────────────────────────────────────────────
-- db/migrations/006_messaging.sql
-- ─────────────────────────────────────────────────────────
-- 006 messaging: real cross-user direct messages + unread tracking, RLS, Realtime.
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body         text not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.message_reads (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  other_id     uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, other_id)
);

alter table public.messages      enable row level security;
alter table public.message_reads enable row level security;

drop policy if exists messages_select_party on public.messages;
create policy messages_select_party on public.messages
  for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own on public.messages
  for insert to authenticated with check (auth.uid() = sender_id);

drop policy if exists message_reads_all_own on public.message_reads;
create policy message_reads_all_own on public.message_reads
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists messages_pair_idx on public.messages (sender_id, recipient_id, created_at);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at);

-- Realtime: add messages to the supabase_realtime publication (idempotent)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;


-- ─────────────────────────────────────────────────────────
-- db/migrations/007_shared_catchups.sql
-- ─────────────────────────────────────────────────────────
-- 007 shared catchups: retire the private one-sided connections/catchups model.
--
-- connections was a private per-user boolean ("I connected with X") that gated
-- nothing and implied a mutual relationship it never had — removed outright.
--
-- catchups was keyed by (user_id, person_id) and written only to the current
-- user's own row, so the other party never saw a proposed time and could
-- double-book. Recreated as a real two-party table, RLS shaped exactly like
-- messages (006_messaging.sql): either party can read, only the proposer can
-- insert, either party can update/delete (accept, decline, cancel).

drop table if exists public.connections cascade;
drop table if exists public.catchups cascade;

create table public.catchups (
  id           uuid primary key default gen_random_uuid(),
  proposer_id  uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  day          int  not null,
  start_min    int  not null,
  end_min      int  not null,
  status       text not null default 'proposed' check (status in ('proposed','accepted','declined','cancelled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.catchups enable row level security;

drop policy if exists catchups_select_party on public.catchups;
create policy catchups_select_party on public.catchups
  for select to authenticated using (auth.uid() = proposer_id or auth.uid() = recipient_id);

drop policy if exists catchups_insert_own on public.catchups;
create policy catchups_insert_own on public.catchups
  for insert to authenticated with check (auth.uid() = proposer_id);

drop policy if exists catchups_update_party on public.catchups;
create policy catchups_update_party on public.catchups
  for update to authenticated using (auth.uid() = proposer_id or auth.uid() = recipient_id);

drop policy if exists catchups_delete_party on public.catchups;
create policy catchups_delete_party on public.catchups
  for delete to authenticated using (auth.uid() = proposer_id or auth.uid() = recipient_id);

create index if not exists catchups_proposer_idx on public.catchups (proposer_id);
create index if not exists catchups_recipient_idx on public.catchups (recipient_id);

-- Realtime: add catchups to the supabase_realtime publication (idempotent)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='catchups') then
    alter publication supabase_realtime add table public.catchups;
  end if;
end $$;


-- ─────────────────────────────────────────────────────────
-- db/migrations/008_build_log.sql
-- ─────────────────────────────────────────────────────────
-- 008 build log: a shipped-progress feed to complement the Radar's "stuck" feed.
--
-- Same shape as 002_radar.sql (blockers/blocker_metoo), with one difference:
-- author_id is NOT NULL here — there are no anonymous/seed Build Log posts.

create table if not exists public.build_log (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles(id) on delete cascade,
  category   text not null,
  note       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.build_log_cheers (
  post_id    uuid references public.build_log(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.build_log        enable row level security;
alter table public.build_log_cheers enable row level security;

drop policy if exists build_log_select on public.build_log;
create policy build_log_select on public.build_log for select to authenticated using (true);
drop policy if exists build_log_insert_own on public.build_log;
create policy build_log_insert_own on public.build_log for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists build_log_delete_own on public.build_log;
create policy build_log_delete_own on public.build_log for delete to authenticated using (auth.uid() = author_id);

drop policy if exists build_log_cheers_select on public.build_log_cheers;
create policy build_log_cheers_select on public.build_log_cheers for select to authenticated using (true);
drop policy if exists build_log_cheers_insert_own on public.build_log_cheers;
create policy build_log_cheers_insert_own on public.build_log_cheers for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists build_log_cheers_delete_own on public.build_log_cheers;
create policy build_log_cheers_delete_own on public.build_log_cheers for delete to authenticated using (auth.uid() = user_id);

-- Realtime: add tables to the supabase_realtime publication (idempotent)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='build_log') then
    alter publication supabase_realtime add table public.build_log;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='build_log_cheers') then
    alter publication supabase_realtime add table public.build_log_cheers;
  end if;
end $$;


-- ─────────────────────────────────────────────────────────
-- db/migrations/009_events.sql
-- ─────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────
-- db/migrations/010_event_scoping.sql
-- ─────────────────────────────────────────────────────────
-- 010 event scoping: tag Radar blockers and Build Log ships with an event.
--
-- event_id is NULLABLE on purpose. The everyday loop (no event running) posts
-- with event_id = NULL; posting inside an event tags it with that event. This
-- lets the same feed roll up two ways:
--   - global signal:  all rows (the always-on Circuit view)
--   - event signal:   rows where event_id = <event>  (the episode view)
--
-- on delete set null: a builder's Radar/Build Log history is part of their
-- persistent journey, so deleting an event must NOT delete their posts — it
-- only drops the event tag.

alter table public.blockers  add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.build_log add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists blockers_event_id_idx  on public.blockers(event_id);
create index if not exists build_log_event_id_idx on public.build_log(event_id);


-- ─────────────────────────────────────────────────────────
-- db/migrations/011_spotlight_nominations.sql
-- ─────────────────────────────────────────────────────────
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
    and status = 'pending'
    and exists (select 1 from public.build_log b where b.id = post_id and b.author_id = auth.uid())
  );

-- Withdraw your own nomination.
drop policy if exists spotlight_nominations_delete_own on public.spotlight_nominations;
create policy spotlight_nominations_delete_own on public.spotlight_nominations
  for delete to authenticated using (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────
-- db/migrations/012_scale_indexes.sql
-- ─────────────────────────────────────────────────────────
-- 012 scale: bound the read cost of the live feeds for high-concurrency events
-- (target ~500 concurrent, headroom to 1000).
--
-- Two problems this addresses on the hot paths (build_log + blockers feeds):
--   1. The feeds order by created_at and read newest-first with a LIMIT; without
--      an index that is a full scan + sort on every fetch. Add created_at indexes.
--   2. The cheer / me-too counts were aggregated client-side by selecting the
--      ENTIRE cheers/metoo table on every realtime change. Replace that with
--      aggregate views so a client reads at most one row per visible post.
--
-- The composite primary keys already cover post_id/blocker_id prefixed lookups
-- (so the scoped `.in(post_id, ...)` count reads are indexed); no extra index
-- needed there.

create index if not exists build_log_created_at_idx on public.build_log (created_at desc);
create index if not exists blockers_created_at_idx  on public.blockers  (created_at desc);

-- Aggregate count views. security_invoker so the caller's RLS applies (both
-- base tables already allow authenticated to select all rows), and the view is
-- never a privilege-escalation path. Each returns one row per post/blocker that
-- has at least one cheer/me-too; posts with none simply do not appear and the
-- client defaults them to 0.
create or replace view public.build_log_cheer_counts
  with (security_invoker = on) as
  select post_id, count(*)::int as cheers
  from public.build_log_cheers
  group by post_id;

create or replace view public.blocker_metoo_counts
  with (security_invoker = on) as
  select blocker_id, count(*)::int as metoo
  from public.blocker_metoo
  group by blocker_id;

grant select on public.build_log_cheer_counts to authenticated;
grant select on public.blocker_metoo_counts  to authenticated;


-- ─────────────────────────────────────────────────────────
-- db/migrations/013_projects.sql
-- ─────────────────────────────────────────────────────────
-- 013 projects: a builder's ongoing piece of work that ships accrue under.
--
-- A project is personal (one owner) and public to the cohort, like ships are:
-- everyone signed in can browse any project and its ship timeline; only the
-- owner can create, edit, or delete theirs. Tagging a ship with a project is
-- optional -- the daily ritual stays one-box simple, projects add the arc.

create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  tagline    text,
  created_at timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on public.projects(owner_id);

-- Ships link to a project. Nullable: untagged ships stay valid, and deleting a
-- project keeps its ships (they just lose the tag).
alter table public.build_log
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists build_log_project_id_idx on public.build_log(project_id);

alter table public.projects enable row level security;

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated using (true);

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
  for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
  for delete to authenticated using (auth.uid() = owner_id);

-- Per-project ship rollup, same aggregate-view pattern as 012: one bounded row
-- per project instead of clients scanning build_log to count.
create or replace view public.project_ship_counts
  with (security_invoker = on) as
  select project_id, count(*)::int as ships, max(created_at) as last_ship
  from public.build_log
  where project_id is not null
  group by project_id;

grant select on public.project_ship_counts to authenticated;


-- ─────────────────────────────────────────────────────────
-- db/migrations/014_project_labels.sql
-- ─────────────────────────────────────────────────────────
-- 014 project labels: tag a project with industries and focus tags, reusing the
-- same taxonomies People uses (types/index.ts INDUSTRIES + ALL_TAGS). Both are
-- text[] defaulting to empty, so existing projects stay valid.

alter table public.projects
  add column if not exists industries text[] not null default '{}',
  add column if not exists tags       text[] not null default '{}';


-- ─────────────────────────────────────────────────────────
-- db/migrations/015_catchups_calendar.sql
-- ─────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────
-- db/seed.sql
-- ─────────────────────────────────────────────────────────
-- seed: a few starter blockers so the Radar feed is never empty (community/seed posts, no author)
insert into public.blockers (author_id, category, note) values
  (null, 'Getting unstuck', 'Still haven''t received my API credits — anyone else waiting?'),
  (null, 'RAG/Retrieval',  'Retrieval keeps surfacing irrelevant chunks. Think my chunking strategy is off.'),
  (null, 'Deploy/Infra',   'Serverless function times out mid agent-loop. Need to trim latency somewhere.'),
  (null, 'Launch/Demo',     '3-minute pitch is still 6 minutes of jargon. Need to cut it down hard.')
on conflict do nothing;

-- seed events as episodes: one live now, one upcoming. Dates are relative to
-- now() so the Events page always shows a useful mix. created_by is null (no
-- organizer account required to seed).
insert into public.events (slug, name, tagline, location, starts_at, ends_at) values
  ('aabw-hcmc',      'Agentic AI Build Week', 'Five days, one build, shipped live.', 'Ho Chi Minh City', now() - interval '1 day',  now() + interval '4 days'),
  ('circuit-sprint', 'Circuit Launch Sprint', 'A weekend to ship your next thing.',  'Online',           now() + interval '7 days', now() + interval '9 days')
on conflict (slug) do nothing;

