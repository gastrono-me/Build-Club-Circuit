-- 016 ship attachments: let a ship carry an optional link and/or one uploaded
-- file (a screenshot renders inline; any other file shows as a download chip),
-- so builders can show what they shipped, not just describe it.
--
-- Additive: all columns are nullable, so existing ships are unaffected.

alter table public.build_log
  add column if not exists link_url   text,
  add column if not exists media_url  text,
  add column if not exists media_type text,   -- the file's mime type (e.g. image/png)
  add column if not exists media_name text;   -- original filename, for the file chip label

-- Public bucket for ship media, mirroring the avatars bucket (004). Build-in-
-- public: the files are world-readable by URL, uploads are authenticated.
insert into storage.buckets (id, name, public)
values ('ships', 'ships', true)
on conflict (id) do nothing;

drop policy if exists ships_public_read on storage.objects;
create policy ships_public_read on storage.objects
  for select using (bucket_id = 'ships');

drop policy if exists ships_auth_insert on storage.objects;
create policy ships_auth_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'ships');

drop policy if exists ships_auth_update on storage.objects;
create policy ships_auth_update on storage.objects
  for update to authenticated using (bucket_id = 'ships');
