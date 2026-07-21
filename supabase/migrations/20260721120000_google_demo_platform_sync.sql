-- Google demo Calendar and Drive synchronization for the ministry platform.
-- Additive only. OAuth refresh tokens stay encrypted in the private schema.

alter table public.ministry_integrations
  drop constraint if exists ministry_integrations_provider_check;

alter table public.ministry_integrations
  add constraint ministry_integrations_provider_check
  check (provider in ('planning_center', 'groupme', 'google_demo'));

alter table public.events
  add column if not exists google_calendar_event_id text,
  add column if not exists google_calendar_event_url text,
  add column if not exists google_drive_folder_id text,
  add column if not exists google_drive_folder_url text,
  add column if not exists google_import_status text;

alter table public.events
  drop constraint if exists events_google_import_status_check;

alter table public.events
  add constraint events_google_import_status_check
    check (
      google_import_status is null
      or google_import_status in ('imported_from_google', 'planning_details_incomplete')
    ) not valid;

create index if not exists idx_events_google_calendar_event
  on public.events(ministry_id, google_calendar_event_id)
  where google_calendar_event_id is not null;

create index if not exists idx_events_google_drive_folder
  on public.events(ministry_id, google_drive_folder_id)
  where google_drive_folder_id is not null;

create schema if not exists lead_emergence_private;

revoke all on schema lead_emergence_private from public;
revoke all on schema lead_emergence_private from anon;
revoke all on schema lead_emergence_private from authenticated;
grant usage on schema lead_emergence_private to service_role;

create table if not exists lead_emergence_private.google_demo_tokens (
  ministry_id uuid primary key references public.ministries(id) on delete cascade,
  google_account_email text not null,
  google_calendar_id text not null,
  google_calendar_name text not null default 'Emerge',
  google_drive_folder_id text not null,
  google_drive_folder_name text not null default 'Lead Emergence automated Platform',
  google_refresh_token_encrypted text not null,
  calendar_sync_token text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table lead_emergence_private.google_demo_tokens from public;
revoke all on table lead_emergence_private.google_demo_tokens from anon;
revoke all on table lead_emergence_private.google_demo_tokens from authenticated;
grant select, insert, update, delete on table lead_emergence_private.google_demo_tokens to service_role;

drop trigger if exists set_google_demo_tokens_updated_at on lead_emergence_private.google_demo_tokens;
create trigger set_google_demo_tokens_updated_at
before update on lead_emergence_private.google_demo_tokens
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
