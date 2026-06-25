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
