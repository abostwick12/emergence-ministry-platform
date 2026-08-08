-- Content Studio web assets and page registration.
-- Additive/idempotent: extends the existing private attachment system for
-- Meridian content drafts and raises the private bucket limit for rendered reels.

update storage.buckets
set public = false,
    file_size_limit = 104857600
where id = 'resource-attachments';

alter table public.resource_attachments
  drop constraint if exists resource_attachments_parent_type_supported;

alter table public.resource_attachments
  add constraint resource_attachments_parent_type_supported check (
    parent_type in (
      'event',
      'event_task',
      'how_to_read_section',
      'how_to_read_lesson',
      'journey_journal',
      'journey_journal_week',
      'journey_journal_day',
      'volunteer_training',
      'volunteer_training_module',
      'weekly_leader_prep',
      'sermon',
      'leader_guide',
      'small_group_resource',
      'worship_plan',
      'communication_draft',
      'content_draft'
    )
  );

alter table public.resource_attachments
  drop constraint if exists resource_attachments_file_size_positive;

alter table public.resource_attachments
  add constraint resource_attachments_file_size_positive check (
    file_size_bytes is null or (file_size_bytes > 0 and file_size_bytes <= 104857600)
  );

alter table public.resource_attachment_audit
  drop constraint if exists resource_attachment_audit_parent_type_supported;

alter table public.resource_attachment_audit
  add constraint resource_attachment_audit_parent_type_supported check (
    parent_type in (
      'event',
      'event_task',
      'how_to_read_section',
      'how_to_read_lesson',
      'journey_journal',
      'journey_journal_week',
      'journey_journal_day',
      'volunteer_training',
      'volunteer_training_module',
      'weekly_leader_prep',
      'sermon',
      'leader_guide',
      'small_group_resource',
      'worship_plan',
      'communication_draft',
      'content_draft'
    )
  );

insert into public.guest_public_page_permissions (page_key, is_public)
values ('content_studio', false)
on conflict (page_key) do update set is_public = false;

notify pgrst, 'reload schema';
