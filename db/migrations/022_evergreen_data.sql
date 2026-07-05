-- 022 evergreen data: the code moved to the shared work taxonomy (WORK_CATEGORIES)
-- but the live rows didn't. Two fixes:
--
-- 1) Remap legacy AABW-era categories on blockers and ships to the new
--    taxonomy, so every node on the embedding fields gets a real anchor and
--    color instead of the hash/ink fallback.
-- 2) Replace the seeded community blockers (author_id is null) with a
--    discipline-spanning evergreen set - the old ones were all AI-hackathon
--    problems (API credits, chunking, agent loops), which read wrong for a
--    community that includes GTM, sales, and design builders.

-- ── 1) Category remap (both tables share the taxonomy) ────────────────────
update public.blockers set category = 'Engineering'
  where category in ('Auth/Login','Deploy/Infra','RAG/Retrieval','Agent loops','Rate limits/Cost','Data/Eval');
update public.blockers set category = 'Design'  where category = 'UI polish';
update public.blockers set category = 'Product' where category = 'Launch/Demo';
update public.blockers set category = 'Other'   where category = 'Getting unstuck';

update public.build_log set category = 'Engineering'
  where category in ('Auth/Login','Deploy/Infra','RAG/Retrieval','Agent loops','Rate limits/Cost','Data/Eval');
update public.build_log set category = 'Design'  where category = 'UI polish';
update public.build_log set category = 'Product' where category = 'Launch/Demo';
update public.build_log set category = 'Other'   where category = 'Getting unstuck';

-- ── 2) Reseed the community blockers ──────────────────────────────────────
-- Null-author rows are seeds by definition (the UI labels them "Community").
-- Their me-toos cascade away with them; they are demo content.
delete from public.blockers where author_id is null;

insert into public.blockers (author_id, category, note) values
  (null, 'Engineering', 'OAuth redirect loops forever on mobile Safari. Third day on this.'),
  (null, 'Product',     'People sign up, poke around once, and never come back. Cannot tell which feature is supposed to hook them.'),
  (null, 'Growth',      'Landing page converts at under 1 percent. Not sure if it is the copy or the audience.'),
  (null, 'Sales',       'Demos go great, then the deal goes quiet. Following up without being annoying is a skill I do not have yet.'),
  (null, 'Fundraising', '3-minute pitch is still 6 minutes of jargon. Need to cut it down hard.');
