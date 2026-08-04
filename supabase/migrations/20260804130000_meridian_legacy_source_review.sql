-- Review-first bridge from the legacy source library into governed Meridian primitives.
-- A legacy visibility label never implies Meridian approval. Each approved claim must be
-- created by a ministry admin from an exact excerpt in one academic paper, curriculum
-- material, or sermon record.

create table if not exists public.meridian_legacy_source_promotions (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  legacy_source_id uuid not null references public.knowledge_sources(id) on delete restrict,
  meridian_source_id uuid not null,
  source_kind text not null check (source_kind in ('academic_paper','curriculum_material','sermon')),
  rationale text not null default '',
  approved_by_user_id uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (ministry_id, meridian_source_id)
    references public.meridian_sources(ministry_id, id) on delete restrict,
  unique (ministry_id, legacy_source_id),
  unique (ministry_id, meridian_source_id)
);

create table if not exists public.meridian_legacy_claim_promotions (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  source_promotion_id uuid not null references public.meridian_legacy_source_promotions(id) on delete restrict,
  legacy_chunk_id uuid not null references public.knowledge_chunks(id) on delete restrict,
  fragment_id uuid not null,
  claim_id uuid not null,
  rationale text not null default '',
  approved_by_user_id uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (ministry_id, fragment_id)
    references public.meridian_fragments(ministry_id, id) on delete restrict,
  foreign key (ministry_id, claim_id)
    references public.meridian_claims(ministry_id, id) on delete restrict,
  unique (ministry_id, claim_id)
);

create index if not exists idx_meridian_legacy_source_promotions_review
  on public.meridian_legacy_source_promotions(ministry_id, approved_at desc);
create index if not exists idx_meridian_legacy_source_promotions_legacy_source
  on public.meridian_legacy_source_promotions(legacy_source_id);
create index if not exists idx_meridian_legacy_source_promotions_reviewer
  on public.meridian_legacy_source_promotions(approved_by_user_id);
create index if not exists idx_meridian_legacy_claim_promotions_source
  on public.meridian_legacy_claim_promotions(ministry_id, source_promotion_id, approved_at desc);
create index if not exists idx_meridian_legacy_claim_promotions_source_fk
  on public.meridian_legacy_claim_promotions(source_promotion_id);
create index if not exists idx_meridian_legacy_claim_promotions_chunk
  on public.meridian_legacy_claim_promotions(legacy_chunk_id);
create index if not exists idx_meridian_legacy_claim_promotions_fragment
  on public.meridian_legacy_claim_promotions(ministry_id, fragment_id);
create index if not exists idx_meridian_legacy_claim_promotions_reviewer
  on public.meridian_legacy_claim_promotions(approved_by_user_id);

alter table public.meridian_legacy_source_promotions enable row level security;
alter table public.meridian_legacy_claim_promotions enable row level security;

drop policy if exists "admins manage meridian legacy source promotions" on public.meridian_legacy_source_promotions;
create policy "admins manage meridian legacy source promotions"
on public.meridian_legacy_source_promotions for all to authenticated
using (
  exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.ministry_id = meridian_legacy_source_promotions.ministry_id
      and profile.role = 'admin'
  )
  and exists (
    select 1 from public.knowledge_sources source
    where source.id = meridian_legacy_source_promotions.legacy_source_id
      and source.ministry_id = meridian_legacy_source_promotions.ministry_id
  )
)
with check (
  approved_by_user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.ministry_id = meridian_legacy_source_promotions.ministry_id
      and profile.role = 'admin'
  )
  and exists (
    select 1 from public.knowledge_sources source
    where source.id = meridian_legacy_source_promotions.legacy_source_id
      and source.ministry_id = meridian_legacy_source_promotions.ministry_id
  )
);

