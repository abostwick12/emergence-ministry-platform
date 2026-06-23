-- 018_camp_intake_and_camper_profile_photos.sql
-- Prepared for review only. Do not apply until Camp migration history is reconciled.
--
-- Adds:
-- 1. Restricted medication-photo linkage to the specific intake handoff record.
-- 2. A separate private camper profile-photo system for ordinary roster thumbnails.

alter table public.camp_medication_photo_records
add column if not exists intake_record_id uuid references public.camp_medication_intake_records(id) on delete set null;

create index if not exists idx_camp_medication_photos_intake
  on public.camp_medication_photo_records(intake_record_id)
  where intake_record_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'camp-camper-profile-photos',
  'camp-camper-profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

create table if not exists public.camp_camper_profile_photo_records (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  camper_id uuid not null references public.camp_campers(id) on delete cascade,
  storage_bucket text not null default 'camp-camper-profile-photos',
  storage_object_path text not null,
  content_type text not null,
  file_size integer not null check (file_size > 0 and file_size <= 5242880),
  uploaded_by_user_id uuid references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  removed_at timestamptz,
  replaced_by_photo_id uuid references public.camp_camper_profile_photo_records(id),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_object_path)
);

drop trigger if exists set_camp_camper_profile_photo_records_ministry_id on public.camp_camper_profile_photo_records;
create trigger set_camp_camper_profile_photo_records_ministry_id before insert on public.camp_camper_profile_photo_records
for each row execute function public.set_ministry_id_if_null();

create index if not exists idx_camp_camper_profile_photos_camp
  on public.camp_camper_profile_photo_records(camp_id);
create index if not exists idx_camp_camper_profile_photos_camper
  on public.camp_camper_profile_photo_records(camper_id);
create index if not exists idx_camp_camper_profile_photos_active
  on public.camp_camper_profile_photo_records(camp_id, camper_id, uploaded_at desc)
  where removed_at is null and replaced_by_photo_id is null;

alter table public.camp_camper_profile_photo_records enable row level security;

drop policy if exists "ministry can select camp_camper_profile_photo_records" on public.camp_camper_profile_photo_records;
drop policy if exists "staff can insert camp_camper_profile_photo_records" on public.camp_camper_profile_photo_records;
drop policy if exists "staff can update camp_camper_profile_photo_records" on public.camp_camper_profile_photo_records;
create policy "ministry can select camp_camper_profile_photo_records" on public.camp_camper_profile_photo_records
for select to authenticated using (ministry_id = public.current_ministry_id());
create policy "staff can insert camp_camper_profile_photo_records" on public.camp_camper_profile_photo_records
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));
create policy "staff can update camp_camper_profile_photo_records" on public.camp_camper_profile_photo_records
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

drop policy if exists "ministry can select camp camper profile photo objects" on storage.objects;
drop policy if exists "staff can insert camp camper profile photo objects" on storage.objects;
create policy "ministry can select camp camper profile photo objects" on storage.objects
for select to authenticated
using (
  bucket_id = 'camp-camper-profile-photos'
  and name like ('ministry/' || public.current_ministry_id()::text || '/%')
);
create policy "staff can insert camp camper profile photo objects" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'camp-camper-profile-photos'
  and name like ('ministry/' || public.current_ministry_id()::text || '/%')
  and public.current_user_role() in ('admin','leader','staff')
);

notify pgrst, 'reload schema';
