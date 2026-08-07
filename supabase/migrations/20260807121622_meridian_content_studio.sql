-- Meridian-governed, MCP-first ministry content studio. All outputs remain drafts.
-- Feedback is append-only evidence; only an explicit admin batch approval creates
-- a new active guide version. Obsidian remains an authoring format, not a runtime dependency.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.content_guides (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  guide_kind text not null check (guide_kind in ('voice','visual','platform','interviewer')),
  platform text check (platform in ('twitter','facebook','instagram','church_slide','linkedin','groupme')),
  version_number integer not null check (version_number > 0),
  title text not null check (char_length(title) between 1 and 240),
  body_markdown text not null check (char_length(body_markdown) between 1 and 30000),
  guide_data jsonb not null default '{}'::jsonb check (jsonb_typeof(guide_data) = 'object'),
  status text not null check (status in ('active','retired')),
  parent_version_id uuid references public.content_guides(id) on delete set null,
  change_summary text not null check (char_length(change_summary) between 1 and 1000),
  created_by_user_id uuid references public.profiles(id) on delete set null,
  approved_by_user_id uuid references public.profiles(id) on delete set null,
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((guide_kind = 'platform' and platform is not null) or (guide_kind <> 'platform' and platform is null))
);

create unique index if not exists uq_content_guide_version
  on public.content_guides(ministry_id, guide_kind, coalesce(platform, '__none__'), version_number);
create unique index if not exists uq_content_guide_active
  on public.content_guides(ministry_id, guide_kind, coalesce(platform, '__none__')) where status = 'active';
create index if not exists idx_content_guides_history
  on public.content_guides(ministry_id, guide_kind, platform, version_number desc);

create table if not exists public.content_interview_sessions (
  id uuid primary key,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id),
  topic text not null check (char_length(topic) between 1 and 1000),
  content_type text not null check (char_length(content_type) between 1 and 120),
  platforms text[] not null check (
    cardinality(platforms) between 1 and 6
    and platforms <@ array['twitter','facebook','instagram','church_slide','linkedin','groupme']::text[]
  ),
  interview_mode text not null check (interview_mode in ('guided','skipped')),
  status text not null check (status in ('collecting','ready','drafted','closed')),
  question_count integer not null default 0 check (question_count between 0 and 8),
  max_questions integer not null check (max_questions between 1 and 8),
  covered_dimensions text[] not null default '{}',
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  current_question jsonb check (current_question is null or jsonb_typeof(current_question) = 'object'),
  guide_version_ids uuid[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (question_count <= max_questions),
  check ((interview_mode = 'skipped' and status <> 'collecting') or interview_mode = 'guided')
);

