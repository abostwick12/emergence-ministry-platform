-- Supabase projects can expose new public-schema tables through default Data
-- API grants. Meridian is explicitly opt-in for signed-in users, so remove all
-- inherited and direct anonymous privileges as defense in depth in addition to
-- RLS.
revoke all privileges on table public.meridian_objects from public, anon;
revoke all privileges on table public.meridian_sources from public, anon;
revoke all privileges on table public.meridian_fragments from public, anon;
revoke all privileges on table public.meridian_claims from public, anon;
revoke all privileges on table public.meridian_contexts from public, anon;
revoke all privileges on table public.meridian_guardrails from public, anon;
revoke all privileges on table public.meridian_relationships from public, anon;
revoke all privileges on table public.meridian_claim_fragments from public, anon;
revoke all privileges on table public.meridian_candidates from public, anon;
revoke all privileges on table public.meridian_review_events from public, anon;
revoke all privileges on table public.meridian_answer_traces from public, anon;
revoke all privileges on table public.meridian_provider_traces from public, anon;
revoke all privileges on table public.meridian_mcp_access_grants from public, anon;
revoke all privileges on table public.meridian_resource_drafts from public, anon;
revoke all privileges on table public.meridian_resource_draft_claims from public, anon;

revoke all on function public.search_meridian_approved_claims(uuid, text, text, text, integer) from public, anon;
revoke all on function public.promote_meridian_candidate(uuid, jsonb, jsonb, jsonb, text) from public, anon;
revoke all on function public.fetch_meridian_generation_fragments(uuid, uuid[]) from public, anon;
revoke all on function public.submit_meridian_resource_draft(uuid, text, text, text, text, text, uuid[], text, text, jsonb) from public, anon;
