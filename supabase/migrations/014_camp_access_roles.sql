-- 014_camp_access_roles.sql
-- Durable, admin-managed Camp access role assignments + change audit.
--
-- Additive and idempotent. NOT auto-applied. Apply via the approved Supabase
-- workflow after confirming the target project.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

-- Capability tiers:
--   camp_admin           -> full Camp operations + admin-only Medical Command
--   medical_coordinator  -> restricted medical workflows + EMMA smart search, NO Medical Command
--   restricted_assistant -> restricted medical workflows only
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

-- Replace legacy restricted identity inference with the durable Camp role table.
create or replace function public.current_user_can_access_camp_restricted()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.camp_access_members m
    where m.user_id = auth.uid()
      and m.is_active
      and m.camp_role in ('camp_admin','medical_coordinator','restricted_assistant')
  );
$$;

alter table public.camp_access_members enable row level security;
alter table public.camp_access_audit enable row level security;

drop policy if exists camp_access_members_select on public.camp_access_members;
create policy camp_access_members_select on public.camp_access_members
  for select using (user_id = auth.uid() or public.current_user_is_camp_admin());

drop policy if exists camp_access_members_modify on public.camp_access_members;
create policy camp_access_members_modify on public.camp_access_members
  for all using (public.current_user_is_camp_admin())
  with check (public.current_user_is_camp_admin());

drop policy if exists camp_access_audit_select on public.camp_access_audit;
create policy camp_access_audit_select on public.camp_access_audit
  for select using (public.current_user_is_camp_admin());

drop policy if exists camp_access_audit_insert on public.camp_access_audit;
revoke insert, update, delete on public.camp_access_audit from anon;
revoke insert, update, delete on public.camp_access_audit from authenticated;
grant select on public.camp_access_audit to authenticated;

-- Access audit rows are generated from the actual member-table operation.
-- Clients never provide actor, timestamp, action, or subject metadata.
create or replace function private.camp_access_audit_member_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  actor_mail text;
  audit_action text;
  audit_old_role text;
  audit_new_role text;
  target_id uuid;
  target_mail text;
begin
  if tg_op = 'UPDATE'
     and old.camp_role is not distinct from new.camp_role
     and old.is_active is not distinct from new.is_active then
    return new;
  end if;

  if actor_id is null then
    actor_id := case
      when tg_op in ('INSERT','UPDATE') then new.granted_by
      else old.granted_by
    end;
  end if;

  select lower(u.email) into actor_mail
  from auth.users u
  where u.id = actor_id;

  if tg_op = 'INSERT' then
    audit_action := case when new.is_active then 'grant' else 'revoke' end;
    audit_old_role := null;
    audit_new_role := case when new.is_active then new.camp_role else null end;
    target_id := new.user_id;
    target_mail := new.email;
  elsif tg_op = 'UPDATE' then
    audit_action := case
      when old.is_active = false and new.is_active = true then 'grant'
      when new.is_active = false then 'revoke'
      else 'update'
    end;
    audit_old_role := case when old.is_active then old.camp_role else null end;
    audit_new_role := case when new.is_active then new.camp_role else null end;
    target_id := new.user_id;
    target_mail := new.email;
  else
    audit_action := 'revoke';
    audit_old_role := case when old.is_active then old.camp_role else null end;
    audit_new_role := null;
    target_id := old.user_id;
    target_mail := old.email;
  end if;

  insert into public.camp_access_audit (
    actor_user_id,
    actor_email,
    target_user_id,
    target_email,
    action,
    old_role,
    new_role
  )
  values (
    actor_id,
    actor_mail,
    target_id,
    lower(target_mail),
    audit_action,
    audit_old_role,
    audit_new_role
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists camp_access_members_audit on public.camp_access_members;
create trigger camp_access_members_audit
  after insert or update or delete on public.camp_access_members
  for each row execute function private.camp_access_audit_member_change();

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

-- Bootstrap Andrew as the first Camp Admin if his authenticated user exists.
-- The member trigger writes the corresponding audit row from this database operation.
insert into public.camp_access_members (user_id, email, camp_role, granted_by)
select u.id, lower(u.email), 'camp_admin', u.id
from auth.users u
where lower(u.email) = 'andrew.w.bostwick12@gmail.com'
on conflict (user_id) do update
set email = excluded.email,
    camp_role = 'camp_admin',
    is_active = true,
    granted_by = excluded.granted_by,
    updated_at = now();

notify pgrst, 'reload schema';
