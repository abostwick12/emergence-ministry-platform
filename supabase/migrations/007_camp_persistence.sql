-- 007_camp_persistence.sql
-- Adds durable Camp Command Center storage for live camp operations.
--
-- Additive and idempotent: no existing EMMA/event/task tables are removed,
-- renamed, or altered. Camp data is ministry-scoped and protected by RLS.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.current_user_can_access_camp_restricted()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(coalesce(p.full_name, '')) ~ '(^| )andrew( |$)'
        or lower(coalesce(p.full_name, '')) ~ '(^| )jaci( |$)'
        or lower(coalesce(p.full_name, '')) ~ '(^| )joel( |$)'
        or split_part(lower(coalesce(p.email, '')), '@', 1) in ('andrew', 'jaci', 'joel')
        or split_part(lower(coalesce(p.email, '')), '@', 1) like 'andrew.%'
        or split_part(lower(coalesce(p.email, '')), '@', 1) like 'jaci.%'
        or split_part(lower(coalesce(p.email, '')), '@', 1) like 'joel.%'
      )
  );
$$;

create table if not exists public.camp_sessions (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  slug text not null,
  name text not null,
  starts_on date not null,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, slug)
);

create table if not exists public.camp_teams (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  name text not null,
  color text not null default '',
  leader text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (camp_id, name)
);

