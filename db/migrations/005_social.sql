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
