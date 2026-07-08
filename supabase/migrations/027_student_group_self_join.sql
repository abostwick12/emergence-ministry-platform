-- 027_student_group_self_join.sql
-- Adds leader-created student groups and self-join invite links for the
-- Scripture in New Frontiers small-group pilot.

create extension if not exists pgcrypto;

create table if not exists public.student_groups (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text not null check (char_length(trim(slug)) between 2 and 90),
  is_active boolean not null default true,
  created_by_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, slug)
);

create table if not exists public.student_group_invites (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  group_id uuid not null references public.student_groups(id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9-]{8,80}$'),
  label text not null default 'Student invite',
  is_active boolean not null default true,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  created_by_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_group_members (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  group_id uuid not null references public.student_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);

alter table public.student_discussion_prompts
add column if not exists group_id uuid references public.student_groups(id) on delete set null;

drop trigger if exists set_student_groups_updated_at on public.student_groups;
create trigger set_student_groups_updated_at
before update on public.student_groups
for each row execute function public.set_updated_at();

drop trigger if exists set_student_group_invites_updated_at on public.student_group_invites;
create trigger set_student_group_invites_updated_at
before update on public.student_group_invites
for each row execute function public.set_updated_at();

drop trigger if exists set_student_group_members_updated_at on public.student_group_members;
create trigger set_student_group_members_updated_at
before update on public.student_group_members
for each row execute function public.set_updated_at();

drop trigger if exists set_student_groups_ministry_id on public.student_groups;
create trigger set_student_groups_ministry_id
before insert on public.student_groups
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_student_group_invites_ministry_id on public.student_group_invites;
create trigger set_student_group_invites_ministry_id
before insert on public.student_group_invites
for each row execute function public.set_ministry_id_if_null();

drop trigger if exists set_student_group_members_ministry_id on public.student_group_members;
create trigger set_student_group_members_ministry_id
before insert on public.student_group_members
for each row execute function public.set_ministry_id_if_null();

create index if not exists idx_student_groups_ministry_created
  on public.student_groups(ministry_id, created_at desc);
create index if not exists idx_student_group_invites_ministry_created
  on public.student_group_invites(ministry_id, created_at desc);
create index if not exists idx_student_group_invites_code
  on public.student_group_invites(code);
create index if not exists idx_student_group_members_group
  on public.student_group_members(group_id, status);
create index if not exists idx_student_group_members_user
  on public.student_group_members(user_id, status);
create index if not exists idx_student_discussion_prompts_group_created
  on public.student_discussion_prompts(group_id, created_at desc);

alter table public.student_groups enable row level security;
alter table public.student_group_invites enable row level security;
alter table public.student_group_members enable row level security;

drop policy if exists "students can select own groups" on public.student_groups;
drop policy if exists "leaders can manage ministry student groups" on public.student_groups;
drop policy if exists "leaders can select ministry student groups" on public.student_groups;

create policy "students can select own groups" on public.student_groups
for select to authenticated
using (
  ministry_id = public.current_ministry_id()
  and exists (
    select 1
    from public.student_group_members m
    where m.group_id = id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "leaders can select ministry student groups" on public.student_groups
for select to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

create policy "leaders can manage ministry student groups" on public.student_groups
for all to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

drop policy if exists "leaders can manage ministry student invites" on public.student_group_invites;

create policy "leaders can manage ministry student invites" on public.student_group_invites
for all to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

drop policy if exists "students can select own group memberships" on public.student_group_members;
drop policy if exists "leaders can manage ministry student memberships" on public.student_group_members;
drop policy if exists "leaders can select ministry student memberships" on public.student_group_members;

create policy "students can select own group memberships" on public.student_group_members
for select to authenticated
using (ministry_id = public.current_ministry_id() and user_id = (select auth.uid()));

create policy "leaders can select ministry student memberships" on public.student_group_members
for select to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

create policy "leaders can manage ministry student memberships" on public.student_group_members
for all to authenticated
using (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'))
with check (ministry_id = public.current_ministry_id() and public.current_user_role() in ('admin','leader','staff'));

grant select, insert, update on table public.student_groups to authenticated;
grant select, insert, update on table public.student_group_invites to authenticated;
grant select, insert, update on table public.student_group_members to authenticated;
