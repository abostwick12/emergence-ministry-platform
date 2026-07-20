-- Universal resource attachments.
--
-- This creates one shared attachment system for non-restricted ministry
-- resources. Sensitive Camp medical files remain in their existing restricted
-- buckets and tables.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resource-attachments',
  'resource-attachments',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = 26214400,
    allowed_mime_types = array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'video/mp4',
      'text/plain',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

create table if not exists public.resource_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_ministry_id() references public.ministries(id),
  parent_type text not null,
  parent_id text not null,
  title text not null,
  description text not null default '',
  resource_type text not null,
  storage_bucket text not null default 'resource-attachments',
  storage_path text,
  external_url text,
  original_filename text,
  mime_type text,
  file_size_bytes integer,
  display_order integer not null default 0,
  visibility text not null default 'inherit_parent',
  is_featured boolean not null default false,
  is_downloadable boolean not null default true,
  opens_in_new_tab boolean not null default true,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint resource_attachments_parent_type_supported check (
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
      'communication_draft'
    )
  ),
  constraint resource_attachments_resource_type_supported check (
    resource_type in (
      'document',
      'pdf',
      'image',
      'audio',
      'video',
      'slides',
      'spreadsheet',
      'form',
      'external_link',
      'google_drive',
      'youtube',
      'other'
    )
  ),
  constraint resource_attachments_visibility_supported check (
    visibility in (
      'admin_only',
      'staff_admin',
      'volunteer_leaders',
      'assigned_leaders',
      'students',
      'parents',
      'authenticated',
      'public',
      'inherit_parent'
    )
  ),
  constraint resource_attachments_file_size_positive check (
    file_size_bytes is null or (file_size_bytes > 0 and file_size_bytes <= 26214400)
  ),
  constraint resource_attachments_single_location check (
    num_nonnulls(storage_path, external_url) = 1
  ),
  constraint resource_attachments_link_types_use_url check (
    (
      resource_type in ('external_link', 'google_drive', 'youtube')
      and external_url is not null
    )
    or (
      resource_type not in ('external_link', 'google_drive', 'youtube')
      and storage_path is not null
    )
  ),
  constraint resource_attachments_external_url_safe check (
    external_url is null or external_url ~* '^https?://'
  ),
  constraint resource_attachments_no_camp_restricted_bucket check (
    storage_bucket = 'resource-attachments'
  )
);

drop trigger if exists set_resource_attachments_updated_at on public.resource_attachments;
create trigger set_resource_attachments_updated_at
before update on public.resource_attachments
for each row execute function public.set_updated_at();

create index if not exists idx_resource_attachments_parent
  on public.resource_attachments(organization_id, parent_type, parent_id, archived_at, display_order, created_at);
create index if not exists idx_resource_attachments_storage_path
  on public.resource_attachments(storage_bucket, storage_path)
  where storage_path is not null;
create index if not exists idx_resource_attachments_visibility
  on public.resource_attachments(organization_id, visibility, archived_at);

create table if not exists public.resource_attachment_audit (
  id uuid primary key default gen_random_uuid(),
  resource_attachment_id uuid references public.resource_attachments(id) on delete set null,
  organization_id uuid not null default public.current_ministry_id() references public.ministries(id),
  parent_type text not null,
  parent_id text not null,
  action text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  changed_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint resource_attachment_audit_action_supported check (
    action in (
      'resource_uploaded',
      'external_link_added',
      'metadata_edited',
      'file_replaced',
      'visibility_changed',
      'resource_reordered',
      'resource_archived',
      'resource_restored',
      'resource_permanently_deleted'
    )
  ),
  constraint resource_attachment_audit_parent_type_supported check (
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
      'communication_draft'
    )
  )
);

create index if not exists idx_resource_attachment_audit_attachment
  on public.resource_attachment_audit(resource_attachment_id, created_at desc);
create index if not exists idx_resource_attachment_audit_parent
  on public.resource_attachment_audit(organization_id, parent_type, parent_id, created_at desc);

alter table public.resource_attachments enable row level security;
alter table public.resource_attachment_audit enable row level security;

drop policy if exists "ministry can select resource attachments" on public.resource_attachments;
drop policy if exists "admins can insert resource attachments" on public.resource_attachments;
drop policy if exists "admins can update resource attachments" on public.resource_attachments;
drop policy if exists "admins can delete resource attachments" on public.resource_attachments;
create policy "ministry can select resource attachments" on public.resource_attachments
for select to authenticated using (
  organization_id = public.current_ministry_id()
  and (
    visibility in ('public', 'authenticated')
    or public.current_user_role() in ('admin', 'leader', 'staff')
    or (visibility = 'students' and public.current_user_role() = 'student')
    or (visibility = 'parents' and public.current_user_role() = 'parent')
  )
);
create policy "admins can insert resource attachments" on public.resource_attachments
for insert to authenticated with check (
  organization_id = public.current_ministry_id()
  and public.current_user_role() = 'admin'
);
create policy "admins can update resource attachments" on public.resource_attachments
for update to authenticated using (
  organization_id = public.current_ministry_id()
  and public.current_user_role() = 'admin'
)
with check (
  organization_id = public.current_ministry_id()
  and public.current_user_role() = 'admin'
);
create policy "admins can delete resource attachments" on public.resource_attachments
for delete to authenticated using (
  organization_id = public.current_ministry_id()
  and public.current_user_role() = 'admin'
);

drop policy if exists "ministry can select resource attachment audit" on public.resource_attachment_audit;
drop policy if exists "admins can insert resource attachment audit" on public.resource_attachment_audit;
create policy "ministry can select resource attachment audit" on public.resource_attachment_audit
for select to authenticated using (
  organization_id = public.current_ministry_id()
  and public.current_user_role() in ('admin', 'leader', 'staff')
);
create policy "admins can insert resource attachment audit" on public.resource_attachment_audit
for insert to authenticated with check (
  organization_id = public.current_ministry_id()
  and public.current_user_role() = 'admin'
);

drop policy if exists "visible resource attachment objects" on storage.objects;
drop policy if exists "admins can insert resource attachment objects" on storage.objects;
drop policy if exists "admins can delete resource attachment objects" on storage.objects;
create policy "visible resource attachment objects" on storage.objects
for select to authenticated
using (
  bucket_id = 'resource-attachments'
  and exists (
    select 1
    from public.resource_attachments attachment
    where attachment.storage_bucket = storage.objects.bucket_id
      and attachment.storage_path = storage.objects.name
      and attachment.organization_id = public.current_ministry_id()
      and attachment.archived_at is null
      and (
        attachment.visibility in ('public', 'authenticated')
        or public.current_user_role() in ('admin', 'leader', 'staff')
        or (attachment.visibility = 'students' and public.current_user_role() = 'student')
        or (attachment.visibility = 'parents' and public.current_user_role() = 'parent')
      )
  )
);
create policy "admins can insert resource attachment objects" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'resource-attachments'
  and name like ('organizations/' || public.current_ministry_id()::text || '/%')
  and public.current_user_role() = 'admin'
);
create policy "admins can delete resource attachment objects" on storage.objects
for delete to authenticated
using (
  bucket_id = 'resource-attachments'
  and name like ('organizations/' || public.current_ministry_id()::text || '/%')
  and public.current_user_role() = 'admin'
);

grant select on public.resource_attachments to authenticated;
grant insert, update, delete on public.resource_attachments to authenticated;
grant select, insert on public.resource_attachment_audit to authenticated;

notify pgrst, 'reload schema';
