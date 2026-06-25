-- 010 event scoping: tag Radar blockers and Build Log ships with an event.
--
-- event_id is NULLABLE on purpose. The everyday loop (no event running) posts
-- with event_id = NULL; posting inside an event tags it with that event. This
-- lets the same feed roll up two ways:
--   - global signal:  all rows (the always-on Circuit view)
--   - event signal:   rows where event_id = <event>  (the episode view)
--
-- on delete set null: a builder's Radar/Build Log history is part of their
-- persistent journey, so deleting an event must NOT delete their posts — it
-- only drops the event tag.

alter table public.blockers  add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.build_log add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists blockers_event_id_idx  on public.blockers(event_id);
create index if not exists build_log_event_id_idx on public.build_log(event_id);