create table if not exists public.camp_vehicles (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  name text not null,
  driver text not null default '',
  departure_window text not null default '',
  capacity integer not null default 0 check (capacity >= 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (camp_id, name)
);

create table if not exists public.camp_campers (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  name text not null,
  photo_initials text not null default '',
  grade text not null default '',
  team_id uuid references public.camp_teams(id) on delete set null,
  vehicle_id uuid references public.camp_vehicles(id) on delete set null,
  cabin text not null default '',
  limited_safety_flags text[] not null default '{}',
  has_restricted_medical_info boolean not null default false,
  has_medication_plan boolean not null default false,
  needs_parent_clarification boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.camp_restricted_medical_records (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  camper_id uuid not null references public.camp_campers(id) on delete cascade,
  medical_form_status text not null check (medical_form_status in ('Received','Needs Parent Clarification')),
  restricted_notes text not null default '',
  allergy_notes text not null default '',
  insurance_status text not null default '',
  parent_medical_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (camp_id, camper_id)
);

create table if not exists public.camp_medication_records (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  camper_id uuid not null references public.camp_campers(id) on delete cascade,
  medication_name text not null default 'Parent-labeled medication',
  medicine_photo_status text not null default 'Photo Needed' check (medicine_photo_status in ('Photo Needed','Photo On File')),
  parent_provided_instructions text not null default 'Needs Parent Clarification.',
  check_in_status text not null default 'Not Checked In' check (check_in_status in ('Not Checked In','Checked In','Needs Parent Clarification')),
  received_by text,
  received_at timestamptz,
  clarification_status text not null default 'Clear' check (clarification_status in ('Clear','Needs Parent Clarification')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.camp_medication_schedule_items (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  medication_record_id uuid not null references public.camp_medication_records(id) on delete cascade,
  camper_id uuid not null references public.camp_campers(id) on delete cascade,
  time_window text not null,
  parent_provided_instructions text not null default 'Needs Parent Clarification.',
  status text not null default 'Pending' check (status in ('Pending','Logged','Needs Parent Clarification')),
  last_logged_at timestamptz,
  last_logged_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.camp_medication_administration_logs (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  medication_record_id uuid not null references public.camp_medication_records(id) on delete cascade,
  schedule_item_id uuid references public.camp_medication_schedule_items(id) on delete set null,
  camper_id uuid not null references public.camp_campers(id) on delete cascade,
  time_window text not null,
  logged_at timestamptz not null default now(),
  logged_by text not null default '',
  status text not null check (status in ('Logged','Skipped','Needs Parent Clarification')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.camp_medication_return_items (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  medication_record_id uuid not null references public.camp_medication_records(id) on delete cascade,
  camper_id uuid not null references public.camp_campers(id) on delete cascade,
  return_status text not null default 'Pending Return' check (return_status in ('Pending Return','Returned to Parent','Needs Parent Clarification')),
  returned_at timestamptz,
  returned_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (camp_id, medication_record_id)
);

create table if not exists public.camp_import_batches (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  imported_by uuid references public.profiles(id),
  source_name text,
  row_count integer not null default 0 check (row_count >= 0),
  status text not null default 'previewed' check (status in ('previewed','committed','cancelled','failed')),
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_camp_sessions_updated_at on public.camp_sessions;
create trigger set_camp_sessions_updated_at before update on public.camp_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_camp_teams_updated_at on public.camp_teams;
create trigger set_camp_teams_updated_at before update on public.camp_teams
for each row execute function public.set_updated_at();

drop trigger if exists set_camp_vehicles_updated_at on public.camp_vehicles;
create trigger set_camp_vehicles_updated_at before update on public.camp_vehicles
for each row execute function public.set_updated_at();

drop trigger if exists set_camp_campers_updated_at on public.camp_campers;
create trigger set_camp_campers_updated_at before update on public.camp_campers
for each row execute function public.set_updated_at();

drop trigger if exists set_camp_restricted_medical_records_updated_at on public.camp_restricted_medical_records;
create trigger set_camp_restricted_medical_records_updated_at before update on public.camp_restricted_medical_records
for each row execute function public.set_updated_at();

drop trigger if exists set_camp_medication_records_updated_at on public.camp_medication_records;
create trigger set_camp_medication_records_updated_at before update on public.camp_medication_records
for each row execute function public.set_updated_at();

drop trigger if exists set_camp_medication_schedule_items_updated_at on public.camp_medication_schedule_items;
create trigger set_camp_medication_schedule_items_updated_at before update on public.camp_medication_schedule_items
for each row execute function public.set_updated_at();

drop trigger if exists set_camp_medication_return_items_updated_at on public.camp_medication_return_items;
create trigger set_camp_medication_return_items_updated_at before update on public.camp_medication_return_items
for each row execute function public.set_updated_at();

drop trigger if exists set_camp_import_batches_updated_at on public.camp_import_batches;
create trigger set_camp_import_batches_updated_at before update on public.camp_import_batches
for each row execute function public.set_updated_at();

drop trigger if exists set_camp_sessions_ministry_id on public.camp_sessions;
create trigger set_camp_sessions_ministry_id before insert on public.camp_sessions
for each row execute function public.set_ministry_id_if_null();
drop trigger if exists set_camp_teams_ministry_id on public.camp_teams;
create trigger set_camp_teams_ministry_id before insert on public.camp_teams
for each row execute function public.set_ministry_id_if_null();
drop trigger if exists set_camp_vehicles_ministry_id on public.camp_vehicles;
create trigger set_camp_vehicles_ministry_id before insert on public.camp_vehicles
for each row execute function public.set_ministry_id_if_null();
drop trigger if exists set_camp_campers_ministry_id on public.camp_campers;
create trigger set_camp_campers_ministry_id before insert on public.camp_campers
for each row execute function public.set_ministry_id_if_null();
drop trigger if exists set_camp_restricted_medical_records_ministry_id on public.camp_restricted_medical_records;
create trigger set_camp_restricted_medical_records_ministry_id before insert on public.camp_restricted_medical_records
for each row execute function public.set_ministry_id_if_null();
drop trigger if exists set_camp_medication_records_ministry_id on public.camp_medication_records;
create trigger set_camp_medication_records_ministry_id before insert on public.camp_medication_records
for each row execute function public.set_ministry_id_if_null();
drop trigger if exists set_camp_medication_schedule_items_ministry_id on public.camp_medication_schedule_items;
create trigger set_camp_medication_schedule_items_ministry_id before insert on public.camp_medication_schedule_items
for each row execute function public.set_ministry_id_if_null();
drop trigger if exists set_camp_medication_administration_logs_ministry_id on public.camp_medication_administration_logs;
create trigger set_camp_medication_administration_logs_ministry_id before insert on public.camp_medication_administration_logs
for each row execute function public.set_ministry_id_if_null();
drop trigger if exists set_camp_medication_return_items_ministry_id on public.camp_medication_return_items;
create trigger set_camp_medication_return_items_ministry_id before insert on public.camp_medication_return_items
for each row execute function public.set_ministry_id_if_null();
drop trigger if exists set_camp_import_batches_ministry_id on public.camp_import_batches;
create trigger set_camp_import_batches_ministry_id before insert on public.camp_import_batches
for each row execute function public.set_ministry_id_if_null();

create index if not exists idx_camp_sessions_ministry on public.camp_sessions(ministry_id);
create index if not exists idx_camp_teams_camp on public.camp_teams(camp_id);
create index if not exists idx_camp_teams_ministry on public.camp_teams(ministry_id);
create index if not exists idx_camp_vehicles_camp on public.camp_vehicles(camp_id);
create index if not exists idx_camp_vehicles_ministry on public.camp_vehicles(ministry_id);
create index if not exists idx_camp_campers_camp on public.camp_campers(camp_id);
create index if not exists idx_camp_campers_team on public.camp_campers(team_id);
create index if not exists idx_camp_campers_vehicle on public.camp_campers(vehicle_id);
create index if not exists idx_camp_campers_ministry on public.camp_campers(ministry_id);
create index if not exists idx_camp_restricted_medical_camp on public.camp_restricted_medical_records(camp_id);
create index if not exists idx_camp_restricted_medical_camper on public.camp_restricted_medical_records(camper_id);
create index if not exists idx_camp_medication_records_camp on public.camp_medication_records(camp_id);
create index if not exists idx_camp_medication_records_camper on public.camp_medication_records(camper_id);
create index if not exists idx_camp_medication_schedule_camp on public.camp_medication_schedule_items(camp_id);
create index if not exists idx_camp_medication_schedule_medication on public.camp_medication_schedule_items(medication_record_id);
create index if not exists idx_camp_medication_schedule_camper on public.camp_medication_schedule_items(camper_id);
create index if not exists idx_camp_medication_logs_camp on public.camp_medication_administration_logs(camp_id);
create index if not exists idx_camp_medication_logs_medication on public.camp_medication_administration_logs(medication_record_id);
create index if not exists idx_camp_medication_logs_camper on public.camp_medication_administration_logs(camper_id);
create index if not exists idx_camp_medication_return_camp on public.camp_medication_return_items(camp_id);
create index if not exists idx_camp_medication_return_medication on public.camp_medication_return_items(medication_record_id);
create index if not exists idx_camp_medication_return_camper on public.camp_medication_return_items(camper_id);
create index if not exists idx_camp_import_batches_camp on public.camp_import_batches(camp_id);

alter table public.camp_sessions enable row level security;
alter table public.camp_teams enable row level security;
alter table public.camp_vehicles enable row level security;
alter table public.camp_campers enable row level security;
alter table public.camp_restricted_medical_records enable row level security;
alter table public.camp_medication_records enable row level security;
alter table public.camp_medication_schedule_items enable row level security;
alter table public.camp_medication_administration_logs enable row level security;
alter table public.camp_medication_return_items enable row level security;
alter table public.camp_import_batches enable row level security;

drop policy if exists "ministry can select camp_sessions" on public.camp_sessions;
drop policy if exists "staff can insert camp_sessions" on public.camp_sessions;
drop policy if exists "staff can update camp_sessions" on public.camp_sessions;
create policy "ministry can select camp_sessions" on public.camp_sessions
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "staff can insert camp_sessions" on public.camp_sessions
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));
create policy "staff can update camp_sessions" on public.camp_sessions
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

drop policy if exists "ministry can select camp_teams" on public.camp_teams;
drop policy if exists "staff can insert camp_teams" on public.camp_teams;
drop policy if exists "staff can update camp_teams" on public.camp_teams;
create policy "ministry can select camp_teams" on public.camp_teams
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "staff can insert camp_teams" on public.camp_teams
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));
create policy "staff can update camp_teams" on public.camp_teams
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

drop policy if exists "ministry can select camp_vehicles" on public.camp_vehicles;
drop policy if exists "staff can insert camp_vehicles" on public.camp_vehicles;
drop policy if exists "staff can update camp_vehicles" on public.camp_vehicles;
create policy "ministry can select camp_vehicles" on public.camp_vehicles
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "staff can insert camp_vehicles" on public.camp_vehicles
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));
create policy "staff can update camp_vehicles" on public.camp_vehicles
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

drop policy if exists "ministry can select camp_campers" on public.camp_campers;
drop policy if exists "staff can insert camp_campers" on public.camp_campers;
drop policy if exists "staff can update camp_campers" on public.camp_campers;
create policy "ministry can select camp_campers" on public.camp_campers
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "staff can insert camp_campers" on public.camp_campers
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));
create policy "staff can update camp_campers" on public.camp_campers
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

