-- Adds the versioned EMMA review gate for MCP resource bundles. Reviews are
-- append-only, retain approved claim/fragment provenance, and never store
-- provider prompts or private Obsidian note text.

alter table public.meridian_mcp_access_grants
  add column if not exists can_review_resources boolean not null default false;

alter table public.meridian_mcp_resource_bundles
  add column if not exists human_review_status text not null default 'pending'
    check (human_review_status in ('pending','approved','changes_requested','rejected'));

alter table public.ai_requests drop constraint if exists ai_requests_source_check;
alter table public.ai_requests add constraint ai_requests_source_check
  check (source in ('event_card','task_action','dashboard','assistant_panel','platform_mcp','scheduled','system','planning_center'));

alter table public.ai_requests drop constraint if exists ai_requests_workflow_check;
alter table public.ai_requests add constraint ai_requests_workflow_check
  check (workflow in ('EVENT_PLAN','GENERATE_EVENT_TASKS','ANALYZE_TASK_HEALTH','DRAFT_PARENT_EMAIL','DRAFT_LEADER_GROUPME','DRAFT_SMS','REVIEW_RESOURCE_BUNDLE','ANALYZE_VOLUNTEER_GAPS','GENERATE_MINISTRY_SUMMARY','DRAFT_STUDENT_FOLLOW_UP','QUERY_MINISTRY_LIBRARY'));

