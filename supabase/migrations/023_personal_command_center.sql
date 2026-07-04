-- 023_personal_command_center.sql
-- Personal Command Center (SAGE) foundation for Andrew Bostwick.
--
-- NOT APPLIED. Review and apply only with explicit approval.
--
-- These tables are intentionally NOT ministry-scoped. This is a single-user
-- personal executive assistant feature, isolated from the EMERGE ministry
-- data model entirely. Access is enforced purely by RLS against the
-- authenticated user's email address (see lib/command-center/access.ts for
-- the matching application-layer gate).
--
-- Additive and idempotent: safe to run multiple times. No data is deleted.

create extension if not exists pgcrypto;

-- Shared updated_at helper already exists (migration 005), created here too
-- so this migration remains self-contained if run against a fresh database.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. personal_tasks -----------------------------------------------------

create table if not exists public.personal_tasks (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('military_transition', 'sotf_fellowship', 'job_search', 'life')),
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  due_date date,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_personal_tasks_updated_at on public.personal_tasks;
create trigger set_personal_tasks_updated_at
before update on public.personal_tasks
for each row execute function public.set_updated_at();

create index if not exists idx_personal_tasks_domain on public.personal_tasks(domain);
create index if not exists idx_personal_tasks_status on public.personal_tasks(status);
create index if not exists idx_personal_tasks_due_date on public.personal_tasks(due_date);

-- 2. daily_briefing_cache -------------------------------------------------

create table if not exists public.daily_briefing_cache (
  id uuid primary key default gen_random_uuid(),
  cache_date date not null unique,
  items jsonb not null default '[]',
  generated_at timestamptz not null default now()
);

-- 3. ai_conversations -----------------------------------------------------

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_conversations_session on public.ai_conversations(session_id, created_at);

-- 4. personal_integrations -------------------------------------------------

create table if not exists public.personal_integrations (
  id uuid primary key default gen_random_uuid(),
  service text not null unique check (service in ('slack', 'google_calendar', 'gmail', 'google_drive', 'linkedin', 'monday')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  config jsonb not null default '{}',
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_personal_integrations_updated_at on public.personal_integrations;
create trigger set_personal_integrations_updated_at
before update on public.personal_integrations
for each row execute function public.set_updated_at();

insert into public.personal_integrations (service, status)
values
  ('slack', 'disconnected'),
  ('google_calendar', 'disconnected'),
  ('gmail', 'disconnected'),
  ('google_drive', 'disconnected'),
  ('linkedin', 'disconnected'),
  ('monday', 'disconnected')
on conflict (service) do nothing;

-- 5. sage_memory ------------------------------------------------------------

create table if not exists public.sage_memory (
  id uuid primary key default gen_random_uuid(),
  memory_type text not null check (memory_type in ('fact', 'preference', 'context', 'relationship')),
  content text not null,
  domain text,
  created_at timestamptz not null default now(),
  last_referenced_at timestamptz
);

create index if not exists idx_sage_memory_domain on public.sage_memory(domain);

-- 6. capture_inbox ------------------------------------------------------------

create table if not exists public.capture_inbox (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null,
  status text not null default 'unprocessed' check (status in ('unprocessed', 'processed', 'discarded')),
  routed_domain text check (routed_domain in ('military_transition', 'sotf_fellowship', 'job_search', 'life')),
  routed_task_id uuid references public.personal_tasks(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_capture_inbox_status on public.capture_inbox(status);

-- 7. job_applications ------------------------------------------------------------

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  role text not null,
  status text not null default 'applied' check (status in ('researching', 'applied', 'phone_screen', 'interview', 'offer', 'rejected', 'withdrawn')),
  applied_date date,
  contact_name text,
  contact_notes text,
  next_follow_up_date date,
  compensation_notes text,
  job_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_job_applications_updated_at on public.job_applications;
create trigger set_job_applications_updated_at
before update on public.job_applications
for each row execute function public.set_updated_at();

create index if not exists idx_job_applications_status on public.job_applications(status);
create index if not exists idx_job_applications_follow_up on public.job_applications(next_follow_up_date);

-- 8. Row Level Security: Andrew-only ----------------------------------------
-- Every table in this migration is scoped to a single authenticated email.
-- There is no ministry, no role table, and no delegation for this feature.

alter table public.personal_tasks enable row level security;
alter table public.daily_briefing_cache enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.personal_integrations enable row level security;
alter table public.sage_memory enable row level security;
alter table public.capture_inbox enable row level security;
alter table public.job_applications enable row level security;

drop policy if exists "andrew only" on public.personal_tasks;
create policy "andrew only" on public.personal_tasks
for all to authenticated
using (auth.email() = 'andrew.w.bostwick12@gmail.com')
with check (auth.email() = 'andrew.w.bostwick12@gmail.com');

drop policy if exists "andrew only" on public.daily_briefing_cache;
create policy "andrew only" on public.daily_briefing_cache
for all to authenticated
using (auth.email() = 'andrew.w.bostwick12@gmail.com')
with check (auth.email() = 'andrew.w.bostwick12@gmail.com');

drop policy if exists "andrew only" on public.ai_conversations;
create policy "andrew only" on public.ai_conversations
for all to authenticated
using (auth.email() = 'andrew.w.bostwick12@gmail.com')
with check (auth.email() = 'andrew.w.bostwick12@gmail.com');

drop policy if exists "andrew only" on public.personal_integrations;
create policy "andrew only" on public.personal_integrations
for all to authenticated
using (auth.email() = 'andrew.w.bostwick12@gmail.com')
with check (auth.email() = 'andrew.w.bostwick12@gmail.com');

drop policy if exists "andrew only" on public.sage_memory;
create policy "andrew only" on public.sage_memory
for all to authenticated
using (auth.email() = 'andrew.w.bostwick12@gmail.com')
with check (auth.email() = 'andrew.w.bostwick12@gmail.com');

drop policy if exists "andrew only" on public.capture_inbox;
create policy "andrew only" on public.capture_inbox
for all to authenticated
using (auth.email() = 'andrew.w.bostwick12@gmail.com')
with check (auth.email() = 'andrew.w.bostwick12@gmail.com');

drop policy if exists "andrew only" on public.job_applications;
create policy "andrew only" on public.job_applications
for all to authenticated
using (auth.email() = 'andrew.w.bostwick12@gmail.com')
with check (auth.email() = 'andrew.w.bostwick12@gmail.com');

grant select, insert, update, delete on public.personal_tasks to authenticated;
grant select, insert, update, delete on public.daily_briefing_cache to authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, update, delete on public.personal_integrations to authenticated;
grant select, insert, update, delete on public.sage_memory to authenticated;
grant select, insert, update, delete on public.capture_inbox to authenticated;
grant select, insert, update, delete on public.job_applications to authenticated;

notify pgrst, 'reload schema';
