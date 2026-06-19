-- 011_camp_medication_correction_audit.sql
-- Add restricted correction/void audit fields for Camp medication workflows.

alter table public.camp_medication_intake_records add column if not exists voided_at timestamptz;
alter table public.camp_medication_intake_records add column if not exists voided_by_user_id uuid references public.profiles(id);
alter table public.camp_medication_intake_records add column if not exists voided_by_name text not null default '';
alter table public.camp_medication_intake_records add column if not exists void_reason text not null default '';

alter table public.camp_medication_records add column if not exists supersedes_medication_record_id uuid references public.camp_medication_records(id);
alter table public.camp_medication_records add column if not exists correction_note text not null default '';
alter table public.camp_medication_records add column if not exists voided_at timestamptz;
alter table public.camp_medication_records add column if not exists voided_by_user_id uuid references public.profiles(id);
alter table public.camp_medication_records add column if not exists voided_by_name text not null default '';
alter table public.camp_medication_records add column if not exists void_reason text not null default '';

alter table public.camp_medication_schedule_items add column if not exists supersedes_schedule_item_id uuid references public.camp_medication_schedule_items(id);
alter table public.camp_medication_schedule_items add column if not exists correction_note text not null default '';
alter table public.camp_medication_schedule_items add column if not exists voided_at timestamptz;
alter table public.camp_medication_schedule_items add column if not exists voided_by_user_id uuid references public.profiles(id);
alter table public.camp_medication_schedule_items add column if not exists voided_by_name text not null default '';
alter table public.camp_medication_schedule_items add column if not exists void_reason text not null default '';

alter table public.camp_medication_administration_logs add column if not exists supersedes_administration_log_id uuid references public.camp_medication_administration_logs(id);
alter table public.camp_medication_administration_logs add column if not exists correction_note text not null default '';
alter table public.camp_medication_administration_logs add column if not exists voided_at timestamptz;
alter table public.camp_medication_administration_logs add column if not exists voided_by_user_id uuid references public.profiles(id);
alter table public.camp_medication_administration_logs add column if not exists voided_by_name text not null default '';
alter table public.camp_medication_administration_logs add column if not exists void_reason text not null default '';

alter table public.camp_medication_return_items add column if not exists supersedes_return_item_id uuid references public.camp_medication_return_items(id);
alter table public.camp_medication_return_items add column if not exists correction_note text not null default '';
alter table public.camp_medication_return_items add column if not exists voided_at timestamptz;
alter table public.camp_medication_return_items add column if not exists voided_by_user_id uuid references public.profiles(id);
alter table public.camp_medication_return_items add column if not exists voided_by_name text not null default '';
alter table public.camp_medication_return_items add column if not exists void_reason text not null default '';
alter table public.camp_medication_return_items add column if not exists returned_by text not null default '';
alter table public.camp_medication_return_items add column if not exists returned_at timestamptz;
alter table public.camp_medication_return_items add column if not exists recipient_name text not null default '';
alter table public.camp_medication_return_items add column if not exists recipient_relationship text not null default '';
alter table public.camp_medication_return_items add column if not exists return_notes text not null default '';

update public.camp_medication_return_items
set return_status = 'Returned to Parent/Guardian'
where return_status = 'Returned to Parent';

alter table public.camp_medication_return_items
drop constraint if exists camp_medication_return_items_return_status_check;

alter table public.camp_medication_return_items
add constraint camp_medication_return_items_return_status_check
check (return_status in (
  'Pending Return',
  'Returned to Parent/Guardian',
  'Needs Parent Clarification',
  'Not Returned / Follow-Up Needed'
));

create index if not exists idx_camp_medication_intake_active
  on public.camp_medication_intake_records(camp_id, medication_record_id, received_at)
  where voided_at is null;
create index if not exists idx_camp_medication_intake_voided
  on public.camp_medication_intake_records(camp_id, voided_at)
  where voided_at is not null;
create index if not exists idx_camp_medication_records_active
  on public.camp_medication_records(camp_id, camper_id, updated_at)
  where voided_at is null;
create index if not exists idx_camp_medication_records_supersedes
  on public.camp_medication_records(supersedes_medication_record_id);
create index if not exists idx_camp_medication_schedule_active
  on public.camp_medication_schedule_items(camp_id, medication_record_id, created_at)
  where voided_at is null;
create index if not exists idx_camp_medication_schedule_supersedes
  on public.camp_medication_schedule_items(supersedes_schedule_item_id);
create index if not exists idx_camp_medication_logs_active
  on public.camp_medication_administration_logs(camp_id, medication_record_id, logged_at)
  where voided_at is null;
create index if not exists idx_camp_medication_logs_supersedes
  on public.camp_medication_administration_logs(supersedes_administration_log_id);
create index if not exists idx_camp_medication_return_active
  on public.camp_medication_return_items(camp_id, medication_record_id, updated_at)
  where voided_at is null;
create index if not exists idx_camp_medication_return_supersedes
  on public.camp_medication_return_items(supersedes_return_item_id);

-- Keep all affected restricted medication tables protected by the existing
-- restricted Camp medical helper. Add update policies where void metadata must
-- be recorded without allowing hard delete.
drop policy if exists "restricted can update camp_medication_intake_records" on public.camp_medication_intake_records;
create policy "restricted can update camp_medication_intake_records" on public.camp_medication_intake_records
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "restricted can update camp_medication_administration_logs" on public.camp_medication_administration_logs;
create policy "restricted can update camp_medication_administration_logs" on public.camp_medication_administration_logs
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

notify pgrst, 'reload schema';
