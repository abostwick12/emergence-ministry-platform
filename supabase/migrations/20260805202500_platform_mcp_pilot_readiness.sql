-- Adds the controlled Phase 6 MCP pilot gate, payload-free operational metrics,
-- and categorical human feedback. Nothing is enrolled or enabled by default.

alter table public.meridian_mcp_access_grants
  add column if not exists pilot_stage text not null default 'not_enrolled'
    check (pilot_stage in ('not_enrolled','admin_pilot','leader_pilot')),
  add column if not exists pilot_enrolled_at timestamptz,
  add column if not exists pilot_enrolled_by_user_id uuid references public.profiles(id) on delete set null;

create table if not exists public.meridian_mcp_pilot_cohort_events (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  previous_stage text not null check (previous_stage in ('not_enrolled','admin_pilot','leader_pilot')),
  new_stage text not null check (new_stage in ('not_enrolled','admin_pilot','leader_pilot')),
  changed_by_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.meridian_mcp_pilot_events (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pilot_stage text not null check (pilot_stage in ('admin_pilot','leader_pilot')),
  tool_name text not null check (tool_name in (
    'list_events','get_event','list_tasks','list_team_members','list_resources',
    'create_event','update_event','create_task','update_task','create_resource_bundle','submit_bundle_for_emma_review'
  )),
  client_category text not null check (client_category in ('codex','chatgpt','claude','other')),
  operation_kind text not null check (operation_kind in ('read','write')),
  outcome text not null check (outcome in ('succeeded','idempotent_replay','rejected','failed')),
  duration_ms integer not null check (duration_ms between 0 and 900000),
  target_record_type text check (target_record_type is null or target_record_type in ('event','task','resource_bundle')),
  target_record_id text check (target_record_id is null or char_length(target_record_id) between 1 and 120),
  parent_record_type text check (parent_record_type is null or parent_record_type in ('event','weekly_leader_prep')),
  parent_record_id text check (parent_record_id is null or char_length(parent_record_id) between 1 and 120),
  result_count integer check (result_count is null or result_count between 0 and 1000),
  artifact_count integer check (artifact_count is null or artifact_count between 0 and 8),
  grounding_claim_count integer check (grounding_claim_count is null or grounding_claim_count between 0 and 160),
  private_discovery_status text check (private_discovery_status is null or private_discovery_status in ('not_used','passed')),
  emma_outcome text check (emma_outcome is null or emma_outcome in ('ready_for_human_review','changes_required','blocked')),
  advisory_count integer not null default 0 check (advisory_count between 0 and 64),
  required_change_count integer not null default 0 check (required_change_count between 0 and 64),
  blocker_count integer not null default 0 check (blocker_count between 0 and 64),
  placement_verified boolean,
  idempotent_replay boolean not null default false,
  error_code text check (error_code is null or (char_length(error_code) between 1 and 80 and error_code ~ '^[a-z0-9_]+$')),
  created_at timestamptz not null default now(),
  check ((outcome = 'idempotent_replay') = idempotent_replay),
  check ((outcome in ('rejected','failed')) = (error_code is not null)),
  check (operation_kind = 'write' or placement_verified is null)
);

create table if not exists public.meridian_mcp_pilot_review_feedback (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  review_id uuid not null references public.meridian_mcp_bundle_reviews(id) on delete cascade,
  reviewer_user_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  usefulness text not null check (usefulness in ('useful','mixed','not_useful')),
  placement_correct boolean not null,
  grounding_helpful boolean not null,
  privacy_handling text not null check (privacy_handling in ('correct','concern','not_applicable')),
  issue_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (review_id, reviewer_user_id, idempotency_key),
  check (cardinality(issue_codes) <= 8),
  check (issue_codes <@ array[
    'wrong_destination','weak_grounding','citation_problem','privacy_concern','permission_concern',
    'theology_concern','audience_mismatch','too_many_false_positives','duplicate_write'
  ]::text[])
);

create index if not exists idx_mcp_pilot_cohort_events_ministry
  on public.meridian_mcp_pilot_cohort_events(ministry_id, created_at desc);
create index if not exists idx_mcp_pilot_events_ministry_created
  on public.meridian_mcp_pilot_events(ministry_id, created_at desc);
create index if not exists idx_mcp_pilot_events_tool
  on public.meridian_mcp_pilot_events(ministry_id, tool_name, outcome, created_at desc);
create index if not exists idx_mcp_pilot_feedback_review
  on public.meridian_mcp_pilot_review_feedback(ministry_id, review_id, created_at desc);

alter table public.meridian_mcp_pilot_cohort_events enable row level security;
alter table public.meridian_mcp_pilot_events enable row level security;
alter table public.meridian_mcp_pilot_review_feedback enable row level security;

drop policy if exists "admins manage meridian mcp grants" on public.meridian_mcp_access_grants;
drop policy if exists "admins read meridian mcp grants" on public.meridian_mcp_access_grants;
create policy "admins read meridian mcp grants"
on public.meridian_mcp_access_grants for select to authenticated
using (exists (
  select 1 from public.profiles actor
  where actor.id = (select auth.uid())
    and actor.ministry_id = meridian_mcp_access_grants.ministry_id
    and actor.role = 'admin'
));

drop policy if exists "admins insert non-pilot meridian mcp grants" on public.meridian_mcp_access_grants;
create policy "admins insert non-pilot meridian mcp grants"
on public.meridian_mcp_access_grants for insert to authenticated
with check (
  pilot_stage = 'not_enrolled'
  and pilot_enrolled_at is null
  and pilot_enrolled_by_user_id is null
  and exists (
    select 1
    from public.profiles actor
    join public.profiles target on target.id = meridian_mcp_access_grants.user_id and target.ministry_id = actor.ministry_id
    where actor.id = (select auth.uid())
      and actor.ministry_id = meridian_mcp_access_grants.ministry_id
      and actor.role = 'admin'
      and (
        (target.role = 'admin' and meridian_mcp_access_grants.access_level = 'admin')
        or (target.role = 'leader' and meridian_mcp_access_grants.access_level = 'leader_creator')
        or (target.role = 'volunteer' and meridian_mcp_access_grants.access_level = 'volunteer_creator')
      )
  )
);

drop policy if exists "admins update meridian mcp grant capabilities" on public.meridian_mcp_access_grants;
create policy "admins update meridian mcp grant capabilities"
on public.meridian_mcp_access_grants for update to authenticated
using (exists (
  select 1 from public.profiles actor
  where actor.id = (select auth.uid())
    and actor.ministry_id = meridian_mcp_access_grants.ministry_id
    and actor.role = 'admin'
))
with check (exists (
  select 1
  from public.profiles actor
  join public.profiles target on target.id = meridian_mcp_access_grants.user_id and target.ministry_id = actor.ministry_id
  where actor.id = (select auth.uid())
    and actor.ministry_id = meridian_mcp_access_grants.ministry_id
    and actor.role = 'admin'
    and (
      (target.role = 'admin' and meridian_mcp_access_grants.access_level = 'admin')
      or (target.role = 'leader' and meridian_mcp_access_grants.access_level = 'leader_creator')
      or (target.role = 'volunteer' and meridian_mcp_access_grants.access_level = 'volunteer_creator')
    )
));

drop policy if exists "admins read MCP pilot cohort events" on public.meridian_mcp_pilot_cohort_events;
create policy "admins read MCP pilot cohort events"
on public.meridian_mcp_pilot_cohort_events for select to authenticated
using (exists (
  select 1 from public.profiles actor
  where actor.id = (select auth.uid())
    and actor.ministry_id = meridian_mcp_pilot_cohort_events.ministry_id
    and actor.role = 'admin'
));

drop policy if exists "pilot users and admins read MCP pilot events" on public.meridian_mcp_pilot_events;
create policy "pilot users and admins read MCP pilot events"
on public.meridian_mcp_pilot_events for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.profiles actor
    where actor.id = (select auth.uid())
      and actor.ministry_id = meridian_mcp_pilot_events.ministry_id
      and actor.role = 'admin'
  )
);

