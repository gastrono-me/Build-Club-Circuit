-- 028 blocker resolve: close the "stuck" loop. A blocker could be posted and
-- deleted, but not marked solved. resolved_at (null = still stuck, a timestamp =
-- resolved) lets a builder retire a blocker as solved while keeping the record,
-- so the arc from "stuck" to "unstuck" is visible instead of vanishing.

alter table public.blockers
  add column if not exists resolved_at timestamptz;

-- Editing your own blocker had no policy before (only insert/delete existed);
-- add it so the author can flip resolved_at (resolve / reopen).
drop policy if exists blockers_update_own on public.blockers;
create policy blockers_update_own on public.blockers
  for update to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
