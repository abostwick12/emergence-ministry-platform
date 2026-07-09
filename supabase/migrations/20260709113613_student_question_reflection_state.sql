-- 20260709113613_student_question_reflection_state.sql
-- Private student reflection state for the question journey loop. Students can
-- mark a question as reflected and save a private note without exposing that
-- journal text to leaders or group discussion feeds.

create extension if not exists pgcrypto;

create table if not exists public.student_question_reflections (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  prompt_id uuid not null references public.student_discussion_prompts(id) on delete cascade,
  student_user_id uuid not null references public.profiles(id),
  reflected_at timestamptz,
  private_note text not null default '' check (char_length(private_note) <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prompt_id, student_user_id)
);

drop trigger if exists set_student_question_reflections_ministry_id on public.student_question_reflections;
create trigger set_student_question_reflections_ministry_id
before insert on public.student_question_reflections
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_student_question_reflections_updated_at on public.student_question_reflections;
create trigger set_student_question_reflections_updated_at
before update on public.student_question_reflections
for each row execute function public.set_updated_at();

create index if not exists idx_student_question_reflections_student_updated
  on public.student_question_reflections(student_user_id, updated_at desc);
create index if not exists idx_student_question_reflections_prompt
  on public.student_question_reflections(prompt_id, updated_at desc);

alter table public.student_question_reflections enable row level security;

drop policy if exists "students can select own question reflections" on public.student_question_reflections;
drop policy if exists "students can insert own question reflections" on public.student_question_reflections;
drop policy if exists "students can update own question reflections" on public.student_question_reflections;

create policy "students can select own question reflections" on public.student_question_reflections
for select to authenticated
using (
  ministry_id = public.current_ministry_id()
  and student_user_id = (select auth.uid())
);

create policy "students can insert own question reflections" on public.student_question_reflections
for insert to authenticated
with check (
  ministry_id = public.current_ministry_id()
  and student_user_id = (select auth.uid())
  and exists (
    select 1
    from public.student_discussion_prompts p
    where p.id = prompt_id
      and p.ministry_id = public.current_ministry_id()
      and p.submitted_by_user_id = (select auth.uid())
  )
);

create policy "students can update own question reflections" on public.student_question_reflections
for update to authenticated
using (
  ministry_id = public.current_ministry_id()
  and student_user_id = (select auth.uid())
)
with check (
  ministry_id = public.current_ministry_id()
  and student_user_id = (select auth.uid())
  and exists (
    select 1
    from public.student_discussion_prompts p
    where p.id = prompt_id
      and p.ministry_id = public.current_ministry_id()
      and p.submitted_by_user_id = (select auth.uid())
  )
);

revoke all on public.student_question_reflections from anon;
revoke delete, truncate, trigger on public.student_question_reflections from authenticated;
grant select, insert, update on public.student_question_reflections to authenticated;
