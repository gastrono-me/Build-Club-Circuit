-- 021 ship comments: flat, one level, per ship. Cheers are applause; comments
-- are conversation ("how did you build that?"). Same shape and policies as
-- build_log_cheers (008), plus the aggregate-count view pattern from 012 so
-- feeds read one bounded row per post instead of scanning the table.

create table if not exists public.ship_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.build_log(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists ship_comments_post_idx on public.ship_comments (post_id, created_at);
create index if not exists ship_comments_author_idx on public.ship_comments (author_id, created_at);

alter table public.ship_comments enable row level security;

drop policy if exists ship_comments_select on public.ship_comments;
create policy ship_comments_select on public.ship_comments
  for select to authenticated using (true);

drop policy if exists ship_comments_insert_own on public.ship_comments;
create policy ship_comments_insert_own on public.ship_comments
  for insert to authenticated with check (auth.uid() = author_id);

drop policy if exists ship_comments_delete_own on public.ship_comments;
create policy ship_comments_delete_own on public.ship_comments
  for delete to authenticated using (auth.uid() = author_id);

-- One bounded row per post for feed badges.
create or replace view public.ship_comment_counts
  with (security_invoker = on) as
  select post_id, count(*)::int as comments
  from public.ship_comments
  group by post_id;

grant select on public.ship_comment_counts to authenticated;
