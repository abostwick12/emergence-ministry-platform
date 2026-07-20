-- Live GroupMe support for the Volunteer Hub.
-- Additive only. Tokens remain encrypted in the private schema and messages
-- can only be sent through an explicit server-side, human-reviewed action.

alter table public.ministry_integrations
  drop constraint if exists ministry_integrations_provider_check;

alter table public.ministry_integrations
  add constraint ministry_integrations_provider_check
  check (provider in ('planning_center', 'groupme'));

create schema if not exists lead_emergence_private;

revoke all on schema lead_emergence_private from public;
revoke all on schema lead_emergence_private from anon;
revoke all on schema lead_emergence_private from authenticated;
grant usage on schema lead_emergence_private to service_role;

create table if not exists lead_emergence_private.groupme_tokens (
  ministry_id uuid primary key references public.ministries(id) on delete cascade,
  access_token_ciphertext text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table lead_emergence_private.groupme_tokens from public;
revoke all on table lead_emergence_private.groupme_tokens from anon;
revoke all on table lead_emergence_private.groupme_tokens from authenticated;
grant select, insert, update, delete on table lead_emergence_private.groupme_tokens to service_role;

alter table public.volunteer_hub_small_groups
  add column if not exists group_me_group_id text,
  add column if not exists group_me_group_name text;

alter table public.volunteer_hub_chat_previews
  add column if not exists external_message_id text,
  add column if not exists source_guid text;

create index if not exists volunteer_hub_small_groups_groupme_idx
  on public.volunteer_hub_small_groups(ministry_id, group_me_group_id)
  where group_me_group_id is not null;

create unique index if not exists volunteer_hub_chat_previews_source_guid_idx
  on public.volunteer_hub_chat_previews(ministry_id, source_guid)
  where source_guid is not null;

notify pgrst, 'reload schema';