create table if not exists public.content_drafts (
  id uuid primary key,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  session_id uuid not null references public.content_interview_sessions(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id),
  platform text not null check (platform in ('twitter','facebook','instagram','church_slide','linkedin','groupme')),
  body_markdown text not null check (char_length(body_markdown) between 1 and 5000),
  design jsonb not null default '{}'::jsonb check (jsonb_typeof(design) = 'object'),
  status text not null default 'draft' check (status = 'draft'),
  voice_guide_version_id uuid not null references public.content_guides(id),
  visual_guide_version_id uuid not null references public.content_guides(id),
  platform_guide_version_id uuid not null references public.content_guides(id),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.content_feedback_batches (
  id uuid primary key,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  feedback_ids uuid[] not null check (cardinality(feedback_ids) >= 3),
  approved_by_user_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.content_feedback_batch_changes (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  batch_id uuid not null references public.content_feedback_batches(id) on delete cascade,
  source_guide_version_id uuid not null references public.content_guides(id),
  proposed_body_markdown text not null check (char_length(proposed_body_markdown) between 1 and 30000),
  proposed_guide_data jsonb not null check (jsonb_typeof(proposed_guide_data) = 'object'),
  change_summary text not null check (char_length(change_summary) between 1 and 1000),
  resulting_guide_version_id uuid references public.content_guides(id),
  created_at timestamptz not null default now(),
  unique (batch_id, source_guide_version_id)
);

create table if not exists public.content_feedback (
  id uuid primary key,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  draft_id uuid not null references public.content_drafts(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id),
  sentiment text not null check (sentiment in ('positive','correction')),
  feedback_text text not null check (char_length(feedback_text) between 1 and 3000),
  guide_target text not null check (guide_target in ('voice','visual','platform')),
  target_platform text check (target_platform in ('twitter','facebook','instagram','church_slide','linkedin','groupme')),
  batch_id uuid references public.content_feedback_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((guide_target = 'platform' and target_platform is not null) or (guide_target <> 'platform' and target_platform is null))
);

create index if not exists idx_content_sessions_owner on public.content_interview_sessions(ministry_id, created_by_user_id, created_at desc);
create index if not exists idx_content_drafts_session on public.content_drafts(ministry_id, session_id, created_at desc);
create index if not exists idx_content_feedback_draft on public.content_feedback(ministry_id, draft_id, created_at desc);
create index if not exists idx_content_feedback_unbatched on public.content_feedback(ministry_id, created_at desc) where batch_id is null;
create index if not exists idx_content_feedback_batches_status on public.content_feedback_batches(ministry_id, status, created_at desc);

drop trigger if exists set_content_interview_sessions_updated_at on public.content_interview_sessions;
create trigger set_content_interview_sessions_updated_at before update on public.content_interview_sessions
for each row execute function public.set_updated_at();

alter table public.content_guides enable row level security;
alter table public.content_interview_sessions enable row level security;
alter table public.content_drafts enable row level security;
alter table public.content_feedback_batches enable row level security;
alter table public.content_feedback_batch_changes enable row level security;
alter table public.content_feedback enable row level security;

create or replace function private.has_content_studio_access(p_ministry_id uuid, p_write boolean default false, p_admin boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles actor
    join public.meridian_mcp_access_grants grant_row
      on grant_row.user_id = actor.id and grant_row.ministry_id = actor.ministry_id and grant_row.revoked_at is null
    where actor.id = auth.uid() and actor.ministry_id = p_ministry_id
      and (not p_write or grant_row.can_save_drafts)
      and (p_write or grant_row.can_search)
      and (not p_admin or (actor.role = 'admin' and grant_row.access_level = 'admin'))
  );
$$;
revoke all on function private.has_content_studio_access(uuid, boolean, boolean) from public, anon, service_role;
grant execute on function private.has_content_studio_access(uuid, boolean, boolean) to authenticated;

create policy "content users read guides" on public.content_guides for select to authenticated
using ((select private.has_content_studio_access(ministry_id, false, false)));
create policy "content users read own sessions" on public.content_interview_sessions for select to authenticated
using (created_by_user_id = (select auth.uid()) or (select private.has_content_studio_access(ministry_id, false, true)));
create policy "content users create own sessions" on public.content_interview_sessions for insert to authenticated
with check (created_by_user_id = (select auth.uid()) and (select private.has_content_studio_access(ministry_id, true, false)));
create policy "content users update own sessions" on public.content_interview_sessions for update to authenticated
using (created_by_user_id = (select auth.uid()) and (select private.has_content_studio_access(ministry_id, true, false)))
with check (created_by_user_id = (select auth.uid()) and (select private.has_content_studio_access(ministry_id, true, false)));
create policy "content users read own drafts" on public.content_drafts for select to authenticated
using (created_by_user_id = (select auth.uid()) or (select private.has_content_studio_access(ministry_id, false, true)));
create policy "content users create own drafts" on public.content_drafts for insert to authenticated
with check (
  created_by_user_id = (select auth.uid()) and status = 'draft'
  and (select private.has_content_studio_access(ministry_id, true, false))
  and exists (select 1 from public.content_interview_sessions content_session
    where content_session.id = content_drafts.session_id and content_session.ministry_id = content_drafts.ministry_id
      and content_session.created_by_user_id = (select auth.uid()) and content_session.status in ('ready','drafted'))
);
create policy "content users read own batches" on public.content_feedback_batches for select to authenticated
using (created_by_user_id = (select auth.uid()) or (select private.has_content_studio_access(ministry_id, false, true)));
create policy "content users read batch changes" on public.content_feedback_batch_changes for select to authenticated
using (exists (select 1 from public.content_feedback_batches batch
  where batch.id = content_feedback_batch_changes.batch_id and batch.ministry_id = content_feedback_batch_changes.ministry_id
    and (batch.created_by_user_id = (select auth.uid()) or (select private.has_content_studio_access(batch.ministry_id, false, true)))));
create policy "content users read own feedback" on public.content_feedback for select to authenticated
using (created_by_user_id = (select auth.uid()) or (select private.has_content_studio_access(ministry_id, false, true)));
create policy "content users create own feedback" on public.content_feedback for insert to authenticated
with check (
  created_by_user_id = (select auth.uid()) and batch_id is null
  and (select private.has_content_studio_access(ministry_id, true, false))
  and exists (select 1 from public.content_drafts draft
    where draft.id = content_feedback.draft_id and draft.ministry_id = content_feedback.ministry_id and draft.created_by_user_id = (select auth.uid()))
);

grant select on public.content_guides to authenticated;
grant select, insert, update (status, question_count, covered_dimensions, transcript, current_question) on public.content_interview_sessions to authenticated;
grant select, insert on public.content_drafts to authenticated;
grant select on public.content_feedback_batches, public.content_feedback_batch_changes to authenticated;
grant select, insert on public.content_feedback to authenticated;
revoke all on public.content_guides, public.content_interview_sessions, public.content_drafts,
  public.content_feedback_batches, public.content_feedback_batch_changes, public.content_feedback from public, anon;

create or replace function public.create_content_feedback_batch(p_batch_id uuid, p_feedback_ids uuid[], p_changes jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype; change_value jsonb;
begin
  select * into actor from public.profiles where id = auth.uid();
  if not found or not private.has_content_studio_access(actor.ministry_id, true, false) then raise exception 'Content draft access is required.'; end if;
  if cardinality(p_feedback_ids) < 3 or (select count(distinct feedback.draft_id) from public.content_feedback feedback
      where feedback.ministry_id = actor.ministry_id and feedback.created_by_user_id = actor.id
        and feedback.id = any(p_feedback_ids) and feedback.batch_id is null) < 3
  then raise exception 'A learning batch requires feedback from at least three distinct drafts.'; end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) < 1 then raise exception 'At least one guide change is required.'; end if;
  if (select count(*) from public.content_feedback feedback where feedback.id = any(p_feedback_ids)
      and feedback.ministry_id = actor.ministry_id and feedback.created_by_user_id = actor.id and feedback.batch_id is null) <> cardinality(p_feedback_ids)
  then raise exception 'Feedback batch scope is invalid.'; end if;
  insert into public.content_feedback_batches(id, ministry_id, created_by_user_id, feedback_ids)
  values (p_batch_id, actor.ministry_id, actor.id, p_feedback_ids);
  for change_value in select value from jsonb_array_elements(p_changes) loop
    if not exists (select 1 from public.content_guides guide where guide.id = (change_value->>'sourceGuideVersionId')::uuid
      and guide.ministry_id = actor.ministry_id and guide.status = 'active') then raise exception 'A proposed change is based on a stale guide.'; end if;
    insert into public.content_feedback_batch_changes(
      ministry_id, batch_id, source_guide_version_id, proposed_body_markdown, proposed_guide_data, change_summary
    ) values (
      actor.ministry_id, p_batch_id, (change_value->>'sourceGuideVersionId')::uuid,
      change_value->>'proposedBodyMarkdown', coalesce(change_value->'proposedGuideData', '{}'::jsonb), change_value->>'changeSummary'
    );
  end loop;
  update public.content_feedback set batch_id = p_batch_id where id = any(p_feedback_ids) and ministry_id = actor.ministry_id;
  return p_batch_id;
end;
$$;

create or replace function public.approve_content_feedback_batch(p_batch_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype; batch public.content_feedback_batches%rowtype; change_row record; new_id uuid; next_version integer;
begin
  select * into actor from public.profiles where id = auth.uid();
  if not found or not private.has_content_studio_access(actor.ministry_id, true, true) then raise exception 'Administrator approval is required.'; end if;
  select * into batch from public.content_feedback_batches where id = p_batch_id and ministry_id = actor.ministry_id for update;
  if not found then raise exception 'Feedback batch not found.'; end if;
  if batch.status = 'approved' then return batch.id; end if;
  if batch.status <> 'pending' then raise exception 'Only a pending feedback batch can be approved.'; end if;
  if (select count(distinct feedback.draft_id) from public.content_feedback feedback where feedback.batch_id = batch.id) < 3
  then raise exception 'A learning batch requires feedback from at least three distinct drafts.'; end if;
  for change_row in select change.*, guide.guide_kind, guide.platform, guide.title
    from public.content_feedback_batch_changes change join public.content_guides guide on guide.id = change.source_guide_version_id
    where change.batch_id = batch.id for update of change
  loop
    if not exists (select 1 from public.content_guides guide where guide.id = change_row.source_guide_version_id and guide.status = 'active')
    then raise exception 'The active guide changed after this batch was proposed.'; end if;
    select coalesce(max(guide.version_number), 0) + 1 into next_version from public.content_guides guide
      where guide.ministry_id = actor.ministry_id and guide.guide_kind = change_row.guide_kind
        and guide.platform is not distinct from change_row.platform;
    update public.content_guides set status = 'retired' where id = change_row.source_guide_version_id;
    new_id := gen_random_uuid();
    insert into public.content_guides(id, ministry_id, guide_kind, platform, version_number, title, body_markdown,
      guide_data, status, parent_version_id, change_summary, created_by_user_id, approved_by_user_id)
    values (new_id, actor.ministry_id, change_row.guide_kind, change_row.platform, next_version, change_row.title,
      change_row.proposed_body_markdown, change_row.proposed_guide_data, 'active', change_row.source_guide_version_id,
      change_row.change_summary, batch.created_by_user_id, actor.id);
    update public.content_feedback_batch_changes set resulting_guide_version_id = new_id where id = change_row.id;
  end loop;
  update public.content_feedback_batches set status = 'approved', approved_by_user_id = actor.id, approved_at = now() where id = batch.id;
  return batch.id;
end;
$$;

create or replace function public.rollback_content_guide(p_target_version_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype; target public.content_guides%rowtype; active public.content_guides%rowtype; new_id uuid := gen_random_uuid(); next_version integer;
begin
  select * into actor from public.profiles where id = auth.uid();
  if not found or not private.has_content_studio_access(actor.ministry_id, true, true) then raise exception 'Administrator approval is required.'; end if;
  select * into target from public.content_guides where id = p_target_version_id and ministry_id = actor.ministry_id;
  if not found then raise exception 'Guide version not found.'; end if;
  select * into active from public.content_guides where ministry_id = actor.ministry_id and guide_kind = target.guide_kind
    and platform is not distinct from target.platform and status = 'active' for update;
  if not found then raise exception 'Active guide not found.'; end if;
  select max(version_number) + 1 into next_version from public.content_guides where ministry_id = actor.ministry_id
    and guide_kind = target.guide_kind and platform is not distinct from target.platform;
  update public.content_guides set status = 'retired' where id = active.id;
  insert into public.content_guides(id, ministry_id, guide_kind, platform, version_number, title, body_markdown, guide_data,
    status, parent_version_id, change_summary, created_by_user_id, approved_by_user_id)
  values (new_id, actor.ministry_id, target.guide_kind, target.platform, next_version, target.title, target.body_markdown,
    target.guide_data, 'active', active.id, 'Rollback to version ' || target.version_number || ': ' || trim(p_reason), actor.id, actor.id);
  return new_id;
end;
$$;

revoke all on function public.create_content_feedback_batch(uuid, uuid[], jsonb) from public, anon;
revoke all on function public.approve_content_feedback_batch(uuid) from public, anon;
revoke all on function public.rollback_content_guide(uuid, text) from public, anon;
grant execute on function public.create_content_feedback_batch(uuid, uuid[], jsonb) to authenticated;
grant execute on function public.approve_content_feedback_batch(uuid) to authenticated;
grant execute on function public.rollback_content_guide(uuid, text) to authenticated;

create or replace function private.seed_content_studio_guides()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.content_guides(ministry_id, guide_kind, platform, version_number, title, body_markdown, guide_data, status, change_summary)
  select new.id, seed.guide_kind, seed.platform, 1, seed.title, seed.body_markdown, seed.guide_data, 'active', 'Initial governed content studio guide'
  from jsonb_to_recordset($seed$[
    {"guide_kind":"voice","platform":null,"title":"Lead Emergence voice and anti-slop guide","body_markdown":"Write like a real ministry leader: specific, honest, warm, concrete, and recognizably ours. No generic scene-setting, empty superlatives, inflated urgency, fake testimony, invented details, stock AI phrases, habitual rhetorical flourishes, spiritual pressure, or inferred motives and diagnoses. Ask for missing facts. Test every draft for truth, specificity, natural voice, and a clear next step.","guide_data":{"editorialQuestions":["true","specific","recognizably ours","clear next step","sayable aloud"]}},
    {"guide_kind":"visual","platform":null,"title":"Lead Emergence visual style guide","body_markdown":"Use one focal idea, deep blue, warm parchment, restrained gold, real documentary imagery, generous space, clear hierarchy, accessible contrast, and destination-size legibility. Avoid fake crowds, glossy AI surrealism, plastic skin, excessive glow, random gradients, floating icons, and decorative clutter.","guide_data":{"palette":["deep blue","warm parchment","restrained gold"],"principles":["one focal idea","real imagery","clear hierarchy","accessible contrast"]}},
    {"guide_kind":"interviewer","platform":null,"title":"Content interviewer playbook","body_markdown":"Offer guided and skip paths equally. Ask one question at a time, choose unresolved dimensions dynamically, and stop when required ground is covered, the user finishes, or six answers are collected.","guide_data":{"maxQuestions":6,"minQuestions":3,"dimensions":[{"id":"purpose","label":"Purpose","objective":"the one outcome this content should create","priority":100,"required":true,"platformAffinity":[],"minWords":5,"maxAttempts":2,"probes":["What should be different after someone sees this?"],"followups":["What would a successful response look like in real life?"]},{"id":"audience","label":"Audience","objective":"the actual people being addressed","priority":90,"required":true,"platformAffinity":["facebook","instagram","groupme","linkedin","twitter"],"minWords":8,"maxAttempts":2,"probes":["Who specifically needs to hear this, and what is already on their mind?"],"followups":["What would make that person keep reading?"]},{"id":"substance","label":"Substance","objective":"the concrete detail that makes the idea worth sharing","priority":85,"required":true,"platformAffinity":["facebook","instagram","linkedin","twitter"],"minWords":12,"maxAttempts":2,"probes":["What specific detail makes this more than a generic announcement?"],"followups":["Which detail can we verify and safely share?"]},{"id":"response","label":"Response","objective":"the next step the audience can actually take","priority":75,"required":true,"platformAffinity":["groupme","facebook","instagram","church_slide"],"minWords":5,"maxAttempts":2,"probes":["What exactly should someone do next, and by when?"],"followups":["If they do only one thing, what should it be?"]},{"id":"tone","label":"Tone","objective":"the emotional register that feels natural","priority":55,"required":false,"platformAffinity":["linkedin","groupme","twitter"],"minWords":5,"maxAttempts":1,"probes":["How should this feel, and what should it not sound like?"],"followups":["Name one phrase you would naturally say."]},{"id":"visual","label":"Visual","objective":"the visual focal point and hierarchy","priority":70,"required":false,"platformAffinity":["instagram","church_slide"],"minWords":8,"maxAttempts":2,"probes":["What should someone understand from the visual first?"],"followups":["Which words must remain readable at the destination size?"]}]}},
    {"guide_kind":"platform","platform":"twitter","title":"twitter design guide","body_markdown":"One sharp idea, standard 280-character ceiling, at most one purposeful hashtag, and no miniature press release.","guide_data":{"bodyMode":"short_post","maxBodyCharacters":280,"allowedAspectRatios":[],"requiredDesignFields":[],"differentiators":["one claim","conversational compression","at most one hashtag"]}},
    {"guide_kind":"platform","platform":"facebook","title":"facebook design guide","body_markdown":"Mixed church-and-community context, short paragraphs, concrete next step, and real story or imagery over slogan art.","guide_data":{"bodyMode":"feed_post","maxBodyCharacters":1800,"allowedAspectRatios":["4:5","1:1","16:9"],"requiredDesignFields":[],"differentiators":["standalone context","short paragraphs","community-readable next step"]}},
    {"guide_kind":"platform","platform":"instagram","title":"instagram design guide","body_markdown":"Phone-first opening, 4:5, 1:1, or 9:16 art, caption-led story, no more than 14 overlay words, and useful alt text.","guide_data":{"bodyMode":"caption","maxBodyCharacters":2200,"maxOverlayWords":14,"allowedAspectRatios":["4:5","1:1","9:16"],"requiredDesignFields":["aspectRatio","overlayText","visualDirection","accessibilityText"],"differentiators":["phone-first hook","caption carries story","sparse overlay","alt text required"]}},
    {"guide_kind":"platform","platform":"church_slide","title":"church slide design guide","body_markdown":"Room-first 16:9 canvas, one glanceable headline, no more than 22 on-screen words, essential logistics, and distance legibility.","guide_data":{"bodyMode":"screen_copy","maxBodyCharacters":180,"maxOverlayWords":22,"allowedAspectRatios":["16:9"],"requiredDesignFields":["aspectRatio","overlayText","visualDirection","accessibilityText"],"differentiators":["room-distance legibility","one glance","16:9 only","logistics over narrative"]}},
    {"guide_kind":"platform","platform":"linkedin","title":"linkedin design guide","body_markdown":"Concrete observation, ethical leadership or formation relevance, earned reflection, and no corporate inspiration clichés.","guide_data":{"bodyMode":"professional_post","maxBodyCharacters":2200,"allowedAspectRatios":["1.91:1","1:1","4:5"],"requiredDesignFields":[],"differentiators":["professional relevance","ethical reflection","no corporate inspiration clichés"]}},
    {"guide_kind":"platform","platform":"groupme","title":"groupme design guide","body_markdown":"Useful teammate voice, logistics and action first, brief scanning, and no devotional preamble before the ask.","guide_data":{"bodyMode":"message","maxBodyCharacters":650,"allowedAspectRatios":[],"requiredDesignFields":[],"differentiators":["teammate voice","logistics first","brief and scannable"]}}
  ]$seed$::jsonb) as seed(guide_kind text, platform text, title text, body_markdown text, guide_data jsonb)
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.seed_content_studio_guides() from public, anon, authenticated, service_role;

drop trigger if exists seed_content_studio_guides_for_ministry on public.ministries;
create trigger seed_content_studio_guides_for_ministry after insert on public.ministries
for each row execute function private.seed_content_studio_guides();

do $$ declare ministry_row record; begin
  for ministry_row in select id from public.ministries loop
    insert into public.content_guides(ministry_id, guide_kind, platform, version_number, title, body_markdown, guide_data, status, change_summary)
    select ministry_row.id, seed.guide_kind, seed.platform, 1, seed.title, seed.body_markdown, seed.guide_data, 'active', 'Initial governed content studio guide'
    from jsonb_to_recordset($seed$[
      {"guide_kind":"voice","platform":null,"title":"Lead Emergence voice and anti-slop guide","body_markdown":"Write like a real ministry leader: specific, honest, warm, concrete, and recognizably ours. No generic scene-setting, empty superlatives, inflated urgency, fake testimony, invented details, stock AI phrases, habitual rhetorical flourishes, spiritual pressure, or inferred motives and diagnoses. Ask for missing facts.","guide_data":{}},
      {"guide_kind":"visual","platform":null,"title":"Lead Emergence visual style guide","body_markdown":"Use one focal idea, deep blue, warm parchment, restrained gold, real imagery, generous space, clear hierarchy, accessible contrast, and destination-size legibility.","guide_data":{}},
      {"guide_kind":"interviewer","platform":null,"title":"Content interviewer playbook","body_markdown":"Offer guided and skip paths equally. Ask one question at a time and stop by six answers.","guide_data":{"maxQuestions":6,"minQuestions":3,"dimensions":[{"id":"purpose","label":"Purpose","objective":"the outcome","priority":100,"required":true,"platformAffinity":[],"minWords":5,"maxAttempts":2,"probes":["What should be different after someone sees this?"],"followups":["What would success look like?"]},{"id":"audience","label":"Audience","objective":"the people","priority":90,"required":true,"platformAffinity":[],"minWords":8,"maxAttempts":2,"probes":["Who specifically needs this?"],"followups":["What is already on their mind?"]},{"id":"substance","label":"Substance","objective":"the concrete detail","priority":85,"required":true,"platformAffinity":[],"minWords":10,"maxAttempts":2,"probes":["What specific detail makes this worth sharing?"],"followups":["What can we verify?"]},{"id":"response","label":"Response","objective":"the next step","priority":75,"required":true,"platformAffinity":[],"minWords":5,"maxAttempts":2,"probes":["What should someone do next?"],"followups":["By when?"]},{"id":"visual","label":"Visual","objective":"the focal point","priority":70,"required":false,"platformAffinity":["instagram","church_slide"],"minWords":8,"maxAttempts":2,"probes":["What should the visual communicate first?"],"followups":["What must stay readable?"]}]}},
      {"guide_kind":"platform","platform":"twitter","title":"twitter design guide","body_markdown":"One sharp idea within 280 characters.","guide_data":{"bodyMode":"short_post","maxBodyCharacters":280,"allowedAspectRatios":[],"requiredDesignFields":[],"differentiators":["one claim"]}},
      {"guide_kind":"platform","platform":"facebook","title":"facebook design guide","body_markdown":"Standalone mixed-audience context and a clear next step.","guide_data":{"bodyMode":"feed_post","maxBodyCharacters":1800,"allowedAspectRatios":["4:5","1:1","16:9"],"requiredDesignFields":[],"differentiators":["standalone context"]}},
      {"guide_kind":"platform","platform":"instagram","title":"instagram design guide","body_markdown":"Phone-first caption with sparse overlay and alt text.","guide_data":{"bodyMode":"caption","maxBodyCharacters":2200,"maxOverlayWords":14,"allowedAspectRatios":["4:5","1:1","9:16"],"requiredDesignFields":["aspectRatio","overlayText","visualDirection","accessibilityText"],"differentiators":["caption carries story","alt text required"]}},
      {"guide_kind":"platform","platform":"church_slide","title":"church slide design guide","body_markdown":"Room-first 16:9 screen copy with at most 22 words.","guide_data":{"bodyMode":"screen_copy","maxBodyCharacters":180,"maxOverlayWords":22,"allowedAspectRatios":["16:9"],"requiredDesignFields":["aspectRatio","overlayText","visualDirection","accessibilityText"],"differentiators":["room-distance legibility","16:9 only"]}},
      {"guide_kind":"platform","platform":"linkedin","title":"linkedin design guide","body_markdown":"Concrete professional reflection without corporate clichés.","guide_data":{"bodyMode":"professional_post","maxBodyCharacters":2200,"allowedAspectRatios":["1.91:1","1:1","4:5"],"requiredDesignFields":[],"differentiators":["professional relevance"]}},
      {"guide_kind":"platform","platform":"groupme","title":"groupme design guide","body_markdown":"Useful teammate voice with logistics first.","guide_data":{"bodyMode":"message","maxBodyCharacters":650,"allowedAspectRatios":[],"requiredDesignFields":[],"differentiators":["logistics first"]}}
    ]$seed$::jsonb) as seed(guide_kind text, platform text, title text, body_markdown text, guide_data jsonb)
    on conflict do nothing;
  end loop;
end $$;

notify pgrst, 'reload schema';
