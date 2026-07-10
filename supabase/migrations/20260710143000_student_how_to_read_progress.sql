-- 20260710143000_student_how_to_read_progress.sql
-- Private per-student progress for the How to Read path. Students can save
-- completion state without exposing progress to other students. Group sharing
-- remains opt-in data only until a later privacy-reviewed slice adds reads.

create extension if not exists pgcrypto;

create table if not exists public.student_how_to_read_progress (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  student_user_id uuid not null references public.profiles(id),
  module_id text not null check (module_id ~ '^[a-z0-9-]{3,80}$'),
  completed_at timestamptz,
  share_with_group boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_user_id, module_id)
);

drop trigger if exists set_student_how_to_read_progress_ministry_id on public.student_how_to_read_progress;
create trigger set_student_how_to_read_progress_ministry_id
before insert on public.student_how_to_read_progress
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_student_how_to_read_progress_updated_at on public.student_how_to_read_progress;
create trigger set_student_how_to_read_progress_updated_at
before update on public.student_how_to_read_progress
for each row execute function public.set_updated_at();

create index if not exists idx_student_how_to_read_progress_student_updated
  on public.student_how_to_read_progress(student_user_id, updated_at desc);
create index if not exists idx_student_how_to_read_progress_ministry_completed
  on public.student_how_to_read_progress(ministry_id, completed_at desc);

alter table public.student_how_to_read_progress enable row level security;

drop policy if exists "students can select own how to read progress" on public.student_how_to_read_progress;
drop policy if exists "students can insert own how to read progress" on public.student_how_to_read_progress;
drop policy if exists "students can update own how to read progress" on public.student_how_to_read_progress;

create policy "students can select own how to read progress" on public.student_how_to_read_progress
for select to authenticated
using (
  ministry_id = public.current_ministry_id()
  and student_user_id = (select auth.uid())
);

create policy "students can insert own how to read progress" on public.student_how_to_read_progress
for insert to authenticated
with check (
  ministry_id = public.current_ministry_id()
  and student_user_id = (select auth.uid())
);

create policy "students can update own how to read progress" on public.student_how_to_read_progress
for update to authenticated
using (
  ministry_id = public.current_ministry_id()
  and student_user_id = (select auth.uid())
)
with check (
  ministry_id = public.current_ministry_id()
  and student_user_id = (select auth.uid())
);

revoke all on public.student_how_to_read_progress from anon;
revoke delete, truncate, trigger on public.student_how_to_read_progress from authenticated;
grant select, insert, update on public.student_how_to_read_progress to authenticated;
