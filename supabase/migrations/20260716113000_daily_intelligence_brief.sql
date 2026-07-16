create table if not exists public.daily_intelligence_resource_queue (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid references public.ministries(id) on delete cascade,
  week_start date not null,
  day text not null check (day in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  topic text not null,
  resource_type text not null check (resource_type in ('article','podcast','video','social','ministry_resource','game')),
  title text not null,
  url text not null,
  source text not null,
  summary text not null default '',
  why_included text not null default '',
  score integer not null default 0,
  created_at timestamptz not null default now(),
  unique (ministry_id, week_start, url)
);

create index if not exists daily_intelligence_resource_queue_lookup_idx
  on public.daily_intelligence_resource_queue (ministry_id, week_start, day, score desc);

create table if not exists public.daily_intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid references public.ministries(id) on delete cascade,
  run_date date not null,
  status text not null check (status in ('sent','preview','failed')),
  slack_sent_at timestamptz,
  warnings text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists daily_intelligence_runs_lookup_idx
  on public.daily_intelligence_runs (ministry_id, run_date desc, created_at desc);

alter table public.daily_intelligence_resource_queue enable row level security;
alter table public.daily_intelligence_runs enable row level security;

drop policy if exists "daily intelligence queue scoped select" on public.daily_intelligence_resource_queue;
create policy "daily intelligence queue scoped select"
on public.daily_intelligence_resource_queue
for select to authenticated
using (ministry_id = public.current_ministry_id());

drop policy if exists "daily intelligence run scoped select" on public.daily_intelligence_runs;
create policy "daily intelligence run scoped select"
on public.daily_intelligence_runs
for select to authenticated
using (ministry_id = public.current_ministry_id());