drop policy if exists "review participants read MCP pilot feedback" on public.meridian_mcp_pilot_review_feedback;
create policy "review participants read MCP pilot feedback"
on public.meridian_mcp_pilot_review_feedback for select to authenticated
using (
  reviewer_user_id = (select auth.uid())
  or exists (
    select 1
    from public.meridian_mcp_bundle_reviews review
    join public.profiles actor on actor.id = (select auth.uid()) and actor.ministry_id = review.ministry_id
    where review.id = meridian_mcp_pilot_review_feedback.review_id
      and review.ministry_id = meridian_mcp_pilot_review_feedback.ministry_id
      and (review.created_by_user_id = (select auth.uid()) or actor.role = 'admin')
  )
);

grant select on public.meridian_mcp_pilot_cohort_events to authenticated;
grant select on public.meridian_mcp_pilot_events to authenticated;
grant select on public.meridian_mcp_pilot_review_feedback to authenticated;
revoke insert, update, delete on public.meridian_mcp_pilot_cohort_events from authenticated;
revoke insert, update, delete on public.meridian_mcp_pilot_events from authenticated;
revoke insert, update, delete on public.meridian_mcp_pilot_review_feedback from authenticated;
revoke all on public.meridian_mcp_pilot_cohort_events from anon;
revoke all on public.meridian_mcp_pilot_events from anon;
revoke all on public.meridian_mcp_pilot_review_feedback from anon;
revoke update, delete on public.meridian_mcp_access_grants from authenticated;
grant update (
  access_level, can_search, can_save_drafts, can_submit_candidates, can_read_platform,
  can_manage_events, can_manage_tasks, can_save_resources, can_review_resources, revoked_at
) on public.meridian_mcp_access_grants to authenticated;

