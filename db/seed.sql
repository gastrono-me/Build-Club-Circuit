-- seed: a few starter blockers so the stuck feed is never empty (community/seed posts, no author)
insert into public.blockers (author_id, category, note) values
  (null, 'Engineering', 'Retrieval keeps surfacing irrelevant chunks. Think my chunking strategy is off.'),
  (null, 'Engineering', 'Serverless function times out mid agent-loop. Need to trim latency somewhere.'),
  (null, 'Growth',      'Landing page converts at under 1 percent. Not sure if it is the copy or the audience.'),
  (null, 'Fundraising', '3-minute pitch is still 6 minutes of jargon. Need to cut it down hard.')
on conflict do nothing;

-- seed events as episodes: one live now, one upcoming. Dates are relative to
-- now() so the Events page always shows a useful mix. created_by is null (no
-- organizer account required to seed).
insert into public.events (slug, name, tagline, location, starts_at, ends_at) values
  ('aabw-hcmc',      'Agentic AI Build Week', 'Five days, one build, shipped live.', 'Ho Chi Minh City', now() - interval '1 day',  now() + interval '4 days'),
  ('circuit-sprint', 'Circuit Launch Sprint', 'A weekend to ship your next thing.',  'Online',           now() + interval '7 days', now() + interval '9 days')
on conflict (slug) do nothing;
