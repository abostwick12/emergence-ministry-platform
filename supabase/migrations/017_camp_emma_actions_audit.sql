-- 017_camp_emma_actions_audit.sql
-- Audit trail for Camp EMMA-confirmed room/cabin changes (first EMMA write
-- slice: Andrew-only operational room changes).
--
-- Additive and idempotent. No existing table/column/policy is dropped or
-- narrowed. Adds a new camp_emma_actions table only.
--
-- Every row is written exactly once, immediately after a confirmed EMMA room
-- change (never before confirmation, never speculatively). It records the
-- actor, the camper, the old/new room values, the source ("emma"), the
-- original natural-language request, and which model/deployment produced the
-- proposal — never an API key or any restricted medical/contact data, since
-- this slice never touches those fields.
--
-- NOT YET APPLIED — drafted for review. Do not run against any environment
-- without explicit approval.

create table if not exists public.camp_emma_actions (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  camper_id uuid not null references public.camp_campers(id) on delete cascade,
  actor_name text not null,
  student_name text not null,
  old_room text not null default '',
  new_room text not null default '',
  source text not null default 'emma' check (source = 'emma'),
  original_request text not null default '',
  model text not null default '',
  deployment text not null default '',
  created_at timestamptz not null default now()
);

drop trigger if exists set_camp_emma_actions_ministry_id on public.camp_emma_actions;
create trigger set_camp_emma_actions_ministry_id before insert on public.camp_emma_actions
for each row execute function public.set_ministry_id_if_null();

create index if not exists idx_camp_emma_actions_camp on public.camp_emma_actions(camp_id);
create index if not exists idx_camp_emma_actions_camper on public.camp_emma_actions(camper_id);
create index if not exists idx_camp_emma_actions_ministry on public.camp_emma_actions(ministry_id);

alter table public.camp_emma_actions enable row level security;

-- Audit-log access shape: any ministry member can read the trail (it carries
-- no restricted medical/contact data), but only Andrew can ever insert,
-- mirroring the Andrew-only confirm-route gate enforced in application code.
-- This is defense in depth, not the primary gate — the primary gate is
-- assertCampEmmaOperationsAccess in lib/camp/permissions.ts.
drop policy if exists "ministry can select camp_emma_actions" on public.camp_emma_actions;
drop policy if exists "andrew can insert camp_emma_actions" on public.camp_emma_actions;
create policy "ministry can select camp_emma_actions" on public.camp_emma_actions
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "andrew can insert camp_emma_actions" on public.camp_emma_actions
for insert to authenticated
with check (
  ministry_id = public.current_ministry_id()
  and public.current_user_is_camp_admin()
);

notify pgrst, 'reload schema';
