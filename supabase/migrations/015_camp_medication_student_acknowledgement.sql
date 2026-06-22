-- 015_camp_medication_student_acknowledgement.sql
-- Adds student acknowledgement fields to append-only medication administration logs.

alter table public.camp_medication_administration_logs
add column if not exists student_acknowledgement_initials text not null default '';

alter table public.camp_medication_administration_logs
add column if not exists student_acknowledgement_unavailable boolean not null default false;

alter table public.camp_medication_administration_logs
add column if not exists student_acknowledgement_unavailable_reason text not null default '';

update public.camp_medication_administration_logs
set
  student_acknowledgement_unavailable = true,
  student_acknowledgement_unavailable_reason = 'Student acknowledgement was not captured before this field existed.'
where
  student_acknowledgement_unavailable = false
  and length(trim(student_acknowledgement_initials)) = 0
  and length(trim(student_acknowledgement_unavailable_reason)) = 0;

alter table public.camp_medication_administration_logs
drop constraint if exists camp_medication_admin_student_ack_check;

alter table public.camp_medication_administration_logs
add constraint camp_medication_admin_student_ack_check
check (
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
);

notify pgrst, 'reload schema';
