-- Additive governed Meridian primitive knowledge architecture.
-- Legacy knowledge_sources/knowledge_chunks remain available as a compatibility
-- fallback while content is explicitly reviewed and promoted into this model.

create extension if not exists pgcrypto;

create table if not exists public.meridian_objects (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  object_type text not null check (object_type in ('source','fragment','claim','context','guardrail')),
  created_at timestamptz not null default now(),
  unique (ministry_id, id)
);

create table if not exists public.meridian_sources (
  id uuid primary key,
  ministry_id uuid not null,
  source_kind text not null check (source_kind in ('sermon','academic_paper','curriculum_material','scholarly_work','church_policy','doctrine','strategy','obsidian_note','operational_record','scripture','ai_draft')),
  corpus_family text not null check (corpus_family in ('canonical_scripture','approved_church','andrew_authored_ministry','attributed_scholarship','operational_evidence','private_discovery','derived_artifact')),
  title text not null check (char_length(title) between 1 and 240),
  source_uri text,
  attribution text,
  authority_class text not null check (authority_class in ('canonical_scripture','approved_policy','adopted_doctrine','current_strategy','approved_teaching','attributed_scholarship','operational_evidence','none')),
  approval_status text not null default 'unreviewed' check (approval_status in ('unreviewed','in_review','approved','rejected','disputed','superseded')),
  external_visibility text not null default 'private' check (external_visibility in ('private','ministry','external')),
  quote_policy text not null default 'never' check (quote_policy in ('never','review_required','allowed')),
  generation_policy text not null default 'discovery_only' check (generation_policy in ('discovery_only','approved_generation','prohibited')),
  sensitivity text not null default 'internal' check (sensitivity in ('general','internal','pastoral','person_specific','safeguarding')),
  origin_mode text not null default 'direct' check (origin_mode in ('direct','candidate','promoted')),
  metadata jsonb not null default '{}'::jsonb,
  approved_by_user_id uuid references public.profiles(id),
  approved_at timestamptz,
  created_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ministry_id, id) references public.meridian_objects(ministry_id, id) on delete restrict,
  unique (ministry_id, id),
  check (approval_status <> 'approved' or (approved_by_user_id is not null and approved_at is not null and authority_class <> 'none')),
  check (
    source_kind <> 'obsidian_note'
    or origin_mode = 'promoted'
    or (
      approval_status = 'unreviewed'
      and authority_class = 'none'
      and quote_policy = 'never'
      and generation_policy = 'discovery_only'
      and external_visibility = 'private'
    )
  ),
  check (source_kind <> 'ai_draft' or (authority_class = 'none' and approval_status <> 'approved')),
  check (source_kind not in ('sermon','academic_paper','curriculum_material') or corpus_family = 'andrew_authored_ministry'),
  check (source_kind <> 'scholarly_work' or corpus_family = 'attributed_scholarship'),
  check (source_kind <> 'obsidian_note' or corpus_family = 'private_discovery'),
  check (source_kind <> 'operational_record' or corpus_family = 'operational_evidence'),
  check (source_kind <> 'ai_draft' or corpus_family = 'derived_artifact'),
  check (source_kind <> 'scripture' or authority_class = 'canonical_scripture'),
  check (source_kind <> 'scripture' or corpus_family = 'canonical_scripture'),
  check (authority_class <> 'canonical_scripture' or source_kind = 'scripture')
);

