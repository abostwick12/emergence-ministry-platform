-- Volunteer Hub durable ministry storage.
-- Additive and idempotent. Do not apply to production without confirming target project.

create extension if not exists pgcrypto;

create or replace function public.current_user_is_ministry_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.platform_user_access a on a.user_id = p.id
    where p.id = (select auth.uid())
      and p.ministry_id = public.current_ministry_id()
      and p.role in ('admin', 'leader', 'staff', 'director')
      and coalesce(a.is_active, true)
  );
$$;

revoke all on function public.current_user_is_ministry_operator() from public;
grant execute on function public.current_user_is_ministry_operator() to authenticated;
grant execute on function public.current_user_is_ministry_operator() to service_role;

create table if not exists public.volunteer_hub_leaders (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  profile_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  role_label text not null default 'Volunteer',
  email text,
  profile_photo_url text,
  source_church text,
  serving_areas text[] not null default '{}'::text[],
  availability text not null default 'Not synced',
  skills text[] not null default '{}'::text[],
  background_check_expires date,
  preferred_communication text not null default 'email' check (preferred_communication in ('email', 'text', 'groupme')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, profile_user_id)
);

create table if not exists public.volunteer_hub_services (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  name text not null,
  service_type text not null default 'permanent' check (service_type in ('permanent', 'one_time')),
  sort_order integer not null default 0,
  created_by_user_id uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.volunteer_hub_small_groups (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  service_id uuid references public.volunteer_hub_services(id) on delete set null,
  name text not null,
  leader_id uuid references public.volunteer_hub_leaders(id) on delete set null,
  co_leader_id uuid references public.volunteer_hub_leaders(id) on delete set null,
  room text not null default '',
  service_time text not null default '',
  group_me_connected boolean not null default false,
  archived_at timestamptz,
  archive_reason text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.volunteer_hub_small_group_members (
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  group_id uuid not null references public.volunteer_hub_small_groups(id) on delete cascade,
  student_source text not null check (student_source in ('planning_center', 'camp_clc')),
  student_ref_id text not null,
  created_at timestamptz not null default now(),
  primary key (group_id, student_source, student_ref_id)
);

create table if not exists public.volunteer_hub_event_leader_assignments (
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  event_id text not null,
  leader_id uuid not null references public.volunteer_hub_leaders(id) on delete cascade,
  assigned_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, leader_id)
);

create table if not exists public.volunteer_hub_items (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  item_key text not null,
  item_type text not null check (item_type in ('task', 'resource', 'training', 'onboarding')),
  title text not null,
  detail text not null default '',
  category text not null default '',
  due_label text not null default '',
  due_date timestamptz,
  required boolean not null default false,
  estimated_minutes integer not null default 0,
  shareable boolean not null default false,
  blocks_student_contact boolean not null default false,
  sort_order integer not null default 0,
  created_by_user_id uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, item_key)
);

