-- 014 project labels: tag a project with industries and focus tags, reusing the
-- same taxonomies People uses (types/index.ts INDUSTRIES + ALL_TAGS). Both are
-- text[] defaulting to empty, so existing projects stay valid.

alter table public.projects
  add column if not exists industries text[] not null default '{}',
  add column if not exists tags       text[] not null default '{}';
