-- 006_emma_foundation.sql
-- EMMA (Emerge Ministry Momentum Assistant) Iteration 1 — audited AI foundation.
--
-- Adds the request/run/provider-attempt/proposal/approval audit tables plus a
-- per-ministry feature-config table. No AI provider is called by this iteration;
-- these tables record and govern EMMA activity. Every table is ministry-scoped
-- (reusing public.current_ministry_id() and the set_ministry_id_if_null trigger
-- from migration 005) and protected by RLS. Admin/Leader roles may create
-- requests and decide proposals.
--
-- Additive and idempotent: safe to run multiple times. No data is deleted.
-- Requires migration 005 (ministries, current_ministry_id, set_ministry_id_if_null).

create extension if not exists pgcrypto;

-- Role helper: the authenticated user's role from their profile. SECURITY
-- DEFINER so policies can read profiles regardless of RLS. profiles.role exists
-- in the base schema, so this is safe to define before the EMMA tables.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- 1. Tables -----------------------------------------------------------------

create table if not exists public.ai_feature_configs (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  feature_key text not null,
  enabled boolean not null default true,
  primary_provider text,
  primary_model text,
  fallback_provider text,
  fallback_model text,
  temperature numeric(4, 2),
  max_output_tokens integer,
  timeout_ms integer,
  requires_approval boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, feature_key)
);

create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  requested_by uuid references public.profiles(id),
  source text not null check (source in ('event_card','task_action','dashboard','assistant_panel','scheduled','system','planning_center')),
  source_record_type text,
  source_record_id text,
  workflow text not null check (workflow in ('EVENT_PLAN','GENERATE_EVENT_TASKS','ANALYZE_TASK_HEALTH','DRAFT_PARENT_EMAIL','DRAFT_LEADER_GROUPME','DRAFT_SMS','ANALYZE_VOLUNTEER_GAPS','GENERATE_MINISTRY_SUMMARY','DRAFT_STUDENT_FOLLOW_UP','QUERY_MINISTRY_LIBRARY')),
  status text not null default 'pending' check (status in ('pending','running','awaiting_approval','completed','failed','cancelled')),
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ai_requests(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id),
  skill_key text not null,
  input_schema_version text,
  output_schema_version text,
  context_manifest jsonb not null default '{"entries":[]}'::jsonb,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed')),
  summary text,
  assumptions jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_provider_attempts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_runs(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id),
  provider text not null,
  model text not null,
  attempt_number integer not null default 1,
  status text not null check (status in ('success','failure')),
  error_code text,
  http_status integer,
  duration_ms integer,
  total_tokens integer,
  estimated_cost numeric(10, 4),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_action_proposals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_runs(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id),
  action_type text not null check (action_type in ('create_tasks','update_event','create_communication_draft','create_operational_alert','none')),
  risk_level text not null check (risk_level in ('low','medium','high','restricted')),
  target_table text,
  target_record_id text,
  payload jsonb,
  summary text not null,
  requires_approval boolean not null default true,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','executed')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_approvals (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.ai_action_proposals(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id),
  decision text not null check (decision in ('approved','rejected','changes_requested')),
  decided_by uuid references public.profiles(id),
  decision_notes text,
  original_payload jsonb,
  approved_payload jsonb,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2. updated_at triggers (tables that carry updated_at) ---------------------

drop trigger if exists set_ai_feature_configs_updated_at on public.ai_feature_configs;
create trigger set_ai_feature_configs_updated_at before update on public.ai_feature_configs
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_requests_updated_at on public.ai_requests;
create trigger set_ai_requests_updated_at before update on public.ai_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_runs_updated_at on public.ai_runs;
create trigger set_ai_runs_updated_at before update on public.ai_runs
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_action_proposals_updated_at on public.ai_action_proposals;
create trigger set_ai_action_proposals_updated_at before update on public.ai_action_proposals
for each row execute function public.set_updated_at();

-- 3. Default-scope triggers (fill ministry_id on insert when omitted) -------

drop trigger if exists set_ai_feature_configs_ministry_id on public.ai_feature_configs;
create trigger set_ai_feature_configs_ministry_id before insert on public.ai_feature_configs
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_ai_requests_ministry_id on public.ai_requests;
create trigger set_ai_requests_ministry_id before insert on public.ai_requests
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_ai_runs_ministry_id on public.ai_runs;
create trigger set_ai_runs_ministry_id before insert on public.ai_runs
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_ai_provider_attempts_ministry_id on public.ai_provider_attempts;
create trigger set_ai_provider_attempts_ministry_id before insert on public.ai_provider_attempts
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_ai_action_proposals_ministry_id on public.ai_action_proposals;
create trigger set_ai_action_proposals_ministry_id before insert on public.ai_action_proposals
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_ai_approvals_ministry_id on public.ai_approvals;
create trigger set_ai_approvals_ministry_id before insert on public.ai_approvals
for each row execute function public.set_ministry_id_if_null();

-- 4. Indexes ----------------------------------------------------------------

