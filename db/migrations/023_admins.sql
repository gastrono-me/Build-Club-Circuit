-- 023 admins: a staff role, and events become admin-managed.
--
-- Deliberately a SEPARATE table, not a column on profiles: profiles_update_own
-- (001) lets a user edit any column on their own row, so an is_admin flag there
-- would be self-grantable. This table has a read policy but NO write policy, so
-- normal users can never insert/update it - admin status is bootstrapped by
-- inserting a row from the Supabase SQL editor (service role bypasses RLS):
--   insert into public.admins (user_id) values ('<your-profile-uuid>');

create table if not exists public.admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- You can see whether YOU are an admin; you cannot enumerate staff or write it.
drop policy if exists admins_select_own on public.admins;
create policy admins_select_own on public.admins
  for select to authenticated using (user_id = auth.uid());

-- SECURITY DEFINER so RLS policies can call it without recursing into admins'
-- own RLS. STABLE: one lookup per statement.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- Events: writes move from creator-scoped to admin-only. Reads + join/leave
-- (event_members) are unchanged - any builder still browses and joins.
drop policy if exists events_insert_own on public.events;
drop policy if exists events_insert_admin on public.events;
create policy events_insert_admin on public.events
  for insert to authenticated with check (public.is_admin());

drop policy if exists events_update_own on public.events;
drop policy if exists events_update_admin on public.events;
create policy events_update_admin on public.events
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists events_delete_own on public.events;
drop policy if exists events_delete_admin on public.events;
create policy events_delete_admin on public.events
  for delete to authenticated using (public.is_admin());
