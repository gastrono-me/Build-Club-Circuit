-- 018 project link: a project's primary URL (its website, repo, or demo), so a
-- builder can point the cohort at the thing itself once it exists -- e.g. when
-- they launch a site. Nullable, so existing projects stay valid.

alter table public.projects
  add column if not exists link_url text;
