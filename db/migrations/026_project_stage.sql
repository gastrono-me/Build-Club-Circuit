-- 026 project stage: where a project is on its lifecycle arc (Idea -> Prototype
-- -> MVP -> Launched -> Revenue -> Scaling). A single value per project (unlike
-- the multi-value industries/tags labels), nullable — not every project sets
-- one. Free text, so the set can change with no migration.

alter table public.projects
  add column if not exists stage text;
