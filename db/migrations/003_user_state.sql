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