create table if not exists public.meridian_fragments (
  id uuid primary key,
  ministry_id uuid not null,
  source_id uuid not null,
  locator jsonb not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  body_text text not null default '',
  provenance jsonb not null default '{}'::jsonb,
  quote_policy text not null default 'never' check (quote_policy in ('never','review_required','allowed')),
  generation_policy text not null default 'discovery_only' check (generation_policy in ('discovery_only','approved_generation','prohibited')),
  external_visibility text not null default 'private' check (external_visibility in ('private','ministry','external')),
  sensitivity text not null default 'internal' check (sensitivity in ('general','internal','pastoral','person_specific','safeguarding')),
  can_quote boolean not null default false,
  can_paraphrase boolean not null default false,
  can_cite boolean not null default false,
  can_use_final_answer boolean not null default false,
  can_use_external_communication boolean not null default false,
  created_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (ministry_id, id) references public.meridian_objects(ministry_id, id) on delete restrict,
  foreign key (ministry_id, source_id) references public.meridian_sources(ministry_id, id) on delete restrict,
  unique (ministry_id, id),
  unique (ministry_id, source_id, content_hash),
  check (generation_policy <> 'discovery_only' or not can_use_final_answer),
  check (quote_policy = 'allowed' or not can_quote),
  check (external_visibility <> 'private' or not can_use_external_communication),
  check (sensitivity not in ('pastoral','person_specific') or (not can_use_final_answer and not can_use_external_communication))
);

create table if not exists public.meridian_claims (
  id uuid primary key,
  ministry_id uuid not null,
  proposition text not null check (char_length(proposition) between 1 and 2000),
  claim_kind text not null check (claim_kind in ('scripture_text','doctrinal_position','policy_rule','strategy_priority','teaching_history','scholarly_perspective','operational_observation','interpretation','recommendation','draft')),
  attribution text,
  authority_class text not null check (authority_class in ('canonical_scripture','approved_policy','adopted_doctrine','current_strategy','approved_teaching','attributed_scholarship','operational_evidence','none')),
  approval_status text not null default 'unreviewed' check (approval_status in ('unreviewed','in_review','approved','rejected','disputed','superseded')),
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  scope jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (
    to_tsvector('english'::regconfig,
      coalesce(proposition, '') || ' ' || coalesce(attribution, '') || ' ' ||
      coalesce(scope ->> 'topics', '') || ' ' || coalesce(scope ->> 'scriptureReferences', '')
    )
  ) stored,
  derived_artifact boolean not null default false,
  approved_by_user_id uuid references public.profiles(id),
  approved_at timestamptz,
  created_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ministry_id, id) references public.meridian_objects(ministry_id, id) on delete restrict,
  unique (ministry_id, id),
  check (approval_status <> 'approved' or (approved_by_user_id is not null and approved_at is not null and authority_class <> 'none')),
  check (not derived_artifact or (authority_class = 'none' and approval_status <> 'approved')),
  check (claim_kind <> 'scholarly_perspective' or nullif(trim(attribution), '') is not null)
);

create table if not exists public.meridian_contexts (
  id uuid primary key,
  ministry_id uuid not null,
  ministry_label text,
  audience text,
  task_type text,
  tradition text,
  sensitivity text not null default 'general' check (sensitivity in ('general','internal','pastoral','person_specific','safeguarding')),
  valid_from timestamptz,
  valid_until timestamptz,
  created_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (ministry_id, id) references public.meridian_objects(ministry_id, id) on delete restrict,
  unique (ministry_id, id),
  check (valid_until is null or valid_from is null or valid_until > valid_from)
);

create table if not exists public.meridian_guardrails (
  id uuid primary key,
  ministry_id uuid not null,
  name text not null check (char_length(name) between 1 and 180),
  category text not null check (category in ('access','authority','quoting','theological','privacy','generation')),
  enforcement text not null check (enforcement in ('block','require_review','warn')),
  rule jsonb not null,
  active boolean not null default true,
  created_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ministry_id, id) references public.meridian_objects(ministry_id, id) on delete restrict,
  unique (ministry_id, id)
);

create table if not exists public.meridian_relationships (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  relationship_kind text not null check (relationship_kind in ('supports','derived_from','interprets','contradicts','qualifies','agrees_with','applies_to','not_applicable_to','supersedes','approved_by','requires','prohibited_by','uses_scripture')),
  from_object_id uuid not null,
  to_object_id uuid not null,
  rationale text,
  created_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (ministry_id, from_object_id) references public.meridian_objects(ministry_id, id) on delete restrict,
  foreign key (ministry_id, to_object_id) references public.meridian_objects(ministry_id, id) on delete restrict,
  unique (ministry_id, relationship_kind, from_object_id, to_object_id),
  check (from_object_id <> to_object_id)
);

