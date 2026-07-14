-- Harden Planning Center integration table grants.
-- Keep Data API access limited to authenticated users and rely on RLS policies
-- for ministry-scoped row authorization.

revoke all privileges on table public.ministry_integrations from public;
revoke all privileges on table public.planning_center_people_refs from public;
revoke all privileges on table public.planning_center_attendance_refs from public;
revoke all privileges on table public.planning_center_sync_runs from public;

revoke all privileges on table public.ministry_integrations from anon;
revoke all privileges on table public.planning_center_people_refs from anon;
revoke all privileges on table public.planning_center_attendance_refs from anon;
revoke all privileges on table public.planning_center_sync_runs from anon;

revoke all privileges on table public.ministry_integrations from authenticated;
revoke all privileges on table public.planning_center_people_refs from authenticated;
revoke all privileges on table public.planning_center_attendance_refs from authenticated;
revoke all privileges on table public.planning_center_sync_runs from authenticated;

grant select, insert, update, delete on table public.ministry_integrations to authenticated;
grant select, insert, update, delete on table public.planning_center_people_refs to authenticated;
grant select, insert, update, delete on table public.planning_center_attendance_refs to authenticated;
grant select, insert on table public.planning_center_sync_runs to authenticated;
