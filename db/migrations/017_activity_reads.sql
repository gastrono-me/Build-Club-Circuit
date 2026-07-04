-- 017 activity notifications: a read cursor for "who reacted to my ships".
--
-- Cheers already live in build_log_cheers (008); this only adds the per-user
-- "last time I looked at my activity" marker so the bell can show an unread
-- count for cheers on your own posts, the same way message_reads (006) does
-- for direct messages. One row per user, so a single cursor covers the stream.

create table if not exists public.activity_reads (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now()
);

alter table public.activity_reads enable row level security;

drop policy if exists activity_reads_all_own on public.activity_reads;
create policy activity_reads_all_own on public.activity_reads
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