create table if not exists public.meridian_claim_fragments (
  ministry_id uuid not null references public.ministries(id),
  claim_id uuid not null,
  fragment_id uuid not null,
  support_role text not null default 'supports' check (support_role in ('supports','qualifies','contradicts')),
  created_at timestamptz not null default now(),
  primary key (claim_id, fragment_id),
  foreign key (ministry_id, claim_id) references public.meridian_claims(ministry_id, id) on delete restrict,
  foreign key (ministry_id, fragment_id) references public.meridian_fragments(ministry_id, id) on delete restrict
);

create table if not exists public.meridian_candidates (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  source_kind text not null default 'obsidian_note' check (source_kind = 'obsidian_note'),
  title text not null check (char_length(title) between 1 and 240),
  source_uri text,
  raw_text text not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  authority_class text not null default 'none' check (authority_class = 'none'),
  approval_status text not null default 'unreviewed' check (approval_status in ('unreviewed','in_review','rejected','promoted')),
  quote_policy text not null default 'never' check (quote_policy = 'never'),
  generation_policy text not null default 'discovery_only' check (generation_policy = 'discovery_only'),
  external_visibility text not null default 'private' check (external_visibility = 'private'),
  sensitivity text not null default 'internal' check (sensitivity in ('internal','pastoral','person_specific','safeguarding')),
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  reviewed_by_user_id uuid references public.profiles(id),
  reviewed_at timestamptz,
  promoted_source_id uuid,
  unique (ministry_id, id),
  unique (ministry_id, content_hash),
  foreign key (ministry_id, promoted_source_id) references public.meridian_sources(ministry_id, id) on delete restrict
);

create table if not exists public.meridian_review_events (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  candidate_id uuid not null,
  decision text not null check (decision in ('started_review','rejected','promoted')),
  rationale text not null default '',
  reviewed_by_user_id uuid not null references public.profiles(id),
  source_id uuid,
  claim_id uuid,
  created_at timestamptz not null default now(),
  foreign key (ministry_id, candidate_id) references public.meridian_candidates(ministry_id, id) on delete restrict,
  foreign key (ministry_id, source_id) references public.meridian_sources(ministry_id, id) on delete restrict,
  foreign key (ministry_id, claim_id) references public.meridian_claims(ministry_id, id) on delete restrict
);

