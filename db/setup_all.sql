-- ============================================================
-- Circuit — full schema setup bundle (generated)
-- Paste into the Supabase SQL editor of a NEW project and run.
-- Idempotent: safe to re-run after adding migrations.
-- Source of truth is db/migrations/*.sql + db/seed.sql.
-- Regenerate with: npm run db:bundle
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
-- db/migrations/016_ship_attachments.sql
-- ─────────────────────────────────────────────────────────
-- 016 ship attachments: let a ship carry an optional link and/or one uploaded
-- file (a screenshot renders inline; any other file shows as a download chip),
-- so builders can show what they shipped, not just describe it.
--
-- Additive: all columns are nullable, so existing ships are unaffected.

alter table public.build_log
  add column if not exists link_url   text,
  add column if not exists media_url  text,
  add column if not exists media_type text,   -- the file's mime type (e.g. image/png)
  add column if not exists media_name text;   -- original filename, for the file chip label

-- Public bucket for ship media, mirroring the avatars bucket (004). Build-in-
-- public: the files are world-readable by URL, uploads are authenticated.
insert into storage.buckets (id, name, public)
values ('ships', 'ships', true)
on conflict (id) do nothing;

drop policy if exists ships_public_read on storage.objects;
create policy ships_public_read on storage.objects
  for select using (bucket_id = 'ships');

drop policy if exists ships_auth_insert on storage.objects;
create policy ships_auth_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'ships');

drop policy if exists ships_auth_update on storage.objects;
create policy ships_auth_update on storage.objects
  for update to authenticated using (bucket_id = 'ships');


-- ─────────────────────────────────────────────────────────
-- db/migrations/017_activity_reads.sql
-- ─────────────────────────────────────────────────────────
-- 017 activity notifications: a read cursor for "who reacted to my ships".
--
-- Cheers already live in build_log_cheers (008); this only adds the per-user
-- "last time I looked at my activity" marker so the bell can show an unread
-- count for cheers on your own posts, the same way message_reads (006) does
-- for direct messages. One row per user, so a single cursor covers the stream.

create table if not exists public.activity_reads (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now()
);

alter table public.activity_reads enable row level security;

drop policy if exists activity_reads_all_own on public.activity_reads;
create policy activity_reads_all_own on public.activity_reads
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────
-- db/migrations/018_project_link.sql
-- ─────────────────────────────────────────────────────────
-- 018 project link: a project's primary URL (its website, repo, or demo), so a
-- builder can point the cohort at the thing itself once it exists -- e.g. when
-- they launch a site. Nullable, so existing projects stay valid.

alter table public.projects
  add column if not exists link_url text;


-- ─────────────────────────────────────────────────────────
-- db/migrations/019_project_links_array.sql
-- ─────────────────────────────────────────────────────────
-- 019 project links: a project can carry several links (website, repo, demo,
-- socials), not just one. Replaces the single link_url (018) with a text[] of
-- URLs, each rendered by its hostname. Any existing single link is preserved.

alter table public.projects
  add column if not exists links text[] not null default '{}';

update public.projects
  set links = array[link_url]
  where link_url is not null and btrim(link_url) <> '' and links = '{}';

alter table public.projects
  drop column if exists link_url;


-- ─────────────────────────────────────────────────────────
-- db/migrations/020_storage_hardening.sql
-- ─────────────────────────────────────────────────────────
-- 020 storage hardening: lock the public buckets down to their owners and
-- enforce size/type limits at the storage layer, not just in client JS.
--
-- Before this, any authenticated user could (a) upload into anyone's folder,
-- (b) OVERWRITE anyone else's files via the broad update policies (e.g.
-- replace another builder's avatar.jpg), (c) upload any mime type at any
-- size (the 10 MB cap lived only in the browser). Both buckets already key
-- paths by {userId}/..., so policies scope to the first path segment.
-- Public read stays: build-in-public by design.

-- ── Bucket-level constraints ─────────────────────────────────────────────
-- Ships: images render inline; anything else is a download chip. HTML/SVG
-- are deliberately absent (script-bearing types); unknown types upload as
-- application/octet-stream (the client's fallback), which browsers download
-- rather than render.
update storage.buckets set
  file_size_limit = 10485760, -- 10 MB, matching the client cap
  allowed_mime_types = array[
    'image/png','image/jpeg','image/gif','image/webp','image/avif',
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/wav','audio/mp4',
    'application/pdf','application/zip','application/json',
    'text/plain','text/markdown','text/csv',
    'application/octet-stream'
  ]
where id = 'ships';

-- Avatars: the profile form compresses to JPEG client-side; keep headroom.
update storage.buckets set
  file_size_limit = 5242880, -- 5 MB
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'avatars';

-- ── Ships: owner-folder write policies ───────────────────────────────────
drop policy if exists ships_auth_insert on storage.objects;
create policy ships_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ships' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ships_auth_update on storage.objects;
drop policy if exists ships_owner_update on storage.objects;
create policy ships_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'ships' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'ships' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ships_owner_delete on storage.objects;
create policy ships_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ships' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Avatars: owner-folder write policies ─────────────────────────────────
drop policy if exists avatars_auth_insert on storage.objects;
create policy avatars_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_auth_update on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- ─────────────────────────────────────────────────────────
-- db/migrations/021_ship_comments.sql
-- ─────────────────────────────────────────────────────────
-- 021 ship comments: flat, one level, per ship. Cheers are applause; comments
-- are conversation ("how did you build that?"). Same shape and policies as
-- build_log_cheers (008), plus the aggregate-count view pattern from 012 so
-- feeds read one bounded row per post instead of scanning the table.

create table if not exists public.ship_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.build_log(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists ship_comments_post_idx on public.ship_comments (post_id, created_at);
create index if not exists ship_comments_author_idx on public.ship_comments (author_id, created_at);

alter table public.ship_comments enable row level security;

drop policy if exists ship_comments_select on public.ship_comments;
create policy ship_comments_select on public.ship_comments
  for select to authenticated using (true);

drop policy if exists ship_comments_insert_own on public.ship_comments;
create policy ship_comments_insert_own on public.ship_comments
  for insert to authenticated with check (auth.uid() = author_id);

drop policy if exists ship_comments_delete_own on public.ship_comments;
create policy ship_comments_delete_own on public.ship_comments
  for delete to authenticated using (auth.uid() = author_id);

-- One bounded row per post for feed badges.
create or replace view public.ship_comment_counts
  with (security_invoker = on) as
  select post_id, count(*)::int as comments
  from public.ship_comments
  group by post_id;

grant select on public.ship_comment_counts to authenticated;


-- ─────────────────────────────────────────────────────────
-- db/migrations/022_evergreen_data.sql
-- ─────────────────────────────────────────────────────────
-- 022 evergreen data: the code moved to the shared work taxonomy (WORK_CATEGORIES)
-- but the live rows didn't. Two fixes:
--
-- 1) Remap legacy AABW-era categories on blockers and ships to the new
--    taxonomy, so every node on the embedding fields gets a real anchor and
--    color instead of the hash/ink fallback.
-- 2) Replace the seeded community blockers (author_id is null) with a
--    discipline-spanning evergreen set - the old ones were all AI-hackathon
--    problems (API credits, chunking, agent loops), which read wrong for a
--    community that includes GTM, sales, and design builders.

-- ── 1) Category remap (both tables share the taxonomy) ────────────────────
update public.blockers set category = 'Engineering'
  where category in ('Auth/Login','Deploy/Infra','RAG/Retrieval','Agent loops','Rate limits/Cost','Data/Eval');
update public.blockers set category = 'Design'  where category = 'UI polish';
update public.blockers set category = 'Product' where category = 'Launch/Demo';
update public.blockers set category = 'Other'   where category = 'Getting unstuck';

update public.build_log set category = 'Engineering'
  where category in ('Auth/Login','Deploy/Infra','RAG/Retrieval','Agent loops','Rate limits/Cost','Data/Eval');
update public.build_log set category = 'Design'  where category = 'UI polish';
update public.build_log set category = 'Product' where category = 'Launch/Demo';
update public.build_log set category = 'Other'   where category = 'Getting unstuck';

-- ── 2) Reseed the community blockers ──────────────────────────────────────
-- Null-author rows are seeds by definition (the UI labels them "Community").
-- Their me-toos cascade away with them; they are demo content.
delete from public.blockers where author_id is null;

insert into public.blockers (author_id, category, note) values
  (null, 'Engineering', 'OAuth redirect loops forever on mobile Safari. Third day on this.'),
  (null, 'Product',     'People sign up, poke around once, and never come back. Cannot tell which feature is supposed to hook them.'),
  (null, 'Growth',      'Landing page converts at under 1 percent. Not sure if it is the copy or the audience.'),
  (null, 'Sales',       'Demos go great, then the deal goes quiet. Following up without being annoying is a skill I do not have yet.'),
  (null, 'Fundraising', '3-minute pitch is still 6 minutes of jargon. Need to cut it down hard.');


-- ─────────────────────────────────────────────────────────
-- db/migrations/023_admins.sql
-- ─────────────────────────────────────────────────────────
-- 023 admins: a staff role, and events become admin-managed.
--
-- Deliberately a SEPARATE table, not a column on profiles: profiles_update_own
-- (001) lets a user edit any column on their own row, so an is_admin flag there
-- would be self-grantable. This table has a read policy but NO write policy, so
-- normal users can never insert/update it - admin status is bootstrapped by
-- inserting a row from the Supabase SQL editor (service role bypasses RLS):
--   insert into public.admins (user_id) values ('<your-profile-uuid>');

create table if not exists public.admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- You can see whether YOU are an admin; you cannot enumerate staff or write it.
drop policy if exists admins_select_own on public.admins;
create policy admins_select_own on public.admins
  for select to authenticated using (user_id = auth.uid());

-- SECURITY DEFINER so RLS policies can call it without recursing into admins'
-- own RLS. STABLE: one lookup per statement.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- Events: writes move from creator-scoped to admin-only. Reads + join/leave
-- (event_members) are unchanged - any builder still browses and joins.
drop policy if exists events_insert_own on public.events;
drop policy if exists events_insert_admin on public.events;
create policy events_insert_admin on public.events
  for insert to authenticated with check (public.is_admin());

drop policy if exists events_update_own on public.events;
drop policy if exists events_update_admin on public.events;
create policy events_update_admin on public.events
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists events_delete_own on public.events;
drop policy if exists events_delete_admin on public.events;
create policy events_delete_admin on public.events
  for delete to authenticated using (public.is_admin());


-- ─────────────────────────────────────────────────────────
-- db/migrations/024_ship_kind.sql
-- ─────────────────────────────────────────────────────────
-- 024 ship type: a second axis on ships, orthogonal to the work category.
-- Category = which discipline (Product/Engineering/…); kind = how significant
-- (Update / Feature / Milestone). Free text like category, default 'Update'
-- (most ships are small updates). Adding the column backfills existing rows to
-- 'Update'.

alter table public.build_log
  add column if not exists kind text not null default 'Update';

-- Editing your own ship had no policy before (only insert/delete existed);
-- add it so builders can reclassify a ship's type after posting.
drop policy if exists build_log_update_own on public.build_log;
create policy build_log_update_own on public.build_log
  for update to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- Per-project, per-kind ship counts for the project tally. One bounded row per
-- (project, kind), same aggregate-view pattern as 012/013.
create or replace view public.project_ship_kind_counts
  with (security_invoker = on) as
  select project_id, kind, count(*)::int as count
  from public.build_log
  where project_id is not null
  group by project_id, kind;

grant select on public.project_ship_kind_counts to authenticated;


-- ─────────────────────────────────────────────────────────
-- db/migrations/025_author_ship_counts.sql
-- ─────────────────────────────────────────────────────────
-- 025 author ship tally: per-builder, per-kind ship counts for the profile
-- popup ("Ada has shipped 12 updates, 3 features, 2 milestones"). Same
-- aggregate-view pattern as project_ship_kind_counts (024), grouped by author
-- instead of project. Counts every ship the builder has logged, project-tagged
-- or not.

create or replace view public.author_ship_kind_counts
  with (security_invoker = on) as
  select author_id, kind, count(*)::int as count
  from public.build_log
  group by author_id, kind;

grant select on public.author_ship_kind_counts to authenticated;


-- ─────────────────────────────────────────────────────────
-- db/migrations/026_project_stage.sql
-- ─────────────────────────────────────────────────────────
-- 026 project stage: where a project is on its lifecycle arc (Idea -> Prototype
-- -> MVP -> Launched -> Revenue -> Scaling). A single value per project (unlike
-- the multi-value industries/tags labels), nullable — not every project sets
-- one. Free text, so the set can change with no migration.

alter table public.projects
  add column if not exists stage text;


-- ─────────────────────────────────────────────────────────
-- db/migrations/027_onboarding.sql
-- ─────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────
-- db/migrations/028_blocker_resolve.sql
-- ─────────────────────────────────────────────────────────
-- 028 blocker resolve: close the "stuck" loop. A blocker could be posted and
-- deleted, but not marked solved. resolved_at (null = still stuck, a timestamp =
-- resolved) lets a builder retire a blocker as solved while keeping the record,
-- so the arc from "stuck" to "unstuck" is visible instead of vanishing.

alter table public.blockers
  add column if not exists resolved_at timestamptz;

-- Editing your own blocker had no policy before (only insert/delete existed);
-- add it so the author can flip resolved_at (resolve / reopen).
drop policy if exists blockers_update_own on public.blockers;
create policy blockers_update_own on public.blockers
  for update to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);


-- ─────────────────────────────────────────────────────────
-- db/migrations/029_drop_seed_blockers.sql
-- ─────────────────────────────────────────────────────────
-- 029 drop the seeded "community" blockers. Migration 022 reseeded a set of
-- null-author demo blockers to keep the stuck feed from looking empty. The
-- cohort is now real, so the placeholder posts are just fake data on a live
-- surface. Remove them; their me-toos cascade away with them. Real blockers
-- always carry an author_id (post() sets auth.uid()), so this only touches seeds.

delete from public.blockers where author_id is null;


-- ─────────────────────────────────────────────────────────
-- db/migrations/030_admin_moderation.sql
-- ─────────────────────────────────────────────────────────
-- 030 admin moderation: let staff delete any ship or blocker, not just their
-- own. These are additional PERMISSIVE delete policies alongside the existing
-- *_delete_own ones, so RLS OR-combines them: a row is deletable if you are its
-- author OR you are an admin. is_admin() (023) is SECURITY DEFINER, so it works
-- inside these policies without recursing into admins' own RLS.

drop policy if exists build_log_delete_admin on public.build_log;
create policy build_log_delete_admin on public.build_log
  for delete to authenticated using (public.is_admin());

drop policy if exists blockers_delete_admin on public.blockers;
create policy blockers_delete_admin on public.blockers
  for delete to authenticated using (public.is_admin());


-- ─────────────────────────────────────────────────────────
-- db/migrations/031_live_coworking.sql
-- ─────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────
-- db/migrations/032_staff_event_operators.sql
-- ─────────────────────────────────────────────────────────
-- 032 staff event operators: one operational role for Circuit.
--
-- Build Club staff (public.admins) create and operate every event. The legacy
-- event_members.role column was never read or enforced, and its original join
-- policy allowed a builder to choose its value. Removing it prevents a second,
-- misleading authorization path: event_members now represents participation
-- only, while public.is_admin() remains the sole staff capability check.

alter table public.event_members
  drop column if exists role;


-- ─────────────────────────────────────────────────────────
-- db/seed.sql
-- ─────────────────────────────────────────────────────────
-- Blockers are not seeded: the stuck feed shows only real builder posts. (An
-- earlier build seeded null-author "community" blockers; migration 029 removed
-- them.)

-- seed events as episodes: one live now, one upcoming. Dates are relative to
-- now() so the Events page always shows a useful mix. created_by is null (no
-- organizer account required to seed).
insert into public.events (slug, name, tagline, location, starts_at, ends_at) values
  ('aabw-hcmc',      'Agentic AI Build Week', 'Five days, one build, shipped live.', 'Ho Chi Minh City', now() - interval '1 day',  now() + interval '4 days'),
  ('circuit-sprint', 'Circuit Launch Sprint', 'A weekend to ship your next thing.',  'Online',           now() + interval '7 days', now() + interval '9 days')
on conflict (slug) do nothing;
