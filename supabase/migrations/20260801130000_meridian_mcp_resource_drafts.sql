-- MCP access is explicit and fail-closed. A platform role alone never enables
-- external-agent access, and MCP-created resources can only enter review.

create table if not exists public.meridian_mcp_access_grants (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_level text not null check (access_level in ('volunteer_creator','leader_creator','admin')),
  can_search boolean not null default true,
  can_save_drafts boolean not null default false,
  created_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (ministry_id, user_id)
);

create table if not exists public.meridian_resource_drafts (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 240),
  resource_type text not null check (resource_type in ('lesson','leader_guide','devotional','discussion_guide','activity','curriculum','sermon_support','other')),
  audience text not null check (char_length(audience) between 1 and 120),
  task_type text not null check (char_length(task_type) between 1 and 120),
  body_markdown text not null check (char_length(body_markdown) between 1 and 30000),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'submitted' check (status in ('submitted','changes_requested','approved','rejected')),
  safety_status text not null default 'review_required' check (safety_status in ('review_required','blocked','passed')),
  safety_findings jsonb not null default '[]'::jsonb check (jsonb_typeof(safety_findings) = 'array'),
  client_origin text not null default 'mcp_external_agent' check (client_origin = 'mcp_external_agent'),
  client_name text not null check (char_length(client_name) between 1 and 120),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  reviewed_by_user_id uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_notes text check (review_notes is null or char_length(review_notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, created_by_user_id, idempotency_key)
);

create table if not exists public.meridian_resource_draft_claims (
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  draft_id uuid not null references public.meridian_resource_drafts(id) on delete cascade,
  claim_id uuid not null references public.meridian_claims(id),
  created_at timestamptz not null default now(),
  primary key (draft_id, claim_id)
);

drop trigger if exists set_meridian_mcp_access_grants_updated_at on public.meridian_mcp_access_grants;
create trigger set_meridian_mcp_access_grants_updated_at
before update on public.meridian_mcp_access_grants
for each row execute function public.set_updated_at();

drop trigger if exists set_meridian_resource_drafts_updated_at on public.meridian_resource_drafts;
create trigger set_meridian_resource_drafts_updated_at
before update on public.meridian_resource_drafts
for each row execute function public.set_updated_at();

create index if not exists idx_meridian_mcp_grants_active_user
  on public.meridian_mcp_access_grants(ministry_id, user_id)
  where revoked_at is null;
create index if not exists idx_meridian_resource_drafts_review_queue
  on public.meridian_resource_drafts(ministry_id, status, created_at desc);
create index if not exists idx_meridian_resource_draft_claims_claim
  on public.meridian_resource_draft_claims(ministry_id, claim_id);

alter table public.meridian_mcp_access_grants enable row level security;
alter table public.meridian_resource_drafts enable row level security;
alter table public.meridian_resource_draft_claims enable row level security;

create policy "users read own active meridian mcp grant"
on public.meridian_mcp_access_grants for select to authenticated
using (user_id = (select auth.uid()) and revoked_at is null);

create policy "admins manage meridian mcp grants"
on public.meridian_mcp_access_grants for all to authenticated
using (exists (
  select 1 from public.profiles profile
  where profile.id = (select auth.uid()) and profile.ministry_id = meridian_mcp_access_grants.ministry_id and profile.role = 'admin'
))
with check (exists (
  select 1 from public.profiles profile
  where profile.id = (select auth.uid()) and profile.ministry_id = meridian_mcp_access_grants.ministry_id and profile.role = 'admin'
));

create policy "mcp creators insert own review-only drafts"
on public.meridian_resource_drafts for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and status = 'submitted'
  and safety_status = 'review_required'
  and reviewed_by_user_id is null
  and reviewed_at is null
  and exists (
    select 1 from public.meridian_mcp_access_grants grant_row
    where grant_row.ministry_id = meridian_resource_drafts.ministry_id
      and grant_row.user_id = (select auth.uid())
      and grant_row.revoked_at is null
      and grant_row.can_save_drafts
  )
);

create policy "creators and reviewers read meridian drafts"
on public.meridian_resource_drafts for select to authenticated
using (
  created_by_user_id = (select auth.uid())
  or exists (
    select 1 from public.meridian_mcp_access_grants grant_row
    where grant_row.ministry_id = meridian_resource_drafts.ministry_id
      and grant_row.user_id = (select auth.uid())
      and grant_row.revoked_at is null
      and grant_row.access_level in ('leader_creator','admin')
  )
);

create policy "mcp reviewers update other creators drafts"
on public.meridian_resource_drafts for update to authenticated
using (exists (
  select 1 from public.meridian_mcp_access_grants grant_row
  where grant_row.ministry_id = meridian_resource_drafts.ministry_id
    and grant_row.user_id = (select auth.uid())
    and grant_row.revoked_at is null
    and grant_row.access_level in ('leader_creator','admin')
    and (grant_row.access_level = 'admin' or meridian_resource_drafts.created_by_user_id <> (select auth.uid()))
))
with check (
  reviewed_by_user_id = (select auth.uid())
  and reviewed_at is not null
  and status in ('changes_requested','approved','rejected')
);

