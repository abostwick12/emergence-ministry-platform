-- 022_camp_emma_controlled_actions.sql
-- Additive EMMA Camp Mode pending-action storage and full audit trail.
--
-- NOT APPLIED. Review and apply only with explicit approval.

create table if not exists public.camp_emma_pending_actions (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  actor_user_id uuid not null,
  target_type text not null check (target_type in ('camper', 'leader')),
  target_id uuid not null,
  target_name text not null default '',
  action_type text not null check (action_type in (
    'ASSIGN_CAMPER_TEAM',
    'ASSIGN_LEADER_TEAM',
    'UPDATE_CAMPER_ROOM'
  )),
  field_name text not null check (field_name in ('team', 'room')),
  old_value text not null default '',
  new_value text not null default '',
  original_command_text text not null default '',
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled', 'expired'))
);

drop trigger if exists set_camp_emma_pending_actions_ministry_id on public.camp_emma_pending_actions;
create trigger set_camp_emma_pending_actions_ministry_id
before insert on public.camp_emma_pending_actions
for each row execute function public.set_ministry_id_if_null();

create index if not exists camp_emma_pending_actions_actor_idx
  on public.camp_emma_pending_actions(actor_user_id, created_at desc);
create index if not exists camp_emma_pending_actions_camp_idx
  on public.camp_emma_pending_actions(camp_id, status, expires_at);

create table if not exists public.camp_emma_actions_audit (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  actor_user_id uuid not null,
  actor_name text not null default '',
  target_type text check (target_type in ('camper', 'leader')),
  target_id uuid,
  target_name text,
  action_type text check (action_type in (
    'ASSIGN_CAMPER_TEAM',
    'ASSIGN_LEADER_TEAM',
    'UPDATE_CAMPER_ROOM',
    'LIST_UNASSIGNED_CAMPERS',
    'LIST_UNASSIGNED_LEADERS'
  )),
  field_name text check (field_name in ('team', 'room')),
  old_value text,
  new_value text,
  original_command_text text not null default '',
  confirmation_required boolean not null default false,
  pending_action_id uuid,
  confirmed_at timestamptz,
  status text not null check (status in ('proposed', 'completed', 'denied', 'failed', 'cancelled')),
  error_message text,
  created_at timestamptz not null default now()
);

drop trigger if exists set_camp_emma_actions_audit_ministry_id on public.camp_emma_actions_audit;
create trigger set_camp_emma_actions_audit_ministry_id
before insert on public.camp_emma_actions_audit
for each row execute function public.set_ministry_id_if_null();

create index if not exists camp_emma_actions_audit_actor_idx
  on public.camp_emma_actions_audit(actor_user_id, created_at desc);
create index if not exists camp_emma_actions_audit_target_idx
  on public.camp_emma_actions_audit(target_type, target_id, created_at desc);
create index if not exists camp_emma_actions_audit_pending_idx
  on public.camp_emma_actions_audit(pending_action_id);

alter table public.camp_emma_pending_actions enable row level security;
alter table public.camp_emma_actions_audit enable row level security;

drop policy if exists camp_emma_pending_actions_select_own on public.camp_emma_pending_actions;
create policy camp_emma_pending_actions_select_own on public.camp_emma_pending_actions
for select to authenticated
using (ministry_id = public.current_ministry_id() and actor_user_id = (select auth.uid()));

drop policy if exists camp_emma_pending_actions_insert_own on public.camp_emma_pending_actions;
create policy camp_emma_pending_actions_insert_own on public.camp_emma_pending_actions
for insert to authenticated
with check (ministry_id = public.current_ministry_id() and actor_user_id = (select auth.uid()));

drop policy if exists camp_emma_pending_actions_update_own on public.camp_emma_pending_actions;
create policy camp_emma_pending_actions_update_own on public.camp_emma_pending_actions
for update to authenticated
using (ministry_id = public.current_ministry_id() and actor_user_id = (select auth.uid()))
with check (ministry_id = public.current_ministry_id() and actor_user_id = (select auth.uid()));

drop policy if exists camp_emma_actions_audit_select on public.camp_emma_actions_audit;
create policy camp_emma_actions_audit_select on public.camp_emma_actions_audit
for select to authenticated
using (ministry_id = public.current_ministry_id());

drop policy if exists camp_emma_actions_audit_insert on public.camp_emma_actions_audit;
create policy camp_emma_actions_audit_insert on public.camp_emma_actions_audit
for insert to authenticated
with check (ministry_id = public.current_ministry_id() and actor_user_id = (select auth.uid()));

grant select, insert, update on public.camp_emma_pending_actions to authenticated;
grant select, insert on public.camp_emma_actions_audit to authenticated;

notify pgrst, 'reload schema';
