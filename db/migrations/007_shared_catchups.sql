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