create policy "creators insert grounded draft claims"
on public.meridian_resource_draft_claims for insert to authenticated
with check (
  exists (
    select 1 from public.meridian_resource_drafts draft
    where draft.id = meridian_resource_draft_claims.draft_id
      and draft.ministry_id = meridian_resource_draft_claims.ministry_id
      and draft.created_by_user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.meridian_claims claim
    where claim.id = meridian_resource_draft_claims.claim_id
      and claim.ministry_id = meridian_resource_draft_claims.ministry_id
      and claim.approval_status = 'approved'
      and claim.authority_class <> 'none'
  )
);

create policy "draft readers read grounded claim links"
on public.meridian_resource_draft_claims for select to authenticated
using (exists (
  select 1 from public.meridian_resource_drafts draft
  where draft.id = meridian_resource_draft_claims.draft_id
    and draft.ministry_id = meridian_resource_draft_claims.ministry_id
));

grant select on public.meridian_mcp_access_grants to authenticated;
grant insert, update, delete on public.meridian_mcp_access_grants to authenticated;
grant select, insert on public.meridian_resource_drafts to authenticated;
grant update (status, safety_status, reviewed_by_user_id, reviewed_at, review_notes) on public.meridian_resource_drafts to authenticated;
grant select, insert on public.meridian_resource_draft_claims to authenticated;
revoke all on public.meridian_mcp_access_grants from anon;
revoke all on public.meridian_resource_drafts from anon;
revoke all on public.meridian_resource_draft_claims from anon;

create or replace function public.submit_meridian_resource_draft(
  p_ministry_id uuid,
  p_title text,
  p_resource_type text,
  p_audience text,
  p_task_type text,
  p_body_markdown text,
  p_claim_ids uuid[],
  p_client_name text,
  p_idempotency_key text,
  p_safety_findings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  draft_id uuid;
  expected_claim_count integer;
  approved_claim_count integer;
  inserted boolean := false;
begin
  if actor_id is null then raise exception 'Authentication required.'; end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_body_markdown), '') is null then raise exception 'A title and resource body are required.'; end if;
  if cardinality(p_claim_ids) is null or cardinality(p_claim_ids) < 1 or cardinality(p_claim_ids) > 32 then raise exception 'One to 32 approved claims are required.'; end if;
  if jsonb_typeof(coalesce(p_safety_findings, '[]'::jsonb)) <> 'array' then raise exception 'Safety findings must be an array.'; end if;
  if not exists (
    select 1 from public.meridian_mcp_access_grants grant_row
    where grant_row.ministry_id = p_ministry_id and grant_row.user_id = actor_id
      and grant_row.revoked_at is null and grant_row.can_save_drafts
  ) then raise exception 'Meridian MCP draft access is not granted.'; end if;

  select count(*) into expected_claim_count
  from (select distinct claim_id from unnest(p_claim_ids) claim_id) distinct_claims;
  select count(*) into approved_claim_count
  from public.meridian_claims claim
  where claim.ministry_id = p_ministry_id and claim.id = any(p_claim_ids)
    and claim.approval_status = 'approved' and claim.authority_class <> 'none';
  if approved_claim_count <> expected_claim_count then raise exception 'Every cited claim must be approved and in ministry scope.'; end if;

  insert into public.meridian_resource_drafts(
    ministry_id, created_by_user_id, title, resource_type, audience, task_type, body_markdown,
    content_hash, status, safety_status, safety_findings, client_name, idempotency_key
  ) values (
    p_ministry_id, actor_id, trim(p_title), p_resource_type, trim(p_audience), trim(p_task_type), trim(p_body_markdown),
    encode(extensions.digest(convert_to(trim(p_body_markdown), 'UTF8'), 'sha256'), 'hex'),
    'submitted', 'review_required', coalesce(p_safety_findings, '[]'::jsonb), trim(p_client_name), trim(p_idempotency_key)
  )
  on conflict (ministry_id, created_by_user_id, idempotency_key) do nothing
  returning id into draft_id;

  if draft_id is not null then
    inserted := true;
    insert into public.meridian_resource_draft_claims(ministry_id, draft_id, claim_id)
    select p_ministry_id, draft_id, claim_id
    from (select distinct claim_id from unnest(p_claim_ids) claim_id) distinct_claims;
  else
    select draft.id into draft_id
    from public.meridian_resource_drafts draft
    where draft.ministry_id = p_ministry_id and draft.created_by_user_id = actor_id
      and draft.idempotency_key = trim(p_idempotency_key);
  end if;

  return jsonb_build_object(
    'id', draft_id,
    'status', 'submitted',
    'safetyStatus', 'review_required',
    'idempotentReplay', not inserted
  );
end;
$$;

revoke all on function public.submit_meridian_resource_draft(uuid, text, text, text, text, text, uuid[], text, text, jsonb) from public, anon;
grant execute on function public.submit_meridian_resource_draft(uuid, text, text, text, text, text, uuid[], text, text, jsonb) to authenticated;
