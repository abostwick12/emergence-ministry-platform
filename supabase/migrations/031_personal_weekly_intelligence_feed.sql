-- 031_personal_weekly_intelligence_feed.sql
-- SAGE Weekly Intelligence Feed foundation for the Personal Command Center.
--
-- NOT APPLIED. Review and apply only with explicit approval.
--
-- Extends the personal_* schema from 023/024 with tables for the Drive-
-- sourced weekly intelligence feed. Table names are prefixed personal_ (not
-- the spec's bare "knowledge_sources"/"knowledge_items") because
-- public.knowledge_sources already exists for the unrelated Student Portal
-- Scripture RAG spine (029_scripture_knowledge_rag_spine.sql) -- this avoids
-- colliding with that schema.
--
-- Same isolation model as every other Command Center table: not
-- ministry-scoped, RLS enforced purely against the authenticated user's
-- email (see lib/command-center/access.ts).
--
-- Additive and idempotent: safe to run multiple times. No data is deleted.

-- 1. personal_knowledge_sources ---------------------------------------------

create table if not exists public.personal_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  google_drive_file_id text not null unique,
  file_name text not null,
  file_path text not null,
  source_type text not null check (source_type in ('article', 'podcast', 'video', 'linkedin', 'report')),
  title text not null,
  source_name text,
  author_or_host text,
  url text,
  date_found date,
  imported_at timestamptz not null default now(),
  last_modified_at timestamptz,
  content_hash text not null,
  status text not null default 'new' check (status in ('new', 'included', 'skipped', 'archived')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_personal_knowledge_sources_updated_at on public.personal_knowledge_sources;
create trigger set_personal_knowledge_sources_updated_at
before update on public.personal_knowledge_sources
for each row execute function public.set_updated_at();

create index if not exists idx_personal_knowledge_sources_status on public.personal_knowledge_sources(status);
create index if not exists idx_personal_knowledge_sources_source_type on public.personal_knowledge_sources(source_type);
create index if not exists idx_personal_knowledge_sources_date_found on public.personal_knowledge_sources(date_found);

-- 2. personal_knowledge_items ------------------------------------------------

create table if not exists public.personal_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.personal_knowledge_sources(id) on delete cascade,
  summary text not null,
  key_takeaways text,
  topic_tags text[] not null default '{}',
  relevance_score numeric,
  ministry_application text,
  command_center_application text,
  theological_or_discipleship_connection text,
  career_readiness_connection text,
  caveats text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_personal_knowledge_items_updated_at on public.personal_knowledge_items;
create trigger set_personal_knowledge_items_updated_at
before update on public.personal_knowledge_items
for each row execute function public.set_updated_at();

create index if not exists idx_personal_knowledge_items_source on public.personal_knowledge_items(source_id);
create index if not exists idx_personal_knowledge_items_relevance on public.personal_knowledge_items(relevance_score);

-- 3. personal_weekly_feeds ----------------------------------------------------

create table if not exists public.personal_weekly_feeds (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  title text not null,
  executive_summary text not null,
  top_topics text[] not null default '{}',
  app_platform_implications text,
  ministry_implications text,
  suggested_action_items text,
  created_at timestamptz not null default now(),
  created_by text,
  unique (week_start)
);

create index if not exists idx_personal_weekly_feeds_week_start on public.personal_weekly_feeds(week_start);

-- 4. personal_weekly_feed_items ------------------------------------------------

create table if not exists public.personal_weekly_feed_items (
  id uuid primary key default gen_random_uuid(),
  weekly_feed_id uuid not null references public.personal_weekly_feeds(id) on delete cascade,
  knowledge_item_id uuid not null references public.personal_knowledge_items(id) on delete cascade,
  rank int not null,
  section text not null,
  reason_included text,
  recommended_action text,
  confidence_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_personal_weekly_feed_items_feed on public.personal_weekly_feed_items(weekly_feed_id);
create index if not exists idx_personal_weekly_feed_items_rank on public.personal_weekly_feed_items(weekly_feed_id, rank);

-- 5. personal_feed_run_logs ------------------------------------------------------

create table if not exists public.personal_feed_run_logs (
  id uuid primary key default gen_random_uuid(),
  run_started_at timestamptz not null default now(),
  run_completed_at timestamptz,
  triggered_by text not null default 'manual',
  status text not null check (status in ('running', 'succeeded', 'failed')),
  files_scanned int not null default 0,
  files_imported int not null default 0,
  files_skipped int not null default 0,
  errors_count int not null default 0,
  error_details jsonb not null default '[]',
  model_used text,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index if not exists idx_personal_feed_run_logs_started_at on public.personal_feed_run_logs(run_started_at);

-- 6. Row Level Security: Andrew-only ------------------------------------------
-- Same single-email policy as every other Command Center table.

alter table public.personal_knowledge_sources enable row level security;
alter table public.personal_knowledge_items enable row level security;
alter table public.personal_weekly_feeds enable row level security;
alter table public.personal_weekly_feed_items enable row level security;
alter table public.personal_feed_run_logs enable row level security;

drop policy if exists "andrew only" on public.personal_knowledge_sources;
create policy "andrew only" on public.personal_knowledge_sources
for all to authenticated
using (auth.email() = 'andrew.w.bostwick12@gmail.com')
with check (auth.email() = 'andrew.w.bostwick12@gmail.com');

drop policy if exists "andrew only" on public.personal_knowledge_items;
create policy "andrew only" on public.personal_knowledge_items
for all to authenticated
using (auth.email() = 'andrew.w.bostwick12@gmail.com')
with check (auth.email() = 'andrew.w.bostwick12@gmail.com');

drop policy if exists "andrew only" on public.personal_weekly_feeds;
create policy "andrew only" on public.personal_weekly_feeds
for all to authenticated
using (auth.email() = 'andrew.w.bostwick12@gmail.com')
with check (auth.email() = 'andrew.w.bostwick12@gmail.com');

drop policy if exists "andrew only" on public.personal_weekly_feed_items;
create policy "andrew only" on public.personal_weekly_feed_items
for all to authenticated
using (auth.email() = 'andrew.w.bostwick12@gmail.com')
with check (auth.email() = 'andrew.w.bostwick12@gmail.com');

drop policy if exists "andrew only" on public.personal_feed_run_logs;
create policy "andrew only" on public.personal_feed_run_logs
for all to authenticated
using (auth.email() = 'andrew.w.bostwick12@gmail.com')
with check (auth.email() = 'andrew.w.bostwick12@gmail.com');

grant select, insert, update, delete on public.personal_knowledge_sources to authenticated;
grant select, insert, update, delete on public.personal_knowledge_items to authenticated;
grant select, insert, update, delete on public.personal_weekly_feeds to authenticated;
grant select, insert, update, delete on public.personal_weekly_feed_items to authenticated;
grant select, insert, update, delete on public.personal_feed_run_logs to authenticated;

notify pgrst, 'reload schema';
