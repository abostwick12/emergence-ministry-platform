-- 021_camp_leader_permissions_upgrade.sql
-- Additive Camp leader permission scopes + denied mutation audit.
-- NOT auto-applied. Confirm the target Supabase project before running.

alter table public.camp_access_members
  add column if not exists camp_edit_scope text not null default 'read_only'
    check (camp_edit_scope in ('read_only','partner_church_only','all_campers')),
  add column if not exists app_area_scope text not null default 'camp_only'
    check (app_area_scope in ('camp_only','emerge_operations','admin')),
  add column if not exists can_post_team_bulletin boolean not null default false,
  add column if not exists partner_church_id text,
  add column if not exists assigned_team_ids text[] not null default '{}'::text[],
  add column if not exists last_change_reason text;

update public.camp_access_members
set camp_edit_scope = 'all_campers',
    app_area_scope = 'admin',
    can_post_team_bulletin = true
where camp_role = 'camp_admin';

update public.camp_access_members
set partner_church_id = null
where camp_edit_scope <> 'partner_church_only';

alter table public.camp_access_audit
  add column if not exists previous_value jsonb,
  add column if not exists new_value jsonb,
  add column if not exists reason text;

create table if not exists public.camp_denied_mutation_audit (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid references public.ministries(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  camp_role text,
  camp_edit_scope text,
  app_area_scope text,
  action text not null,
  target_table text not null,
  target_id text,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists camp_denied_mutation_audit_actor_idx
  on public.camp_denied_mutation_audit(actor_user_id, created_at desc);

create index if not exists camp_denied_mutation_audit_target_idx
  on public.camp_denied_mutation_audit(target_table, target_id, created_at desc);

create table if not exists public.camp_team_bulletins (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid references public.ministries(id) on delete set null,
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  team_id uuid not null references public.camp_teams(id) on delete cascade,
  partner_church_id text,
  message text not null,
  posted_by_user_id uuid references auth.users(id) on delete set null,
  posted_by_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists camp_team_bulletins_team_idx
  on public.camp_team_bulletins(team_id, created_at desc);

alter table public.camp_denied_mutation_audit enable row level security;
alter table public.camp_team_bulletins enable row level security;

create or replace function public.current_user_can_post_team_bulletin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(m.can_post_team_bulletin, false)
  from public.camp_access_members m
  where m.user_id = auth.uid() and m.is_active
  limit 1;
$$;

create or replace function public.current_user_camp_edit_scope()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(m.camp_edit_scope, 'read_only')
  from public.camp_access_members m
  where m.user_id = auth.uid() and m.is_active
  limit 1;
$$;

create or replace function public.current_user_partner_church_id()
returns text language sql stable security definer set search_path = '' as $$
  select m.partner_church_id
  from public.camp_access_members m
  where m.user_id = auth.uid() and m.is_active
  limit 1;
$$;

create or replace function public.current_user_assigned_team_ids()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(m.assigned_team_ids, '{}'::text[])
  from public.camp_access_members m
  where m.user_id = auth.uid() and m.is_active
  limit 1;
$$;

drop policy if exists camp_denied_mutation_audit_select on public.camp_denied_mutation_audit;
create policy camp_denied_mutation_audit_select on public.camp_denied_mutation_audit
  for select to authenticated
  using (public.current_user_is_camp_admin());

drop policy if exists camp_denied_mutation_audit_insert on public.camp_denied_mutation_audit;
create policy camp_denied_mutation_audit_insert on public.camp_denied_mutation_audit
  for insert to authenticated
  with check (actor_user_id = auth.uid());

drop policy if exists camp_team_bulletins_select on public.camp_team_bulletins;
create policy camp_team_bulletins_select on public.camp_team_bulletins
  for select to authenticated
  using (ministry_id = public.current_ministry_id());

drop policy if exists camp_team_bulletins_insert on public.camp_team_bulletins;
create policy camp_team_bulletins_insert on public.camp_team_bulletins
  for insert to authenticated
  with check (
    ministry_id = public.current_ministry_id()
    and posted_by_user_id = auth.uid()
    and public.current_user_can_post_team_bulletin()
    and (
      public.current_user_camp_edit_scope() = 'all_campers'
      or (
        team_id::text = any(public.current_user_assigned_team_ids())
        and (
          (public.current_user_partner_church_id() is null and partner_church_id is null)
          or (
            public.current_user_partner_church_id() is not null
            and partner_church_id = public.current_user_partner_church_id()
          )
        )
      )
    )
  );

grant select, insert on public.camp_denied_mutation_audit to authenticated;
grant select, insert on public.camp_team_bulletins to authenticated;

create or replace function public.current_user_camp_edit_scope()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(m.camp_edit_scope, 'read_only')
  from public.camp_access_members m
  where m.user_id = auth.uid() and m.is_active
  limit 1;
$$;

create or replace function public.current_user_app_area_scope()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(m.app_area_scope, 'camp_only')
  from public.camp_access_members m
  where m.user_id = auth.uid() and m.is_active
  limit 1;
$$;

create or replace function public.current_user_can_post_team_bulletin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(m.can_post_team_bulletin, false)
  from public.camp_access_members m
  where m.user_id = auth.uid() and m.is_active
  limit 1;
$$;

create or replace function public.current_user_partner_church_id()
returns text language sql stable security definer set search_path = '' as $$
  select m.partner_church_id
  from public.camp_access_members m
  where m.user_id = auth.uid() and m.is_active
  limit 1;
$$;

create or replace function public.current_user_assigned_team_ids()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(m.assigned_team_ids, '{}'::text[])
  from public.camp_access_members m
  where m.user_id = auth.uid() and m.is_active
  limit 1;
$$;

create or replace function public.current_user_is_camp_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.camp_access_members m
    where m.user_id = auth.uid()
      and m.is_active
      and m.camp_role = 'camp_admin'
      and m.app_area_scope = 'admin'
  );
$$;

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
  previous_payload jsonb;
  new_payload jsonb;
begin
  if tg_op = 'UPDATE'
     and old.camp_role is not distinct from new.camp_role
     and old.camp_edit_scope is not distinct from new.camp_edit_scope
     and old.app_area_scope is not distinct from new.app_area_scope
     and old.can_post_team_bulletin is not distinct from new.can_post_team_bulletin
     and old.partner_church_id is not distinct from new.partner_church_id
     and old.assigned_team_ids is not distinct from new.assigned_team_ids
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
    previous_payload := null;
    new_payload := to_jsonb(new) - 'created_at' - 'updated_at';
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
    previous_payload := to_jsonb(old) - 'created_at' - 'updated_at';
    new_payload := to_jsonb(new) - 'created_at' - 'updated_at';
  else
    audit_action := 'revoke';
    audit_old_role := case when old.is_active then old.camp_role else null end;
    audit_new_role := null;
    target_id := old.user_id;
    target_mail := old.email;
    previous_payload := to_jsonb(old) - 'created_at' - 'updated_at';
    new_payload := null;
  end if;

  insert into public.camp_access_audit (
    actor_user_id,
    actor_email,
    target_user_id,
    target_email,
    action,
    old_role,
    new_role,
    previous_value,
    new_value,
    reason
  )
  values (
    actor_id,
    actor_mail,
    target_id,
    lower(target_mail),
    audit_action,
    audit_old_role,
    audit_new_role,
    previous_payload,
    new_payload,
    case when tg_op in ('INSERT','UPDATE') then nullif(trim(new.last_change_reason), '') else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
