-- 029_scripture_knowledge_rag_spine.sql
-- Launch-safe Scripture knowledge spine for student question recommendations.
-- Stores curated source metadata and excerpt-safe chunks only. Raw papers,
-- personal notes, leadership issues, and private care material stay out of
-- production unless explicitly promoted into student-safe knowledge.

create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  title text not null check (char_length(title) between 1 and 240),
  source_kind text not null check (source_kind in ('own_voice','scholar_reference','app_resource','curated_note')),
  hemisphere text not null check (hemisphere in ('own_voice','scholar','platform')),
  visibility text not null default 'leader_only' check (visibility in ('student_visible','leader_only','private_review','scholar_citation_only')),
  source_uri text,
  citation text,
  summary text not null default '',
  tags text[] not null default '{}',
  created_by_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  chunk_index integer not null default 0 check (chunk_index >= 0),
  title text not null check (char_length(title) between 1 and 240),
  body text not null check (char_length(body) between 1 and 4000),
  student_summary text not null default '' check (char_length(student_summary) <= 800),
  topic_tags text[] not null default '{}',
  concepts text[] not null default '{}',
  scripture_references text[] not null default '{}',
  visibility text not null default 'leader_only' check (visibility in ('student_visible','leader_only','private_review','scholar_citation_only')),
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, chunk_index)
);

create table if not exists public.knowledge_concepts (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  label text not null check (char_length(label) between 1 and 120),
  description text not null default '',
  aliases text[] not null default '{}',
  visibility text not null default 'leader_only' check (visibility in ('student_visible','leader_only','private_review','scholar_citation_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, slug)
);

create table if not exists public.student_question_recommendations (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  prompt_id uuid not null references public.student_discussion_prompts(id) on delete cascade,
  student_user_id uuid not null references public.profiles(id),
  source_chunk_id uuid references public.knowledge_chunks(id) on delete set null,
  recommendation_kind text not null check (recommendation_kind in ('dig_question','reading_plan','resource','scripture_lookup','leader_context')),
  label text not null check (char_length(label) between 1 and 120),
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '' check (char_length(description) <= 800),
  href text not null default '/student',
  reason text not null default '' check (char_length(reason) <= 400),
  rank integer not null default 0 check (rank >= 0),
  created_at timestamptz not null default now()
);

drop trigger if exists set_knowledge_sources_ministry_id on public.knowledge_sources;
create trigger set_knowledge_sources_ministry_id
before insert on public.knowledge_sources
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_knowledge_chunks_ministry_id on public.knowledge_chunks;
create trigger set_knowledge_chunks_ministry_id
before insert on public.knowledge_chunks
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_knowledge_concepts_ministry_id on public.knowledge_concepts;
create trigger set_knowledge_concepts_ministry_id
before insert on public.knowledge_concepts
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_student_question_recommendations_ministry_id on public.student_question_recommendations;
create trigger set_student_question_recommendations_ministry_id
before insert on public.student_question_recommendations
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_knowledge_sources_updated_at on public.knowledge_sources;
create trigger set_knowledge_sources_updated_at
before update on public.knowledge_sources
for each row execute function public.set_updated_at();

drop trigger if exists set_knowledge_chunks_updated_at on public.knowledge_chunks;
create trigger set_knowledge_chunks_updated_at
before update on public.knowledge_chunks
for each row execute function public.set_updated_at();

drop trigger if exists set_knowledge_concepts_updated_at on public.knowledge_concepts;
create trigger set_knowledge_concepts_updated_at
before update on public.knowledge_concepts
for each row execute function public.set_updated_at();

create index if not exists idx_knowledge_sources_ministry_visibility
  on public.knowledge_sources(ministry_id, visibility, updated_at desc);
create index if not exists idx_knowledge_sources_tags
  on public.knowledge_sources using gin(tags);
create index if not exists idx_knowledge_chunks_ministry_visibility
  on public.knowledge_chunks(ministry_id, visibility, updated_at desc);
create index if not exists idx_knowledge_chunks_topic_tags
  on public.knowledge_chunks using gin(topic_tags);
create index if not exists idx_knowledge_chunks_concepts
  on public.knowledge_chunks using gin(concepts);
create index if not exists idx_knowledge_chunks_scripture_refs
  on public.knowledge_chunks using gin(scripture_references);
create index if not exists idx_knowledge_concepts_ministry_slug
  on public.knowledge_concepts(ministry_id, slug);
create index if not exists idx_student_question_recommendations_prompt_rank
  on public.student_question_recommendations(prompt_id, rank, created_at desc);
create index if not exists idx_student_question_recommendations_student
  on public.student_question_recommendations(student_user_id, created_at desc);

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_concepts enable row level security;
alter table public.student_question_recommendations enable row level security;

drop policy if exists "students can select visible knowledge sources" on public.knowledge_sources;
drop policy if exists "leaders can manage ministry knowledge sources" on public.knowledge_sources;
drop policy if exists "students can select visible knowledge chunks" on public.knowledge_chunks;
drop policy if exists "leaders can manage ministry knowledge chunks" on public.knowledge_chunks;
drop policy if exists "students can select visible knowledge concepts" on public.knowledge_concepts;
drop policy if exists "leaders can manage ministry knowledge concepts" on public.knowledge_concepts;
drop policy if exists "students can select own question recommendations" on public.student_question_recommendations;
drop policy if exists "students can insert own question recommendations" on public.student_question_recommendations;
drop policy if exists "leaders can select ministry question recommendations" on public.student_question_recommendations;

create policy "students can select visible knowledge sources" on public.knowledge_sources
for select to authenticated
using (ministry_id = public.current_ministry_id() and visibility = 'student_visible');

create policy "leaders can manage ministry knowledge sources" on public.knowledge_sources
for all to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

create policy "students can select visible knowledge chunks" on public.knowledge_chunks
for select to authenticated
using (ministry_id = public.current_ministry_id() and visibility = 'student_visible');

create policy "leaders can manage ministry knowledge chunks" on public.knowledge_chunks
for all to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

create policy "students can select visible knowledge concepts" on public.knowledge_concepts
for select to authenticated
using (ministry_id = public.current_ministry_id() and visibility = 'student_visible');

create policy "leaders can manage ministry knowledge concepts" on public.knowledge_concepts
for all to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

create policy "students can select own question recommendations" on public.student_question_recommendations
for select to authenticated
using (ministry_id = public.current_ministry_id() and student_user_id = (select auth.uid()));

create policy "leaders can select ministry question recommendations" on public.student_question_recommendations
for select to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

create policy "students can insert own question recommendations" on public.student_question_recommendations
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
  and (
    source_chunk_id is null
    or exists (
      select 1
      from public.knowledge_chunks c
      where c.id = source_chunk_id
        and c.ministry_id = public.current_ministry_id()
        and c.visibility = 'student_visible'
    )
  )
);

grant select, insert, update, delete on public.knowledge_sources to authenticated;
grant select, insert, update, delete on public.knowledge_chunks to authenticated;
grant select, insert, update, delete on public.knowledge_concepts to authenticated;
grant select, insert on public.student_question_recommendations to authenticated;
