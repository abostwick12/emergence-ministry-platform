-- 008_camp_restricted_data_audit.sql
-- Tightens Camp restricted-data authorization after the pre-camp data-leak audit.
-- Additive and rollback-friendly: no Camp data is removed or reshaped.

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
        split_part(lower(coalesce(p.email, '')), '@', 1) in ('andrew', 'jaci', 'joel')
        or split_part(lower(coalesce(p.email, '')), '@', 1) like 'andrew.%'
        or split_part(lower(coalesce(p.email, '')), '@', 1) like 'andrew-%'
        or split_part(lower(coalesce(p.email, '')), '@', 1) like 'andrew\_%' escape '\'
        or split_part(lower(coalesce(p.email, '')), '@', 1) like 'jaci.%'
        or split_part(lower(coalesce(p.email, '')), '@', 1) like 'jaci-%'
        or split_part(lower(coalesce(p.email, '')), '@', 1) like 'jaci\_%' escape '\'
        or split_part(lower(coalesce(p.email, '')), '@', 1) like 'joel.%'
        or split_part(lower(coalesce(p.email, '')), '@', 1) like 'joel-%'
        or split_part(lower(coalesce(p.email, '')), '@', 1) like 'joel\_%' escape '\'
      )
  );
$$;

drop policy if exists "staff can select camp_import_batches" on public.camp_import_batches;
drop policy if exists "staff can insert camp_import_batches" on public.camp_import_batches;
drop policy if exists "staff can update camp_import_batches" on public.camp_import_batches;
drop policy if exists "restricted can select camp_import_batches" on public.camp_import_batches;
drop policy if exists "restricted can insert camp_import_batches" on public.camp_import_batches;
drop policy if exists "restricted can update camp_import_batches" on public.camp_import_batches;
create policy "restricted can select camp_import_batches" on public.camp_import_batches
for select to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can insert camp_import_batches" on public.camp_import_batches
for insert to authenticated with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
create policy "restricted can update camp_import_batches" on public.camp_import_batches
for update to authenticated using (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted())
with check (ministry_id = public.current_ministry_id() and public.current_user_can_access_camp_restricted());