create index if not exists idx_ai_feature_configs_ministry on public.ai_feature_configs(ministry_id);
create index if not exists idx_ai_requests_ministry on public.ai_requests(ministry_id);
create index if not exists idx_ai_requests_status on public.ai_requests(status);
create index if not exists idx_ai_requests_workflow on public.ai_requests(workflow);
create index if not exists idx_ai_requests_requested_by on public.ai_requests(requested_by);
create index if not exists idx_ai_requests_created_at on public.ai_requests(created_at);
create index if not exists idx_ai_runs_request on public.ai_runs(request_id);
create index if not exists idx_ai_runs_ministry on public.ai_runs(ministry_id);
create index if not exists idx_ai_runs_status on public.ai_runs(status);
create index if not exists idx_ai_runs_created_at on public.ai_runs(created_at);
create index if not exists idx_ai_provider_attempts_run on public.ai_provider_attempts(run_id);
create index if not exists idx_ai_provider_attempts_ministry on public.ai_provider_attempts(ministry_id);
create index if not exists idx_ai_provider_attempts_created_at on public.ai_provider_attempts(created_at);
create index if not exists idx_ai_action_proposals_run on public.ai_action_proposals(run_id);
create index if not exists idx_ai_action_proposals_ministry on public.ai_action_proposals(ministry_id);
create index if not exists idx_ai_action_proposals_status on public.ai_action_proposals(status);
create index if not exists idx_ai_action_proposals_created_at on public.ai_action_proposals(created_at);
create index if not exists idx_ai_approvals_proposal on public.ai_approvals(proposal_id);
create index if not exists idx_ai_approvals_ministry on public.ai_approvals(ministry_id);
create index if not exists idx_ai_approvals_decided_by on public.ai_approvals(decided_by);
create index if not exists idx_ai_approvals_created_at on public.ai_approvals(created_at);

-- 5. RLS --------------------------------------------------------------------
-- Every table is ministry-scoped. ai_requests and ai_approvals additionally
-- require an Admin or Leader role to insert (create requests / decide
-- proposals). ai_feature_configs is Admin-managed. No DELETE policies are
-- granted on the audit tables, so authenticated users cannot delete history.

alter table public.ai_feature_configs enable row level security;
alter table public.ai_requests enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_provider_attempts enable row level security;
alter table public.ai_action_proposals enable row level security;
alter table public.ai_approvals enable row level security;

-- ai_feature_configs (Admin-managed)
drop policy if exists "ministry can select ai_feature_configs" on public.ai_feature_configs;
drop policy if exists "admin can insert ai_feature_configs" on public.ai_feature_configs;
drop policy if exists "admin can update ai_feature_configs" on public.ai_feature_configs;
drop policy if exists "admin can delete ai_feature_configs" on public.ai_feature_configs;
create policy "ministry can select ai_feature_configs" on public.ai_feature_configs
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "admin can insert ai_feature_configs" on public.ai_feature_configs
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() = 'admin');
create policy "admin can update ai_feature_configs" on public.ai_feature_configs
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() = 'admin')
with check (ministry_id = public.current_ministry_id() and public.current_user_role() = 'admin');
create policy "admin can delete ai_feature_configs" on public.ai_feature_configs
for delete to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() = 'admin');

-- ai_requests (Admin/Leader create)
drop policy if exists "ministry can select ai_requests" on public.ai_requests;
drop policy if exists "staff can insert ai_requests" on public.ai_requests;
drop policy if exists "staff can update ai_requests" on public.ai_requests;
create policy "ministry can select ai_requests" on public.ai_requests
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "staff can insert ai_requests" on public.ai_requests
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader'));
create policy "staff can update ai_requests" on public.ai_requests
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader'));

-- ai_runs (Admin/Leader create + update)
drop policy if exists "ministry can select ai_runs" on public.ai_runs;
drop policy if exists "staff can insert ai_runs" on public.ai_runs;
drop policy if exists "staff can update ai_runs" on public.ai_runs;
create policy "ministry can select ai_runs" on public.ai_runs
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "staff can insert ai_runs" on public.ai_runs
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader'));
create policy "staff can update ai_runs" on public.ai_runs
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader'));

-- ai_provider_attempts (ministry-scoped append)
drop policy if exists "ministry can select ai_provider_attempts" on public.ai_provider_attempts;
drop policy if exists "staff can insert ai_provider_attempts" on public.ai_provider_attempts;
create policy "ministry can select ai_provider_attempts" on public.ai_provider_attempts
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "staff can insert ai_provider_attempts" on public.ai_provider_attempts
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader'));

-- ai_action_proposals (Admin/Leader create + update)
drop policy if exists "ministry can select ai_action_proposals" on public.ai_action_proposals;
drop policy if exists "staff can insert ai_action_proposals" on public.ai_action_proposals;
drop policy if exists "staff can update ai_action_proposals" on public.ai_action_proposals;
create policy "ministry can select ai_action_proposals" on public.ai_action_proposals
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "staff can insert ai_action_proposals" on public.ai_action_proposals
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader'));
create policy "staff can update ai_action_proposals" on public.ai_action_proposals
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader'));

-- ai_approvals (only Admin/Leader may approve; append-only)
drop policy if exists "ministry can select ai_approvals" on public.ai_approvals;
drop policy if exists "approvers can insert ai_approvals" on public.ai_approvals;
create policy "ministry can select ai_approvals" on public.ai_approvals
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "approvers can insert ai_approvals" on public.ai_approvals
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader'));

-- 6. Refresh PostgREST schema cache.
notify pgrst, 'reload schema';
