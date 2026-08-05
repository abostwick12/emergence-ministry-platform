-- Promote reviewed question candidates into non-answer planning maps. Question
-- maps may shape retrieval facets but never create claims or generation evidence.
create table if not exists public.meridian_question_maps (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  source_candidate_id uuid not null,
  title text not null check (char_length(title) between 1 and 240),
  aliases text[] not null check (cardinality(aliases) between 1 and 20),
  facets text[] not null check (cardinality(facets) between 1 and 4),
  topics text[] not null default '{}'::text[] check (cardinality(topics) <= 20),
  scripture_references text[] not null default '{}'::text[] check (cardinality(scripture_references) <= 20),
  search_text text not null check (char_length(search_text) between 1 and 20000),
  search_vector tsvector generated always as (to_tsvector('english'::regconfig, search_text)) stored,
  active boolean not null default true,
  approved_by_user_id uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (ministry_id, source_candidate_id)
    references public.meridian_candidates(ministry_id, id) on delete restrict,
  unique (ministry_id, id),
  unique (ministry_id, source_candidate_id)
);

create index if not exists idx_meridian_question_maps_active
  on public.meridian_question_maps(ministry_id, active);
create index if not exists idx_meridian_question_maps_search
  on public.meridian_question_maps using gin(search_vector);
create index if not exists idx_meridian_question_maps_approver
  on public.meridian_question_maps(approved_by_user_id);

alter table public.meridian_question_maps enable row level security;

drop policy if exists "operators read active meridian question maps" on public.meridian_question_maps;
create policy "operators read active meridian question maps"
on public.meridian_question_maps for select to authenticated
using (
  active
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.ministry_id = meridian_question_maps.ministry_id
      and p.role in ('admin', 'leader', 'staff')
  )
);

drop policy if exists "admins insert meridian question maps" on public.meridian_question_maps;
create policy "admins insert meridian question maps"
on public.meridian_question_maps for insert to authenticated
with check (
  approved_by_user_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.ministry_id = meridian_question_maps.ministry_id
      and p.role = 'admin'
  )
);

grant select, insert on public.meridian_question_maps to authenticated;
revoke all on public.meridian_question_maps from anon;
revoke update, delete, truncate, trigger on public.meridian_question_maps from authenticated;

