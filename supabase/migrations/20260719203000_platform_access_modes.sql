-- Three-mode platform access for registered users and invite links.
-- Additive and idempotent. Do not apply to production without confirming target project.

alter table public.platform_user_access
  add column if not exists access_mode text not null default 'save'
  check (access_mode in ('demo', 'read_only', 'save'));

alter table public.platform_registration_invites
  add column if not exists access_mode text not null default 'read_only'
  check (access_mode in ('demo', 'read_only', 'save'));

update public.platform_user_access
set access_mode = case
  when can_save_changes is false then 'read_only'
  else 'save'
end
where access_mode is null
  or access_mode not in ('demo', 'read_only', 'save');

update public.platform_registration_invites
set access_mode = case
  when can_save_changes is true then 'save'
  else 'read_only'
end
where access_mode is null
  or access_mode not in ('demo', 'read_only', 'save');

notify pgrst, 'reload schema';
