-- 020 storage hardening: lock the public buckets down to their owners and
-- enforce size/type limits at the storage layer, not just in client JS.
--
-- Before this, any authenticated user could (a) upload into anyone's folder,
-- (b) OVERWRITE anyone else's files via the broad update policies (e.g.
-- replace another builder's avatar.jpg), (c) upload any mime type at any
-- size (the 10 MB cap lived only in the browser). Both buckets already key
-- paths by {userId}/..., so policies scope to the first path segment.
-- Public read stays: build-in-public by design.

-- ── Bucket-level constraints ─────────────────────────────────────────────
-- Ships: images render inline; anything else is a download chip. HTML/SVG
-- are deliberately absent (script-bearing types); unknown types upload as
-- application/octet-stream (the client's fallback), which browsers download
-- rather than render.
update storage.buckets set
  file_size_limit = 10485760, -- 10 MB, matching the client cap
  allowed_mime_types = array[
    'image/png','image/jpeg','image/gif','image/webp','image/avif',
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/wav','audio/mp4',
    'application/pdf','application/zip','application/json',
    'text/plain','text/markdown','text/csv',
    'application/octet-stream'
  ]
where id = 'ships';

-- Avatars: the profile form compresses to JPEG client-side; keep headroom.
update storage.buckets set
  file_size_limit = 5242880, -- 5 MB
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'avatars';

-- ── Ships: owner-folder write policies ───────────────────────────────────
drop policy if exists ships_auth_insert on storage.objects;
create policy ships_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ships' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ships_auth_update on storage.objects;
drop policy if exists ships_owner_update on storage.objects;
create policy ships_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'ships' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'ships' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ships_owner_delete on storage.objects;
create policy ships_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ships' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Avatars: owner-folder write policies ─────────────────────────────────
drop policy if exists avatars_auth_insert on storage.objects;
create policy avatars_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_auth_update on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
