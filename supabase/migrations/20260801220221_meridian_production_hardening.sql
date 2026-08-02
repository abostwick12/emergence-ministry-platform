-- Harden shared helpers used by RLS. Anonymous callers do not need direct RPC
-- access; authenticated execution is retained because existing RLS policies
-- invoke these helpers as the signed-in user.
alter function public.set_updated_at() set search_path = '';
alter function public.set_ministry_id_if_null() set search_path = '';
revoke execute on function public.current_ministry_id() from public, anon;
revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_ministry_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;

-- Raw fragment text is never directly available through the Data API. This
-- narrowly scoped function enforces tenant, approval, sensitivity, and final-
-- answer permission checks, and only includes exact text when quote permission
-- is independently granted.
create or replace function public.fetch_meridian_generation_fragments(
  p_ministry_id uuid,
  p_fragment_ids uuid[]
)
returns table (
  id uuid,
  ministry_id uuid,
  source_id uuid,
  locator jsonb,
  content_hash text,
  body_text text,
  provenance jsonb,
  quote_policy text,
  generation_policy text,
  sensitivity text,
  can_quote boolean,
  can_paraphrase boolean,
  can_cite boolean,
  can_use_final_answer boolean,
  can_use_external_communication boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    fragment.id,
    fragment.ministry_id,
    fragment.source_id,
    fragment.locator,
    fragment.content_hash,
    case
      when fragment.can_quote and fragment.quote_policy = 'allowed' then fragment.body_text
      else ''
    end as body_text,
    fragment.provenance,
    fragment.quote_policy,
    fragment.generation_policy,
    fragment.sensitivity,
    fragment.can_quote,
    fragment.can_paraphrase,
    fragment.can_cite,
    fragment.can_use_final_answer,
    fragment.can_use_external_communication
  from public.meridian_fragments fragment
  join public.meridian_sources source
    on source.id = fragment.source_id
   and source.ministry_id = fragment.ministry_id
  where fragment.ministry_id = p_ministry_id
    and fragment.id = any(coalesce(p_fragment_ids, '{}'::uuid[]))
    and fragment.generation_policy = 'approved_generation'
    and fragment.can_use_final_answer
    and fragment.external_visibility <> 'private'
    and fragment.sensitivity not in ('pastoral', 'person_specific')
    and source.approval_status = 'approved'
    and source.generation_policy = 'approved_generation'
    and source.external_visibility <> 'private'
    and source.sensitivity not in ('pastoral', 'person_specific')
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.ministry_id = p_ministry_id
        and profile.role in ('admin', 'leader', 'staff')
    );
$$;

revoke all on function public.fetch_meridian_generation_fragments(uuid, uuid[]) from public, anon;
grant execute on function public.fetch_meridian_generation_fragments(uuid, uuid[]) to authenticated;
revoke select on public.meridian_fragments from authenticated;

-- Cover foreign-key and review-queue access paths that will grow with the
-- approved corpus. These indexes are additive and safe on an empty rollout.
create index if not exists idx_meridian_sources_approved_by on public.meridian_sources(approved_by_user_id) where approved_by_user_id is not null;
create index if not exists idx_meridian_sources_created_by on public.meridian_sources(created_by_user_id);
create index if not exists idx_meridian_fragments_created_by on public.meridian_fragments(created_by_user_id);
create index if not exists idx_meridian_claims_approved_by on public.meridian_claims(approved_by_user_id) where approved_by_user_id is not null;
create index if not exists idx_meridian_claims_created_by on public.meridian_claims(created_by_user_id);
create index if not exists idx_meridian_contexts_created_by on public.meridian_contexts(created_by_user_id);
create index if not exists idx_meridian_guardrails_created_by on public.meridian_guardrails(created_by_user_id);
create index if not exists idx_meridian_relationships_created_by on public.meridian_relationships(created_by_user_id);
create index if not exists idx_meridian_claim_fragments_ministry_claim on public.meridian_claim_fragments(ministry_id, claim_id);
create index if not exists idx_meridian_claim_fragments_ministry_fragment on public.meridian_claim_fragments(ministry_id, fragment_id);
create index if not exists idx_meridian_candidates_created_by on public.meridian_candidates(created_by_user_id);
create index if not exists idx_meridian_candidates_reviewed_by on public.meridian_candidates(reviewed_by_user_id) where reviewed_by_user_id is not null;
create index if not exists idx_meridian_candidates_promoted_source on public.meridian_candidates(ministry_id, promoted_source_id) where promoted_source_id is not null;
create index if not exists idx_meridian_review_events_reviewer on public.meridian_review_events(reviewed_by_user_id);
create index if not exists idx_meridian_review_events_candidate on public.meridian_review_events(ministry_id, candidate_id);
create index if not exists idx_meridian_review_events_source on public.meridian_review_events(ministry_id, source_id) where source_id is not null;
create index if not exists idx_meridian_review_events_claim on public.meridian_review_events(ministry_id, claim_id) where claim_id is not null;
create index if not exists idx_meridian_answer_traces_created_by on public.meridian_answer_traces(created_by_user_id);
create index if not exists idx_meridian_provider_traces_answer on public.meridian_provider_traces(answer_trace_id);
create index if not exists idx_meridian_provider_traces_ministry on public.meridian_provider_traces(ministry_id);
create index if not exists idx_meridian_mcp_grants_user on public.meridian_mcp_access_grants(user_id);
create index if not exists idx_meridian_mcp_grants_created_by on public.meridian_mcp_access_grants(created_by_user_id);
create index if not exists idx_meridian_resource_drafts_created_by on public.meridian_resource_drafts(created_by_user_id);
create index if not exists idx_meridian_resource_drafts_reviewed_by on public.meridian_resource_drafts(reviewed_by_user_id) where reviewed_by_user_id is not null;
create index if not exists idx_meridian_resource_draft_claims_claim_only on public.meridian_resource_draft_claims(claim_id);
