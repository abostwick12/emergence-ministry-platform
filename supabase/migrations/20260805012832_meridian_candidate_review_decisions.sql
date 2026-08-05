-- Record non-promotion candidate decisions atomically. Promotion remains in
-- promote_meridian_candidate so each accepted claim keeps its evidence graph.
create or replace function public.review_meridian_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_rationale text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate public.meridian_candidates%rowtype;
  reviewer_id uuid := auth.uid();
  normalized_rationale text := trim(coalesce(p_rationale, ''));
  next_status text;
  event_id uuid;
  event_created_at timestamptz;
begin
  select * into candidate
  from public.meridian_candidates
  where id = p_candidate_id
  for update;

  if candidate.id is null then
    raise exception 'Candidate was not found.';
  end if;
  if not exists (
    select 1
    from public.profiles p
    where p.id = reviewer_id
      and p.ministry_id = candidate.ministry_id
      and p.role = 'admin'
  ) then
    raise exception 'Only a ministry admin may review Meridian candidates.';
  end if;

  if p_decision = 'started_review' then
    if candidate.approval_status <> 'unreviewed' then
      raise exception 'Only an unreviewed candidate may enter review.';
    end if;
    next_status := 'in_review';
  elsif p_decision = 'rejected' then
    if candidate.approval_status not in ('unreviewed', 'in_review') then
      raise exception 'Candidate is not available for rejection.';
    end if;
    if normalized_rationale = '' then
      raise exception 'Rejection requires a review rationale.';
    end if;
    next_status := 'rejected';
  else
    raise exception 'Review decision must be started_review or rejected.';
  end if;

  update public.meridian_candidates
  set
    approval_status = next_status,
    reviewed_by_user_id = reviewer_id,
    reviewed_at = case when next_status = 'rejected' then now() else null end
  where id = candidate.id;

  insert into public.meridian_review_events(
    ministry_id,
    candidate_id,
    decision,
    rationale,
    reviewed_by_user_id
  )
  values (
    candidate.ministry_id,
    candidate.id,
    p_decision,
    normalized_rationale,
    reviewer_id
  )
  returning id, created_at into event_id, event_created_at;

  return jsonb_build_object(
    'candidateId', candidate.id,
    'approvalStatus', next_status,
    'eventId', event_id,
    'eventCreatedAt', event_created_at
  );
end;
$$;

-- The base schema defines an admin-only insert policy but originally granted
-- authenticated users SELECT only. Invoker functions need the matching table
-- privilege before RLS can authorize the admin row.
grant insert on public.meridian_review_events to authenticated;

revoke all on function public.review_meridian_candidate(uuid, text, text) from public, anon;
grant execute on function public.review_meridian_candidate(uuid, text, text) to authenticated;
