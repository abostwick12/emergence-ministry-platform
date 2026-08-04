-- Expands the authenticated MCP from approved Meridian knowledge into guarded
-- platform operations. Capabilities remain opt-in and all generated resources
-- enter human/EMMA review without publish, send, or delete permissions.

alter table public.meridian_mcp_access_grants
  add column if not exists can_read_platform boolean not null default false,
  add column if not exists can_manage_events boolean not null default false,
  add column if not exists can_manage_tasks boolean not null default false,
  add column if not exists can_save_resources boolean not null default false;

create table if not exists public.meridian_mcp_resource_bundles (
  id uuid primary key,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 240),
  destination_type text not null check (destination_type in ('event','weekly_leader_prep')),
  destination_id text not null check (char_length(destination_id) between 1 and 120),
  status text not null default 'creating' check (status in ('creating','review_required','changes_requested','approved','rejected','blocked')),
  emma_status text not null default 'not_reviewed' check (emma_status in ('not_reviewed','changes_required','blocked','passed')),
  client_name text not null check (char_length(client_name) between 1 and 120),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, created_by_user_id, idempotency_key)
);

create table if not exists public.meridian_mcp_resource_bundle_items (
  id uuid primary key,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  bundle_id uuid not null references public.meridian_mcp_resource_bundles(id) on delete cascade,
  artifact_kind text not null check (artifact_kind in ('sermon_support','leader_guide','discussion_questions','slide_plan','activity','devotional','curriculum','other')),
  title text not null check (char_length(title) between 1 and 160),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  attachment_id uuid references public.resource_attachments(id) on delete set null,
  position integer not null default 0 check (position between 0 and 7),
  status text not null default 'creating' check (status in ('creating','review_required','changes_requested','approved','rejected','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bundle_id, position)
);

drop trigger if exists set_meridian_mcp_resource_bundles_updated_at on public.meridian_mcp_resource_bundles;
create trigger set_meridian_mcp_resource_bundles_updated_at
before update on public.meridian_mcp_resource_bundles
for each row execute function public.set_updated_at();

drop trigger if exists set_meridian_mcp_resource_bundle_items_updated_at on public.meridian_mcp_resource_bundle_items;
create trigger set_meridian_mcp_resource_bundle_items_updated_at
before update on public.meridian_mcp_resource_bundle_items
for each row execute function public.set_updated_at();

create index if not exists idx_meridian_mcp_resource_bundles_destination
  on public.meridian_mcp_resource_bundles(ministry_id, destination_type, destination_id, created_at desc);
create index if not exists idx_meridian_mcp_resource_bundles_review
  on public.meridian_mcp_resource_bundles(ministry_id, status, emma_status, created_at desc);
create index if not exists idx_meridian_mcp_resource_bundle_items_bundle
  on public.meridian_mcp_resource_bundle_items(ministry_id, bundle_id, position);

alter table public.meridian_mcp_resource_bundles enable row level security;
alter table public.meridian_mcp_resource_bundle_items enable row level security;

drop policy if exists "mcp creators insert own resource bundles" on public.meridian_mcp_resource_bundles;
drop policy if exists "mcp creators and reviewers read resource bundles" on public.meridian_mcp_resource_bundles;
drop policy if exists "mcp creators complete unreviewed resource bundles" on public.meridian_mcp_resource_bundles;
drop policy if exists "mcp creators insert own resource bundle items" on public.meridian_mcp_resource_bundle_items;
drop policy if exists "resource bundle readers read items" on public.meridian_mcp_resource_bundle_items;
drop policy if exists "mcp creators attach unreviewed resource bundle items" on public.meridian_mcp_resource_bundle_items;

create policy "mcp creators insert own resource bundles"
on public.meridian_mcp_resource_bundles for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and status = 'creating'
  and emma_status = 'not_reviewed'
  and exists (
    select 1 from public.meridian_mcp_access_grants grant_row
    where grant_row.ministry_id = meridian_mcp_resource_bundles.ministry_id
      and grant_row.user_id = (select auth.uid())
      and grant_row.revoked_at is null
      and grant_row.can_save_resources
  )
);

create policy "mcp creators and reviewers read resource bundles"
on public.meridian_mcp_resource_bundles for select to authenticated
using (
  created_by_user_id = (select auth.uid())
  or exists (
    select 1 from public.meridian_mcp_access_grants grant_row
    where grant_row.ministry_id = meridian_mcp_resource_bundles.ministry_id
      and grant_row.user_id = (select auth.uid())
      and grant_row.revoked_at is null
      and grant_row.access_level in ('leader_creator','admin')
  )
);

create policy "mcp creators complete unreviewed resource bundles"
on public.meridian_mcp_resource_bundles for update to authenticated
using (
  created_by_user_id = (select auth.uid())
  and emma_status = 'not_reviewed'
  and status in ('creating','review_required')
  and exists (
    select 1 from public.meridian_mcp_access_grants grant_row
    where grant_row.ministry_id = meridian_mcp_resource_bundles.ministry_id
      and grant_row.user_id = (select auth.uid())
      and grant_row.revoked_at is null
      and grant_row.can_save_resources
  )
)
with check (
  created_by_user_id = (select auth.uid())
  and emma_status = 'not_reviewed'
  and status in ('creating','review_required')
);

create policy "mcp creators insert own resource bundle items"
on public.meridian_mcp_resource_bundle_items for insert to authenticated
with check (
  status = 'creating'
  and attachment_id is null
  and exists (
    select 1 from public.meridian_mcp_resource_bundles bundle
    join public.meridian_mcp_access_grants grant_row
      on grant_row.ministry_id = bundle.ministry_id
     and grant_row.user_id = (select auth.uid())
     and grant_row.revoked_at is null
     and grant_row.can_save_resources
    where bundle.id = meridian_mcp_resource_bundle_items.bundle_id
      and bundle.ministry_id = meridian_mcp_resource_bundle_items.ministry_id
      and bundle.created_by_user_id = (select auth.uid())
      and bundle.status = 'creating'
      and bundle.emma_status = 'not_reviewed'
  )
);

create policy "resource bundle readers read items"
on public.meridian_mcp_resource_bundle_items for select to authenticated
using (exists (
  select 1 from public.meridian_mcp_resource_bundles bundle
  where bundle.id = meridian_mcp_resource_bundle_items.bundle_id
    and bundle.ministry_id = meridian_mcp_resource_bundle_items.ministry_id
    and (
      bundle.created_by_user_id = (select auth.uid())
      or exists (
        select 1 from public.meridian_mcp_access_grants grant_row
        where grant_row.ministry_id = bundle.ministry_id
          and grant_row.user_id = (select auth.uid())
          and grant_row.revoked_at is null
          and grant_row.access_level in ('leader_creator','admin')
      )
    )
));

create policy "mcp creators attach unreviewed resource bundle items"
on public.meridian_mcp_resource_bundle_items for update to authenticated
using (exists (
  select 1 from public.meridian_mcp_resource_bundles bundle
  join public.meridian_mcp_access_grants grant_row
    on grant_row.ministry_id = bundle.ministry_id
   and grant_row.user_id = (select auth.uid())
   and grant_row.revoked_at is null
   and grant_row.can_save_resources
  where bundle.id = meridian_mcp_resource_bundle_items.bundle_id
    and bundle.created_by_user_id = (select auth.uid())
    and bundle.emma_status = 'not_reviewed'
))
with check (status in ('creating','review_required'));

grant select on public.meridian_mcp_resource_bundles to authenticated;
grant insert on public.meridian_mcp_resource_bundles to authenticated;
grant update (status) on public.meridian_mcp_resource_bundles to authenticated;
grant select on public.meridian_mcp_resource_bundle_items to authenticated;
grant insert on public.meridian_mcp_resource_bundle_items to authenticated;
grant update (attachment_id, status) on public.meridian_mcp_resource_bundle_items to authenticated;

revoke all on public.meridian_mcp_resource_bundles from anon;
revoke all on public.meridian_mcp_resource_bundle_items from anon;
