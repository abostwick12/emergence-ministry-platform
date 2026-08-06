-- Store the exact Journey Journal routing decision and source-attributed AI draft
-- on the already leader-reviewed student question. The parent prompt status is
-- the publication gate; students must not receive journey_content while the
-- prompt remains pending_review or changes_requested.

alter table public.student_discussion_prompts
  add column if not exists journey_selection jsonb,
  add column if not exists journey_content jsonb;

alter table public.student_discussion_prompts
  drop constraint if exists student_discussion_prompts_journey_selection_object_check;

alter table public.student_discussion_prompts
  add constraint student_discussion_prompts_journey_selection_object_check
  check (journey_selection is null or jsonb_typeof(journey_selection) = 'object');

alter table public.student_discussion_prompts
  drop constraint if exists student_discussion_prompts_journey_content_object_check;

alter table public.student_discussion_prompts
  add constraint student_discussion_prompts_journey_content_object_check
  check (journey_content is null or jsonb_typeof(journey_content) = 'object');

create index if not exists idx_student_discussion_prompts_journey_match_status
  on public.student_discussion_prompts ((journey_selection ->> 'status'))
  where journey_selection is not null;

comment on column public.student_discussion_prompts.journey_selection is
  'Strict passage-routing decision, confidence, why-this-passage rationale, and passage relationship evidence. Provider topic tags are not authoritative routing input.';

comment on column public.student_discussion_prompts.journey_content is
  'Source-attributed AI-assisted Receive/Explore/Practice/Walk/See draft. It inherits the parent prompt leader-review gate and must never be exposed while the parent prompt is unapproved.';
