-- Require an actual lexical match before an approved Meridian claim can enter
-- a generation evidence pack. Approval and authority remain eligibility gates;
-- relevance is the first ranking signal inside that safe set.
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
  with search as (
    select to_tsquery(
      'english'::regconfig,
      string_agg(quote_literal(lexeme), ' | ')
    ) as query
    from unnest(
      tsvector_to_array(to_tsvector('english'::regconfig, coalesce(p_query_text, '')))
    ) as tokens(lexeme)
    where length(lexeme) >= 3
      and lexeme ~ '[[:alpha:]]'
  )
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
  cross join search
  where claim.ministry_id = p_ministry_id
    and claim.approval_status = 'approved'
    and claim.authority_class <> 'none'
    and search.query is not null
    and claim.search_vector @@ search.query
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
    ts_rank_cd(claim.search_vector, search.query) desc,
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
    claim.confidence desc,
    claim.id
  limit least(greatest(p_match_count, 1), 64);
$$;

revoke all on function public.search_meridian_approved_claims(uuid, text, text, text, integer) from public, anon;
grant execute on function public.search_meridian_approved_claims(uuid, text, text, text, integer) to authenticated;
