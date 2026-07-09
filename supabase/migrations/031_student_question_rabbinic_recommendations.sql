-- 031_student_question_rabbinic_recommendations.sql
-- Adds first-class saved recommendation kinds for the student question rhythm:
-- wrestle with your question, dig deeper, reflect, pray, and wrestle together.

alter table public.student_question_recommendations
  drop constraint if exists student_question_recommendations_recommendation_kind_check;

alter table public.student_question_recommendations
  add constraint student_question_recommendations_recommendation_kind_check
  check (
    recommendation_kind in (
      'wrestle_question',
      'dig_question',
      'journal_prompt',
      'prayer_prompt',
      'wrestle_together',
      'reading_plan',
      'resource',
      'scripture_lookup',
      'leader_context'
    )
  );
