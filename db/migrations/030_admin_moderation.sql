-- 030 admin moderation: let staff delete any ship or blocker, not just their
-- own. These are additional PERMISSIVE delete policies alongside the existing
-- *_delete_own ones, so RLS OR-combines them: a row is deletable if you are its
-- author OR you are an admin. is_admin() (023) is SECURITY DEFINER, so it works
-- inside these policies without recursing into admins' own RLS.

drop policy if exists build_log_delete_admin on public.build_log;
create policy build_log_delete_admin on public.build_log
  for delete to authenticated using (public.is_admin());

drop policy if exists blockers_delete_admin on public.blockers;
create policy blockers_delete_admin on public.blockers
  for delete to authenticated using (public.is_admin());