create or replace function public.set_meridian_mcp_pilot_member(
  p_user_id uuid,
  p_pilot_stage text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
  previous_stage text;
begin
  select * into actor from public.profiles where id = auth.uid();
  if not found or actor.role <> 'admin' then raise exception 'Admin access is required.'; end if;
  if p_pilot_stage not in ('not_enrolled','admin_pilot','leader_pilot') then raise exception 'Invalid MCP pilot stage.'; end if;

  select * into target from public.profiles where id = p_user_id and ministry_id = actor.ministry_id;
  if not found or target.role not in ('admin','leader') then raise exception 'Only administrators and leaders may join this pilot.'; end if;
  if p_pilot_stage = 'admin_pilot' and target.role <> 'admin' then raise exception 'Admin pilot enrollment requires an administrator.'; end if;
  if p_pilot_stage = 'leader_pilot' and target.role <> 'leader' then raise exception 'Leader pilot enrollment requires a leader.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor.ministry_id::text, 0));

  select grant_row.pilot_stage into previous_stage
  from public.meridian_mcp_access_grants grant_row
  where grant_row.ministry_id = actor.ministry_id and grant_row.user_id = target.id
  for update;
  if not found then
    if p_pilot_stage = 'not_enrolled' then
      return jsonb_build_object('userId', target.id, 'pilotStage', 'not_enrolled', 'changed', false);
    end if;
    insert into public.meridian_mcp_access_grants(
      ministry_id, user_id, access_level, can_search, can_save_drafts, can_submit_candidates,
      can_read_platform, can_manage_events, can_manage_tasks, can_save_resources, can_review_resources,
      pilot_stage, created_by_user_id, revoked_at
    ) values (
      actor.ministry_id, target.id, case when target.role = 'admin' then 'admin' else 'leader_creator' end,
      true, false, false, false, false, false, false, false,
      'not_enrolled', actor.id, null
    );
    previous_stage := 'not_enrolled';
  end if;

  if previous_stage <> p_pilot_stage then
    if p_pilot_stage = 'admin_pilot' and (
      select count(*) from public.meridian_mcp_access_grants grant_row
      where grant_row.ministry_id = actor.ministry_id and grant_row.user_id <> target.id
        and grant_row.revoked_at is null and grant_row.pilot_stage = 'admin_pilot'
    ) >= 2 then raise exception 'The administrator pilot is limited to two people.'; end if;
    if p_pilot_stage = 'leader_pilot' and (
      select count(*) from public.meridian_mcp_access_grants grant_row
      where grant_row.ministry_id = actor.ministry_id and grant_row.user_id <> target.id
        and grant_row.revoked_at is null and grant_row.pilot_stage = 'leader_pilot'
    ) >= 3 then raise exception 'The leader pilot is limited to three people.'; end if;

    update public.meridian_mcp_access_grants set
      pilot_stage = p_pilot_stage,
      pilot_enrolled_at = case when p_pilot_stage = 'not_enrolled' then null else now() end,
      pilot_enrolled_by_user_id = case when p_pilot_stage = 'not_enrolled' then null else actor.id end,
      revoked_at = case when p_pilot_stage = 'not_enrolled' then revoked_at else null end,
      can_search = case when p_pilot_stage = 'not_enrolled' then can_search else true end,
      can_read_platform = p_pilot_stage <> 'not_enrolled',
      can_manage_events = false,
      can_manage_tasks = false,
      can_save_resources = false,
      can_review_resources = false
    where ministry_id = actor.ministry_id and user_id = target.id;

    insert into public.meridian_mcp_pilot_cohort_events(
      ministry_id, user_id, previous_stage, new_stage, changed_by_user_id
    ) values (actor.ministry_id, target.id, previous_stage, p_pilot_stage, actor.id);
  end if;

  return jsonb_build_object('userId', target.id, 'pilotStage', p_pilot_stage, 'changed', previous_stage <> p_pilot_stage);
end;
$$;

create or replace function public.assert_meridian_mcp_pilot_access(p_tool_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  grant_row public.meridian_mcp_access_grants%rowtype;
  actor_role text;
begin
  if actor_id is null then raise exception 'Authentication required.'; end if;
  if p_tool_name not in (
    'list_events','get_event','list_tasks','list_team_members','list_resources',
    'create_event','update_event','create_task','update_task','create_resource_bundle','submit_bundle_for_emma_review'
  ) then raise exception 'Unknown MCP pilot tool.'; end if;

  select grant_value.* into grant_row
  from public.meridian_mcp_access_grants grant_value
  join public.profiles profile
    on profile.id = actor_id and profile.ministry_id = grant_value.ministry_id
  where grant_value.user_id = actor_id and grant_value.revoked_at is null;
  if not found or grant_row.pilot_stage not in ('admin_pilot','leader_pilot') then raise exception 'MCP pilot enrollment is required.'; end if;
  select profile.role into actor_role from public.profiles profile where profile.id = actor_id;
  if not found then raise exception 'MCP pilot profile scope is invalid.'; end if;
  if (grant_row.pilot_stage = 'admin_pilot' and actor_role <> 'admin') or (grant_row.pilot_stage = 'leader_pilot' and actor_role <> 'leader') then
    raise exception 'MCP pilot role boundary is invalid.';
  end if;
  if not grant_row.can_read_platform then raise exception 'Platform read access is required.'; end if;
  if p_tool_name in ('create_event','update_event') and not grant_row.can_manage_events then raise exception 'Event management access is required.'; end if;
  if p_tool_name in ('create_task','update_task') and not grant_row.can_manage_tasks then raise exception 'Task management access is required.'; end if;
  if p_tool_name = 'create_resource_bundle' and not grant_row.can_save_resources then raise exception 'Resource save access is required.'; end if;
  if p_tool_name = 'submit_bundle_for_emma_review' and not grant_row.can_review_resources then raise exception 'Resource review access is required.'; end if;

  return jsonb_build_object('pilotStage', grant_row.pilot_stage);
end;
$$;

create or replace function public.record_meridian_mcp_pilot_event(
  p_tool_name text,
  p_client_category text,
  p_operation_kind text,
  p_outcome text,
  p_duration_ms integer,
  p_target_record_type text,
  p_target_record_id text,
  p_parent_record_type text,
  p_parent_record_id text,
  p_result_count integer,
  p_artifact_count integer,
  p_grounding_claim_count integer,
  p_private_discovery_status text,
  p_emma_outcome text,
  p_advisory_count integer,
  p_required_change_count integer,
  p_blocker_count integer,
  p_idempotent_replay boolean,
  p_error_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  grant_row public.meridian_mcp_access_grants%rowtype;
  event_id uuid := gen_random_uuid();
  verified_placement boolean := null;
begin
  perform public.assert_meridian_mcp_pilot_access(p_tool_name);
  select grant_value.* into grant_row
  from public.meridian_mcp_access_grants grant_value
  join public.profiles profile
    on profile.id = actor_id and profile.ministry_id = grant_value.ministry_id
  where grant_value.user_id = actor_id and grant_value.revoked_at is null;

  if p_operation_kind = 'write' and p_outcome in ('succeeded','idempotent_replay') then
    verified_placement := case p_target_record_type
      when 'event' then exists (
        select 1 from public.events event
        where event.id::text = p_target_record_id and event.ministry_id = grant_row.ministry_id
      )
      when 'task' then exists (
        select 1 from public.tasks task
        where task.id::text = p_target_record_id and task.ministry_id = grant_row.ministry_id
          and (p_parent_record_type is null or (p_parent_record_type = 'event' and task.event_id::text = p_parent_record_id))
      )
      when 'resource_bundle' then exists (
        select 1 from public.meridian_mcp_resource_bundles bundle
        where bundle.id::text = p_target_record_id and bundle.ministry_id = grant_row.ministry_id
          and (p_parent_record_type is null or (bundle.destination_type = p_parent_record_type and bundle.destination_id = p_parent_record_id))
      )
      else false
    end;
  end if;

  insert into public.meridian_mcp_pilot_events(
    id, ministry_id, user_id, pilot_stage, tool_name, client_category, operation_kind, outcome, duration_ms,
    target_record_type, target_record_id, parent_record_type, parent_record_id, result_count, artifact_count,
    grounding_claim_count, private_discovery_status, emma_outcome, advisory_count, required_change_count,
    blocker_count, placement_verified, idempotent_replay, error_code
  ) values (
    event_id, grant_row.ministry_id, actor_id, grant_row.pilot_stage, p_tool_name, p_client_category,
    p_operation_kind, p_outcome, p_duration_ms, p_target_record_type, nullif(trim(p_target_record_id), ''),
    p_parent_record_type, nullif(trim(p_parent_record_id), ''), p_result_count, p_artifact_count,
    p_grounding_claim_count, p_private_discovery_status, p_emma_outcome, p_advisory_count,
    p_required_change_count, p_blocker_count, verified_placement, p_idempotent_replay,
    nullif(trim(p_error_code), '')
  );
  return event_id;
end;
$$;

create or replace function public.save_meridian_mcp_pilot_review_feedback(
  p_review_id uuid,
  p_idempotency_key text,
  p_usefulness text,
  p_placement_correct boolean,
  p_grounding_helpful boolean,
  p_privacy_handling text,
  p_issue_codes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  review public.meridian_mcp_bundle_reviews%rowtype;
  feedback_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required.'; end if;
  select * into review from public.meridian_mcp_bundle_reviews where id = p_review_id and outcome <> 'failed';
  if not found then raise exception 'Reviewed bundle not found.'; end if;
  if not exists (
    select 1
    from public.profiles actor
    join public.meridian_mcp_access_grants grant_row
      on grant_row.user_id = actor.id and grant_row.ministry_id = actor.ministry_id and grant_row.revoked_at is null
    where actor.id = actor_id
      and actor.ministry_id = review.ministry_id
      and grant_row.pilot_stage in ('admin_pilot','leader_pilot')
      and (review.created_by_user_id = actor_id or actor.role = 'admin')
  ) then raise exception 'This review is outside your pilot feedback scope.'; end if;

  select existing.id into feedback_id
  from public.meridian_mcp_pilot_review_feedback existing
  where existing.review_id = p_review_id
    and existing.reviewer_user_id = actor_id
    and existing.idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('id', feedback_id, 'idempotentReplay', true); end if;

  feedback_id := gen_random_uuid();
  insert into public.meridian_mcp_pilot_review_feedback(
    id, ministry_id, review_id, reviewer_user_id, idempotency_key, usefulness,
    placement_correct, grounding_helpful, privacy_handling, issue_codes
  ) values (
    feedback_id, review.ministry_id, review.id, actor_id, trim(p_idempotency_key), p_usefulness,
    p_placement_correct, p_grounding_helpful, p_privacy_handling, coalesce(p_issue_codes, '{}')
  );
  return jsonb_build_object('id', feedback_id, 'idempotentReplay', false);
end;
$$;

create or replace function public.get_meridian_mcp_pilot_metrics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  result jsonb;
begin
  select * into actor from public.profiles where id = auth.uid();
  if not found or actor.role <> 'admin' then raise exception 'Admin access is required.'; end if;
  if p_days not between 1 and 90 then raise exception 'Pilot metric window must be between 1 and 90 days.'; end if;

  with scoped_events as (
    select * from public.meridian_mcp_pilot_events event
    where event.ministry_id = actor.ministry_id and event.created_at >= now() - make_interval(days => p_days)
  ), latest_feedback as (
    select distinct on (feedback.review_id, feedback.reviewer_user_id) feedback.*
    from public.meridian_mcp_pilot_review_feedback feedback
    where feedback.ministry_id = actor.ministry_id and feedback.created_at >= now() - make_interval(days => p_days)
    order by feedback.review_id, feedback.reviewer_user_id, feedback.created_at desc
  )
  select jsonb_build_object(
    'windowDays', p_days,
    'cohort', jsonb_build_object(
      'admins', (select count(*) from public.meridian_mcp_access_grants grant_row where grant_row.ministry_id = actor.ministry_id and grant_row.revoked_at is null and grant_row.pilot_stage = 'admin_pilot'),
      'leaders', (select count(*) from public.meridian_mcp_access_grants grant_row where grant_row.ministry_id = actor.ministry_id and grant_row.revoked_at is null and grant_row.pilot_stage = 'leader_pilot')
    ),
    'calls', count(*),
    'successfulCalls', count(*) filter (where outcome in ('succeeded','idempotent_replay')),
    'rejectedCalls', count(*) filter (where outcome = 'rejected'),
    'failedCalls', count(*) filter (where outcome = 'failed'),
    'duplicateSafeReplays', count(*) filter (where idempotent_replay),
    'privacyBlocks', count(*) filter (where error_code = 'private_discovery_leakage'),
    'placementVerifiedWrites', count(*) filter (where operation_kind = 'write' and outcome in ('succeeded','idempotent_replay') and placement_verified),
    'successfulWrites', count(*) filter (where operation_kind = 'write' and outcome in ('succeeded','idempotent_replay')),
    'medianLatencyMs', coalesce(percentile_cont(0.5) within group (order by duration_ms), 0),
    'p95LatencyMs', coalesce(percentile_cont(0.95) within group (order by duration_ms), 0),
    'reviewOutcomes', jsonb_build_object(
      'ready', count(*) filter (where emma_outcome = 'ready_for_human_review'),
      'changesRequired', count(*) filter (where emma_outcome = 'changes_required'),
      'blocked', count(*) filter (where emma_outcome = 'blocked')
    ),
    'feedback', jsonb_build_object(
      'responses', (select count(*) from latest_feedback),
      'useful', (select count(*) from latest_feedback where usefulness = 'useful'),
      'mixed', (select count(*) from latest_feedback where usefulness = 'mixed'),
      'notUseful', (select count(*) from latest_feedback where usefulness = 'not_useful'),
      'placementCorrect', (select count(*) from latest_feedback where placement_correct),
      'groundingHelpful', (select count(*) from latest_feedback where grounding_helpful),
      'privacyConcerns', (select count(*) from latest_feedback where privacy_handling = 'concern'),
      'duplicateWriteIncidents', (select count(*) from latest_feedback where 'duplicate_write' = any(issue_codes))
    )
  ) into result
  from scoped_events;
  return result;
end;
$$;

create or replace function public.get_meridian_mcp_pilot_dashboard(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  actor_stage text := 'not_enrolled';
  metrics jsonb := null;
  members jsonb := '[]'::jsonb;
  reviews jsonb := '[]'::jsonb;
begin
  select * into actor from public.profiles where id = auth.uid();
  if not found then raise exception 'Authentication required.'; end if;
  select grant_row.pilot_stage into actor_stage
  from public.meridian_mcp_access_grants grant_row
  where grant_row.ministry_id = actor.ministry_id and grant_row.user_id = actor.id and grant_row.revoked_at is null;
  actor_stage := coalesce(actor_stage, 'not_enrolled');
  if actor.role <> 'admin' and actor_stage <> 'leader_pilot' then raise exception 'MCP pilot enrollment is required.'; end if;

  if actor.role = 'admin' then
    metrics := public.get_meridian_mcp_pilot_metrics(p_days);
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId', profile.id,
      'name', coalesce(profile.full_name, 'Unnamed team member'),
      'role', profile.role,
      'grantEnabled', grant_row.revoked_at is null and grant_row.can_search,
      'pilotStage', coalesce(grant_row.pilot_stage, 'not_enrolled'),
      'canReadPlatform', coalesce(grant_row.can_read_platform, false),
      'canManageEvents', coalesce(grant_row.can_manage_events, false),
      'canManageTasks', coalesce(grant_row.can_manage_tasks, false),
      'canSaveResources', coalesce(grant_row.can_save_resources, false),
      'canReviewResources', coalesce(grant_row.can_review_resources, false)
    ) order by profile.role, profile.full_name), '[]'::jsonb) into members
    from public.profiles profile
    left join public.meridian_mcp_access_grants grant_row
      on grant_row.ministry_id = profile.ministry_id and grant_row.user_id = profile.id
    where profile.ministry_id = actor.ministry_id and profile.role in ('admin','leader');
  end if;

  if actor_stage in ('admin_pilot','leader_pilot') then
    select coalesce(jsonb_agg(recent_reviews.review_row order by recent_reviews."createdAt" desc), '[]'::jsonb) into reviews
    from (
    select jsonb_build_object(
      'reviewId', review.id,
      'bundleId', review.bundle_id,
      'bundleTitle', bundle.title,
      'destinationType', bundle.destination_type,
      'destinationId', bundle.destination_id,
      'outcome', review.outcome,
      'summary', review.summary,
      'humanReviewStatus', review.human_review_status,
      'createdAt', review.created_at,
      'feedback', case when feedback.id is null then null else jsonb_build_object(
        'usefulness', feedback.usefulness,
        'placementCorrect', feedback.placement_correct,
        'groundingHelpful', feedback.grounding_helpful,
        'privacyHandling', feedback.privacy_handling,
        'issueCodes', feedback.issue_codes,
        'createdAt', feedback.created_at
      ) end
    ) as review_row,
    review.created_at as "createdAt"
    from public.meridian_mcp_bundle_reviews review
    join public.meridian_mcp_resource_bundles bundle
      on bundle.id = review.bundle_id and bundle.ministry_id = review.ministry_id
    left join lateral (
      select feedback_value.*
      from public.meridian_mcp_pilot_review_feedback feedback_value
      where feedback_value.review_id = review.id and feedback_value.reviewer_user_id = actor.id
      order by feedback_value.created_at desc
      limit 1
    ) feedback on true
    where review.ministry_id = actor.ministry_id
      and review.outcome <> 'failed'
      and (actor.role = 'admin' or review.created_by_user_id = actor.id)
    order by review.created_at desc
    limit 10
    ) recent_reviews;
  end if;

  return jsonb_build_object(
    'isAdmin', actor.role = 'admin',
    'pilotStage', actor_stage,
    'members', members,
    'metrics', metrics,
    'reviews', reviews
  );
end;
$$;

revoke all on function public.set_meridian_mcp_pilot_member(uuid, text) from public, anon;
revoke all on function public.assert_meridian_mcp_pilot_access(text) from public, anon;
revoke all on function public.record_meridian_mcp_pilot_event(text, text, text, text, integer, text, text, text, text, integer, integer, integer, text, text, integer, integer, integer, boolean, text) from public, anon;
revoke all on function public.save_meridian_mcp_pilot_review_feedback(uuid, text, text, boolean, boolean, text, text[]) from public, anon;
revoke all on function public.get_meridian_mcp_pilot_metrics(integer) from public, anon;
revoke all on function public.get_meridian_mcp_pilot_dashboard(integer) from public, anon;
grant execute on function public.set_meridian_mcp_pilot_member(uuid, text) to authenticated;
grant execute on function public.assert_meridian_mcp_pilot_access(text) to authenticated;
grant execute on function public.record_meridian_mcp_pilot_event(text, text, text, text, integer, text, text, text, text, integer, integer, integer, text, text, integer, integer, integer, boolean, text) to authenticated;
grant execute on function public.save_meridian_mcp_pilot_review_feedback(uuid, text, text, boolean, boolean, text, text[]) to authenticated;
grant execute on function public.get_meridian_mcp_pilot_metrics(integer) to authenticated;
grant execute on function public.get_meridian_mcp_pilot_dashboard(integer) to authenticated;

notify pgrst, 'reload schema';
