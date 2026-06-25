-- seed: a few starter blockers so the Radar feed is never empty (community/seed posts, no author)
insert into public.blockers (author_id, category, note) values
  (null, 'hackathon help', 'Still haven''t received my API credits — anyone else waiting?'),
  (null, 'RAG/Retrieval',  'Retrieval keeps surfacing irrelevant chunks. Think my chunking strategy is off.'),
  (null, 'Deploy/Infra',   'Serverless function times out mid agent-loop. Need to trim latency somewhere.'),
  (null, 'Demo prep',      '3-minute pitch is still 6 minutes of jargon. Need to cut it down hard.')
on conflict do nothing;
