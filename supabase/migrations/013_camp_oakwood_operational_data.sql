-- 013_camp_oakwood_operational_data.sql
-- Camp Oakwood full operational-data migration support.
--
-- Additive and idempotent. No existing column/table/policy is dropped or
-- narrowed. Adds:
--   * safe operational columns on camp_campers (shirt size, external/registration
--     id for matching, and three SAFE boolean indicators surfaced to leaders)
--   * restricted contact columns on camp_restricted_medical_records (emergency +
--     guardian contact, dietary) — inherit the existing Andrew/Jaci/Joel-only RLS
--   * a new camp_staff table for the adult/volunteer roster (safe operational only)
--   * import-audit count columns on camp_import_batches
--
-- The three camp_campers booleans are derived ONLY from the workbook's explicit
-- "Quick Filter" category and whether a restricted note is present — never by
-- parsing medical/dietary free text. They expose presence, never detail, and are
-- safe for General Leaders (camp_campers is ministry-readable).

-- ── camp_campers: safe operational columns ──────────────────────────────────
alter table public.camp_campers add column if not exists registration_external_id text;
alter table public.camp_campers add column if not exists shirt_size text not null default '';
alter table public.camp_campers add column if not exists emergency_contact_on_file boolean not null default false;
alter table public.camp_campers add column if not exists has_medical_alert boolean not null default false;
alter table public.camp_campers add column if not exists has_dietary_alert boolean not null default false;

-- Match key is (camp_id, registration_external_id, lower(name)) — the external id
-- alone is a HOUSEHOLD id (shared by family members), so it is never unique on its
-- own. Index supports lookups; uniqueness is enforced in application code so an
-- ambiguous match can be surfaced rather than hard-failing an import.
create index if not exists idx_camp_campers_external_id
  on public.camp_campers(camp_id, registration_external_id)
  where registration_external_id is not null;

-- ── camp_restricted_medical_records: restricted contact + dietary ───────────
alter table public.camp_restricted_medical_records add column if not exists emergency_contact_name text not null default '';
alter table public.camp_restricted_medical_records add column if not exists emergency_contact_phone text not null default '';
alter table public.camp_restricted_medical_records add column if not exists emergency_contact_relationship text not null default '';
alter table public.camp_restricted_medical_records add column if not exists guardian_name text not null default '';
alter table public.camp_restricted_medical_records add column if not exists guardian_phone text not null default '';
alter table public.camp_restricted_medical_records add column if not exists dietary_requirements text not null default '';

-- ── camp_staff: adult / volunteer / leader roster (SAFE operational only) ────
-- Restricted adult contact/medical data is NOT stored here; this table holds only
-- general-leader-safe operational fields, mirroring camp_campers' safe subset.
create table if not exists public.camp_staff (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  name text not null,
  role text not null default 'adult_volunteer' check (role in ('adult_volunteer','leader','staff')),
  shirt_size text not null default '',
  registration_external_id text,
  team_id uuid references public.camp_teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by_user_id uuid references public.profiles(id),
  archive_reason text not null default ''
);

drop trigger if exists set_camp_staff_updated_at on public.camp_staff;
create trigger set_camp_staff_updated_at before update on public.camp_staff
for each row execute function public.set_updated_at();

drop trigger if exists set_camp_staff_ministry_id on public.camp_staff;
create trigger set_camp_staff_ministry_id before insert on public.camp_staff
for each row execute function public.set_ministry_id_if_null();

create index if not exists idx_camp_staff_camp on public.camp_staff(camp_id);
create index if not exists idx_camp_staff_ministry on public.camp_staff(ministry_id);
create index if not exists idx_camp_staff_external_id
  on public.camp_staff(camp_id, registration_external_id)
  where registration_external_id is not null;
create index if not exists idx_camp_staff_active
  on public.camp_staff(camp_id, archived_at)
  where archived_at is null;

alter table public.camp_staff enable row level security;

-- Same access shape as camp_campers: ministry can read; admin/leader/staff write.
-- No medication/medical data lives here, so no restricted gate is needed.
drop policy if exists "ministry can select camp_staff" on public.camp_staff;
drop policy if exists "staff can insert camp_staff" on public.camp_staff;
drop policy if exists "staff can update camp_staff" on public.camp_staff;
create policy "ministry can select camp_staff" on public.camp_staff
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "staff can insert camp_staff" on public.camp_staff
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));
create policy "staff can update camp_staff" on public.camp_staff
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

-- ── camp_import_batches: audit summary counts ───────────────────────────────
alter table public.camp_import_batches add column if not exists source_file text;
alter table public.camp_import_batches add column if not exists created_count integer not null default 0;
alter table public.camp_import_batches add column if not exists updated_count integer not null default 0;
alter table public.camp_import_batches add column if not exists skipped_count integer not null default 0;
alter table public.camp_import_batches add column if not exists ambiguous_count integer not null default 0;
alter table public.camp_import_batches add column if not exists invalid_count integer not null default 0;
alter table public.camp_import_batches add column if not exists restricted_count integer not null default 0;
alter table public.camp_import_batches add column if not exists safe_count integer not null default 0;
alter table public.camp_import_batches add column if not exists staff_count integer not null default 0;

notify pgrst, 'reload schema';
