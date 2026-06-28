-- 011 spotlight nominations: a builder can opt a ship of theirs in for an
-- external "spotlight" (e.g. a Build Club feature). Default is OFF; nothing is
-- ever featured externally without this explicit, per-post opt-in.
--
-- Curation is manual: an operator reads this queue with the service role and
-- sets `status`. No automated publishing, no admin UI in this slice. Not added
-- to the realtime publication; it is a queue, not a live feed.

create table if not exists public.spotlight_nominations (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.build_log(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending',  -- 'pending' | 'featured' | 'declined' (operator-set)
  created_at timestamptz not null default now(),
  unique (post_id)
);

create index if not exists spotlight_nominations_user_id_idx on public.spotlight_nominations(user_id);

alter table public.spotlight_nominations enable row level security;

-- A builder reads only their own nominations. The operator reads all via the
-- service role, which bypasses RLS.
drop policy if exists spotlight_nominations_select_own on public.spotlight_nominations;
create policy spotlight_nominations_select_own on public.spotlight_nominations
  for select to authenticated using (auth.uid() = user_id);

-- Insert only your own nomination, and only for a post you authored.
drop policy if exists spotlight_nominations_insert_own on public.spotlight_nominations;
create policy spotlight_nominations_insert_own on public.spotlight_nominations
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and exists (select 1 from public.build_log b where b.id = post_id and b.author_id = auth.uid())
  );

-- Withdraw your own nomination.
drop policy if exists spotlight_nominations_delete_own on public.spotlight_nominations;
create policy spotlight_nominations_delete_own on public.spotlight_nominations
  for delete to authenticated using (auth.uid() = user_id);
