-- 029 drop the seeded "community" blockers. Migration 022 reseeded a set of
-- null-author demo blockers to keep the stuck feed from looking empty. The
-- cohort is now real, so the placeholder posts are just fake data on a live
-- surface. Remove them; their me-toos cascade away with them. Real blockers
-- always carry an author_id (post() sets auth.uid()), so this only touches seeds.

delete from public.blockers where author_id is null;
