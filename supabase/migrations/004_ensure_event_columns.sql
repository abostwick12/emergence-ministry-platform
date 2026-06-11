-- 004_ensure_event_columns.sql
-- Idempotently ensures every column the app writes to public.events exists.
-- Run this in the Supabase SQL editor if event creation/edit fails with a
-- "Could not find the '<column>' column of 'events' in the schema cache" or
-- "column ... does not exist" error (e.g. when migration 003 was never applied).
-- Safe to run multiple times.

alter table public.events
  add column if not exists ministry_area text,
  add column if not exists vision text,
  add column if not exists target_group text,
  add column if not exists communication_owner text,
  add column if not exists notes text;

-- Refresh PostgREST's schema cache so the new columns are immediately usable.
notify pgrst, 'reload schema';
