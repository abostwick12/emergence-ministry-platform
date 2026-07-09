-- 20260709210000_personal_tasks_monday_sync.sql
-- Adds the dedup columns needed for one-directional Monday.com -> Command
-- Center task sync (Andrew approved this direction; Command Center ->
-- Monday and two-way sync remain out of scope). Nullable and additive:
-- existing personal_tasks rows are untouched, and the partial unique index
-- only constrains rows that came from a Monday.com sync.

alter table public.personal_tasks
  add column if not exists monday_board_id text,
  add column if not exists monday_item_id text;

create unique index if not exists idx_personal_tasks_monday_item_id
  on public.personal_tasks(monday_item_id)
  where monday_item_id is not null;

notify pgrst, 'reload schema';