create table if not exists public.meridian_answer_traces (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  task_context jsonb not null,
  claim_ids uuid[] not null default '{}',
  fragment_ids uuid[] not null default '{}',
  response_contract jsonb not null,
  conflict_decisions jsonb not null default '[]'::jsonb,
  leakage_check text not null check (leakage_check in ('passed','blocked','review_required')),
  derived_approval_status text not null default 'unreviewed' check (derived_approval_status in ('unreviewed','in_review','approved','rejected')),
  created_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.meridian_provider_traces (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  answer_trace_id uuid not null references public.meridian_answer_traces(id) on delete restrict,
  provider text not null,
  model text not null,
  provider_request_id text,
  status text not null check (status in ('completed','failed','fallback')),
  fallback_reason text,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_meridian_objects_ministry_type on public.meridian_objects(ministry_id, object_type);
create index if not exists idx_meridian_sources_generation on public.meridian_sources(ministry_id, approval_status, generation_policy, authority_class);
create index if not exists idx_meridian_fragments_source on public.meridian_fragments(ministry_id, source_id);
create index if not exists idx_meridian_claims_generation on public.meridian_claims(ministry_id, approval_status, authority_class);
create index if not exists idx_meridian_claims_search on public.meridian_claims using gin(search_vector);
create index if not exists idx_meridian_relationships_from on public.meridian_relationships(ministry_id, from_object_id, relationship_kind);
create index if not exists idx_meridian_relationships_to on public.meridian_relationships(ministry_id, to_object_id, relationship_kind);
create index if not exists idx_meridian_candidates_review on public.meridian_candidates(ministry_id, approval_status, created_at);
create index if not exists idx_meridian_answer_traces_creator on public.meridian_answer_traces(ministry_id, created_by_user_id, created_at desc);

create or replace function public.search_meridian_approved_claims(
  p_ministry_id uuid,
  p_query_text text,
  p_task_type text,
  p_audience text,
  p_match_count integer default 32
)
returns table (
  id uuid,
  ministry_id uuid,
  proposition text,
  claim_kind text,
  attribution text,
  authority_class text,
  approval_status text,
  confidence numeric,
  scope jsonb,
  derived_artifact boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    claim.id,
    claim.ministry_id,
    claim.proposition,
    claim.claim_kind,
    claim.attribution,
    claim.authority_class,
    claim.approval_status,
    claim.confidence,
    claim.scope,
    claim.derived_artifact
  from public.meridian_claims claim
  where claim.ministry_id = p_ministry_id
    and claim.approval_status = 'approved'
    and claim.authority_class <> 'none'
    and case
      when jsonb_typeof(claim.scope -> 'taskTypes') = 'array'
        then jsonb_array_length(claim.scope -> 'taskTypes') = 0 or claim.scope -> 'taskTypes' ? p_task_type
      else true
    end
    and case
      when jsonb_typeof(claim.scope -> 'audience') = 'array'
        then jsonb_array_length(claim.scope -> 'audience') = 0 or claim.scope -> 'audience' ? p_audience
      else true
    end
  order by
    case
      when nullif(trim(p_query_text), '') is null then 0
      when claim.search_vector @@ websearch_to_tsquery('english'::regconfig, p_query_text) then 1
      else 0
    end desc,
    case claim.authority_class
      when 'canonical_scripture' then 1
      when 'approved_policy' then 2
      when 'adopted_doctrine' then 3
      when 'current_strategy' then 4
      when 'approved_teaching' then 5
      when 'attributed_scholarship' then 6
      when 'operational_evidence' then 7
      else 8
    end,
    case
      when nullif(trim(p_query_text), '') is null then 0
      else ts_rank_cd(claim.search_vector, websearch_to_tsquery('english'::regconfig, p_query_text))
    end desc,
    claim.confidence desc,
    claim.id
  limit least(greatest(p_match_count, 1), 64);
$$;

create or replace function public.meridian_fragment_is_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Meridian fragments are immutable; append a replacement fragment and supersedes relationship.';
end;
$$;

drop trigger if exists protect_meridian_fragment_immutability on public.meridian_fragments;
create trigger protect_meridian_fragment_immutability
before update or delete on public.meridian_fragments
for each row execute function public.meridian_fragment_is_immutable();

create or replace function public.meridian_reject_persisted_scripture_text()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.body_text <> '' and exists (
    select 1 from public.meridian_sources source
    where source.id = new.source_id and source.ministry_id = new.ministry_id and source.source_kind = 'scripture'
  ) then
    raise exception 'YouVersion Scripture text must remain transient; persist locator and provenance only.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_persisted_scripture_text on public.meridian_fragments;
create trigger prevent_persisted_scripture_text
before insert on public.meridian_fragments
for each row execute function public.meridian_reject_persisted_scripture_text();

alter table public.meridian_objects enable row level security;
alter table public.meridian_sources enable row level security;
alter table public.meridian_fragments enable row level security;
alter table public.meridian_claims enable row level security;
alter table public.meridian_contexts enable row level security;
alter table public.meridian_guardrails enable row level security;
alter table public.meridian_relationships enable row level security;
alter table public.meridian_claim_fragments enable row level security;
alter table public.meridian_candidates enable row level security;
alter table public.meridian_review_events enable row level security;
alter table public.meridian_answer_traces enable row level security;
alter table public.meridian_provider_traces enable row level security;

-- Strict tenant predicate: no fallback ministry is used for governed knowledge.
create policy "admins manage meridian objects" on public.meridian_objects for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_objects.ministry_id and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_objects.ministry_id and p.role = 'admin'));

create policy "admins manage meridian sources" on public.meridian_sources for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_sources.ministry_id and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_sources.ministry_id and p.role = 'admin'));
create policy "leaders read approved meridian sources" on public.meridian_sources for select to authenticated
using (approval_status = 'approved' and generation_policy = 'approved_generation' and external_visibility <> 'private' and sensitivity not in ('pastoral','person_specific') and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_sources.ministry_id and p.role in ('admin','leader','staff')));

