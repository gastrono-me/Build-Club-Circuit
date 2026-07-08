-- Blockers are not seeded: the stuck feed shows only real builder posts. (An
-- earlier build seeded null-author "community" blockers; migration 029 removed
-- them.)

-- seed events as episodes: one live now, one upcoming. Dates are relative to
-- now() so the Events page always shows a useful mix. created_by is null (no
-- organizer account required to seed).
insert into public.events (slug, name, tagline, location, starts_at, ends_at) values
  ('aabw-hcmc',      'Agentic AI Build Week', 'Five days, one build, shipped live.', 'Ho Chi Minh City', now() - interval '1 day',  now() + interval '4 days'),
  ('circuit-sprint', 'Circuit Launch Sprint', 'A weekend to ship your next thing.',  'Online',           now() + interval '7 days', now() + interval '9 days')
on conflict (slug) do nothing;
