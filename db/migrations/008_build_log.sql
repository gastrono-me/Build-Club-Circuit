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
