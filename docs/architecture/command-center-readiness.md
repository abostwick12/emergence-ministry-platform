# Personal Command Center Readiness

This document records the Phase 1A foundation and Phase 1B SAGE chat boundary
for Andrew's Personal Command Center.

## Phase 1A Scope

Phase 1A includes:

- Andrew-only access boundary through `lib/command-center/access.ts`
- protected `/command-center` route shell
- additive Supabase schema in `supabase/migrations/023_personal_command_center.sql`
- repository plus mock fallback pattern in `lib/command-center/repository.ts`
- dashboard overview
- personal task create, update, status move, and delete
- quick capture inbox with explicit approve-or-discard review
- job application tracker with pipeline status and follow-up dates
- planned integration status placeholders

No production migration has been applied by this PR.

## Phase 1B Scope

Phase 1B adds the first SAGE chat runtime:

- `/command-center/chat` remains Andrew-only through the Command Center layout.
- `/api/command-center/chat` remains Andrew-only through
  `requireCommandCenterAccess()`.
- `GET /api/command-center/chat` reports only whether SAGE is configured and
  which model name is selected.
- `POST /api/command-center/chat` returns `503` with a safe
  `SAGE unavailable` response when `OPENAI_API_KEY` is missing.
- When `OPENAI_API_KEY` is present, the route streams plain text from the
  OpenAI Responses API.
- The client receives only streamed assistant text. It never receives provider
  keys or raw environment values.

SAGE Phase 1B has no memory behavior, no function calling, no personal
integration tools, and no automatic writes.

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

Phase 1B still deliberately does not include:

- SAGE memory behavior
- AI function calling
- Google, Slack, Firecrawl, Monday.com, LinkedIn, Gmail, Calendar, or Drive
  integrations
- automatic task creation from quick capture
- production data mutation
- deployment or merge

Future SAGE skills should be designed under the shared AI conventions in
`docs/architecture/ai-skill-system.md`, with assistant-specific prompts in the
SAGE namespace and data access kept inside the Command Center boundary.

## Known Gaps

- `daily_briefing_cache`, `sage_memory`, and `ai_conversations` remain schema
  placeholders. Phase 1B chat does not persist conversation or memory records.
- Integration cards are disconnected placeholders only.
- SAGE chat is unavailable unless `OPENAI_API_KEY` is configured server-side.
- No live provider credentials are required for the rest of the Command Center.
