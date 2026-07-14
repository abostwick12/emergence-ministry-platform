-- Planning Center read-only People / attendance integration.
-- Additive only: stores per-ministry connection metadata plus minimized
-- external reference rows. OAuth tokens live in a private schema.

create schema if not exists lead_emergence_private;

revoke all on schema lead_emergence_private from public;
revoke all on schema lead_emergence_private from anon;
revoke all on schema lead_emergence_private from authenticated;
grant usage on schema lead_emergence_private to service_role;

create table if not exists public.ministry_integrations (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  provider text not null check (provider in ('planning_center')),
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'error')),
  config jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, provider)
);

create table if not exists public.planning_center_people_refs (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  external_person_id text not null,
  display_name text not null,
  household_external_id text,
  grade text,
  age_band text,
  source_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, external_person_id)
);

create table if not exists public.planning_center_attendance_refs (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  external_check_in_id text not null,
  external_person_id text,
  external_event_id text,
  session_label text,
  location_label text,
  checked_in_at timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, external_check_in_id)
);

create table if not exists public.planning_center_sync_runs (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  status text not null check (status in ('succeeded', 'failed')),
  people_count integer not null default 0,
  attendance_count integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create table if not exists lead_emergence_private.planning_center_tokens (
  ministry_id uuid primary key references public.ministries(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  scope text,
  updated_at timestamptz not null default now()
);

revoke all on table lead_emergence_private.planning_center_tokens from public;
revoke all on table lead_emergence_private.planning_center_tokens from anon;
revoke all on table lead_emergence_private.planning_center_tokens from authenticated;
grant select, insert, update, delete on table lead_emergence_private.planning_center_tokens to service_role;

drop trigger if exists set_ministry_integrations_updated_at on public.ministry_integrations;
create trigger set_ministry_integrations_updated_at
before update on public.ministry_integrations
for each row execute function public.set_updated_at();

drop trigger if exists set_planning_center_people_refs_updated_at on public.planning_center_people_refs;
create trigger set_planning_center_people_refs_updated_at
before update on public.planning_center_people_refs
for each row execute function public.set_updated_at();

drop trigger if exists set_planning_center_attendance_refs_updated_at on public.planning_center_attendance_refs;
create trigger set_planning_center_attendance_refs_updated_at
before update on public.planning_center_attendance_refs
for each row execute function public.set_updated_at();

alter table public.ministry_integrations enable row level security;
alter table public.planning_center_people_refs enable row level security;
alter table public.planning_center_attendance_refs enable row level security;
alter table public.planning_center_sync_runs enable row level security;

drop policy if exists "ministry can select ministry_integrations" on public.ministry_integrations;
drop policy if exists "ministry can insert ministry_integrations" on public.ministry_integrations;
drop policy if exists "ministry can update ministry_integrations" on public.ministry_integrations;
drop policy if exists "ministry can delete ministry_integrations" on public.ministry_integrations;

create policy "ministry can select ministry_integrations" on public.ministry_integrations
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "ministry can insert ministry_integrations" on public.ministry_integrations
for insert to authenticated with check (ministry_id = public.current_ministry_id());
create policy "ministry can update ministry_integrations" on public.ministry_integrations
for update to authenticated using (ministry_id = public.current_ministry_id()) with check (ministry_id = public.current_ministry_id());
create policy "ministry can delete ministry_integrations" on public.ministry_integrations
for delete to authenticated using (ministry_id = public.current_ministry_id());

drop policy if exists "ministry can select planning_center_people_refs" on public.planning_center_people_refs;
drop policy if exists "ministry can write planning_center_people_refs" on public.planning_center_people_refs;
create policy "ministry can select planning_center_people_refs" on public.planning_center_people_refs
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "ministry can write planning_center_people_refs" on public.planning_center_people_refs
for all to authenticated using (ministry_id = public.current_ministry_id()) with check (ministry_id = public.current_ministry_id());

drop policy if exists "ministry can select planning_center_attendance_refs" on public.planning_center_attendance_refs;
drop policy if exists "ministry can write planning_center_attendance_refs" on public.planning_center_attendance_refs;
create policy "ministry can select planning_center_attendance_refs" on public.planning_center_attendance_refs
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "ministry can write planning_center_attendance_refs" on public.planning_center_attendance_refs
for all to authenticated using (ministry_id = public.current_ministry_id()) with check (ministry_id = public.current_ministry_id());

drop policy if exists "ministry can select planning_center_sync_runs" on public.planning_center_sync_runs;
drop policy if exists "ministry can insert planning_center_sync_runs" on public.planning_center_sync_runs;
create policy "ministry can select planning_center_sync_runs" on public.planning_center_sync_runs
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "ministry can insert planning_center_sync_runs" on public.planning_center_sync_runs
for insert to authenticated with check (ministry_id = public.current_ministry_id());

create index if not exists idx_ministry_integrations_ministry_provider
  on public.ministry_integrations(ministry_id, provider);
create index if not exists idx_planning_center_people_refs_ministry
  on public.planning_center_people_refs(ministry_id, external_person_id);
create index if not exists idx_planning_center_attendance_refs_ministry
  on public.planning_center_attendance_refs(ministry_id, external_person_id, checked_in_at desc);
create index if not exists idx_planning_center_sync_runs_ministry
  on public.planning_center_sync_runs(ministry_id, started_at desc);

grant select, insert, update, delete on table public.ministry_integrations to authenticated;
grant select, insert, update, delete on table public.planning_center_people_refs to authenticated;
grant select, insert, update, delete on table public.planning_center_attendance_refs to authenticated;
grant select, insert on table public.planning_center_sync_runs to authenticated;
