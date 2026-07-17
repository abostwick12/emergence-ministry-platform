-- 030_student_discussion_ai_provider_fallbacks.sql
-- Allow Meridian student-question drafts to record Gloo-primary fallback providers.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'student_discussion_prompts_ai_provider_check'
      and conrelid = 'public.student_discussion_prompts'::regclass
  ) then
    alter table public.student_discussion_prompts
      drop constraint student_discussion_prompts_ai_provider_check;
  end if;
end $$;

alter table public.student_discussion_prompts
  add constraint student_discussion_prompts_ai_provider_check
  check (ai_provider in ('gloo', 'gemini', 'openai'));
