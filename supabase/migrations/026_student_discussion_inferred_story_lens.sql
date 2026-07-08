-- 026_student_discussion_inferred_story_lens.sql
-- Keeps the story lens internal to the platform instead of requiring students
-- to choose a metanarrative movement before submitting a question.

alter table public.student_discussion_prompts
  alter column metanarrative_movement drop not null;
