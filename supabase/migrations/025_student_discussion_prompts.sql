-- 025_student_discussion_prompts.sql
-- Real student small-group question workflow for the Scripture in New Frontiers
-- tryout. Stores ministry-scoped question/review/delivery artifacts only. It
-- does not create a parallel student roster and it does not store Bible text.

create extension if not exists pgcrypto;

create table if not exists public.student_discussion_prompts (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  submitted_by_user_id uuid not null references public.profiles(id),
  submitted_by_name text not null,
  submitted_by_email text not null,
  question text not null check (char_length(question) between 1 and 1200),
  scripture_reference text,
  scripture_passage_id text,
  metanarrative_movement text not null,
  ai_provider text not null default 'gloo' check (ai_provider in ('gloo')),
  ai_status text not null default 'pending' check (ai_status in ('not_configured','pending','generated','failed')),
  ai_model text,
  ai_model_tier text check (ai_model_tier in ('default','escalation','long_context')),
  ai_model_reason text,
  ai_confidence numeric check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  topic_tags text[] not null default '{}',
  escalation_reason text,
  safety_label text not null default 'unreviewed' check (safety_label in ('safe','needs_leader_care','pastoral_escalation','unreviewed')),
  safety_notes text,
  discussion_prompt text,
  leader_notes text,
  status text not null default 'pending_review' check (status in ('pending_review','approved','changes_requested','archived','posted')),
  delivery_channel text,
  delivery_status text not null default 'not_requested' check (delivery_status in ('not_requested','not_configured','delivered','failed')),
  delivery_message text,
  approved_by_user_id uuid references public.profiles(id),
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_discussion_prompt_events (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  prompt_id uuid not null references public.student_discussion_prompts(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists set_student_discussion_prompts_ministry_id on public.student_discussion_prompts;
create trigger set_student_discussion_prompts_ministry_id
before insert on public.student_discussion_prompts
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_student_discussion_prompt_events_ministry_id on public.student_discussion_prompt_events;
create trigger set_student_discussion_prompt_events_ministry_id
before insert on public.student_discussion_prompt_events
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_student_discussion_prompts_updated_at on public.student_discussion_prompts;
create trigger set_student_discussion_prompts_updated_at
before update on public.student_discussion_prompts
for each row execute function public.set_updated_at();

create index if not exists idx_student_discussion_prompts_ministry_created
  on public.student_discussion_prompts(ministry_id, created_at desc);
create index if not exists idx_student_discussion_prompts_submitter
  on public.student_discussion_prompts(submitted_by_user_id, created_at desc);
create index if not exists idx_student_discussion_prompt_events_prompt
  on public.student_discussion_prompt_events(prompt_id, created_at desc);

alter table public.student_discussion_prompts enable row level security;
alter table public.student_discussion_prompt_events enable row level security;

drop policy if exists "students can select own discussion prompts" on public.student_discussion_prompts;
drop policy if exists "leaders can select ministry discussion prompts" on public.student_discussion_prompts;
drop policy if exists "students can insert own discussion prompts" on public.student_discussion_prompts;
drop policy if exists "leaders can update ministry discussion prompts" on public.student_discussion_prompts;

create policy "students can select own discussion prompts" on public.student_discussion_prompts
for select to authenticated
using (ministry_id = public.current_ministry_id() and submitted_by_user_id = (select auth.uid()));

create policy "leaders can select ministry discussion prompts" on public.student_discussion_prompts
for select to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

create policy "students can insert own discussion prompts" on public.student_discussion_prompts
for insert to authenticated
with check (
  ministry_id = public.current_ministry_id()
  and submitted_by_user_id = (select auth.uid())
  and public.current_user_role() in ('admin','leader','student')
);

create policy "leaders can update ministry discussion prompts" on public.student_discussion_prompts
for update to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

drop policy if exists "students can select own discussion prompt events" on public.student_discussion_prompt_events;
drop policy if exists "leaders can select ministry discussion prompt events" on public.student_discussion_prompt_events;
drop policy if exists "participants can insert discussion prompt events" on public.student_discussion_prompt_events;

create policy "students can select own discussion prompt events" on public.student_discussion_prompt_events
for select to authenticated
using (
  ministry_id = public.current_ministry_id()
  and exists (
    select 1
    from public.student_discussion_prompts p
    where p.id = prompt_id
      and p.submitted_by_user_id = (select auth.uid())
  )
);

create policy "leaders can select ministry discussion prompt events" on public.student_discussion_prompt_events
for select to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

create policy "participants can insert discussion prompt events" on public.student_discussion_prompt_events
for insert to authenticated
with check (
  ministry_id = public.current_ministry_id()
  and (
    actor_user_id = (select auth.uid())
    or public.current_user_role() in ('admin','leader','staff')
  )
);