create policy "admins insert meridian fragments" on public.meridian_fragments for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_fragments.ministry_id and p.role = 'admin'));
create policy "admins read meridian fragments" on public.meridian_fragments for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_fragments.ministry_id and p.role = 'admin'));
create policy "leaders read approved meridian fragments" on public.meridian_fragments for select to authenticated
using (generation_policy = 'approved_generation' and can_use_final_answer and external_visibility <> 'private' and sensitivity not in ('pastoral','person_specific') and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_fragments.ministry_id and p.role in ('admin','leader','staff')) and exists (select 1 from public.meridian_sources s where s.id = meridian_fragments.source_id and s.ministry_id = meridian_fragments.ministry_id and s.approval_status = 'approved' and s.generation_policy = 'approved_generation'));

create policy "admins manage meridian claims" on public.meridian_claims for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_claims.ministry_id and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_claims.ministry_id and p.role = 'admin'));
create policy "leaders read approved meridian claims" on public.meridian_claims for select to authenticated
using (approval_status = 'approved' and authority_class <> 'none' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_claims.ministry_id and p.role in ('admin','leader','staff')));

create policy "admins manage meridian contexts" on public.meridian_contexts for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_contexts.ministry_id and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_contexts.ministry_id and p.role = 'admin'));
create policy "leaders read meridian contexts" on public.meridian_contexts for select to authenticated
using (sensitivity not in ('pastoral','person_specific') and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_contexts.ministry_id and p.role in ('admin','leader','staff')));

create policy "admins manage meridian guardrails" on public.meridian_guardrails for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_guardrails.ministry_id and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_guardrails.ministry_id and p.role = 'admin'));
create policy "leaders read active meridian guardrails" on public.meridian_guardrails for select to authenticated
using (active and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_guardrails.ministry_id and p.role in ('admin','leader','staff')));

create policy "admins manage meridian relationships" on public.meridian_relationships for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_relationships.ministry_id and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_relationships.ministry_id and p.role = 'admin'));
create policy "leaders read meridian relationships" on public.meridian_relationships for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_relationships.ministry_id and p.role in ('admin','leader','staff')));

create policy "admins manage meridian claim fragments" on public.meridian_claim_fragments for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_claim_fragments.ministry_id and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_claim_fragments.ministry_id and p.role = 'admin'));
create policy "leaders read meridian claim fragments" on public.meridian_claim_fragments for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_claim_fragments.ministry_id and p.role in ('admin','leader','staff')));

create policy "admins manage meridian candidates" on public.meridian_candidates for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_candidates.ministry_id and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_candidates.ministry_id and p.role = 'admin'));
create policy "admins read meridian review events" on public.meridian_review_events for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_review_events.ministry_id and p.role = 'admin'));
create policy "admins insert meridian review events" on public.meridian_review_events for insert to authenticated
with check (reviewed_by_user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_review_events.ministry_id and p.role = 'admin'));

