-- Adds the private-discovery boundary for the platform MCP. Vault reads remain
-- local to the user's Codex process. The hosted platform stores only opaque
-- source references and content hashes after a transient leakage check.

alter table public.meridian_mcp_access_grants
  add column if not exists can_submit_candidates boolean not null default false;

alter table public.meridian_mcp_resource_bundles
  add column if not exists private_discovery_status text not null default 'not_used'
    check (private_discovery_status in ('not_used','passed'));

alter table public.meridian_candidates
  drop constraint if exists meridian_candidates_raw_text_hash_matches;
alter table public.meridian_candidates
  add constraint meridian_candidates_raw_text_hash_matches
  check (
    content_hash = encode(extensions.digest(convert_to(trim(raw_text), 'UTF8'), 'sha256'), 'hex')
  ) not valid;

create table if not exists public.meridian_mcp_bundle_private_provenance (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  bundle_id uuid not null references public.meridian_mcp_resource_bundles(id) on delete cascade,
  source_reference text not null check (char_length(source_reference) between 8 and 128),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  check_status text not null default 'passed' check (check_status = 'passed'),
  checked_at timestamptz not null default now(),
  unique (bundle_id, source_reference, content_hash)
);

create index if not exists idx_mcp_bundle_private_provenance_bundle
  on public.meridian_mcp_bundle_private_provenance(ministry_id, bundle_id);

alter table public.meridian_mcp_bundle_private_provenance enable row level security;

drop policy if exists "mcp creators insert own resource bundles" on public.meridian_mcp_resource_bundles;
create policy "mcp creators insert own resource bundles"
on public.meridian_mcp_resource_bundles for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and status = 'creating'
  and emma_status = 'not_reviewed'
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

create policy "mcp creators insert passed private provenance"
on public.meridian_mcp_bundle_private_provenance for insert to authenticated
with check (
  check_status = 'passed'
  and exists (
    select 1 from public.meridian_mcp_resource_bundles bundle
    join public.meridian_mcp_access_grants grant_row
      on grant_row.ministry_id = bundle.ministry_id
     and grant_row.user_id = (select auth.uid())
     and grant_row.revoked_at is null
     and grant_row.can_save_resources
    where bundle.id = meridian_mcp_bundle_private_provenance.bundle_id
      and bundle.ministry_id = meridian_mcp_bundle_private_provenance.ministry_id
      and bundle.created_by_user_id = (select auth.uid())
      and bundle.status = 'creating'
      and bundle.emma_status = 'not_reviewed'
  )
);

create policy "resource bundle readers read private provenance"
on public.meridian_mcp_bundle_private_provenance for select to authenticated
using (exists (
  select 1 from public.meridian_mcp_resource_bundles bundle
  where bundle.id = meridian_mcp_bundle_private_provenance.bundle_id
    and bundle.ministry_id = meridian_mcp_bundle_private_provenance.ministry_id
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

drop policy if exists "mcp users submit own discovery candidates" on public.meridian_candidates;
create policy "mcp users submit own discovery candidates"
on public.meridian_candidates for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and source_kind = 'obsidian_note'
  and authority_class = 'none'
  and approval_status = 'unreviewed'
  and quote_policy = 'never'
  and generation_policy = 'discovery_only'
  and external_visibility = 'private'
  and sensitivity = 'internal'
  and source_uri ~ '^obsidian-private://[a-zA-Z0-9._:-]{8,128}$'
  and char_length(trim(raw_text)) between 1 and 60000
  and metadata ->> 'objectType' in ('passage','doctrine','formation','question')
  and metadata ->> 'privateDiscoveryExplicitSubmission' = 'true'
  and exists (
    select 1 from public.meridian_mcp_access_grants grant_row
    where grant_row.ministry_id = meridian_candidates.ministry_id
      and grant_row.user_id = (select auth.uid())
      and grant_row.revoked_at is null
      and grant_row.can_submit_candidates
      and grant_row.access_level in ('leader_creator','admin')
  )
);

drop policy if exists "mcp users read own discovery candidates" on public.meridian_candidates;
create policy "mcp users read own discovery candidates"
on public.meridian_candidates for select to authenticated
using (
  created_by_user_id = (select auth.uid())
  and exists (
    select 1 from public.meridian_mcp_access_grants grant_row
    where grant_row.ministry_id = meridian_candidates.ministry_id
      and grant_row.user_id = (select auth.uid())
      and grant_row.revoked_at is null
      and grant_row.can_submit_candidates
  )
);

grant select, insert on public.meridian_mcp_bundle_private_provenance to authenticated;
grant update (status, private_discovery_status) on public.meridian_mcp_resource_bundles to authenticated;
revoke all on public.meridian_mcp_bundle_private_provenance from anon;

create or replace function public.submit_meridian_private_discovery_candidate(
  p_ministry_id uuid,
  p_title text,
  p_source_reference text,
  p_raw_text text,
  p_content_hash text,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  candidate_id uuid;
  inserted boolean := false;
  calculated_hash text;
begin
  if actor_id is null then raise exception 'Authentication required.'; end if;
  if nullif(trim(p_title), '') is null or char_length(trim(p_title)) > 240 then raise exception 'Candidate title is invalid.'; end if;
  if nullif(trim(p_raw_text), '') is null or char_length(trim(p_raw_text)) > 60000 then raise exception 'Candidate text is invalid.'; end if;
  if p_source_reference !~ '^[a-zA-Z0-9._:-]{8,128}$' then raise exception 'Private source reference is invalid.'; end if;
  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then raise exception 'Candidate metadata must be an object.'; end if;
  if not exists (
    select 1 from public.meridian_mcp_access_grants grant_row
    where grant_row.ministry_id = p_ministry_id
      and grant_row.user_id = actor_id
      and grant_row.revoked_at is null
      and grant_row.can_submit_candidates
      and grant_row.access_level in ('leader_creator','admin')
  ) then raise exception 'Meridian candidate submission is not granted.'; end if;

  calculated_hash := encode(extensions.digest(convert_to(trim(p_raw_text), 'UTF8'), 'sha256'), 'hex');
  if calculated_hash <> lower(trim(p_content_hash)) then raise exception 'Candidate content hash does not match the submitted text.'; end if;

  insert into public.meridian_candidates(
    ministry_id, title, source_uri, raw_text, content_hash, sensitivity, metadata, created_by_user_id
  ) values (
    p_ministry_id,
    trim(p_title),
    'obsidian-private://' || p_source_reference,
    trim(p_raw_text),
    calculated_hash,
    'internal',
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'privateDiscoveryExplicitSubmission', true,
      'privateSourceReference', p_source_reference,
      'submissionVersion', 1
    ),
    actor_id
  )
  on conflict (ministry_id, content_hash) do nothing
  returning id into candidate_id;

  if candidate_id is not null then
    inserted := true;
  else
    select candidate.id into candidate_id
    from public.meridian_candidates candidate
    where candidate.ministry_id = p_ministry_id
      and candidate.content_hash = calculated_hash
      and candidate.created_by_user_id = actor_id;
    if candidate_id is null then raise exception 'This material has already been nominated by another ministry user.'; end if;
  end if;

  return jsonb_build_object(
    'id', candidate_id,
    'approvalStatus', 'unreviewed',
    'quotePolicy', 'never',
    'reviewRequired', true,
    'idempotentReplay', not inserted
  );
end;
$$;

revoke all on function public.submit_meridian_private_discovery_candidate(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.submit_meridian_private_discovery_candidate(uuid, text, text, text, text, jsonb) to authenticated;