drop policy if exists "restricted can select camp_restricted_medical_records" on public.camp_restricted_medical_records;
drop policy if exists "restricted can insert camp_restricted_medical_records" on public.camp_restricted_medical_records;
drop policy if exists "restricted can update camp_restricted_medical_records" on public.camp_restricted_medical_records;
create policy "restricted can select camp_restricted_medical_records" on public.camp_restricted_medical_records
for select to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can insert camp_restricted_medical_records" on public.camp_restricted_medical_records
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can update camp_restricted_medical_records" on public.camp_restricted_medical_records
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "restricted can select camp_medication_records" on public.camp_medication_records;
drop policy if exists "restricted can insert camp_medication_records" on public.camp_medication_records;
drop policy if exists "restricted can update camp_medication_records" on public.camp_medication_records;
create policy "restricted can select camp_medication_records" on public.camp_medication_records
for select to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can insert camp_medication_records" on public.camp_medication_records
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can update camp_medication_records" on public.camp_medication_records
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "restricted can select camp_medication_schedule_items" on public.camp_medication_schedule_items;
drop policy if exists "restricted can insert camp_medication_schedule_items" on public.camp_medication_schedule_items;
drop policy if exists "restricted can update camp_medication_schedule_items" on public.camp_medication_schedule_items;
create policy "restricted can select camp_medication_schedule_items" on public.camp_medication_schedule_items
for select to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can insert camp_medication_schedule_items" on public.camp_medication_schedule_items
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can update camp_medication_schedule_items" on public.camp_medication_schedule_items
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "restricted can select camp_medication_administration_logs" on public.camp_medication_administration_logs;
drop policy if exists "restricted can insert camp_medication_administration_logs" on public.camp_medication_administration_logs;
create policy "restricted can select camp_medication_administration_logs" on public.camp_medication_administration_logs
for select to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can insert camp_medication_administration_logs" on public.camp_medication_administration_logs
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "restricted can select camp_medication_return_items" on public.camp_medication_return_items;
drop policy if exists "restricted can insert camp_medication_return_items" on public.camp_medication_return_items;
drop policy if exists "restricted can update camp_medication_return_items" on public.camp_medication_return_items;
create policy "restricted can select camp_medication_return_items" on public.camp_medication_return_items
for select to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can insert camp_medication_return_items" on public.camp_medication_return_items
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can update camp_medication_return_items" on public.camp_medication_return_items
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "staff can select camp_import_batches" on public.camp_import_batches;
drop policy if exists "staff can insert camp_import_batches" on public.camp_import_batches;
drop policy if exists "staff can update camp_import_batches" on public.camp_import_batches;
create policy "staff can select camp_import_batches" on public.camp_import_batches
for select to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));
create policy "staff can insert camp_import_batches" on public.camp_import_batches
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));
create policy "staff can update camp_import_batches" on public.camp_import_batches
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