create policy "users insert own meridian answer traces" on public.meridian_answer_traces for insert to authenticated
with check (created_by_user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_answer_traces.ministry_id and p.role in ('admin','leader','staff')));
create policy "users read own meridian answer traces" on public.meridian_answer_traces for select to authenticated
using ((created_by_user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = meridian_answer_traces.ministry_id and p.role = 'admin')));
create policy "users insert provider traces for own answer" on public.meridian_provider_traces for insert to authenticated
with check (exists (select 1 from public.meridian_answer_traces a where a.id = meridian_provider_traces.answer_trace_id and a.ministry_id = meridian_provider_traces.ministry_id and a.created_by_user_id = (select auth.uid())));
create policy "users read provider traces for own answer" on public.meridian_provider_traces for select to authenticated
using (exists (select 1 from public.meridian_answer_traces a where a.id = meridian_provider_traces.answer_trace_id and a.ministry_id = meridian_provider_traces.ministry_id and (a.created_by_user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ministry_id = a.ministry_id and p.role = 'admin'))));

grant select, insert, update, delete on public.meridian_objects to authenticated;
grant select, insert, update, delete on public.meridian_sources to authenticated;
grant select, insert on public.meridian_fragments to authenticated;
grant select, insert, update, delete on public.meridian_claims to authenticated;
grant select, insert, update, delete on public.meridian_contexts to authenticated;
grant select, insert, update, delete on public.meridian_guardrails to authenticated;
grant select, insert, update, delete on public.meridian_relationships to authenticated;
grant select, insert, update, delete on public.meridian_claim_fragments to authenticated;
grant select, insert, update, delete on public.meridian_candidates to authenticated;
grant select on public.meridian_review_events to authenticated;
grant select, insert on public.meridian_answer_traces to authenticated;
grant select, insert on public.meridian_provider_traces to authenticated;
revoke all on public.meridian_candidates from anon;
revoke all on public.meridian_review_events from anon;
revoke update, delete, truncate, trigger on public.meridian_fragments from authenticated;