create table if not exists public.volunteer_hub_item_progress (
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  item_id uuid not null references public.volunteer_hub_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create table if not exists public.volunteer_hub_follow_ups (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  student_source text not null check (student_source in ('planning_center', 'camp_clc', 'demo')),
  student_ref_id text not null,
  volunteer_leader_id uuid references public.volunteer_hub_leaders(id) on delete set null,
  note text not null,
  status text not null default 'assigned' check (status in ('assigned', 'completed')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.volunteer_hub_attendance_reviews (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  student_source text not null check (student_source in ('planning_center', 'camp_clc', 'demo')),
  student_ref_id text not null,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  unique (ministry_id, student_source, student_ref_id)
);

create table if not exists public.volunteer_hub_chat_previews (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  group_id uuid references public.volunteer_hub_small_groups(id) on delete set null,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  body text not null,
  resource_id text,
  preview_only boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.volunteer_hub_audit_entries (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  action text not null,
  target text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists volunteer_hub_leaders_set_updated_at on public.volunteer_hub_leaders;
create trigger volunteer_hub_leaders_set_updated_at
  before update on public.volunteer_hub_leaders
  for each row execute function public.set_updated_at();

drop trigger if exists volunteer_hub_services_set_updated_at on public.volunteer_hub_services;
create trigger volunteer_hub_services_set_updated_at
  before update on public.volunteer_hub_services
  for each row execute function public.set_updated_at();

drop trigger if exists volunteer_hub_small_groups_set_updated_at on public.volunteer_hub_small_groups;
create trigger volunteer_hub_small_groups_set_updated_at
  before update on public.volunteer_hub_small_groups
  for each row execute function public.set_updated_at();

drop trigger if exists volunteer_hub_items_set_updated_at on public.volunteer_hub_items;
create trigger volunteer_hub_items_set_updated_at
  before update on public.volunteer_hub_items
  for each row execute function public.set_updated_at();

drop trigger if exists volunteer_hub_follow_ups_set_updated_at on public.volunteer_hub_follow_ups;
create trigger volunteer_hub_follow_ups_set_updated_at
  before update on public.volunteer_hub_follow_ups
  for each row execute function public.set_updated_at();

drop trigger if exists volunteer_hub_item_progress_set_updated_at on public.volunteer_hub_item_progress;
create trigger volunteer_hub_item_progress_set_updated_at
  before update on public.volunteer_hub_item_progress
  for each row execute function public.set_updated_at();

create index if not exists volunteer_hub_leaders_ministry_status_idx
  on public.volunteer_hub_leaders(ministry_id, status, name);
create index if not exists volunteer_hub_services_ministry_idx
  on public.volunteer_hub_services(ministry_id, archived_at, sort_order);
create index if not exists volunteer_hub_small_groups_ministry_idx
  on public.volunteer_hub_small_groups(ministry_id, archived_at, service_id);
create index if not exists volunteer_hub_small_group_members_student_idx
  on public.volunteer_hub_small_group_members(ministry_id, student_source, student_ref_id);
create index if not exists volunteer_hub_event_leader_assignments_ministry_idx
  on public.volunteer_hub_event_leader_assignments(ministry_id, event_id);
create index if not exists volunteer_hub_items_ministry_type_idx
  on public.volunteer_hub_items(ministry_id, item_type, archived_at, sort_order);
create index if not exists volunteer_hub_item_progress_user_idx
  on public.volunteer_hub_item_progress(ministry_id, user_id, completed);
create index if not exists volunteer_hub_follow_ups_student_idx
  on public.volunteer_hub_follow_ups(ministry_id, student_source, student_ref_id, status);
create index if not exists volunteer_hub_chat_previews_group_idx
  on public.volunteer_hub_chat_previews(ministry_id, group_id, created_at desc);
create index if not exists volunteer_hub_audit_entries_ministry_idx
  on public.volunteer_hub_audit_entries(ministry_id, created_at desc);

alter table public.volunteer_hub_leaders enable row level security;
alter table public.volunteer_hub_services enable row level security;
alter table public.volunteer_hub_small_groups enable row level security;
alter table public.volunteer_hub_small_group_members enable row level security;
alter table public.volunteer_hub_event_leader_assignments enable row level security;
alter table public.volunteer_hub_items enable row level security;
alter table public.volunteer_hub_item_progress enable row level security;
alter table public.volunteer_hub_follow_ups enable row level security;
alter table public.volunteer_hub_attendance_reviews enable row level security;
alter table public.volunteer_hub_chat_previews enable row level security;
alter table public.volunteer_hub_audit_entries enable row level security;

drop policy if exists volunteer_hub_leaders_operator_access on public.volunteer_hub_leaders;
create policy volunteer_hub_leaders_operator_access on public.volunteer_hub_leaders
  for all to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator())
  with check (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator());

drop policy if exists volunteer_hub_services_operator_access on public.volunteer_hub_services;
create policy volunteer_hub_services_operator_access on public.volunteer_hub_services
  for all to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator())
  with check (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator());

drop policy if exists volunteer_hub_small_groups_operator_access on public.volunteer_hub_small_groups;
create policy volunteer_hub_small_groups_operator_access on public.volunteer_hub_small_groups
  for all to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator())
  with check (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator());

drop policy if exists volunteer_hub_small_group_members_operator_access on public.volunteer_hub_small_group_members;
create policy volunteer_hub_small_group_members_operator_access on public.volunteer_hub_small_group_members
  for all to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator())
  with check (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator());

drop policy if exists volunteer_hub_event_leader_assignments_operator_access on public.volunteer_hub_event_leader_assignments;
create policy volunteer_hub_event_leader_assignments_operator_access on public.volunteer_hub_event_leader_assignments
  for all to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator())
  with check (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator());

