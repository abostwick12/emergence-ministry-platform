alter table public.camp_medication_intake_records add column if not exists archived_at timestamptz;
alter table public.camp_medication_intake_records add column if not exists archived_by_user_id uuid references public.profiles(id);
alter table public.camp_medication_intake_records add column if not exists archived_by_name text not null default '';
alter table public.camp_medication_intake_records add column if not exists archive_reason text not null default '';

alter table public.camp_medication_records add column if not exists archived_at timestamptz;
alter table public.camp_medication_records add column if not exists archived_by_user_id uuid references public.profiles(id);
alter table public.camp_medication_records add column if not exists archived_by_name text not null default '';
alter table public.camp_medication_records add column if not exists archive_reason text not null default '';

alter table public.camp_medication_schedule_items add column if not exists archived_at timestamptz;
alter table public.camp_medication_schedule_items add column if not exists archived_by_user_id uuid references public.profiles(id);
alter table public.camp_medication_schedule_items add column if not exists archived_by_name text not null default '';
alter table public.camp_medication_schedule_items add column if not exists archive_reason text not null default '';

alter table public.camp_medication_administration_logs add column if not exists archived_at timestamptz;
alter table public.camp_medication_administration_logs add column if not exists archived_by_user_id uuid references public.profiles(id);
alter table public.camp_medication_administration_logs add column if not exists archived_by_name text not null default '';
alter table public.camp_medication_administration_logs add column if not exists archive_reason text not null default '';

alter table public.camp_medication_return_items add column if not exists archived_at timestamptz;
alter table public.camp_medication_return_items add column if not exists archived_by_user_id uuid references public.profiles(id);
alter table public.camp_medication_return_items add column if not exists archived_by_name text not null default '';
alter table public.camp_medication_return_items add column if not exists archive_reason text not null default '';

create index if not exists idx_camp_medication_intake_active_history
  on public.camp_medication_intake_records(camp_id, received_at desc)
  where archived_at is null;
create index if not exists idx_camp_medication_intake_archived_history
  on public.camp_medication_intake_records(camp_id, archived_at desc)
  where archived_at is not null;

create index if not exists idx_camp_medication_records_active_history
  on public.camp_medication_records(camp_id, updated_at desc)
  where archived_at is null;
create index if not exists idx_camp_medication_records_archived_history
  on public.camp_medication_records(camp_id, archived_at desc)
  where archived_at is not null;

create index if not exists idx_camp_medication_schedule_active_history
  on public.camp_medication_schedule_items(camp_id, created_at desc)
  where archived_at is null;
create index if not exists idx_camp_medication_schedule_archived_history
  on public.camp_medication_schedule_items(camp_id, archived_at desc)
  where archived_at is not null;

create index if not exists idx_camp_medication_admin_logs_active_history
  on public.camp_medication_administration_logs(camp_id, logged_at desc)
  where archived_at is null;
create index if not exists idx_camp_medication_admin_logs_archived_history
  on public.camp_medication_administration_logs(camp_id, archived_at desc)
  where archived_at is not null;

create index if not exists idx_camp_medication_return_active_history
  on public.camp_medication_return_items(camp_id, updated_at desc)
  where archived_at is null;
create index if not exists idx_camp_medication_return_archived_history
  on public.camp_medication_return_items(camp_id, archived_at desc)
  where archived_at is not null;

drop policy if exists "restricted can update camp_medication_intake_records" on public.camp_medication_intake_records;
create policy "restricted can update camp_medication_intake_records" on public.camp_medication_intake_records
  for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
  with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "restricted can update camp_medication_records" on public.camp_medication_records;
create policy "restricted can update camp_medication_records" on public.camp_medication_records
  for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
  with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "restricted can update camp_medication_schedule_items" on public.camp_medication_schedule_items;
create policy "restricted can update camp_medication_schedule_items" on public.camp_medication_schedule_items
  for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
  with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "restricted can update camp_medication_administration_logs" on public.camp_medication_administration_logs;
create policy "restricted can update camp_medication_administration_logs" on public.camp_medication_administration_logs
  for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
  with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "restricted can update camp_medication_return_items" on public.camp_medication_return_items;
create policy "restricted can update camp_medication_return_items" on public.camp_medication_return_items
  for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
  with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

notify pgrst, 'reload schema';
