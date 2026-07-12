-- Student-facing curated resources for the Scripture journey.
-- This table is intentionally separate from knowledge_sources/knowledge_chunks:
-- academic papers, citations, and private source metadata stay leader-only while
-- students receive brief, intentionally published guides, practices, and tools.

create extension if not exists pgcrypto;

create table if not exists public.student_curated_resources (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  kind text not null check (kind in ('guide','video','prayer','reading_tool','practice','discussion_prompt')),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null check (char_length(summary) between 1 and 260),
  body text not null check (char_length(body) between 1 and 1400),
  scripture_references text[] not null default '{}',
  themes text[] not null default '{}',
  question_patterns text[] not null default '{}',
  practice_prompt text,
  href text,
  sort_order integer not null default 0 check (sort_order >= 0 and sort_order <= 999),
  is_active boolean not null default true,
  created_by_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_student_curated_resources_ministry_id on public.student_curated_resources;
create trigger set_student_curated_resources_ministry_id
before insert on public.student_curated_resources
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_student_curated_resources_updated_at on public.student_curated_resources;
create trigger set_student_curated_resources_updated_at
before update on public.student_curated_resources
for each row execute function public.set_updated_at();

create index if not exists idx_student_curated_resources_ministry_active
  on public.student_curated_resources(ministry_id, is_active, sort_order, updated_at desc);
create index if not exists idx_student_curated_resources_scripture_refs
  on public.student_curated_resources using gin(scripture_references);
create index if not exists idx_student_curated_resources_themes
  on public.student_curated_resources using gin(themes);
create index if not exists idx_student_curated_resources_question_patterns
  on public.student_curated_resources using gin(question_patterns);

alter table public.student_curated_resources enable row level security;

drop policy if exists "students can select active curated resources" on public.student_curated_resources;
drop policy if exists "leaders can manage student curated resources" on public.student_curated_resources;

create policy "students can select active curated resources" on public.student_curated_resources
for select to authenticated
using (
  ministry_id = public.current_ministry_id()
  and is_active = true
  and public.current_user_role() in ('student','admin','leader','staff')
);

create policy "leaders can manage student curated resources" on public.student_curated_resources
for all to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

grant select, insert, update on public.student_curated_resources to authenticated;