create table if not exists public.meridian_mcp_bundle_reviews (
  id uuid primary key,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  bundle_id uuid not null references public.meridian_mcp_resource_bundles(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  contract_version text not null check (contract_version = '1.0'),
  content_fingerprint text not null check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  outcome text not null check (outcome in ('ready_for_human_review','changes_required','blocked','failed')),
  summary text check (summary is null or char_length(summary) between 1 and 1200),
  findings jsonb not null default '[]'::jsonb check (jsonb_typeof(findings) = 'array'),
  provider text,
  model text,
  emma_request_id uuid not null references public.ai_requests(id) on delete restrict,
  emma_run_id uuid references public.ai_runs(id) on delete restrict,
  failure_code text,
  private_discovery_status text not null check (private_discovery_status in ('not_used','passed')),
  human_review_status text not null default 'pending' check (human_review_status = 'pending'),
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  unique (bundle_id, created_by_user_id, idempotency_key),
  check (
    (outcome = 'failed' and summary is null and provider is null and model is null and emma_run_id is null and failure_code is not null and findings = '[]'::jsonb)
    or
    (outcome <> 'failed' and nullif(trim(summary), '') is not null and nullif(trim(provider), '') is not null and nullif(trim(model), '') is not null and emma_run_id is not null and failure_code is null)
  )
);

create table if not exists public.meridian_mcp_bundle_review_evidence (
  review_id uuid not null references public.meridian_mcp_bundle_reviews(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  bundle_item_id uuid not null references public.meridian_mcp_resource_bundle_items(id) on delete restrict,
  claim_id uuid not null references public.meridian_claims(id) on delete restrict,
  fragment_ids uuid[] not null default '{}',
  authority_class text not null,
  quote_permission text not null check (quote_permission in ('allowed','not_allowed')),
  created_at timestamptz not null default now(),
  primary key (review_id, bundle_item_id, claim_id)
);

alter table public.meridian_mcp_resource_bundles
  add column if not exists active_emma_review_id uuid references public.meridian_mcp_bundle_reviews(id) on delete restrict;

-- Phase 4 policies predate the human/EMMA review columns. Recreate them so the
-- bundle creation path cannot set or preserve review state outside this gate.
drop policy if exists "mcp creators insert own resource bundles" on public.meridian_mcp_resource_bundles;
create policy "mcp creators insert own resource bundles"
on public.meridian_mcp_resource_bundles for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and status = 'creating'
  and emma_status = 'not_reviewed'
  and human_review_status = 'pending'
  and active_emma_review_id is null
  and private_discovery_status = 'not_used'
  and exists (
    select 1 from public.meridian_mcp_access_grants grant_row
    where grant_row.ministry_id = meridian_mcp_resource_bundles.ministry_id
      and grant_row.user_id = (select auth.uid())
      and grant_row.revoked_at is null
      and grant_row.can_save_resources
  )
);

drop policy if exists "mcp creators complete unreviewed resource bundles" on public.meridian_mcp_resource_bundles;
create policy "mcp creators complete unreviewed resource bundles"
on public.meridian_mcp_resource_bundles for update to authenticated
using (
  created_by_user_id = (select auth.uid())
  and emma_status = 'not_reviewed'
  and human_review_status = 'pending'
  and active_emma_review_id is null
  and status in ('creating','review_required')
  and exists (
    select 1 from public.meridian_mcp_access_grants grant_row
    where grant_row.ministry_id = meridian_mcp_resource_bundles.ministry_id
      and grant_row.user_id = (select auth.uid())
      and grant_row.revoked_at is null
      and grant_row.can_save_resources
  )
)
with check (
  created_by_user_id = (select auth.uid())
  and emma_status = 'not_reviewed'
  and human_review_status = 'pending'
  and active_emma_review_id is null
  and status in ('creating','review_required')
  and (
    private_discovery_status = 'not_used'
    or exists (
      select 1 from public.meridian_mcp_bundle_private_provenance provenance
      where provenance.bundle_id = meridian_mcp_resource_bundles.id
        and provenance.ministry_id = meridian_mcp_resource_bundles.ministry_id
        and provenance.check_status = 'passed'
    )
  )
);

create index if not exists idx_mcp_bundle_reviews_bundle
  on public.meridian_mcp_bundle_reviews(ministry_id, bundle_id, created_at desc);
create index if not exists idx_mcp_bundle_reviews_outcome
  on public.meridian_mcp_bundle_reviews(ministry_id, outcome, created_at desc);
create index if not exists idx_mcp_bundle_review_evidence_claim
  on public.meridian_mcp_bundle_review_evidence(ministry_id, claim_id);

alter table public.meridian_mcp_bundle_reviews enable row level security;
alter table public.meridian_mcp_bundle_review_evidence enable row level security;

drop policy if exists "bundle readers read EMMA reviews" on public.meridian_mcp_bundle_reviews;
create policy "bundle readers read EMMA reviews"
on public.meridian_mcp_bundle_reviews for select to authenticated
using (exists (
  select 1 from public.meridian_mcp_resource_bundles bundle
  where bundle.id = meridian_mcp_bundle_reviews.bundle_id
    and bundle.ministry_id = meridian_mcp_bundle_reviews.ministry_id
    and (
      bundle.created_by_user_id = (select auth.uid())
      or exists (
        select 1 from public.meridian_mcp_access_grants grant_row
        where grant_row.ministry_id = bundle.ministry_id
          and grant_row.user_id = (select auth.uid())
          and grant_row.revoked_at is null
          and grant_row.access_level in ('leader_creator','admin')
      )
    )
));

drop policy if exists "granted MCP users insert EMMA reviews" on public.meridian_mcp_bundle_reviews;

drop policy if exists "bundle readers read EMMA evidence" on public.meridian_mcp_bundle_review_evidence;
create policy "bundle readers read EMMA evidence"
on public.meridian_mcp_bundle_review_evidence for select to authenticated
using (exists (
  select 1 from public.meridian_mcp_bundle_reviews review
  where review.id = meridian_mcp_bundle_review_evidence.review_id
    and review.ministry_id = meridian_mcp_bundle_review_evidence.ministry_id
));

drop policy if exists "review creators insert approved evidence" on public.meridian_mcp_bundle_review_evidence;

drop policy if exists "review outcome updates MCP bundle" on public.meridian_mcp_resource_bundles;

drop policy if exists "review outcome updates MCP bundle items" on public.meridian_mcp_resource_bundle_items;

grant select on public.meridian_mcp_bundle_reviews to authenticated;
grant select on public.meridian_mcp_bundle_review_evidence to authenticated;
revoke insert, update, delete on public.meridian_mcp_bundle_reviews from authenticated;
revoke insert, update, delete on public.meridian_mcp_bundle_review_evidence from authenticated;
revoke update (emma_status, human_review_status, active_emma_review_id) on public.meridian_mcp_resource_bundles from authenticated;
revoke all on public.meridian_mcp_bundle_reviews from anon;
revoke all on public.meridian_mcp_bundle_review_evidence from anon;

create or replace function public.save_meridian_mcp_bundle_review(
  p_review_id uuid,
  p_bundle_id uuid,
  p_ministry_id uuid,
  p_idempotency_key text,
  p_contract_version text,
  p_content_fingerprint text,
  p_outcome text,
  p_summary text,
  p_findings jsonb,
  p_evidence jsonb,
  p_provider text,
  p_model text,
  p_emma_request_id uuid,
  p_emma_run_id uuid,
  p_failure_code text,
  p_private_discovery_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  existing public.meridian_mcp_bundle_reviews%rowtype;
  evidence_count integer := 0;
begin
  if actor_id is null then raise exception 'Authentication required.'; end if;
  if p_contract_version <> '1.0' then raise exception 'Unsupported EMMA review contract.'; end if;
  if p_outcome not in ('ready_for_human_review','changes_required','blocked','failed') then raise exception 'Invalid EMMA review outcome.'; end if;
  if char_length(trim(p_idempotency_key)) not between 8 and 120 then raise exception 'Invalid review idempotency key.'; end if;
  if p_content_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'Invalid content fingerprint.'; end if;
  if jsonb_typeof(coalesce(p_findings, '[]'::jsonb)) <> 'array' then raise exception 'Review findings must be an array.'; end if;
  if jsonb_typeof(coalesce(p_evidence, '[]'::jsonb)) <> 'array' then raise exception 'Review evidence must be an array.'; end if;
  if jsonb_array_length(coalesce(p_findings, '[]'::jsonb)) > 64 then raise exception 'Review findings exceed the contract limit.'; end if;
  if jsonb_array_length(coalesce(p_evidence, '[]'::jsonb)) > 160 then raise exception 'Review evidence exceeds the bundle limit.'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_findings, '[]'::jsonb)) finding
    where jsonb_typeof(finding) <> 'object'
      or coalesce(finding ->> 'category', '') not in ('grounding','culture','theology','scripture','privacy','permission','prohibited_inference','citation','audience_fit','temporal_fit','linkage')
      or coalesce(finding ->> 'severity', '') not in ('advisory','required_change','blocker')
      or nullif(trim(finding ->> 'code'), '') is null
      or char_length(finding ->> 'code') > 80
      or (finding ->> 'code') !~ '^[a-z0-9_]+$'
      or nullif(trim(finding ->> 'message'), '') is null
      or char_length(finding ->> 'message') > 800
      or not finding ? 'artifactId'
      or (
        jsonb_typeof(finding -> 'artifactId') <> 'null'
        and (jsonb_typeof(finding -> 'artifactId') <> 'string' or (finding ->> 'artifactId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      )
      or jsonb_typeof(finding -> 'evidenceRefs') <> 'array'
      or jsonb_array_length(finding -> 'evidenceRefs') > 12
      or exists (
        select 1 from jsonb_array_elements(finding -> 'evidenceRefs') evidence_ref
        where jsonb_typeof(evidence_ref) <> 'string'
          or nullif(trim(evidence_ref #>> '{}'), '') is null
          or char_length(evidence_ref #>> '{}') > 160
      )
  ) then raise exception 'Review findings do not match contract 1.0.'; end if;

  select * into existing
  from public.meridian_mcp_bundle_reviews review
  where review.bundle_id = p_bundle_id
    and review.created_by_user_id = actor_id
    and review.idempotency_key = p_idempotency_key;
  if found then
    if existing.id <> p_review_id or existing.content_fingerprint <> p_content_fingerprint then
      raise exception 'That idempotency key has already been used for a different review.';
    end if;
    return jsonb_build_object('id', existing.id, 'outcome', existing.outcome, 'idempotentReplay', true);
  end if;

  if not exists (
    select 1 from public.meridian_mcp_resource_bundles bundle
    join public.meridian_mcp_access_grants grant_row
      on grant_row.ministry_id = bundle.ministry_id
     and grant_row.user_id = actor_id
     and grant_row.revoked_at is null
     and grant_row.can_review_resources
     and grant_row.access_level in ('leader_creator','admin')
    where bundle.id = p_bundle_id
      and bundle.ministry_id = p_ministry_id
      and bundle.status = 'review_required'
      and bundle.emma_status = 'not_reviewed'
      and bundle.private_discovery_status = p_private_discovery_status
      and (bundle.created_by_user_id = actor_id or grant_row.access_level = 'admin')
  ) then raise exception 'Resource bundle is not available for EMMA review.'; end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_findings, '[]'::jsonb)) finding
    where jsonb_typeof(finding -> 'artifactId') = 'string'
      and not exists (
        select 1 from public.meridian_mcp_resource_bundle_items item
        where item.id = (finding ->> 'artifactId')::uuid
          and item.bundle_id = p_bundle_id
          and item.ministry_id = p_ministry_id
      )
  ) then raise exception 'A review finding references an artifact outside the bundle.'; end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_findings, '[]'::jsonb)) finding,
         jsonb_array_elements_text(finding -> 'evidenceRefs') evidence_ref
    where evidence_ref not in (
      'rule:approved_grounding_required',
      'rule:bundle_attachment_required',
      'rule:spiritual_decline',
      'rule:burnout_diagnosis',
      'rule:motive_inference',
      'rule:divine_intent',
      'rule:medical_diagnosis',
      'rule:mental_health_diagnosis'
    )
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) evidence
        where evidence ->> 'claimId' = evidence_ref
          or exists (
            select 1
            from jsonb_array_elements_text(coalesce(evidence -> 'fragmentIds', '[]'::jsonb)) fragment_id
            where fragment_id = evidence_ref
          )
      )
  ) then raise exception 'A review finding references evidence outside the approved review context.'; end if;

  if not exists (
    select 1 from public.ai_requests request
    where request.id = p_emma_request_id
      and request.ministry_id = p_ministry_id
      and request.requested_by = actor_id
      and request.source = 'platform_mcp'
      and request.source_record_type = 'meridian_mcp_resource_bundle'
      and request.source_record_id = p_bundle_id::text
      and request.workflow = 'REVIEW_RESOURCE_BUNDLE'
  ) then raise exception 'EMMA request provenance is invalid.'; end if;

  if p_outcome = 'failed' then
    if p_summary is not null or p_provider is not null or p_model is not null or p_emma_run_id is not null or nullif(trim(p_failure_code), '') is null or p_findings <> '[]'::jsonb then
      raise exception 'Failed review provenance is invalid.';
    end if;
  elsif nullif(trim(p_summary), '') is null or char_length(trim(p_summary)) > 1200 or nullif(trim(p_provider), '') is null or nullif(trim(p_model), '') is null or p_emma_run_id is null or p_failure_code is not null then
    raise exception 'Completed review provenance is invalid.';
  elsif not exists (
    select 1 from public.ai_runs run
    where run.id = p_emma_run_id
      and run.request_id = p_emma_request_id
      and run.ministry_id = p_ministry_id
      and run.skill_key = 'resource_bundle_review_v1'
      and run.output_schema_version = '1.0'
      and run.status = 'succeeded'
  ) then raise exception 'EMMA run provenance is invalid.'; end if;

  insert into public.meridian_mcp_bundle_reviews(
    id, ministry_id, bundle_id, created_by_user_id, idempotency_key,
    contract_version, content_fingerprint, outcome, summary, findings, provider, model,
    emma_request_id, emma_run_id, failure_code, private_discovery_status
  ) values (
    p_review_id, p_ministry_id, p_bundle_id, actor_id, trim(p_idempotency_key),
    p_contract_version, p_content_fingerprint, p_outcome, nullif(trim(p_summary), ''), coalesce(p_findings, '[]'::jsonb),
    nullif(trim(p_provider), ''), nullif(trim(p_model), ''), p_emma_request_id,
    p_emma_run_id, nullif(trim(p_failure_code), ''), p_private_discovery_status
  );

  insert into public.meridian_mcp_bundle_review_evidence(
    review_id, ministry_id, bundle_item_id, claim_id, fragment_ids, authority_class, quote_permission
  )
  select
    p_review_id,
    p_ministry_id,
    evidence."itemId",
    evidence."claimId",
    array(select jsonb_array_elements_text(evidence."fragmentIds")::uuid),
    evidence."authorityClass",
    evidence."quotePermission"
  from jsonb_to_recordset(coalesce(p_evidence, '[]'::jsonb)) as evidence(
    "itemId" uuid,
    "claimId" uuid,
    "fragmentIds" jsonb,
    "authorityClass" text,
    "quotePermission" text
  )
  join public.meridian_mcp_resource_bundle_items item
    on item.id = evidence."itemId"
   and item.bundle_id = p_bundle_id
   and item.ministry_id = p_ministry_id
  join public.meridian_claims claim
    on claim.id = evidence."claimId"
   and claim.ministry_id = p_ministry_id
   and claim.approval_status = 'approved'
   and claim.authority_class <> 'none'
   and claim.authority_class = evidence."authorityClass"
   and evidence."quotePermission" = case when exists (
     select 1
     from jsonb_array_elements_text(evidence."fragmentIds") fragment_id
     join public.meridian_claim_fragments claim_fragment
       on claim_fragment.claim_id = evidence."claimId"
      and claim_fragment.fragment_id = fragment_id::uuid
      and claim_fragment.ministry_id = p_ministry_id
     join public.meridian_fragments fragment
       on fragment.id = claim_fragment.fragment_id
      and fragment.ministry_id = p_ministry_id
      and fragment.can_quote
      and fragment.quote_policy = 'allowed'
   ) then 'allowed' else 'not_allowed' end
  where not exists (
    select 1
    from jsonb_array_elements_text(evidence."fragmentIds") fragment_id
    where not exists (
      select 1 from public.meridian_claim_fragments claim_fragment
      where claim_fragment.ministry_id = p_ministry_id
        and claim_fragment.claim_id = evidence."claimId"
        and claim_fragment.fragment_id = fragment_id::uuid
    )
  );
  get diagnostics evidence_count = row_count;
  if evidence_count <> jsonb_array_length(coalesce(p_evidence, '[]'::jsonb)) then
    raise exception 'Review evidence is invalid or outside the bundle.';
  end if;

  if p_outcome <> 'failed' then
    update public.meridian_mcp_resource_bundles set
      active_emma_review_id = p_review_id,
      human_review_status = 'pending',
      emma_status = case p_outcome
        when 'ready_for_human_review' then 'passed'
        when 'changes_required' then 'changes_required'
        else 'blocked'
      end,
      status = case p_outcome
        when 'ready_for_human_review' then 'review_required'
        when 'changes_required' then 'changes_requested'
        else 'blocked'
      end
    where id = p_bundle_id and ministry_id = p_ministry_id;
    if not found then raise exception 'Bundle review outcome could not be saved.'; end if;

    update public.meridian_mcp_resource_bundle_items set
      status = case p_outcome
        when 'ready_for_human_review' then 'review_required'
        when 'changes_required' then 'changes_requested'
        else 'blocked'
      end
    where bundle_id = p_bundle_id and ministry_id = p_ministry_id;
  end if;

  return jsonb_build_object('id', p_review_id, 'outcome', p_outcome, 'idempotentReplay', false);
end;
$$;

revoke all on function public.save_meridian_mcp_bundle_review(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text, text, uuid, uuid, text, text) from public, anon;
grant execute on function public.save_meridian_mcp_bundle_review(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text, text, uuid, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
