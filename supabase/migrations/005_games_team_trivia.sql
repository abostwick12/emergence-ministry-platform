create extension if not exists pgcrypto;

do $$ begin
  create type game_type as enum ('team_trivia');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type game_status as enum ('draft', 'ready', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type game_question_type as enum ('multiple_choice');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type game_session_status as enum ('lobby', 'active', 'category_intro', 'question_open', 'question_closed', 'answer_revealed', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid,
  title text not null,
  description text not null default '',
  game_type game_type not null default 'team_trivia',
  status game_status not null default 'draft',
  default_question_duration_seconds integer not null default 30 check (default_question_duration_seconds between 5 and 300),
  default_base_points integer not null default 1000 check (default_base_points >= 0),
  default_speed_bonus_points integer not null default 300 check (default_speed_bonus_points >= 0),
  randomize_answer_order boolean not null default true,
  audio_settings jsonb not null default '{"enabled":false,"muted":true,"volume":0.7}'::jsonb,
  celebration_settings jsonb not null default '{"enabled":true,"suspenseCountdownSeconds":3,"confetti":true,"fireworks":false,"trophy":true}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists game_audio_tracks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  track_name text not null,
  file_url text not null,
  duration_seconds numeric(8, 2) not null check (duration_seconds > 0),
  intended_use text not null check (intended_use in ('countdown', 'tiebreaker', 'final_reveal', 'warning', 'expired', 'winner')),
  loop boolean not null default false,
  align_to_countdown_end boolean not null default true,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists game_categories (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  sort_order integer not null default 1,
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists game_questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  category_id uuid not null references game_categories(id) on delete cascade,
  question_text text not null,
  question_type game_question_type not null default 'multiple_choice',
  explanation text,
  media_url text,
  audio_track_id uuid references game_audio_tracks(id) on delete set null,
  time_limit_seconds integer not null default 30 check (time_limit_seconds between 5 and 300),
  base_points integer not null default 1000 check (base_points >= 0),
  speed_bonus_points integer not null default 300 check (speed_bonus_points >= 0),
  sort_order integer not null default 1,
  is_tiebreaker boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists game_answer_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references game_questions(id) on delete cascade,
  answer_text text not null,
  is_correct boolean not null default false,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists game_answer_options_one_correct
  on game_answer_options(question_id)
  where is_correct;

create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  ministry_id uuid,
  join_code text not null unique,
  join_pin text,
  status game_session_status not null default 'lobby',
  current_category_id uuid references game_categories(id) on delete set null,
  current_question_id uuid references game_questions(id) on delete set null,
  current_question_duration_seconds integer check (current_question_duration_seconds between 5 and 300),
  current_question_started_at timestamptz,
  current_question_closed_at timestamptz,
  answers_revealed_at timestamptz,
  introduced_category_ids uuid[] not null default '{}',
  late_joining_enabled boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists game_teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  team_name text not null,
  team_color text not null default '#2563eb',
  connection_token_hash text not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_connected boolean not null default true,
  is_removed boolean not null default false,
  final_rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists game_teams_session_name_ci
  on game_teams(session_id, lower(team_name))
  where is_removed = false;

create table if not exists game_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  question_id uuid not null references game_questions(id) on delete cascade,
  team_id uuid not null references game_teams(id) on delete cascade,
  answer_option_id uuid not null references game_answer_options(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  response_time_ms integer not null check (response_time_ms >= 0),
  is_correct boolean not null,
  base_points_awarded integer not null default 0 check (base_points_awarded >= 0),
  speed_bonus_awarded integer not null default 0 check (speed_bonus_awarded >= 0),
  total_points_awarded integer not null default 0 check (total_points_awarded >= 0),
  created_at timestamptz not null default now(),
  unique (session_id, question_id, team_id)
);

create table if not exists game_score_adjustments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  team_id uuid not null references game_teams(id) on delete cascade,
  question_id uuid references game_questions(id) on delete set null,
  points_delta integer not null,
  reason text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists game_session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('staff', 'team', 'system')),
  actor_id text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create schema if not exists app_private;

create or replace function app_private.submit_game_response(
  p_session_id uuid,
  p_team_id uuid,
  p_question_id uuid,
  p_answer_option_id uuid
) returns game_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session game_sessions%rowtype;
  v_team game_teams%rowtype;
  v_question game_questions%rowtype;
  v_answer game_answer_options%rowtype;
  v_submitted_at timestamptz := now();
  v_response_time_ms integer;
  v_duration_ms integer;
  v_speed_bonus integer := 0;
  v_total integer := 0;
  v_response game_responses%rowtype;
begin
  select * into v_session from game_sessions where id = p_session_id for update;
  if not found or v_session.status <> 'question_open' or v_session.current_question_id <> p_question_id then
    raise exception 'Responses are closed.';
  end if;

  select * into v_team from game_teams where id = p_team_id and session_id = p_session_id and is_removed = false;
  if not found then
    raise exception 'Team is not active.';
  end if;

  select * into v_question from game_questions where id = p_question_id and game_id = v_session.game_id;
  select * into v_answer from game_answer_options where id = p_answer_option_id and question_id = p_question_id;
  if not found then
    raise exception 'Answer does not belong to the active question.';
  end if;

  v_response_time_ms := greatest(0, floor(extract(epoch from (v_submitted_at - v_session.current_question_started_at)) * 1000)::integer);
  v_duration_ms := coalesce(v_session.current_question_duration_seconds, v_question.time_limit_seconds) * 1000;
  if v_response_time_ms > v_duration_ms then
    raise exception 'That answer arrived after the timer ended.';
  end if;

  if v_answer.is_correct then
    v_speed_bonus := round(v_question.speed_bonus_points * greatest(0, 1 - (v_response_time_ms::numeric / greatest(v_duration_ms, 1))))::integer;
    v_total := v_question.base_points + v_speed_bonus;
  end if;

  insert into game_responses (
    session_id, question_id, team_id, answer_option_id, submitted_at, response_time_ms,
    is_correct, base_points_awarded, speed_bonus_awarded, total_points_awarded
  )
  values (
    p_session_id, p_question_id, p_team_id, p_answer_option_id, v_submitted_at, v_response_time_ms,
    v_answer.is_correct, case when v_answer.is_correct then v_question.base_points else 0 end, v_speed_bonus, v_total
  )
  returning * into v_response;

  insert into game_session_events(session_id, event_type, actor_type, actor_id, event_data)
  values (p_session_id, 'response_received', 'team', p_team_id::text, jsonb_build_object('questionId', p_question_id));

  return v_response;
end;
$$;

alter table games enable row level security;
alter table game_audio_tracks enable row level security;
alter table game_categories enable row level security;
alter table game_questions enable row level security;
alter table game_answer_options enable row level security;
alter table game_sessions enable row level security;
alter table game_teams enable row level security;
alter table game_responses enable row level security;
alter table game_score_adjustments enable row level security;
alter table game_session_events enable row level security;

create policy "staff_read_games" on games for select to authenticated using (true);
create policy "staff_write_games" on games for all to authenticated using (true) with check (true);
create policy "staff_read_game_children" on game_categories for select to authenticated using (true);
create policy "staff_write_game_categories" on game_categories for all to authenticated using (true) with check (true);
create policy "staff_read_game_questions" on game_questions for select to authenticated using (true);
create policy "staff_write_game_questions" on game_questions for all to authenticated using (true) with check (true);
create policy "staff_read_game_answers" on game_answer_options for select to authenticated using (true);
create policy "staff_write_game_answers" on game_answer_options for all to authenticated using (true) with check (true);
create policy "staff_read_game_audio" on game_audio_tracks for select to authenticated using (true);
create policy "staff_write_game_audio" on game_audio_tracks for all to authenticated using (true) with check (true);
create policy "staff_manage_sessions" on game_sessions for all to authenticated using (true) with check (true);
create policy "staff_manage_teams" on game_teams for all to authenticated using (true) with check (true);
create policy "staff_read_responses" on game_responses for select to authenticated using (true);
create policy "staff_manage_adjustments" on game_score_adjustments for all to authenticated using (true) with check (true);
create policy "staff_read_events" on game_session_events for select to authenticated using (true);

create policy "public_no_direct_session_browse" on game_sessions for select to anon using (false);
create policy "public_no_direct_team_browse" on game_teams for select to anon using (false);
create policy "public_no_direct_team_insert" on game_teams for insert to anon with check (false);
create policy "public_insert_responses_via_function" on game_responses for insert to anon with check (false);
