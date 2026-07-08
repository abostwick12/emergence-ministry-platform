# Personal Command Center Readiness

This document records the Phase 1A baseline and Phase 1B chat runtime for
Andrew's Personal Command Center.

## Phase 1A Scope

Phase 1A includes:

- Andrew-only access boundary through `lib/command-center/access.ts`
- protected `/command-center` route shell
- additive Supabase schema in `supabase/migrations/023_personal_command_center.sql`
- production-safe schema repair path in
  `supabase/migrations/024_personal_command_center_repair.sql`
- repository plus mock fallback pattern in `lib/command-center/repository.ts`
- dashboard overview
- personal task create, update, status move, and delete
- quick capture inbox with explicit approve-or-discard review
- job application tracker with pipeline status and follow-up dates
- planned integration status placeholders

No production migration has been applied by this PR.

## Production Migration Repair

`supabase/migrations/023_personal_command_center.sql` shares the `023_` prefix
with `023_camp_grouped_medication_workflow.sql`. Supabase migration history is
tracked by version prefix, so the Personal Command Center schema should be
applied through `supabase/migrations/024_personal_command_center_repair.sql`
instead of applying the duplicate-prefix `023` migration directly.

The `024` repair migration preserves the Personal Command Center schema,
recreates Andrew-only RLS policies idempotently, seeds disconnected integration
placeholders with `ON CONFLICT DO NOTHING`, and reloads the PostgREST schema
cache. It is intended to be safe whether `023_personal_command_center.sql`
partially ran or never ran.

## Phase 1B Scope

Phase 1B adds:

- `/api/command-center/chat` Andrew-only streaming route
- real `/command-center/chat` chat UI
- server-only OpenAI SDK dependency
- direct OpenAI and Azure OpenAI provider selection
- `OPENAI_API_KEY` / `OPENAI_MODEL` environment documentation
- Azure OpenAI environment documentation
- graceful unavailable state when provider config is absent
- user and assistant message persistence through `ai_conversations`
- task-aware SAGE prompt context built only from open Command Center tasks
- basic SAGE system prompt and `command_center.task_aware_chat` skill file

SAGE Phase 1B could advise from Command Center task/context data only. It could not
take actions outside the Command Center, call integrations, or execute tools.
This has since evolved: read-only Google Calendar and Gmail context are now
included in chat when those integrations are connected — see "Increment 8"
in [`command-center-integrations.md`](./command-center-integrations.md) for
the updated guardrails. SAGE still cannot execute tools, take an action, or
write to any integration from chat.

## SAGE Provider Selection

SAGE defaults to direct OpenAI. Set `SAGE_AI_PROVIDER=azure` to use Azure OpenAI
instead. Provider selection, missing-config detection, Azure client setup, and
secret-safe config reporting are isolated in `lib/command-center/sage.ts`; the
chat route keeps the same `/api/command-center/chat` streaming contract.

Direct OpenAI provider setup:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Azure OpenAI provider setup:

```env
SAGE_AI_PROVIDER=azure
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_DEPLOYMENT=
AZURE_OPENAI_API_VERSION=2024-10-21
```

Azure OpenAI uses a deployment name, not just a model name. If Andrew's Azure
deployment is named `emma-camp-test`, set
`AZURE_OPENAI_DEPLOYMENT=emma-camp-test`.

SAGE streaming uses Azure OpenAI's Responses API v1 route by deriving
`/openai/v1/` from `AZURE_OPENAI_ENDPOINT`. `AZURE_OPENAI_API_VERSION` remains
documented for compatibility with other Azure OpenAI helpers, but SAGE does not
send it on Responses API requests.

For local development, add the selected provider variables to `.env.local`.
For Vercel, add the same variables in the project Environment Variables page
for the intended environment, without pasting secret values into chat, commits,
GitHub comments, screenshots, or docs.

Azure OpenAI is preferred when Andrew's Azure funding is available. Direct
OpenAI remains supported as the default provider and fallback path.

## Security Boundary

The Command Center is Andrew-only. Access is granted only when the authenticated
session email matches `COMMAND_CENTER_EMAIL` in `lib/command-center/access.ts`.

Command Center data must not be available to:

- EMMA ministry workflows
- Camp EMMA workflows
- Camp staff, leader, medical, transportation, or guardian views
- ministry Admin/Leader users who are not Andrew

SAGE must not read student, camp medical, pastoral, or ministry-restricted
records unless a future approved bridge documents a narrower safe workflow.

## Persistence

The schema creates personal tables for:

- `personal_tasks`
- `daily_briefing_cache`
- `sage_memory`
- `ai_conversations`
- `personal_integrations`
- `capture_inbox`
- `job_applications`

RLS policies are Andrew-only through `auth.email()`. The migration is additive
and should be applied only after the target Supabase environment is confirmed.

Local development and tests use deterministic in-memory mock data when Supabase
is not configured or the session is mock mode.

## Deferred Work

Phase 1A deliberately did not include:

- SAGE chat
- OpenAI streaming
- SAGE memory behavior
- AI function calling
- Google, Slack, Firecrawl, Monday.com, LinkedIn, Gmail, Calendar, or Drive
  integrations
- automatic task creation from quick capture
- production data mutation
- deployment or merge

Future SAGE skills beyond chat should continue under the shared AI conventions
in `docs/architecture/ai-skill-system.md`, with assistant-specific prompts in
the SAGE namespace and data access kept inside the Command Center boundary.

Phase 1B still deliberately does not include:

- Slack, Google OAuth, Gmail, Calendar, Drive, Firecrawl, Monday.com, or
  LinkedIn integrations
- automatic memory saving
- autonomous actions
- function/tool calling
- Vercel cron

## Known Gaps

- `daily_briefing_cache` and `sage_memory` are schema placeholders only.
- Integration cards are disconnected placeholders only.
- No live provider credentials are required for local fallback behavior.

See [`command-center-integrations.md`](./command-center-integrations.md) for
the integration priority order, required env vars, and approval rules that
govern how each integration is added once this baseline is in place.
