-- 009_camp_medication_intake_signature.sql
-- Adds restricted Medication Intake / Parent Handoff records with signature data.
-- Append-only by RLS: corrections are new rows linked through supersedes_intake_id.

create table if not exists public.camp_medication_intake_records (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  camper_id uuid not null references public.camp_campers(id) on delete cascade,
  medication_record_id uuid references public.camp_medication_records(id) on delete set null,
  medication_name text not null default '',
  dose text not null default '',
  schedule_text text not null default '',
  parent_instructions text not null default '',
  staff_notes text not null default '',
  quantity_received text not null default '',
  container_status text not null default '',
  received_by_user_id uuid references public.profiles(id),
  received_by_name text not null default '',
  received_at timestamptz not null default now(),
  guardian_name text not null default '',
  guardian_relationship text not null default '',
  guardian_signature_data jsonb not null,
  signature_format text not null default 'json_strokes_v1' check (signature_format in ('json_strokes_v1')),
  clarification_status text not null default 'Clear' check (clarification_status in ('Clear','Needs Parent Clarification')),
  confirmation_acknowledged boolean not null check (confirmation_acknowledged = true),
  supersedes_intake_id uuid references public.camp_medication_intake_records(id),
  correction_note text not null default '',
  created_at timestamptz not null default now()
);

drop trigger if exists set_camp_medication_intake_records_ministry_id on public.camp_medication_intake_records;
create trigger set_camp_medication_intake_records_ministry_id before insert on public.camp_medication_intake_records
for each row execute function public.set_ministry_id_if_null();

create index if not exists idx_camp_medication_intake_camp on public.camp_medication_intake_records(camp_id);
create index if not exists idx_camp_medication_intake_camper on public.camp_medication_intake_records(camper_id);
create index if not exists idx_camp_medication_intake_medication on public.camp_medication_intake_records(medication_record_id);
create index if not exists idx_camp_medication_intake_received_at on public.camp_medication_intake_records(received_at);
create index if not exists idx_camp_medication_intake_supersedes on public.camp_medication_intake_records(supersedes_intake_id);

alter table public.camp_medication_intake_records enable row level security;

drop policy if exists "restricted can select camp_medication_intake_records" on public.camp_medication_intake_records;
drop policy if exists "restricted can insert camp_medication_intake_records" on public.camp_medication_intake_records;
create policy "restricted can select camp_medication_intake_records" on public.camp_medication_intake_records
for select to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can insert camp_medication_intake_records" on public.camp_medication_intake_records
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

notify pgrst, 'reload schema';