create or replace function public.promote_meridian_candidate(
  p_candidate_id uuid,
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
  candidate public.meridian_candidates%rowtype;
  source_id uuid := gen_random_uuid();
  fragment_id uuid := gen_random_uuid();
  claim_id uuid := gen_random_uuid();
  reviewer_id uuid := auth.uid();
  reviewed_text text := nullif(trim(p_fragment ->> 'text'), '');
  source_authority text := p_source ->> 'authorityClass';
  claim_authority text := p_claim ->> 'authorityClass';
begin
  select * into candidate
  from public.meridian_candidates
  where id = p_candidate_id and approval_status in ('unreviewed','in_review')
  for update;

  if candidate.id is null then raise exception 'Candidate is not available for promotion.'; end if;
  if not exists (select 1 from public.profiles p where p.id = reviewer_id and p.ministry_id = candidate.ministry_id and p.role = 'admin') then
    raise exception 'Only a ministry admin may promote Meridian knowledge.';
  end if;
  if reviewed_text is null then raise exception 'Reviewed fragment text is required.'; end if;
  if source_authority is null or source_authority = 'none' or claim_authority is null or claim_authority = 'none' then
    raise exception 'Promotion requires an explicit approved authority class.';
  end if;
  if source_authority = 'canonical_scripture' or claim_authority = 'canonical_scripture' or p_claim ->> 'kind' = 'scripture_text' then
    raise exception 'Canonical Scripture must come from transient YouVersion retrieval, not Obsidian promotion.';
  end if;

  insert into public.meridian_objects(id, ministry_id, object_type) values
    (source_id, candidate.ministry_id, 'source'),
    (fragment_id, candidate.ministry_id, 'fragment'),
    (claim_id, candidate.ministry_id, 'claim');

  insert into public.meridian_sources(
    id, ministry_id, source_kind, corpus_family, title, source_uri, attribution, authority_class, approval_status,
    external_visibility, quote_policy, generation_policy, sensitivity, origin_mode, metadata,
    approved_by_user_id, approved_at, created_by_user_id
  ) values (
    source_id, candidate.ministry_id, 'obsidian_note', 'private_discovery', coalesce(nullif(trim(p_source ->> 'title'), ''), candidate.title),
    candidate.source_uri, nullif(trim(p_source ->> 'attribution'), ''), source_authority, 'approved',
    coalesce(p_source ->> 'externalVisibility', 'ministry'), coalesce(p_source ->> 'quotePolicy', 'review_required'),
    'approved_generation', coalesce(p_source ->> 'sensitivity', 'internal'), 'promoted',
    jsonb_build_object('candidateId', candidate.id, 'candidateHash', candidate.content_hash), reviewer_id, now(), reviewer_id
  );

  insert into public.meridian_fragments(
    id, ministry_id, source_id, locator, content_hash, body_text, provenance, quote_policy, generation_policy,
    external_visibility, sensitivity, can_quote, can_paraphrase, can_cite, can_use_final_answer,
    can_use_external_communication, created_by_user_id
  ) values (
    fragment_id, candidate.ministry_id, source_id, coalesce(p_fragment -> 'locator', jsonb_build_object('kind','note_block','value','reviewed promotion')),
    encode(extensions.digest(convert_to(reviewed_text, 'UTF8'), 'sha256'), 'hex'), reviewed_text,
    jsonb_build_object('derivedFromCandidateId', candidate.id, 'candidateHash', candidate.content_hash, 'reviewedBy', reviewer_id),
    coalesce(p_source ->> 'quotePolicy', 'review_required'), 'approved_generation',
    coalesce(p_source ->> 'externalVisibility', 'ministry'), coalesce(p_source ->> 'sensitivity', 'internal'),
    coalesce((p_fragment ->> 'canQuote')::boolean, false), coalesce((p_fragment ->> 'canParaphrase')::boolean, true),
    coalesce((p_fragment ->> 'canCite')::boolean, true), coalesce((p_fragment ->> 'canUseFinalAnswer')::boolean, true),
    coalesce((p_fragment ->> 'canUseExternalCommunication')::boolean, false), reviewer_id
  );

  insert into public.meridian_claims(
    id, ministry_id, proposition, claim_kind, attribution, authority_class, approval_status, confidence, scope,
    derived_artifact, approved_by_user_id, approved_at, created_by_user_id
  ) values (
    claim_id, candidate.ministry_id, p_claim ->> 'proposition', p_claim ->> 'kind', nullif(trim(p_claim ->> 'attribution'), ''),
    claim_authority, 'approved', coalesce((p_claim ->> 'confidence')::numeric, 1), coalesce(p_claim -> 'scope', '{}'::jsonb),
    false, reviewer_id, now(), reviewer_id
  );

  insert into public.meridian_claim_fragments(ministry_id, claim_id, fragment_id)
  values (candidate.ministry_id, claim_id, fragment_id);
  insert into public.meridian_relationships(ministry_id, relationship_kind, from_object_id, to_object_id, rationale, created_by_user_id)
  values (candidate.ministry_id, 'supports', fragment_id, claim_id, 'Explicitly reviewed support during candidate promotion.', reviewer_id);

  update public.meridian_candidates set
    approval_status = 'promoted', reviewed_by_user_id = reviewer_id, reviewed_at = now(), promoted_source_id = source_id
  where id = candidate.id;
  insert into public.meridian_review_events(ministry_id, candidate_id, decision, rationale, reviewed_by_user_id, source_id, claim_id)
  values (candidate.ministry_id, candidate.id, 'promoted', coalesce(p_rationale, ''), reviewer_id, source_id, claim_id);

  return jsonb_build_object('sourceId', source_id, 'fragmentId', fragment_id, 'claimId', claim_id);
end;
$$;

revoke all on function public.promote_meridian_candidate(uuid, jsonb, jsonb, jsonb, text) from public, anon;
grant execute on function public.promote_meridian_candidate(uuid, jsonb, jsonb, jsonb, text) to authenticated;
revoke all on function public.search_meridian_approved_claims(uuid, text, text, text, integer) from public, anon;
grant execute on function public.search_meridian_approved_claims(uuid, text, text, text, integer) to authenticated;
