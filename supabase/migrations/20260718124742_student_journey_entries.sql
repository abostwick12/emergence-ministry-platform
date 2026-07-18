-- Account-backed Journey Journal entries. Each student owns one structured row
-- per journey day/entry so saved progress follows the authenticated account
-- across devices. Browser storage remains only a draft/recovery cache.

create extension if not exists pgcrypto;

create table if not exists public.student_journey_entries (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  student_user_id uuid not null references public.profiles(id),
  journey_id text not null check (char_length(journey_id) between 1 and 160),
  journey_kind text not null check (journey_kind in ('formation', 'question')),
  prompt_id uuid references public.student_discussion_prompts(id) on delete cascade,
  entry_sequence smallint not null check (entry_sequence between 1 and 100),
  scripture_reflection text not null default '' check (char_length(scripture_reflection) <= 4000),
  question_reflection text not null default '' check (char_length(question_reflection) <= 4000),
  practice_reflection text not null default '' check (char_length(practice_reflection) <= 4000),
  living_reflection text not null default '' check (char_length(living_reflection) <= 4000),
  fruit_reflection text not null default '' check (char_length(fruit_reflection) <= 4000),
  selected_practice text not null default 'embodied' check (selected_practice in ('embodied', 'guided')),
  study_path text not null default 'word' check (study_path in ('word', 'inductive')),
  selected_reading_id text not null default '' check (char_length(selected_reading_id) <= 200),
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_user_id, journey_id, entry_sequence),
  check (
    (journey_kind = 'formation' and prompt_id is null)
    or
    (journey_kind = 'question' and prompt_id is not null and journey_id = prompt_id::text)
  )
);

drop trigger if exists set_student_journey_entries_ministry_id on public.student_journey_entries;
create trigger set_student_journey_entries_ministry_id
before insert on public.student_journey_entries
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_student_journey_entries_updated_at on public.student_journey_entries;
create trigger set_student_journey_entries_updated_at
before update on public.student_journey_entries
for each row execute function public.set_updated_at();

create index if not exists idx_student_journey_entries_student_updated
  on public.student_journey_entries(student_user_id, updated_at desc);
create index if not exists idx_student_journey_entries_prompt
  on public.student_journey_entries(prompt_id, entry_sequence)
  where prompt_id is not null;

alter table public.student_journey_entries enable row level security;

drop policy if exists "students can select own journey entries" on public.student_journey_entries;
drop policy if exists "students can insert own journey entries" on public.student_journey_entries;
drop policy if exists "students can update own journey entries" on public.student_journey_entries;

create policy "students can select own journey entries" on public.student_journey_entries
for select to authenticated
using (
  ministry_id = public.current_ministry_id()
  and student_user_id = (select auth.uid())
);

create policy "students can insert own journey entries" on public.student_journey_entries
for insert to authenticated
with check (
  ministry_id = public.current_ministry_id()
  and student_user_id = (select auth.uid())
  and (
    journey_kind = 'formation'
    or exists (
      select 1
      from public.student_discussion_prompts p
      where p.id = prompt_id
        and p.ministry_id = public.current_ministry_id()
        and p.submitted_by_user_id = (select auth.uid())
    )
  )
);

create policy "students can update own journey entries" on public.student_journey_entries
for update to authenticated
using (
  ministry_id = public.current_ministry_id()
  and student_user_id = (select auth.uid())
)
with check (
  ministry_id = public.current_ministry_id()
  and student_user_id = (select auth.uid())
  and (
    journey_kind = 'formation'
    or exists (
      select 1
      from public.student_discussion_prompts p
      where p.id = prompt_id
        and p.ministry_id = public.current_ministry_id()
        and p.submitted_by_user_id = (select auth.uid())
    )
  )
);

revoke all on public.student_journey_entries from anon;
revoke delete, truncate, trigger on public.student_journey_entries from authenticated;
grant select, insert, update on public.student_journey_entries to authenticated;
