create extension if not exists pgcrypto;

create type user_role as enum ('admin', 'leader', 'student', 'parent');
create type event_status as enum ('draft', 'planning', 'ready');
create type event_type as enum ('retreat', 'weekly', 'service', 'camp');
create type task_status as enum ('todo', 'in_progress', 'blocked', 'done');
create type integration_type as enum ('planning_center', 'google_calendar', 'google_drive', 'propresenter');
create type activity_type as enum (
  'event_created',
  'task_generated',
  'task_status_changed',
  'task_owner_changed',
  'task_edited',
  'communication_preview_generated',
  'integration_stub_action'
);

create table users (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  role user_role not null,
  grade text,
  created_at timestamptz not null default now()
);

create table small_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader_id uuid references users(id),
  grade_target text,
  gender_target text,
  created_at timestamptz not null default now()
);

create table group_memberships (
  group_id uuid references small_groups(id) on delete cascade,
  student_id uuid references users(id) on delete cascade,
  primary key (group_id, student_id)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  type event_type not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status event_status not null default 'planning',
  location text,
  budget_target numeric(12, 2),
  registration_deadline timestamptz,
  contact_owner_id uuid references users(id),
  auto_generated_timeline jsonb not null default '[]'::jsonb,
  google_drive_folder_id text,
  pro_presenter_playlist_id text,
  created_at timestamptz not null default now()
);

create table workflow_templates (
  id uuid primary key default gen_random_uuid(),
  trigger_event_type event_type not null,
  template_name text not null,
  auto_generate_communications boolean not null default true,
  auto_generate_drive_folder boolean not null default true,
  auto_generate_propresenter boolean not null default true,
  created_at timestamptz not null default now()
);

create table template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references workflow_templates(id) on delete cascade,
  task_title text not null,
  timeline_offset_days integer not null,
  role_assigned user_role not null check (role_assigned in ('admin', 'leader'))
);

create table active_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  task_title text not null,
  due_date timestamptz not null,
  assigned_user_id uuid references users(id),
  status task_status not null default 'todo',
  auto_generated boolean not null default true,
  timeline_offset_days integer not null,
  created_at timestamptz not null default now()
);

create table budget_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default ''
);

create table event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category_id uuid references budget_categories(id),
  amount numeric(12, 2) not null check (amount >= 0),
  description text not null,
  timestamp timestamptz not null default now()
);

create table communication_packages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_time timestamptz,
  status text not null default 'preview' check (status = 'preview'),
  created_at timestamptz not null default now()
);

create table integration_sync_logs (
  id uuid primary key default gen_random_uuid(),
  integration_type integration_type not null,
  event_id uuid not null references events(id) on delete cascade,
  status text not null default 'stub_mode' check (status = 'stub_mode'),
  details jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  type activity_type not null,
  event_id uuid references events(id) on delete cascade,
  task_id uuid references active_tasks(id) on delete set null,
  actor_id uuid references users(id),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);

alter table users enable row level security;
alter table small_groups enable row level security;
alter table group_memberships enable row level security;
alter table events enable row level security;
alter table workflow_templates enable row level security;
alter table template_tasks enable row level security;
alter table active_tasks enable row level security;
alter table budget_categories enable row level security;
alter table event_expenses enable row level security;
alter table communication_packages enable row level security;
alter table integration_sync_logs enable row level security;
alter table activity_logs enable row level security;

-- MVP 1 policy placeholder: tighten to auth.uid()-based membership before live data.
create policy "mvp1_authenticated_read_users" on users for select to authenticated using (true);
create policy "mvp1_authenticated_read_events" on events for select to authenticated using (true);
create policy "mvp1_authenticated_read_tasks" on active_tasks for select to authenticated using (true);
create policy "mvp1_authenticated_read_activity" on activity_logs for select to authenticated using (true);
