-- 014_camp_access_roles.sql
-- Durable, admin-managed Camp access role assignments + change audit.
--
-- Purpose: make Camp access a property of the authenticated user (an explicit,
-- admin-granted assignment) instead of email/name inference. Once this is applied
-- and the initial admin is seeded (manual step at the bottom), the application
-- and RLS treat this table as the authoritative source; the legacy email/name
-- inference in 007 remains only as a transitional fallback until every Camp user
-- has a row here, after which it can be retired.
--
-- Additive and idempotent. NOT auto-applied. Apply via your Supabase workflow,
-- confirm the target project first, then run the seed at the bottom.

create extension if not exists pgcrypto;

-- Capability tiers (levels, not named persons):
--   camp_admin           -> full Camp operations + admin-only Medical Command
--   medical_coordinator  -> restricted medical workflows + EMMA smart search, NO Medical Command
--   restricted_assistant -> restricted medical workflows only (no EMMA smart search, no Medical Command)
--   leader               -> safe operational views only
--   driver               -> safe operational views, vehicle-scoped
create table if not exists public.camp_access_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  camp_role text not null check (camp_role in ('camp_admin','medical_coordinator','restricted_assistant','leader','driver')),
  is_active boolean not null default true,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists camp_access_members_set_updated_at on public.camp_access_members;
create trigger camp_access_members_set_updated_at
  before update on public.camp_access_members
  for each row execute function public.set_updated_at();

create table if not exists public.camp_access_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  actor_email text,
  target_user_id uuid,
  target_email text,
  action text not null check (action in ('grant','update','revoke')),
  old_role text,
  new_role text,
  created_at timestamptz not null default now()
);

create index if not exists camp_access_audit_target_idx
  on public.camp_access_audit(target_user_id, created_at desc);

-- Authoritative Camp role / admin checks from the durable table.
create or replace function public.current_user_camp_role()
returns text language sql stable security definer set search_path = '' as $$
  select m.camp_role
  from public.camp_access_members m
  where m.user_id = auth.uid() and m.is_active
  limit 1;
$$;

create or replace function public.current_user_is_camp_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.camp_access_members m
    where m.user_id = auth.uid() and m.is_active and m.camp_role = 'camp_admin'
  );
$$;

alter table public.camp_access_members enable row level security;
alter table public.camp_access_audit enable row level security;

-- Members may read their own assignment; admins read all.
drop policy if exists camp_access_members_select on public.camp_access_members;
create policy camp_access_members_select on public.camp_access_members
  for select using (user_id = auth.uid() or public.current_user_is_camp_admin());

-- Only admins may create/update/revoke assignments.
drop policy if exists camp_access_members_modify on public.camp_access_members;
create policy camp_access_members_modify on public.camp_access_members
  for all using (public.current_user_is_camp_admin())
  with check (public.current_user_is_camp_admin());

-- Only admins may read the change audit.
drop policy if exists camp_access_audit_select on public.camp_access_audit;
create policy camp_access_audit_select on public.camp_access_audit
  for select using (public.current_user_is_camp_admin());

-- Admins may append audit rows (the app writes one per access change).
drop policy if exists camp_access_audit_insert on public.camp_access_audit;
create policy camp_access_audit_insert on public.camp_access_audit
  for insert with check (public.current_user_is_camp_admin());

-- Guard: never allow removing or demoting the final active administrator.
create or replace function public.camp_access_guard_last_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare remaining int;
begin
  if tg_op = 'DELETE' then
    if old.camp_role = 'camp_admin' and old.is_active then
      select count(*) into remaining from public.camp_access_members
        where camp_role = 'camp_admin' and is_active and user_id <> old.user_id;
      if remaining = 0 then
        raise exception 'Cannot remove the final Camp administrator.';
      end if;
    end if;
    return old;
  end if;

  if old.camp_role = 'camp_admin' and old.is_active
     and (new.camp_role <> 'camp_admin' or not new.is_active) then
    select count(*) into remaining from public.camp_access_members
      where camp_role = 'camp_admin' and is_active and user_id <> old.user_id;
    if remaining = 0 then
      raise exception 'Cannot demote the final Camp administrator.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists camp_access_members_last_admin on public.camp_access_members;
create trigger camp_access_members_last_admin
  before update or delete on public.camp_access_members
  for each row execute function public.camp_access_guard_last_admin();

-- ── Manual seed (run ONCE after applying, with Andrew's real auth user id) ──
-- Andrew is the initial Camp administrator. Replace the placeholders with the
-- real auth.users id + email (do not assume an email local part):
--
-- insert into public.camp_access_members (user_id, email, camp_role, granted_by)
-- values ('<ANDREW_AUTH_USER_ID>', '<andrew-email>', 'camp_admin', '<ANDREW_AUTH_USER_ID>')
-- on conflict (user_id) do update set camp_role = 'camp_admin', is_active = true, updated_at = now();