insert into public.camp_sessions (id, ministry_id, slug, name, starts_on)
values ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-0000000000e1', 'summer-camp-2026', 'Summer Camp 2026', '2026-06-29')
on conflict (ministry_id, slug) do nothing;

insert into public.camp_teams (id, ministry_id, camp_id, name, color, leader, display_order)
values
  ('00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000701', 'Cypress', 'Teal', 'Maya Thompson', 1),
  ('00000000-0000-4000-8000-000000000712', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000701', 'Summit', 'Blue', 'Caleb Rivera', 2),
  ('00000000-0000-4000-8000-000000000713', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000701', 'Harbor', 'Green', 'Nora James', 3)
on conflict (camp_id, name) do nothing;

insert into public.camp_vehicles (id, ministry_id, camp_id, name, driver, departure_window, capacity, display_order)
values
  ('00000000-0000-4000-8000-000000000721', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000701', 'Van 1', 'Marcus Lee', 'June 29, 8:00 AM', 7, 1),
  ('00000000-0000-4000-8000-000000000722', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000701', 'Van 2', 'Tara Mitchell', 'June 29, 8:00 AM', 7, 2),
  ('00000000-0000-4000-8000-000000000723', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000701', 'Van 3', 'Sam Carter', 'June 29, 8:15 AM', 6, 3)
on conflict (camp_id, name) do nothing;

notify pgrst, 'reload schema';
