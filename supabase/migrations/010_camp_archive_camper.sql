-- 010_camp_archive_camper_and_medication_photos.sql
-- Add camper archive metadata and restricted medication photo storage.

alter table public.camp_campers add column if not exists archived_at timestamptz;
alter table public.camp_campers add column if not exists archived_by_user_id uuid references public.profiles(id);
alter table public.camp_campers add column if not exists archive_reason text not null default '';

create index if not exists idx_camp_campers_active
  on public.camp_campers(camp_id, archived_at)
  where archived_at is null;
create index if not exists idx_camp_campers_archived
  on public.camp_campers(camp_id, archived_at)
  where archived_at is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'camp-medication-photos',
  'camp-medication-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

create table if not exists public.camp_medication_photo_records (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  camper_id uuid not null references public.camp_campers(id) on delete cascade,
  medication_record_id uuid not null references public.camp_medication_records(id) on delete cascade,
  storage_bucket text not null default 'camp-medication-photos',
  storage_object_path text not null,
  content_type text not null,
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  uploaded_by_user_id uuid references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  replaced_by_photo_id uuid references public.camp_medication_photo_records(id),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_object_path)
);

drop trigger if exists set_camp_medication_photo_records_ministry_id on public.camp_medication_photo_records;
create trigger set_camp_medication_photo_records_ministry_id before insert on public.camp_medication_photo_records
for each row execute function public.set_ministry_id_if_null();

create index if not exists idx_camp_medication_photos_camp on public.camp_medication_photo_records(camp_id);
create index if not exists idx_camp_medication_photos_camper on public.camp_medication_photo_records(camper_id);
create index if not exists idx_camp_medication_photos_medication on public.camp_medication_photo_records(medication_record_id);
create index if not exists idx_camp_medication_photos_uploaded_at on public.camp_medication_photo_records(uploaded_at);

alter table public.camp_medication_photo_records enable row level security;

drop policy if exists "restricted can select camp_medication_photo_records" on public.camp_medication_photo_records;
drop policy if exists "restricted can insert camp_medication_photo_records" on public.camp_medication_photo_records;
drop policy if exists "restricted can update camp_medication_photo_records" on public.camp_medication_photo_records;
create policy "restricted can select camp_medication_photo_records" on public.camp_medication_photo_records
for select to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can insert camp_medication_photo_records" on public.camp_medication_photo_records
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can update camp_medication_photo_records" on public.camp_medication_photo_records
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());

drop policy if exists "restricted can select camp medication photo objects" on storage.objects;
drop policy if exists "restricted can insert camp medication photo objects" on storage.objects;
create policy "restricted can select camp medication photo objects" on storage.objects
for select to authenticated
using (bucket_id = 'camp-medication-photos' and public.current_user_can_access_camp_restricted());
create policy "restricted can insert camp medication photo objects" on storage.objects
for insert to authenticated
with check (bucket_id = 'camp-medication-photos' and public.current_user_can_access_camp_restricted());

notify pgrst, 'reload schema';