create or replace function public.promote_meridian_question_map(
  p_candidate_id uuid,
  p_aliases text[],
  p_facets text[],
  p_topics text[] default '{}'::text[],
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
  normalized_aliases text[];
  normalized_facets text[];
  normalized_topics text[];
  normalized_rationale text := trim(coalesce(p_rationale, ''));
  question_map_id uuid;
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
  if candidate.approval_status <> 'in_review' then
    raise exception 'Start review before promoting a Meridian question map.';
  end if;
  if candidate.metadata ->> 'objectType' is distinct from 'question' then
    raise exception 'Only a question candidate may become a Meridian question map.';
  end if;
  if not exists (
    select 1
    from public.profiles p
    where p.id = reviewer_id
      and p.ministry_id = candidate.ministry_id
      and p.role = 'admin'
  ) then
    raise exception 'Only a ministry admin may promote Meridian question maps.';
  end if;
  if normalized_rationale = '' then
    raise exception 'Question-map promotion requires a review rationale.';
  end if;

  select coalesce(array_agg(trim(item.value) order by item.ordinality), '{}'::text[])
  into normalized_aliases
  from unnest(coalesce(p_aliases, '{}'::text[])) with ordinality as item(value, ordinality)
  where trim(item.value) <> '';

  select coalesce(array_agg(trim(item.value) order by item.ordinality), '{}'::text[])
  into normalized_facets
  from unnest(coalesce(p_facets, '{}'::text[])) with ordinality as item(value, ordinality)
  where trim(item.value) <> '';

  select coalesce(array_agg(trim(item.value) order by item.ordinality), '{}'::text[])
  into normalized_topics
  from unnest(coalesce(p_topics, '{}'::text[])) with ordinality as item(value, ordinality)
  where trim(item.value) <> '';

  if cardinality(normalized_aliases) not between 1 and 20 then
    raise exception 'Question maps require between 1 and 20 reviewed aliases.';
  end if;
  if cardinality(normalized_facets) not between 1 and 4 then
    raise exception 'Question maps require between 1 and 4 reviewed facets.';
  end if;
  if cardinality(normalized_topics) > 20 then
    raise exception 'Question maps allow at most 20 topic labels.';
  end if;
  if exists (select 1 from unnest(normalized_aliases) item where char_length(item) > 500) then
    raise exception 'Question-map aliases may not exceed 500 characters.';
  end if;
  if exists (select 1 from unnest(normalized_facets) item where char_length(item) > 500) then
    raise exception 'Question-map facets may not exceed 500 characters.';
  end if;
  if exists (select 1 from unnest(normalized_topics) item where char_length(item) > 120) then
    raise exception 'Question-map topic labels may not exceed 120 characters.';
  end if;
  if char_length(normalized_rationale) > 1200 then
    raise exception 'Question-map review rationale may not exceed 1200 characters.';
  end if;

  insert into public.meridian_question_maps(
    ministry_id,
    source_candidate_id,
    title,
    aliases,
    facets,
    topics,
    scripture_references,
    search_text,
    active,
    approved_by_user_id
  )
  values (
    candidate.ministry_id,
    candidate.id,
    candidate.title,
    normalized_aliases,
    normalized_facets,
    normalized_topics,
    coalesce(array(
      select jsonb_array_elements_text(
        case
          when jsonb_typeof(candidate.metadata -> 'scriptureReferences') = 'array'
            then candidate.metadata -> 'scriptureReferences'
          else '[]'::jsonb
        end
      )
      limit 20
    ), '{}'::text[]),
    concat_ws(
      ' ',
      candidate.title,
      array_to_string(normalized_aliases, ' '),
      array_to_string(normalized_facets, ' '),
      array_to_string(normalized_topics, ' ')
    ),
    true,
    reviewer_id
  )
  returning id into question_map_id;

  update public.meridian_candidates
  set
    approval_status = 'promoted',
    reviewed_by_user_id = reviewer_id,
    reviewed_at = now()
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
    'promoted',
    normalized_rationale,
    reviewer_id
  )
  returning id, created_at into event_id, event_created_at;

  return jsonb_build_object(
    'candidateId', candidate.id,
    'questionMapId', question_map_id,
    'eventId', event_id,
    'eventCreatedAt', event_created_at
  );
end;
$$;

create or replace function public.search_meridian_question_maps(
  p_ministry_id uuid,
  p_query_text text,
  p_match_count integer default 8
)
returns table (
  id uuid,
  ministry_id uuid,
  title text,
  aliases text[],
  facets text[],
  topics text[],
  scripture_references text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with search as (
    select case
      when nullif(trim(p_query_text), '') is null then null::tsquery
      else websearch_to_tsquery(
        'english'::regconfig,
        regexp_replace(left(trim(p_query_text), 2000), '\s+', ' OR ', 'g')
      )
    end as query
  )
  select
    question_map.id,
    question_map.ministry_id,
    question_map.title,
    question_map.aliases,
    question_map.facets,
    question_map.topics,
    question_map.scripture_references
  from public.meridian_question_maps question_map
  cross join search
  where question_map.ministry_id = p_ministry_id
    and question_map.active
    and search.query is not null
    and question_map.search_vector @@ search.query
  order by
    ts_rank_cd(question_map.search_vector, search.query) desc,
    question_map.approved_at desc,
    question_map.id
  limit least(greatest(coalesce(p_match_count, 8), 1), 16);
$$;

-- Invoker functions need the table privileges that match their RLS policies.
grant insert on public.meridian_review_events to authenticated;

revoke all on function public.promote_meridian_question_map(uuid, text[], text[], text[], text) from public, anon;
grant execute on function public.promote_meridian_question_map(uuid, text[], text[], text[], text) to authenticated;
revoke all on function public.search_meridian_question_maps(uuid, text, integer) from public, anon;
grant execute on function public.search_meridian_question_maps(uuid, text, integer) to authenticated;
