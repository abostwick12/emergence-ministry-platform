-- Controlled platform registration links.
-- Additive and idempotent. Do not apply to production without confirming target project.

create extension if not exists pgcrypto;

create table if not exists public.platform_registration_invites (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  code text not null unique,
  label text not null default 'Platform registration',
  role text not null default 'leader' check (role in ('leader', 'student', 'parent')),
  can_save_changes boolean not null default false,
  ai_enabled boolean not null default false,
  ai_monthly_limit integer check (ai_monthly_limit is null or ai_monthly_limit between 1 and 1000),
  is_active boolean not null default true,
  max_uses integer not null default 10 check (max_uses between 1 and 500),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_registration_invites_set_updated_at on public.platform_registration_invites;
create trigger platform_registration_invites_set_updated_at
  before update on public.platform_registration_invites
  for each row execute function public.set_updated_at();

create index if not exists platform_registration_invites_ministry_created_idx
  on public.platform_registration_invites(ministry_id, created_at desc);

create index if not exists platform_registration_invites_code_idx
  on public.platform_registration_invites(code);

alter table public.platform_registration_invites enable row level security;

drop policy if exists platform_registration_invites_select on public.platform_registration_invites;
create policy platform_registration_invites_select on public.platform_registration_invites
  for select to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_platform_admin());

drop policy if exists platform_registration_invites_modify on public.platform_registration_invites;
create policy platform_registration_invites_modify on public.platform_registration_invites
  for all to authenticated
  using (ministry_id = public.current_ministry_id() and public.current_user_is_platform_admin())
  with check (ministry_id = public.current_ministry_id() and public.current_user_is_platform_admin());

revoke all privileges on table public.platform_registration_invites from anon;
revoke all privileges on table public.platform_registration_invites from authenticated;
grant select, insert, update on table public.platform_registration_invites to authenticated;
grant select, insert, update, delete on table public.platform_registration_invites to service_role;

alter table public.platform_user_access
  add column if not exists can_save_changes boolean not null default true;

create table if not exists public.platform_ai_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_enabled boolean not null default false,
  monthly_request_limit integer check (monthly_request_limit is null or monthly_request_limit between 1 and 1000),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid references public.ministries(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
  estimated_units integer not null default 1 check (estimated_units > 0),
  created_at timestamptz not null default now()
);

drop trigger if exists platform_ai_access_set_updated_at on public.platform_ai_access;
create trigger platform_ai_access_set_updated_at
  before update on public.platform_ai_access
  for each row execute function public.set_updated_at();

create index if not exists platform_ai_usage_events_user_created_idx
  on public.platform_ai_usage_events(user_id, created_at desc);

create index if not exists platform_ai_usage_events_ministry_created_idx
  on public.platform_ai_usage_events(ministry_id, created_at desc);

alter table public.platform_ai_access enable row level security;
alter table public.platform_ai_usage_events enable row level security;

drop policy if exists platform_ai_access_select on public.platform_ai_access;
create policy platform_ai_access_select on public.platform_ai_access
  for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_is_platform_admin());

drop policy if exists platform_ai_access_modify on public.platform_ai_access;
create policy platform_ai_access_modify on public.platform_ai_access
  for all to authenticated
  using (public.current_user_is_platform_admin())
  with check (public.current_user_is_platform_admin());

drop policy if exists platform_ai_usage_events_select on public.platform_ai_usage_events;
create policy platform_ai_usage_events_select on public.platform_ai_usage_events
  for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_is_platform_admin());

drop policy if exists platform_ai_usage_events_insert_self on public.platform_ai_usage_events;
create policy platform_ai_usage_events_insert_self on public.platform_ai_usage_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all privileges on table public.platform_ai_access from anon;
revoke all privileges on table public.platform_ai_access from authenticated;
revoke all privileges on table public.platform_ai_usage_events from anon;
revoke all privileges on table public.platform_ai_usage_events from authenticated;
grant select, insert, update on table public.platform_ai_access to authenticated;
grant select, insert on table public.platform_ai_usage_events to authenticated;
grant select, insert, update, delete on table public.platform_ai_access to service_role;
grant select, insert, update, delete on table public.platform_ai_usage_events to service_role;

notify pgrst, 'reload schema';
