-- Iteration 2 Phase 2.5 notes support.
-- Adds internal-only staff notes to existing event and task records.

alter table public.events
  add column if not exists notes text;

alter table public.tasks
  add column if not exists notes text;
