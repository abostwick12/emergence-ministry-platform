-- 005_ministry_scope.sql
-- Adds a real ministry scope to the existing single-ministry application.
--
-- The app continues to operate as a SINGLE-MINISTRY deployment. This migration
-- introduces a `ministries` table, seeds the default "Emerge" ministry, and adds
-- a `ministry_id` foreign key to the core tables EMMA will reference (profiles,
-- events, tasks, activity_logs). Existing rows are backfilled to Emerge, and RLS
-- is tightened so authenticated users only access rows in their own ministry.
--
-- For the single Emerge ministry every user resolves to the same scope, so
-- visible behavior is unchanged. Cross-ministry reads/writes are blocked once
-- additional ministries exist.
--
-- Additive and idempotent: safe to run multiple times. No data is deleted.

create extension if not exists pgcrypto;

-- Shared updated_at helper (also defined in schema.sql; create-or-replace keeps
-- this migration self-contained and idempotent).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. Ministries table -------------------------------------------------------

create table if not exists public.ministries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_ministries_updated_at on public.ministries;
create trigger set_ministries_updated_at
before update on public.ministries
for each row execute function public.set_updated_at();

-- 2. Seed the default Emerge ministry with a FIXED id -----------------------
-- The fixed id must match DEFAULT_MINISTRY in lib/ministry/constants.ts.

insert into public.ministries (id, name, slug)
values ('00000000-0000-4000-8000-0000000000e1', 'Emerge', 'emerge')
on conflict (slug) do nothing;

-- 3. Ministry scope helpers -------------------------------------------------
-- current_ministry_id() returns the authenticated user's ministry, falling back
-- to the default Emerge ministry. SECURITY DEFINER so it can read profiles
-- regardless of RLS (avoids recursive policy evaluation), with a locked-down
-- search_path.

create or replace function public.current_ministry_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.ministry_id from public.profiles p where p.id = auth.uid()),
    '00000000-0000-4000-8000-0000000000e1'::uuid
  );
$$;

-- Fills ministry_id from the authenticated scope when an insert omits it.
create or replace function public.set_ministry_id_if_null()
returns trigger
language plpgsql
as $$
begin
  if new.ministry_id is null then
    new.ministry_id := public.current_ministry_id();
  end if;
  return new;
end;
$$;

-- 4. Add ministry_id to core tables (nullable first) ------------------------

alter table public.profiles      add column if not exists ministry_id uuid references public.ministries(id);
alter table public.events        add column if not exists ministry_id uuid references public.ministries(id);
alter table public.tasks         add column if not exists ministry_id uuid references public.ministries(id);
alter table public.activity_logs add column if not exists ministry_id uuid references public.ministries(id);

-- 5. Backfill existing rows to the default Emerge ministry ------------------

update public.profiles      set ministry_id = '00000000-0000-4000-8000-0000000000e1' where ministry_id is null;
update public.events        set ministry_id = '00000000-0000-4000-8000-0000000000e1' where ministry_id is null;
update public.tasks         set ministry_id = '00000000-0000-4000-8000-0000000000e1' where ministry_id is null;
update public.activity_logs set ministry_id = '00000000-0000-4000-8000-0000000000e1' where ministry_id is null;

-- 6. Enforce NOT NULL now that every existing row is scoped -----------------

alter table public.profiles      alter column ministry_id set not null;
alter table public.events        alter column ministry_id set not null;
alter table public.tasks         alter column ministry_id set not null;
alter table public.activity_logs alter column ministry_id set not null;

-- 7. Indexes on ministry scope ----------------------------------------------

create index if not exists idx_profiles_ministry_id      on public.profiles(ministry_id);
create index if not exists idx_events_ministry_id        on public.events(ministry_id);
create index if not exists idx_tasks_ministry_id         on public.tasks(ministry_id);
create index if not exists idx_activity_logs_ministry_id on public.activity_logs(ministry_id);

-- 8. Default-scope triggers (defense in depth) ------------------------------

drop trigger if exists set_profiles_ministry_id on public.profiles;
create trigger set_profiles_ministry_id
before insert on public.profiles
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_events_ministry_id on public.events;
create trigger set_events_ministry_id
before insert on public.events
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_tasks_ministry_id on public.tasks;
create trigger set_tasks_ministry_id
before insert on public.tasks
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_activity_logs_ministry_id on public.activity_logs;
create trigger set_activity_logs_ministry_id
before insert on public.activity_logs
for each row execute function public.set_ministry_id_if_null();

