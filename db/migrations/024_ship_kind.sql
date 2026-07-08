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