drop policy if exists volunteer_hub_items_operator_access on public.volunteer_hub_items;
create policy volunteer_hub_items_operator_access on public.volunteer_hub_items
  for all to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator())
  with check (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator());

drop policy if exists volunteer_hub_item_progress_operator_access on public.volunteer_hub_item_progress;
create policy volunteer_hub_item_progress_operator_access on public.volunteer_hub_item_progress
  for all to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator())
  with check (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator());

drop policy if exists volunteer_hub_follow_ups_operator_access on public.volunteer_hub_follow_ups;
create policy volunteer_hub_follow_ups_operator_access on public.volunteer_hub_follow_ups
  for all to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator())
  with check (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator());

drop policy if exists volunteer_hub_attendance_reviews_operator_access on public.volunteer_hub_attendance_reviews;
create policy volunteer_hub_attendance_reviews_operator_access on public.volunteer_hub_attendance_reviews
  for all to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator())
  with check (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator());

drop policy if exists volunteer_hub_chat_previews_operator_access on public.volunteer_hub_chat_previews;
create policy volunteer_hub_chat_previews_operator_access on public.volunteer_hub_chat_previews
  for all to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator())
  with check (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator());

drop policy if exists volunteer_hub_audit_entries_operator_access on public.volunteer_hub_audit_entries;
create policy volunteer_hub_audit_entries_operator_access on public.volunteer_hub_audit_entries
  for all to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator())
  with check (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator());

grant select, insert, update, delete on table public.volunteer_hub_leaders to authenticated;
grant select, insert, update, delete on table public.volunteer_hub_services to authenticated;
grant select, insert, update, delete on table public.volunteer_hub_small_groups to authenticated;
grant select, insert, update, delete on table public.volunteer_hub_small_group_members to authenticated;
grant select, insert, update, delete on table public.volunteer_hub_event_leader_assignments to authenticated;
grant select, insert, update, delete on table public.volunteer_hub_items to authenticated;
grant select, insert, update, delete on table public.volunteer_hub_item_progress to authenticated;
grant select, insert, update, delete on table public.volunteer_hub_follow_ups to authenticated;
grant select, insert, update, delete on table public.volunteer_hub_attendance_reviews to authenticated;
grant select, insert, update, delete on table public.volunteer_hub_chat_previews to authenticated;
grant select, insert on table public.volunteer_hub_audit_entries to authenticated;

grant select, insert, update, delete on table public.volunteer_hub_leaders to service_role;
grant select, insert, update, delete on table public.volunteer_hub_services to service_role;
grant select, insert, update, delete on table public.volunteer_hub_small_groups to service_role;
grant select, insert, update, delete on table public.volunteer_hub_small_group_members to service_role;
grant select, insert, update, delete on table public.volunteer_hub_event_leader_assignments to service_role;
grant select, insert, update, delete on table public.volunteer_hub_items to service_role;
grant select, insert, update, delete on table public.volunteer_hub_item_progress to service_role;
grant select, insert, update, delete on table public.volunteer_hub_follow_ups to service_role;
grant select, insert, update, delete on table public.volunteer_hub_attendance_reviews to service_role;
grant select, insert, update, delete on table public.volunteer_hub_chat_previews to service_role;
grant select, insert, update, delete on table public.volunteer_hub_audit_entries to service_role;

notify pgrst, 'reload schema';
