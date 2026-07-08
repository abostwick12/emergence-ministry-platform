-- 028_harden_student_group_self_join_grants.sql
-- Keep student self-join tables closed to anonymous API access and limit
-- authenticated grants to the operations used by the app.

revoke all privileges on table public.student_groups from anon;
revoke all privileges on table public.student_group_invites from anon;
revoke all privileges on table public.student_group_members from anon;

revoke all privileges on table public.student_groups from authenticated;
revoke all privileges on table public.student_group_invites from authenticated;
revoke all privileges on table public.student_group_members from authenticated;

grant select, insert, update on table public.student_groups to authenticated;
grant select, insert, update on table public.student_group_invites to authenticated;
grant select, insert, update on table public.student_group_members to authenticated;
