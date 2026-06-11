-- Phase 3: Master Event Card extended fields.
-- Adds target_group to events. Other fields (budget_actual, volunteers_needed, priority)
-- already exist in the base schema.

alter table public.events
  add column if not exists target_group text;
