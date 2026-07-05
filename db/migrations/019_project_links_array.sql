-- 019 project links: a project can carry several links (website, repo, demo,
-- socials), not just one. Replaces the single link_url (018) with a text[] of
-- URLs, each rendered by its hostname. Any existing single link is preserved.

alter table public.projects
  add column if not exists links text[] not null default '{}';

update public.projects
  set links = array[link_url]
  where link_url is not null and btrim(link_url) <> '' and links = '{}';

alter table public.projects
  drop column if exists link_url;
