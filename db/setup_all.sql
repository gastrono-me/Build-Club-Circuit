-- ============================================================
-- Circuit — full schema setup bundle (generated)
-- Paste into the Supabase SQL editor of the NEW project and run.
-- Source of truth is db/migrations/*.sql + db/seed.sql; this is a
-- convenience concatenation in apply order. Safe to delete.
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
-- db/seed.sql
-- ─────────────────────────────────────────────────────────
-- seed: a few starter blockers so the Radar feed is never empty (community/seed posts, no author)
insert into public.blockers (author_id, category, note) values
  (null, 'hackathon help', 'Still haven''t received my API credits — anyone else waiting?'),
  (null, 'RAG/Retrieval',  'Retrieval keeps surfacing irrelevant chunks. Think my chunking strategy is off.'),
  (null, 'Deploy/Infra',   'Serverless function times out mid agent-loop. Need to trim latency somewhere.'),
  (null, 'Demo prep',      '3-minute pitch is still 6 minutes of jargon. Need to cut it down hard.')
on conflict do nothing;

