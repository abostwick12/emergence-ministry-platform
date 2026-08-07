-- Repair the private-discovery bundle update policy without weakening its
-- requirement for a passed provenance record. The original policy queried the
-- provenance table directly; that table's read policy queries bundles, causing
-- PostgreSQL to reject the circular RLS evaluation with error 42P17.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.meridian_mcp_has_passed_private_provenance(
  p_bundle_id uuid,
  p_ministry_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.meridian_mcp_resource_bundles bundle
    join public.meridian_mcp_access_grants grant_row
      on grant_row.ministry_id = bundle.ministry_id
     and grant_row.user_id = (select auth.uid())
     and grant_row.revoked_at is null
     and grant_row.can_save_resources
    join public.meridian_mcp_bundle_private_provenance provenance
      on provenance.bundle_id = bundle.id
     and provenance.ministry_id = bundle.ministry_id
     and provenance.check_status = 'passed'
    where bundle.id = p_bundle_id
      and bundle.ministry_id = p_ministry_id
      and bundle.created_by_user_id = (select auth.uid())
      and bundle.emma_status = 'not_reviewed'
      and bundle.human_review_status = 'pending'
      and bundle.active_emma_review_id is null
      and bundle.status in ('creating','review_required')
  );
$$;

revoke all on function private.meridian_mcp_has_passed_private_provenance(uuid, uuid) from public, anon, service_role;
grant execute on function private.meridian_mcp_has_passed_private_provenance(uuid, uuid) to authenticated;

drop policy if exists "mcp creators complete unreviewed resource bundles"
  on public.meridian_mcp_resource_bundles;

create policy "mcp creators complete unreviewed resource bundles"
on public.meridian_mcp_resource_bundles for update to authenticated
using (
  created_by_user_id = (select auth.uid())
  and emma_status = 'not_reviewed'
  and human_review_status = 'pending'
  and active_emma_review_id is null
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
  and human_review_status = 'pending'
  and active_emma_review_id is null
  and status in ('creating','review_required')
  and (
    private_discovery_status = 'not_used'
    or (select private.meridian_mcp_has_passed_private_provenance(id, ministry_id))
  )
);