-- 9. RLS: ministries table --------------------------------------------------

alter table public.ministries enable row level security;

drop policy if exists "authenticated can read own ministry" on public.ministries;
create policy "authenticated can read own ministry" on public.ministries
for select to authenticated using (id = public.current_ministry_id());

-- 10. RLS: scope core tables to the authenticated user's ministry -----------
-- Replaces the prior staff-wide using(true) policies. Drops both the old and
-- new policy names so this block is safe to re-run.

-- profiles
drop policy if exists "authenticated can select profiles" on public.profiles;
drop policy if exists "authenticated can insert profiles" on public.profiles;
drop policy if exists "authenticated can update profiles" on public.profiles;
drop policy if exists "authenticated can delete profiles" on public.profiles;
drop policy if exists "ministry can select profiles" on public.profiles;
drop policy if exists "ministry can insert profiles" on public.profiles;
drop policy if exists "ministry can update profiles" on public.profiles;
drop policy if exists "ministry can delete profiles" on public.profiles;

create policy "ministry can select profiles" on public.profiles
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "ministry can insert profiles" on public.profiles
for insert to authenticated with check (ministry_id = public.current_ministry_id());
create policy "ministry can update profiles" on public.profiles
for update to authenticated using (ministry_id = public.current_ministry_id()) with check (ministry_id = public.current_ministry_id());
create policy "ministry can delete profiles" on public.profiles
for delete to authenticated using (ministry_id = public.current_ministry_id());

-- events
drop policy if exists "authenticated can select events" on public.events;
drop policy if exists "authenticated can insert events" on public.events;
drop policy if exists "authenticated can update events" on public.events;
drop policy if exists "authenticated can delete events" on public.events;
drop policy if exists "ministry can select events" on public.events;
drop policy if exists "ministry can insert events" on public.events;
drop policy if exists "ministry can update events" on public.events;
drop policy if exists "ministry can delete events" on public.events;

create policy "ministry can select events" on public.events
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "ministry can insert events" on public.events
for insert to authenticated with check (ministry_id = public.current_ministry_id());
create policy "ministry can update events" on public.events
for update to authenticated using (ministry_id = public.current_ministry_id()) with check (ministry_id = public.current_ministry_id());
create policy "ministry can delete events" on public.events
for delete to authenticated using (ministry_id = public.current_ministry_id());

-- tasks
drop policy if exists "authenticated can select tasks" on public.tasks;
drop policy if exists "authenticated can insert tasks" on public.tasks;
drop policy if exists "authenticated can update tasks" on public.tasks;
drop policy if exists "authenticated can delete tasks" on public.tasks;
drop policy if exists "ministry can select tasks" on public.tasks;
drop policy if exists "ministry can insert tasks" on public.tasks;
drop policy if exists "ministry can update tasks" on public.tasks;
drop policy if exists "ministry can delete tasks" on public.tasks;

create policy "ministry can select tasks" on public.tasks
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "ministry can insert tasks" on public.tasks
for insert to authenticated with check (ministry_id = public.current_ministry_id());
create policy "ministry can update tasks" on public.tasks
for update to authenticated using (ministry_id = public.current_ministry_id()) with check (ministry_id = public.current_ministry_id());
create policy "ministry can delete tasks" on public.tasks
for delete to authenticated using (ministry_id = public.current_ministry_id());

-- activity_logs
drop policy if exists "authenticated can select activity logs" on public.activity_logs;
drop policy if exists "authenticated can insert activity logs" on public.activity_logs;
drop policy if exists "authenticated can update activity logs" on public.activity_logs;
drop policy if exists "authenticated can delete activity logs" on public.activity_logs;
drop policy if exists "ministry can select activity logs" on public.activity_logs;
drop policy if exists "ministry can insert activity logs" on public.activity_logs;
drop policy if exists "ministry can update activity logs" on public.activity_logs;
drop policy if exists "ministry can delete activity logs" on public.activity_logs;

create policy "ministry can select activity logs" on public.activity_logs
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "ministry can insert activity logs" on public.activity_logs
for insert to authenticated with check (ministry_id = public.current_ministry_id());
create policy "ministry can update activity logs" on public.activity_logs
for update to authenticated using (ministry_id = public.current_ministry_id()) with check (ministry_id = public.current_ministry_id());
create policy "ministry can delete activity logs" on public.activity_logs
for delete to authenticated using (ministry_id = public.current_ministry_id());

-- 11. Refresh PostgREST's schema cache so ministry_id is immediately usable.
notify pgrst, 'reload schema';
