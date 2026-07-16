-- Internal grounding sources are admin-only context for generation posture,
-- voice, question shape, and ministry culture. They are never student-visible.

alter table public.knowledge_sources
  drop constraint if exists knowledge_sources_visibility_check;
alter table public.knowledge_sources
  add constraint knowledge_sources_visibility_check
  check (visibility in ('student_visible','leader_only','private_review','scholar_citation_only','internal_grounding'));

alter table public.knowledge_chunks
  drop constraint if exists knowledge_chunks_visibility_check;
alter table public.knowledge_chunks
  add constraint knowledge_chunks_visibility_check
  check (visibility in ('student_visible','leader_only','private_review','scholar_citation_only','internal_grounding'));

alter table public.knowledge_concepts
  drop constraint if exists knowledge_concepts_visibility_check;
alter table public.knowledge_concepts
  add constraint knowledge_concepts_visibility_check
  check (visibility in ('student_visible','leader_only','private_review','scholar_citation_only','internal_grounding'));

drop policy if exists "leaders can manage ministry knowledge sources" on public.knowledge_sources;
drop policy if exists "admins can manage all ministry knowledge sources" on public.knowledge_sources;
drop policy if exists "leaders can manage non-grounding ministry knowledge sources" on public.knowledge_sources;

create policy "admins can manage all ministry knowledge sources" on public.knowledge_sources
for all to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() = 'admin')
with check (ministry_id = public.current_ministry_id() and public.current_user_role() = 'admin');

create policy "leaders can manage non-grounding ministry knowledge sources" on public.knowledge_sources
for all to authenticated
using (
  ministry_id = public.current_ministry_id()
  and public.current_user_role() in ('leader','staff')
  and visibility <> 'internal_grounding'
)
with check (
  ministry_id = public.current_ministry_id()
  and public.current_user_role() in ('leader','staff')
  and visibility <> 'internal_grounding'
);

drop policy if exists "leaders can manage ministry knowledge chunks" on public.knowledge_chunks;
drop policy if exists "admins can manage all ministry knowledge chunks" on public.knowledge_chunks;
drop policy if exists "leaders can manage non-grounding ministry knowledge chunks" on public.knowledge_chunks;

create policy "admins can manage all ministry knowledge chunks" on public.knowledge_chunks
for all to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() = 'admin')
with check (ministry_id = public.current_ministry_id() and public.current_user_role() = 'admin');

create policy "leaders can manage non-grounding ministry knowledge chunks" on public.knowledge_chunks
for all to authenticated
using (
  ministry_id = public.current_ministry_id()
  and public.current_user_role() in ('leader','staff')
  and visibility <> 'internal_grounding'
)
with check (
  ministry_id = public.current_ministry_id()
  and public.current_user_role() in ('leader','staff')
  and visibility <> 'internal_grounding'
);

drop policy if exists "leaders can manage ministry knowledge concepts" on public.knowledge_concepts;
drop policy if exists "admins can manage all ministry knowledge concepts" on public.knowledge_concepts;
drop policy if exists "leaders can manage non-grounding ministry knowledge concepts" on public.knowledge_concepts;

create policy "admins can manage all ministry knowledge concepts" on public.knowledge_concepts
for all to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() = 'admin')
with check (ministry_id = public.current_ministry_id() and public.current_user_role() = 'admin');

create policy "leaders can manage non-grounding ministry knowledge concepts" on public.knowledge_concepts
for all to authenticated
using (
  ministry_id = public.current_ministry_id()
  and public.current_user_role() in ('leader','staff')
  and visibility <> 'internal_grounding'
)
with check (
  ministry_id = public.current_ministry_id()
  and public.current_user_role() in ('leader','staff')
  and visibility <> 'internal_grounding'
);
