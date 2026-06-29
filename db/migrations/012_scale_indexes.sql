-- 012 scale: bound the read cost of the live feeds for high-concurrency events
-- (target ~500 concurrent, headroom to 1000).
--
-- Two problems this addresses on the hot paths (build_log + blockers feeds):
--   1. The feeds order by created_at and read newest-first with a LIMIT; without
--      an index that is a full scan + sort on every fetch. Add created_at indexes.
--   2. The cheer / me-too counts were aggregated client-side by selecting the
--      ENTIRE cheers/metoo table on every realtime change. Replace that with
--      aggregate views so a client reads at most one row per visible post.
--
-- The composite primary keys already cover post_id/blocker_id prefixed lookups
-- (so the scoped `.in(post_id, ...)` count reads are indexed); no extra index
-- needed there.

create index if not exists build_log_created_at_idx on public.build_log (created_at desc);
create index if not exists blockers_created_at_idx  on public.blockers  (created_at desc);

-- Aggregate count views. security_invoker so the caller's RLS applies (both
-- base tables already allow authenticated to select all rows), and the view is
-- never a privilege-escalation path. Each returns one row per post/blocker that
-- has at least one cheer/me-too; posts with none simply do not appear and the
-- client defaults them to 0.
create or replace view public.build_log_cheer_counts
  with (security_invoker = on) as
  select post_id, count(*)::int as cheers
  from public.build_log_cheers
  group by post_id;

create or replace view public.blocker_metoo_counts
  with (security_invoker = on) as
  select blocker_id, count(*)::int as metoo
  from public.blocker_metoo
  group by blocker_id;

grant select on public.build_log_cheer_counts to authenticated;
grant select on public.blocker_metoo_counts  to authenticated;
