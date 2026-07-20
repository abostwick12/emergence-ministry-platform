-- Align Volunteer Hub persistence with Supabase advisor feedback.
-- Applied after 20260720144927_volunteer_hub_persistence.

revoke execute on function public.current_user_is_ministry_operator() from anon;
revoke execute on function public.current_user_is_ministry_operator() from public;
grant execute on function public.current_user_is_ministry_operator() to authenticated;
grant execute on function public.current_user_is_ministry_operator() to service_role;

create index if not exists volunteer_hub_attendance_reviews_reviewed_by_idx
  on public.volunteer_hub_attendance_reviews(reviewed_by_user_id)
  where reviewed_by_user_id is not null;

create index if not exists volunteer_hub_audit_entries_actor_idx
  on public.volunteer_hub_audit_entries(actor_user_id)
  where actor_user_id is not null;

create index if not exists volunteer_hub_chat_previews_sender_idx
  on public.volunteer_hub_chat_previews(sender_user_id)
  where sender_user_id is not null;

create index if not exists volunteer_hub_event_leader_assignments_assigned_by_idx
  on public.volunteer_hub_event_leader_assignments(assigned_by_user_id)
  where assigned_by_user_id is not null;

create index if not exists volunteer_hub_follow_ups_created_by_idx
  on public.volunteer_hub_follow_ups(created_by_user_id)
  where created_by_user_id is not null;

create index if not exists volunteer_hub_follow_ups_volunteer_leader_idx
  on public.volunteer_hub_follow_ups(volunteer_leader_id)
  where volunteer_leader_id is not null;

create index if not exists volunteer_hub_items_created_by_idx
  on public.volunteer_hub_items(created_by_user_id)
  where created_by_user_id is not null;

create index if not exists volunteer_hub_leaders_created_by_idx
  on public.volunteer_hub_leaders(created_by_user_id)
  where created_by_user_id is not null;

create index if not exists volunteer_hub_services_created_by_idx
  on public.volunteer_hub_services(created_by_user_id)
  where created_by_user_id is not null;

create index if not exists volunteer_hub_small_groups_co_leader_idx
  on public.volunteer_hub_small_groups(co_leader_id)
  where co_leader_id is not null;

create index if not exists volunteer_hub_small_groups_created_by_idx
  on public.volunteer_hub_small_groups(created_by_user_id)
  where created_by_user_id is not null;

create index if not exists volunteer_hub_small_groups_leader_idx
  on public.volunteer_hub_small_groups(leader_id)
  where leader_id is not null;

notify pgrst, 'reload schema';
