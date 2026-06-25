-- 019_camp_staff_profile_photos.sql
-- Prepared for review only. Do not apply without explicit approval.
--
-- Adds safe operational profile-photo/source-church fields for adult leaders.
-- No restricted medical, medication, intake, signature, insurance, or storage
-- objects are touched by this migration.

alter table public.camp_staff
add column if not exists profile_photo_url text not null default '';

alter table public.camp_staff
add column if not exists source_church text not null default '';

notify pgrst, 'reload schema';
