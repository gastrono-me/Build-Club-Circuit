-- seed: a few starter blockers so the Radar feed is never empty (community/seed posts, no author)
insert into public.blockers (author_id, category, note) values
  (null, 'hackathon help', 'Still haven''t received my API credits — anyone else waiting?'),
  (null, 'RAG/Retrieval',  'Retrieval keeps surfacing irrelevant chunks. Think my chunking strategy is off.'),
  (null, 'Deploy/Infra',   'Serverless function times out mid agent-loop. Need to trim latency somewhere.'),
  (null, 'Demo prep',      '3-minute pitch is still 6 minutes of jargon. Need to cut it down hard.')
on conflict do nothing;

-- seed events as episodes: one live now, one upcoming. Dates are relative to
-- now() so the Events page always shows a useful mix. created_by is null (no
-- organizer account required to seed).
insert into public.events (slug, name, tagline, location, starts_at, ends_at) values
  ('aabw-hcmc',      'Agentic AI Build Week', 'Five days, one build, shipped live.', 'Ho Chi Minh City', now() - interval '1 day',  now() + interval '4 days'),
  ('circuit-sprint', 'Circuit Launch Sprint', 'A weekend to ship your next thing.',  'Online',           now() + interval '7 days', now() + interval '9 days')
on conflict (slug) do nothing;
