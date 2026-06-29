-- 023_camp_grouped_medication_workflow.sql
-- Additive support for camper-level medication intake sessions and grouped
-- medication administration passes. Do not apply without confirming target env.

alter table public.camp_medication_records
  add column if not exists quantity_remaining text,
  add column if not exists schedule_type text not null default 'scheduled'
    check (schedule_type in ('scheduled','prn','needs_review')),
  add column if not exists is_prn boolean not null default false;

create table if not exists public.camp_medication_intake_sessions (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id),
  camper_id uuid not null references public.camp_campers(id),
  received_by_user_id uuid references public.profiles(id),
  received_by_name text not null default '',
  received_at timestamptz not null default now(),
  guardian_name text not null default '',
  guardian_relationship text not null default '',
  guardian_signature_data jsonb not null,
  signature_format text not null default 'json_strokes_v1' check (signature_format in ('json_strokes_v1')),
  status text not null default 'draft' check (status in ('draft','completed','archived')),
  notes text not null default '',
  medication_count integer not null default 0 check (medication_count >= 0),
  archived_at timestamptz,
  archived_by_user_id uuid references public.profiles(id),
  archived_by_name text not null default '',
  archive_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.camp_medication_intake_records
  add column if not exists intake_session_id uuid references public.camp_medication_intake_sessions(id) on delete set null;

create table if not exists public.camp_medication_administration_events (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id),
  camper_id uuid not null references public.camp_campers(id),
  administered_by_user_id uuid references public.profiles(id),
  administered_by text not null default '',
  administered_at timestamptz not null default now(),
  time_window text not null,
  student_acknowledgement_initials text not null default '',
  student_acknowledgement_unavailable boolean not null default false,
  student_acknowledgement_unavailable_reason text not null default '',
  notes text not null default '',
  item_count integer not null default 0 check (item_count > 0),
  created_at timestamptz not null default now(),
  constraint camp_medication_admin_event_ack_check check (
    (
      student_acknowledgement_unavailable = false
      and length(trim(student_acknowledgement_initials)) > 0
      and length(trim(student_acknowledgement_unavailable_reason)) = 0
    )
    or
    (
      student_acknowledgement_unavailable = true
      and length(trim(student_acknowledgement_initials)) = 0
      and length(trim(student_acknowledgement_unavailable_reason)) > 0
    )
  )
);

create table if not exists public.camp_medication_administration_items (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id),
  administration_event_id uuid not null references public.camp_medication_administration_events(id),
  medication_record_id uuid not null references public.camp_medication_records(id),
  schedule_item_id uuid references public.camp_medication_schedule_items(id) on delete set null,
  camper_id uuid not null references public.camp_campers(id),
  medication_name text not null default '',
  time_window text not null,
  status text not null check (status in ('administered','skipped','refused','held','not_present')),
  dose_given text not null default '',
  administered_at timestamptz not null default now(),
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.camp_medication_administration_logs
  add column if not exists administration_event_id uuid references public.camp_medication_administration_events(id) on delete set null,
  add column if not exists administration_item_id uuid references public.camp_medication_administration_items(id) on delete set null;

drop trigger if exists set_camp_medication_intake_sessions_updated_at on public.camp_medication_intake_sessions;
create trigger set_camp_medication_intake_sessions_updated_at before update on public.camp_medication_intake_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_camp_medication_intake_sessions_ministry_id on public.camp_medication_intake_sessions;
create trigger set_camp_medication_intake_sessions_ministry_id before insert on public.camp_medication_intake_sessions
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_camp_medication_administration_events_ministry_id on public.camp_medication_administration_events;
create trigger set_camp_medication_administration_events_ministry_id before insert on public.camp_medication_administration_events
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_camp_medication_administration_items_ministry_id on public.camp_medication_administration_items;
create trigger set_camp_medication_administration_items_ministry_id before insert on public.camp_medication_administration_items
for each row execute function public.set_ministry_id_if_null();

create index if not exists idx_camp_medication_intake_sessions_camp
  on public.camp_medication_intake_sessions(camp_id, received_at desc);
create index if not exists idx_camp_medication_intake_sessions_camper
  on public.camp_medication_intake_sessions(camper_id, received_at desc);
create index if not exists idx_camp_medication_intake_session_link
  on public.camp_medication_intake_records(intake_session_id);
create index if not exists idx_camp_medication_admin_events_camp
  on public.camp_medication_administration_events(camp_id, administered_at desc);
create index if not exists idx_camp_medication_admin_events_camper_time
  on public.camp_medication_administration_events(camper_id, time_window, administered_at desc);
create index if not exists idx_camp_medication_schedule_time_status
  on public.camp_medication_schedule_items(camp_id, time_window, status);
create index if not exists idx_camp_medication_admin_items_event
  on public.camp_medication_administration_items(administration_event_id);
create index if not exists idx_camp_medication_admin_items_medication
  on public.camp_medication_administration_items(medication_record_id, administered_at desc);
create index if not exists idx_camp_medication_admin_items_camper_time
  on public.camp_medication_administration_items(camper_id, time_window, administered_at desc);
create index if not exists idx_camp_medication_admin_log_event
  on public.camp_medication_administration_logs(administration_event_id);
create index if not exists idx_camp_medication_admin_log_item
  on public.camp_medication_administration_logs(administration_item_id);

alter table public.camp_medication_intake_sessions enable row level security;
alter table public.camp_medication_administration_events enable row level security;
alter table public.camp_medication_administration_items enable row level security;

revoke all on table public.camp_medication_intake_sessions from anon, public;
revoke all on table public.camp_medication_administration_events from anon, public;
revoke all on table public.camp_medication_administration_items from anon, public;
grant select, insert, update on table public.camp_medication_intake_sessions to authenticated;
grant select, insert on table public.camp_medication_administration_events to authenticated;
grant select, insert on table public.camp_medication_administration_items to authenticated;

drop policy if exists "restricted can select camp_medication_intake_sessions" on public.camp_medication_intake_sessions;
drop policy if exists "restricted can insert camp_medication_intake_sessions" on public.camp_medication_intake_sessions;
drop policy if exists "restricted can update camp_medication_intake_sessions" on public.camp_medication_intake_sessions;
create policy "restricted can select camp_medication_intake_sessions" on public.camp_medication_intake_sessions
for select to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can insert camp_medication_intake_sessions" on public.camp_medication_intake_sessions
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can update camp_medication_intake_sessions" on public.camp_medication_intake_sessions
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "restricted can select camp_medication_administration_events" on public.camp_medication_administration_events;
drop policy if exists "restricted can insert camp_medication_administration_events" on public.camp_medication_administration_events;
create policy "restricted can select camp_medication_administration_events" on public.camp_medication_administration_events
for select to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can insert camp_medication_administration_events" on public.camp_medication_administration_events
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "restricted can select camp_medication_administration_items" on public.camp_medication_administration_items;
drop policy if exists "restricted can insert camp_medication_administration_items" on public.camp_medication_administration_items;
create policy "restricted can select camp_medication_administration_items" on public.camp_medication_administration_items
for select to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can insert camp_medication_administration_items" on public.camp_medication_administration_items
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

notify pgrst, 'reload schema';
