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
