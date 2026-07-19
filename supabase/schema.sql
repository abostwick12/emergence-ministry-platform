-- Lead Emergence Automated Platform - current schema snapshot/reference.
-- Run this in the Supabase SQL editor after creating at least one Auth user.
-- Future schema changes should be added as idempotent migrations under
-- supabase/migrations/ rather than by editing archived legacy SQL files.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Ministry scope. The app currently runs as a single-ministry deployment; the
-- default "Emerge" ministry below anchors that scope. The fixed id matches
-- DEFAULT_MINISTRY in lib/ministry/constants.ts and migration 005.
create table if not exists public.ministries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ministries (id, name, slug)
values ('00000000-0000-4000-8000-0000000000e1', 'Emerge', 'emerge')
on conflict (slug) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id),
  email text,
  full_name text,
  role text not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  title text not null,
  ministry_area text,
  description text,
  vision text,
  target_group text,
  start_date date,
  end_date date,
  start_time text,
  end_time text,
  location text,
  owner text,
  status text not null default 'planning',
  priority text,
  budget_target numeric(12, 2),
  budget_actual numeric(12, 2) not null default 0,
  volunteers_needed integer,
  communication_owner text,
  notes text,
  archived_at timestamptz,
  archived_by_user_id uuid references public.profiles(id) on delete set null,
  archive_reason text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  owner text,
  due_date date,
  status text not null default 'todo',
  priority text,
  critical boolean not null default false,
  file_status text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  event_id uuid references public.events(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  action text not null,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Ministry scope helpers. current_ministry_id() resolves the authenticated
-- user's ministry, falling back to the default Emerge ministry. SECURITY
-- DEFINER so it reads profiles regardless of RLS (no recursive evaluation).
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

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

drop trigger if exists set_ministries_updated_at on public.ministries;
create trigger set_ministries_updated_at
before update on public.ministries
for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- Default-scope triggers (fill ministry_id on insert when omitted).
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

create index if not exists idx_profiles_ministry_id      on public.profiles(ministry_id);
create index if not exists idx_events_ministry_id        on public.events(ministry_id);
create index if not exists idx_events_active_start       on public.events(ministry_id, start_date) where archived_at is null;
create index if not exists idx_events_archived_at        on public.events(ministry_id, archived_at) where archived_at is not null;
create index if not exists idx_tasks_ministry_id         on public.tasks(ministry_id);
create index if not exists idx_activity_logs_ministry_id on public.activity_logs(ministry_id);

alter table public.ministries enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.tasks enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "authenticated can read own ministry" on public.ministries;
create policy "authenticated can read own ministry" on public.ministries
for select to authenticated using (id = public.current_ministry_id());

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
create policy "admin can delete archived events" on public.events
for delete to authenticated using (
  ministry_id = public.current_ministry_id()
  and public.current_user_role() = 'admin'
  and archived_at is not null
);

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

-- Optional MVP seed data.
-- This block uses the first Auth user in the project as the owner/creator.
-- Create that user manually in Supabase Auth before running the seed.
-- New rows inherit the default Emerge ministry via the set_*_ministry_id triggers.
do $$
declare
  seed_user_id uuid;
  camp_id uuid;
  midweek_id uuid;
  high_school_id uuid;
  fundraiser_id uuid;
  training_id uuid;
begin
  select id into seed_user_id from auth.users order by created_at asc limit 1;

  if seed_user_id is null then
    raise notice 'No auth.users row found. Create a user in Supabase Auth, then rerun the seed block.';
    return;
  end if;

  insert into public.profiles (id, email, full_name, role)
  select seed_user_id, email, coalesce(raw_user_meta_data->>'full_name', email), 'admin'
  from auth.users
  where id = seed_user_id
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    updated_at = now();

  insert into public.events (
    title, ministry_area, description, vision, start_date, end_date, start_time, end_time, location, owner, status,
    priority, budget_target, budget_actual, volunteers_needed, communication_owner, created_by
  )
  values
    ('Midweek Hangout', 'weekly', 'A weekly gathering for connection, worship, and short teaching.', 'Build connection and consistency.', current_date + 2, current_date + 2, '18:00', '20:00', 'Student Center', seed_user_id::text, 'planning', 'normal', 600, 0, 2, seed_user_id::text, seed_user_id),
    ('High School Event', 'service', 'High school students and leaders serve a local ministry partner.', 'Move students toward service and ownership.', current_date + 12, current_date + 12, '09:00', '13:00', 'Hope Center', seed_user_id::text, 'planning', 'normal', 1200, 0, 4, seed_user_id::text, seed_user_id),
    ('Volunteer Training', 'service', 'Leader onboarding and safety training for the ministry season.', 'Prepare leaders with clarity and confidence.', current_date + 16, current_date + 16, '10:00', '12:00', 'Conference Room A', seed_user_id::text, 'planning', 'normal', 400, 0, 4, seed_user_id::text, seed_user_id),
    ('Summer Camp', 'camp', 'A high-visibility camp event with registration, packing, volunteers, parent updates, and files to coordinate.', 'Create a catalytic discipleship week for students.', current_date + 42, current_date + 46, '13:00', '11:00', 'Camp Evergreen', seed_user_id::text, 'planning', 'high', 18000, 0, 8, seed_user_id::text, seed_user_id),
    ('Fall Fundraiser', 'service', 'A fundraiser dinner and auction supporting retreats, camp scholarships, and outreach.', 'Fund ministry opportunities without surprising families.', current_date + 75, current_date + 75, '17:30', '20:30', 'Fellowship Hall', seed_user_id::text, 'planning', 'normal', 2500, 0, 4, seed_user_id::text, seed_user_id)
  on conflict do nothing;

  select id into camp_id from public.events where title = 'Summer Camp' order by created_at desc limit 1;
  select id into midweek_id from public.events where title = 'Midweek Hangout' order by created_at desc limit 1;
  select id into high_school_id from public.events where title = 'High School Event' order by created_at desc limit 1;
  select id into fundraiser_id from public.events where title = 'Fall Fundraiser' order by created_at desc limit 1;
  select id into training_id from public.events where title = 'Volunteer Training' order by created_at desc limit 1;

  insert into public.tasks (event_id, title, owner, due_date, status, priority, critical, file_status, created_by)
  values
    (camp_id, 'Publish registration deadline', seed_user_id::text, current_date + 7, 'todo', 'high', true, 'No file attached', seed_user_id),
    (camp_id, 'Build packing list communication preview', seed_user_id::text, current_date + 20, 'todo', 'high', true, 'No file attached', seed_user_id),
    (camp_id, 'Finalize volunteer load and rooming', seed_user_id::text, current_date + 28, 'todo', 'normal', false, 'No file attached', seed_user_id),
    (camp_id, 'Prepare check-in and payment reminder preview', seed_user_id::text, current_date + 35, 'todo', 'normal', false, 'No file attached', seed_user_id),
    (midweek_id, 'Confirm teaching plan and service flow', seed_user_id::text, current_date + 1, 'todo', 'normal', false, 'No file attached', seed_user_id),
    (midweek_id, 'Prepare ProPresenter playlist stub', seed_user_id::text, current_date + 1, 'todo', 'normal', false, 'No file attached', seed_user_id),
    (high_school_id, 'Confirm partner organization details', seed_user_id::text, current_date + 4, 'todo', 'normal', false, 'No file attached', seed_user_id),
    (fundraiser_id, 'Confirm fundraiser volunteer plan', seed_user_id::text, current_date + 45, 'todo', 'normal', false, 'No file attached', seed_user_id),
    (training_id, 'Prepare leader policy packet', seed_user_id::text, current_date + 8, 'todo', 'normal', false, 'No file attached', seed_user_id)
  on conflict do nothing;

  insert into public.activity_logs (event_id, action, actor_id)
  select id, 'Seeded MVP event: ' || title, seed_user_id from public.events
  where title in ('Camp', 'Midweek Hangout', 'High School Event', 'Fall Fundraiser', 'Volunteer Training', 'Summer Camp')
  on conflict do nothing;
end $$;

-- EMMA AI foundation tables (ai_feature_configs, ai_requests, ai_runs,
-- ai_provider_attempts, ai_action_proposals, ai_approvals) and the
-- public.current_user_role() helper are added by the additive migration
-- supabase/migrations/006_emma_foundation.sql. Run migrations after this
-- snapshot when bootstrapping a new project.
