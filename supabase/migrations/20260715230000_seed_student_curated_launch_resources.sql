-- Reconcile the curated launch resources that were previously available only
-- through the application's local fallback. IDs are deterministic per ministry
-- so this migration is safe to replay without overwriting leader-managed edits.

with launch_resources as (
  select *
  from (values
    (
      'launch-curated-garden-trust',
      'practice',
      'practice',
      'Walk the garden slowly',
      'A short creation walk for questions about trust, choice, and the garden.',
      'Take a quiet walk. Notice created things before you try to solve the question. Then read Genesis 2-3 and ask what God gives before the command appears.',
      array['Genesis 2', 'Genesis 3']::text[],
      array['garden', 'creation', 'trust', 'choice']::text[],
      array['tree', 'eden', 'evil', 'choice', 'garden']::text[],
      'Name three gifts in creation before naming the problem you are trying to solve.',
      '/student/scripture/resources',
      10
    ),
    (
      'launch-curated-lament-prayer',
      'prayer',
      'reflect',
      'Pray without rushing grief',
      'A guided lament rhythm for suffering, anxiety, and unanswered questions.',
      'Read Psalm 13 slowly. Let the questions stay honest, then name one thing you can still ask God to hold with you.',
      array['Psalm 13', 'Romans 8:18']::text[],
      array['lament', 'suffering', 'anxiety', 'hope']::text[],
      array['pain', 'suffering', 'anxiety', 'grief', 'pointless']::text[],
      'Breathe, tell God the truth in one sentence, then sit quietly for one minute before writing anything else.',
      '/student/scripture/resources',
      20
    ),
    (
      'launch-curated-context-tool',
      'reading_tool',
      'read',
      'Read around the question',
      'A context tool for any passage that feels confusing or too familiar.',
      'Read the paragraph before and after the passage. Write one sentence about what is happening before you decide what it means for you.',
      array[]::text[],
      array['context', 'reading', 'questions', 'study']::text[],
      array['what does', 'why did', 'confusing', 'mean']::text[],
      'Start with what the passage says, then what it reveals, then what response it invites.',
      '/student/scripture/how-to-read',
      30
    )
  ) as resource(
    seed_key,
    kind,
    journey_stage,
    title,
    summary,
    body,
    scripture_references,
    themes,
    question_patterns,
    practice_prompt,
    href,
    sort_order
  )
), ministry_launch_resources as (
  select
    (
      substr(md5(ministry.id::text || ':' || resource.seed_key), 1, 8) || '-' ||
      substr(md5(ministry.id::text || ':' || resource.seed_key), 9, 4) || '-' ||
      '5' || substr(md5(ministry.id::text || ':' || resource.seed_key), 14, 3) || '-' ||
      '8' || substr(md5(ministry.id::text || ':' || resource.seed_key), 18, 3) || '-' ||
      substr(md5(ministry.id::text || ':' || resource.seed_key), 21, 12)
    )::uuid as id,
    ministry.id as ministry_id,
    resource.kind,
    resource.journey_stage,
    resource.title,
    resource.summary,
    resource.body,
    resource.scripture_references,
    resource.themes,
    resource.question_patterns,
    resource.practice_prompt,
    resource.href,
    resource.sort_order
  from public.ministries as ministry
  cross join launch_resources as resource
)
insert into public.student_curated_resources (
  id,
  ministry_id,
  kind,
  journey_stage,
  title,
  summary,
  body,
  scripture_references,
  themes,
  question_patterns,
  practice_prompt,
  href,
  sort_order,
  is_active,
  created_at,
  updated_at
)
select
  id,
  ministry_id,
  kind,
  journey_stage,
  title,
  summary,
  body,
  scripture_references,
  themes,
  question_patterns,
  practice_prompt,
  href,
  sort_order,
  true,
  timestamptz '2026-07-11 00:00:00+00',
  timestamptz '2026-07-11 00:00:00+00'
from ministry_launch_resources
on conflict (id) do nothing;