drop policy if exists "admins manage meridian legacy claim promotions" on public.meridian_legacy_claim_promotions;
create policy "admins manage meridian legacy claim promotions"
on public.meridian_legacy_claim_promotions for all to authenticated
using (
  exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.ministry_id = meridian_legacy_claim_promotions.ministry_id
      and profile.role = 'admin'
  )
  and exists (
    select 1 from public.knowledge_chunks chunk
    where chunk.id = meridian_legacy_claim_promotions.legacy_chunk_id
      and chunk.ministry_id = meridian_legacy_claim_promotions.ministry_id
  )
)
with check (
  approved_by_user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.ministry_id = meridian_legacy_claim_promotions.ministry_id
      and profile.role = 'admin'
  )
  and exists (
    select 1 from public.knowledge_chunks chunk
    where chunk.id = meridian_legacy_claim_promotions.legacy_chunk_id
      and chunk.ministry_id = meridian_legacy_claim_promotions.ministry_id
  )
);

grant select, insert on public.meridian_legacy_source_promotions to authenticated;
grant select, insert on public.meridian_legacy_claim_promotions to authenticated;
revoke all on public.meridian_legacy_source_promotions from anon;
revoke all on public.meridian_legacy_claim_promotions from anon;

create or replace function public.promote_legacy_meridian_claim(
  p_legacy_source_id uuid,
  p_legacy_chunk_id uuid,
  p_source_kind text,
  p_source jsonb,
  p_fragment jsonb,
  p_claim jsonb,
  p_rationale text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  legacy_source public.knowledge_sources%rowtype;
  legacy_chunk public.knowledge_chunks%rowtype;
  source_promotion public.meridian_legacy_source_promotions%rowtype;
  reviewed_source public.meridian_sources%rowtype;
  promoted_source_id uuid;
  promoted_fragment_id uuid;
  promoted_claim_id uuid := gen_random_uuid();
  reviewer_id uuid := auth.uid();
  reviewed_text text := nullif(trim(p_fragment ->> 'text'), '');
  proposition text := nullif(trim(p_claim ->> 'proposition'), '');
  source_authority text := p_source ->> 'authorityClass';
  claim_authority text := p_claim ->> 'authorityClass';
  source_visibility text := coalesce(p_source ->> 'externalVisibility', 'ministry');
  source_quote_policy text := coalesce(p_source ->> 'quotePolicy', 'review_required');
  source_sensitivity text := coalesce(p_source ->> 'sensitivity', 'internal');
  fragment_hash text;
  can_quote boolean := coalesce((p_fragment ->> 'canQuote')::boolean, false);
  can_paraphrase boolean := coalesce((p_fragment ->> 'canParaphrase')::boolean, true);
  can_cite boolean := coalesce((p_fragment ->> 'canCite')::boolean, true);
  can_use_final_answer boolean := coalesce((p_fragment ->> 'canUseFinalAnswer')::boolean, true);
  can_use_external_communication boolean := coalesce((p_fragment ->> 'canUseExternalCommunication')::boolean, false);
begin
  if p_source_kind not in ('academic_paper','curriculum_material','sermon') then
    raise exception 'Reviewed authored material must be classified as an academic paper, curriculum material, or sermon.';
  end if;

  select * into legacy_source
  from public.knowledge_sources
  where id = p_legacy_source_id
  for share;

  select * into legacy_chunk
  from public.knowledge_chunks
  where id = p_legacy_chunk_id and public.knowledge_chunks.source_id = p_legacy_source_id
  for share;

  if legacy_source.id is null or legacy_chunk.id is null then
    raise exception 'The selected legacy source excerpt is not available.';
  end if;
  if legacy_source.ministry_id <> legacy_chunk.ministry_id then
    raise exception 'The source excerpt does not belong to the source ministry.';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = reviewer_id
      and profile.ministry_id = legacy_source.ministry_id
      and profile.role = 'admin'
  ) then
    raise exception 'Only a ministry admin may approve Meridian knowledge.';
  end if;
  if reviewed_text is null or position(reviewed_text in legacy_chunk.body) = 0 then
    raise exception 'The supporting excerpt must be copied exactly from the selected source chunk.';
  end if;
  if proposition is null then
    raise exception 'An atomic claim is required.';
  end if;
  if source_authority is null or source_authority = 'none' or claim_authority is null or claim_authority = 'none' then
    raise exception 'Approval requires an explicit authority class.';
  end if;
  if source_authority = 'canonical_scripture' or claim_authority = 'canonical_scripture' or p_claim ->> 'kind' = 'scripture_text' then
    raise exception 'Canonical Scripture must come from transient YouVersion retrieval.';
  end if;
  if source_authority not in ('adopted_doctrine','approved_teaching','attributed_scholarship')
    or claim_authority not in ('adopted_doctrine','approved_teaching','attributed_scholarship') then
    raise exception 'Authored sources may be approved only as doctrine, teaching history, or attributed scholarship.';
  end if;
  if p_claim ->> 'kind' not in ('doctrinal_position','teaching_history','scholarly_perspective','interpretation','recommendation') then
    raise exception 'The selected claim kind is not valid for reviewed authored material.';
  end if;
  if can_quote and source_quote_policy <> 'allowed' then
    raise exception 'Quote permission requires the allowed quote policy.';
  end if;
  if not can_use_final_answer then
    raise exception 'This approved-generation workflow requires explicit final-answer permission.';
  end if;
  if can_use_external_communication and source_visibility <> 'external' then
    raise exception 'External-communication permission requires external source visibility.';
  end if;
  if p_claim ->> 'kind' = 'scholarly_perspective' and nullif(trim(p_claim ->> 'attribution'), '') is null then
    raise exception 'Scholarly perspectives require attribution.';
  end if;

  select * into source_promotion
  from public.meridian_legacy_source_promotions
  where ministry_id = legacy_source.ministry_id and legacy_source_id = legacy_source.id
  for update;

  if source_promotion.id is null then
    promoted_source_id := gen_random_uuid();
    insert into public.meridian_objects(id, ministry_id, object_type)
    values (promoted_source_id, legacy_source.ministry_id, 'source');

    insert into public.meridian_sources(
      id, ministry_id, source_kind, corpus_family, title, source_uri, attribution,
      authority_class, approval_status, external_visibility, quote_policy,
      generation_policy, sensitivity, origin_mode, metadata,
      approved_by_user_id, approved_at, created_by_user_id
    ) values (
      promoted_source_id,
      legacy_source.ministry_id,
      p_source_kind,
      'andrew_authored_ministry',
      coalesce(nullif(trim(p_source ->> 'title'), ''), legacy_source.title),
      legacy_source.source_uri,
      nullif(trim(p_source ->> 'attribution'), ''),
      source_authority,
      'approved',
      source_visibility,
      source_quote_policy,
      'approved_generation',
      source_sensitivity,
      'promoted',
      jsonb_build_object(
        'legacySourceId', legacy_source.id,
        'legacyVisibility', legacy_source.visibility,
        'reviewedSourceKind', p_source_kind
      ),
      reviewer_id,
      now(),
      reviewer_id
    );

    insert into public.meridian_legacy_source_promotions(
      ministry_id, legacy_source_id, meridian_source_id, source_kind,
      rationale, approved_by_user_id
    ) values (
      legacy_source.ministry_id, legacy_source.id, promoted_source_id, p_source_kind,
      coalesce(p_rationale, ''), reviewer_id
    ) returning * into source_promotion;
  else
    promoted_source_id := source_promotion.meridian_source_id;
    if source_promotion.source_kind <> p_source_kind then
      raise exception 'This source was already reviewed under a different source classification.';
    end if;
  end if;

  select * into reviewed_source
  from public.meridian_sources
  where id = promoted_source_id and ministry_id = legacy_source.ministry_id;
  if reviewed_source.id is null then
    raise exception 'The reviewed Meridian source is unavailable.';
  end if;
  source_visibility := reviewed_source.external_visibility;
  source_quote_policy := reviewed_source.quote_policy;
  source_sensitivity := reviewed_source.sensitivity;
  if can_quote and source_quote_policy <> 'allowed' then
    raise exception 'This reviewed source does not permit direct quotation.';
  end if;
  if can_use_external_communication and source_visibility <> 'external' then
    raise exception 'This reviewed source is not approved for external communication.';
  end if;

  fragment_hash := encode(extensions.digest(convert_to(reviewed_text, 'UTF8'), 'sha256'), 'hex');
  promoted_fragment_id := gen_random_uuid();
  insert into public.meridian_objects(id, ministry_id, object_type)
  values (promoted_fragment_id, legacy_source.ministry_id, 'fragment');

  insert into public.meridian_fragments(
    id, ministry_id, source_id, locator, content_hash, body_text, provenance,
    quote_policy, generation_policy, external_visibility, sensitivity,
    can_quote, can_paraphrase, can_cite, can_use_final_answer,
    can_use_external_communication, created_by_user_id
  ) values (
    promoted_fragment_id,
    legacy_source.ministry_id,
    promoted_source_id,
    coalesce(p_fragment -> 'locator', jsonb_build_object('kind','record','value',legacy_chunk.chunk_index::text)),
    fragment_hash,
    reviewed_text,
    jsonb_build_object(
      'legacySourceId', legacy_source.id,
      'legacyChunkId', legacy_chunk.id,
      'legacyChunkIndex', legacy_chunk.chunk_index,
      'reviewedBy', reviewer_id
    ),
    source_quote_policy,
    'approved_generation',
    source_visibility,
    source_sensitivity,
    can_quote,
    can_paraphrase,
    can_cite,
    can_use_final_answer,
    can_use_external_communication,
    reviewer_id
  );

  insert into public.meridian_objects(id, ministry_id, object_type)
  values (promoted_claim_id, legacy_source.ministry_id, 'claim');

  insert into public.meridian_claims(
    id, ministry_id, proposition, claim_kind, attribution, authority_class,
    approval_status, confidence, scope, derived_artifact,
    approved_by_user_id, approved_at, created_by_user_id
  ) values (
    promoted_claim_id,
    legacy_source.ministry_id,
    proposition,
    p_claim ->> 'kind',
    nullif(trim(p_claim ->> 'attribution'), ''),
    claim_authority,
    'approved',
    coalesce((p_claim ->> 'confidence')::numeric, 1),
    coalesce(p_claim -> 'scope', '{}'::jsonb),
    false,
    reviewer_id,
    now(),
    reviewer_id
  );

  insert into public.meridian_claim_fragments(ministry_id, claim_id, fragment_id)
  values (legacy_source.ministry_id, promoted_claim_id, promoted_fragment_id);

  insert into public.meridian_relationships(
    ministry_id, relationship_kind, from_object_id, to_object_id, rationale, created_by_user_id
  ) values (
    legacy_source.ministry_id, 'supports', promoted_fragment_id, promoted_claim_id,
    'Exact excerpt approved through the legacy source review workflow.', reviewer_id
  );

  insert into public.meridian_legacy_claim_promotions(
    ministry_id, source_promotion_id, legacy_chunk_id, fragment_id, claim_id,
    rationale, approved_by_user_id
  ) values (
    legacy_source.ministry_id, source_promotion.id, legacy_chunk.id, promoted_fragment_id, promoted_claim_id,
    coalesce(p_rationale, ''), reviewer_id
  );

  return jsonb_build_object(
    'sourceId', promoted_source_id,
    'fragmentId', promoted_fragment_id,
    'claimId', promoted_claim_id,
    'sourceKind', p_source_kind
  );
end;
$$;

revoke all on function public.promote_legacy_meridian_claim(uuid, uuid, text, jsonb, jsonb, jsonb, text) from public, anon;
grant execute on function public.promote_legacy_meridian_claim(uuid, uuid, text, jsonb, jsonb, jsonb, text) to authenticated;
