-- Add journey-stage placement to student-facing curated resources.
-- Leaders can place a resource into the part of the question journey where it
-- belongs, without exposing private knowledge-source metadata to students.

alter table public.student_curated_resources
  add column if not exists journey_stage text not null default 'read';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_curated_resources_journey_stage_check'
      and conrelid = 'public.student_curated_resources'::regclass
  ) then
    alter table public.student_curated_resources
      add constraint student_curated_resources_journey_stage_check
      check (journey_stage in ('ask','read','reflect','practice','discuss'));
  end if;
end $$;

create index if not exists idx_student_curated_resources_stage
  on public.student_curated_resources(ministry_id, is_active, journey_stage, sort_order, updated_at desc);
