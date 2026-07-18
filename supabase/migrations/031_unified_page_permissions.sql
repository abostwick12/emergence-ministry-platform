-- 031_unified_page_permissions.sql
-- Unified page permissions, guest-public page flags, and deactivate-first user access.
-- Additive and idempotent. Do not apply to production without confirming target project.

create extension if not exists pgcrypto;

create table if not exists public.platform_user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_page_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  page_key text not null,
  is_allowed boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, page_key)
);

create table if not exists public.guest_public_page_permissions (
  page_key text primary key,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_permission_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  action text not null,
  page_key text,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists platform_user_access_set_updated_at on public.platform_user_access;
create trigger platform_user_access_set_updated_at
  before update on public.platform_user_access
  for each row execute function public.set_updated_at();

drop trigger if exists user_page_permissions_set_updated_at on public.user_page_permissions;
create trigger user_page_permissions_set_updated_at
  before update on public.user_page_permissions
  for each row execute function public.set_updated_at();

drop trigger if exists guest_public_page_permissions_set_updated_at on public.guest_public_page_permissions;
create trigger guest_public_page_permissions_set_updated_at
  before update on public.guest_public_page_permissions
  for each row execute function public.set_updated_at();

create index if not exists platform_permission_audit_target_idx
  on public.platform_permission_audit(target_user_id, created_at desc);

create index if not exists platform_permission_audit_page_idx
  on public.platform_permission_audit(page_key, created_at desc);

alter table public.platform_user_access enable row level security;
alter table public.user_page_permissions enable row level security;
alter table public.guest_public_page_permissions enable row level security;
alter table public.platform_permission_audit enable row level security;

create or replace function public.current_user_is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    left join public.platform_user_access a on a.user_id = p.id
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and coalesce(a.is_active, true)
  );
$$;

create or replace function public.current_user_platform_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (
      select coalesce(a.is_active, true)
      from public.profiles p
      left join public.platform_user_access a on a.user_id = p.id
      where p.id = (select auth.uid())
      limit 1
    ),
    false
  );
$$;

drop policy if exists platform_user_access_select on public.platform_user_access;
create policy platform_user_access_select on public.platform_user_access
  for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_is_platform_admin());

drop policy if exists platform_user_access_modify on public.platform_user_access;
create policy platform_user_access_modify on public.platform_user_access
  for all to authenticated
  using (public.current_user_is_platform_admin())
  with check (public.current_user_is_platform_admin());

drop policy if exists user_page_permissions_select on public.user_page_permissions;
create policy user_page_permissions_select on public.user_page_permissions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_is_platform_admin());

drop policy if exists user_page_permissions_modify on public.user_page_permissions;
create policy user_page_permissions_modify on public.user_page_permissions
  for all to authenticated
  using (public.current_user_is_platform_admin())
  with check (public.current_user_is_platform_admin());

drop policy if exists guest_public_page_permissions_select_authenticated on public.guest_public_page_permissions;
create policy guest_public_page_permissions_select_authenticated on public.guest_public_page_permissions
  for select to authenticated
  using (true);

drop policy if exists guest_public_page_permissions_select_anon on public.guest_public_page_permissions;
create policy guest_public_page_permissions_select_anon on public.guest_public_page_permissions
  for select to anon
  using (true);

drop policy if exists guest_public_page_permissions_modify on public.guest_public_page_permissions;
create policy guest_public_page_permissions_modify on public.guest_public_page_permissions
  for all to authenticated
  using (public.current_user_is_platform_admin())
  with check (public.current_user_is_platform_admin());

drop policy if exists platform_permission_audit_select on public.platform_permission_audit;
create policy platform_permission_audit_select on public.platform_permission_audit
  for select to authenticated
  using (public.current_user_is_platform_admin());

revoke insert, update, delete on public.platform_permission_audit from anon;
revoke insert, update, delete on public.platform_permission_audit from authenticated;

grant select, insert, update, delete on public.platform_user_access to authenticated;
grant select, insert, update, delete on public.user_page_permissions to authenticated;
grant select on public.guest_public_page_permissions to anon;
grant select, insert, update, delete on public.guest_public_page_permissions to authenticated;
grant select on public.platform_permission_audit to authenticated;
grant select, insert, update, delete on public.platform_user_access to service_role;
grant select, insert, update, delete on public.user_page_permissions to service_role;
grant select, insert, update, delete on public.guest_public_page_permissions to service_role;
grant select, insert, update, delete on public.platform_permission_audit to service_role;

insert into public.guest_public_page_permissions (page_key, is_public)
values
  ('dashboard', true),
  ('events', true),
  ('leader_prep', true),
  ('worship', true),
  ('tasks', true),
  ('communications', true),
  ('people', true),
  ('files', true),
  ('budget', true),
  ('discipleship', true),
  ('student_portal', true),
  ('journey_journal', true),
  ('scripture_resources', true),
  ('reading_plans', true),
  ('how_to_read', true),
  ('settings', false),
  ('camp', false),
  ('command_center', false)
on conflict (page_key) do nothing;

notify pgrst, 'reload schema';
