-- Add archive lifecycle metadata to ministry events.
-- Additive/idempotent: active events remain active, and hard delete is limited
-- to archived rows for administrators in the same ministry.

alter table public.events add column if not exists archived_at timestamptz;
alter table public.events add column if not exists archived_by_user_id uuid references public.profiles(id) on delete set null;
alter table public.events add column if not exists archive_reason text not null default '';

create index if not exists idx_events_active_start
  on public.events(ministry_id, start_date)
  where archived_at is null;

create index if not exists idx_events_archived_at
  on public.events(ministry_id, archived_at)
  where archived_at is not null;

drop policy if exists "ministry can delete events" on public.events;
drop policy if exists "admin can delete archived events" on public.events;
create policy "admin can delete archived events" on public.events
for delete to authenticated
using (
  ministry_id = public.current_ministry_id()
  and public.current_user_role() = 'admin'
  and archived_at is not null
);

notify pgrst, 'reload schema';
