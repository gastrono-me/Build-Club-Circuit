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
