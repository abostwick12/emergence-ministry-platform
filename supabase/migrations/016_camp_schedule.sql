-- 016_camp_schedule.sql
-- Adds core Camp Oakwood schedule persistence and vehicle archive support.
--
-- Additive and idempotent. Existing Camp roster, medical, medication, import,
-- team, and vehicle records are not deleted or rewritten.

alter table public.camp_vehicles add column if not exists departure_location text not null default '';
alter table public.camp_vehicles add column if not exists notes text not null default '';
alter table public.camp_vehicles add column if not exists archived_at timestamptz;

alter table public.camp_teams add column if not exists notes text not null default '';

create table if not exists public.camp_schedule_items (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  camp_id uuid not null references public.camp_sessions(id) on delete cascade,
  title text not null,
  day text not null default '',
  time text not null default '',
  date date,
  start_time time,
  end_time time,
  location text not null default '',
  owner text not null default '',
  audience text not null default 'All Camp' check (audience in ('All Camp','Leaders','Medical Team')),
  notes text not null default '',
  status text not null default 'Planned' check (status in ('Planned','Confirmed','Needs Review','Canceled')),
  visibility text not null default 'All Camp' check (visibility in ('All Camp','Leaders Only','Medical Only')),
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_camp_schedule_items_updated_at on public.camp_schedule_items;
create trigger set_camp_schedule_items_updated_at before update on public.camp_schedule_items
for each row execute function public.set_updated_at();

drop trigger if exists set_camp_schedule_items_ministry_id on public.camp_schedule_items;
create trigger set_camp_schedule_items_ministry_id before insert on public.camp_schedule_items
for each row execute function public.set_ministry_id_if_null();

create index if not exists idx_camp_vehicles_active
  on public.camp_vehicles(camp_id, display_order)
  where archived_at is null;

create index if not exists idx_camp_schedule_items_camp
  on public.camp_schedule_items(camp_id, date, start_time, display_order)
  where archived_at is null;

create index if not exists idx_camp_schedule_items_ministry
  on public.camp_schedule_items(ministry_id);

alter table public.camp_schedule_items enable row level security;

drop policy if exists "ministry can select camp_schedule_items" on public.camp_schedule_items;
drop policy if exists "staff can insert camp_schedule_items" on public.camp_schedule_items;
drop policy if exists "staff can update camp_schedule_items" on public.camp_schedule_items;

create policy "ministry can select camp_schedule_items" on public.camp_schedule_items
for select to authenticated using (ministry_id = public.current_ministry_id());

create policy "staff can insert camp_schedule_items" on public.camp_schedule_items
for insert to authenticated
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

create policy "staff can update camp_schedule_items" on public.camp_schedule_items
for update to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

notify pgrst, 'reload schema';
