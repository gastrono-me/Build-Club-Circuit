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
