-- 030_harden_student_question_recommendation_grants.sql
-- Keep student recommendation history append-only through the Data API. RLS
-- already blocks update/delete, but explicit grants should match the intended
-- access model.

revoke update, delete, truncate, trigger on public.student_question_recommendations from authenticated;
grant select, insert on public.student_question_recommendations to authenticated;
