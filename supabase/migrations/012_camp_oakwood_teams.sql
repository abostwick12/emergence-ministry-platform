-- 012_camp_oakwood_teams.sql
-- Align Camp team data with the real Camp Oakwood teams (Blue, Red, Yellow,
-- Green, Orange, Purple). Fully additive and non-destructive:
--   * adds nullable co_leader / room columns and a soft-archive marker
--   * renames the camp session to "Camp Oakwood"
--   * upserts the six real color teams (leaders left blank, not invented)
--   * unassigns campers from the obsolete demo teams (ON DELETE SET NULL parity)
--   * soft-archives (does NOT delete) the obsolete Cypress/Summit/Harbor demo teams
-- No medication, medical, intake, signature, photo, audit, or vehicle data is
-- touched: those tables key off camper_id, and the only FK into camp_teams is
-- camp_campers.team_id.

alter table public.camp_teams add column if not exists co_leader text not null default '';
alter table public.camp_teams add column if not exists room text not null default '';
alter table public.camp_teams add column if not exists archived_at timestamptz;

create index if not exists idx_camp_teams_active
  on public.camp_teams(camp_id, display_order)
  where archived_at is null;

-- Rename the existing camp session to its real name.
update public.camp_sessions
set name = 'Camp Oakwood'
where slug = 'summer-camp-2026';

-- Create / refresh the six real Camp Oakwood teams. Color word doubles as the
-- name; leader/co-leader/room are intentionally blank until real data is loaded.
insert into public.camp_teams (ministry_id, camp_id, name, color, leader, co_leader, room, display_order)
select s.ministry_id, s.id, v.name, v.color, '', '', '', v.ord
from public.camp_sessions s
cross join (values
  ('Blue', 'Blue', 1),
  ('Red', 'Red', 2),
  ('Yellow', 'Yellow', 3),
  ('Green', 'Green', 4),
  ('Orange', 'Orange', 5),
  ('Purple', 'Purple', 6)
) as v(name, color, ord)
where s.slug = 'summer-camp-2026'
on conflict (camp_id, name) do update
  set color = excluded.color,
      display_order = excluded.display_order,
      archived_at = null;

-- Unassign any camper still pointing at the obsolete demo teams (leave unassigned).
update public.camp_campers c
set team_id = null
from public.camp_teams t
where c.team_id = t.id
  and t.name in ('Cypress', 'Summit', 'Harbor')
  and t.camp_id = (select id from public.camp_sessions where slug = 'summer-camp-2026');

-- Soft-archive the obsolete demo teams instead of hard-deleting them.
update public.camp_teams
set archived_at = now()
where name in ('Cypress', 'Summit', 'Harbor')
  and camp_id = (select id from public.camp_sessions where slug = 'summer-camp-2026');

notify pgrst, 'reload schema';
