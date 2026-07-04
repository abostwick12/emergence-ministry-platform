# AI Skill System Architecture

This document is the shared baseline for future AI work in Lead Emergence. It
keeps EMMA, Camp EMMA, SAGE, and reusable ministry workflows pointed at one
platform architecture instead of separate feature islands.

## Current State

The repository currently has four skill-like systems:

| Area | Current home | Purpose | Status |
|---|---|---|---|
| Repository agent skills | `.claude/skills/`, `.codex/skills/` | Developer workflow guidance for Codex and Claude Code | Not product runtime AI |
| Core EMMA workflows | `lib/emma/skills/`, `lib/emma/workflows/`, `lib/emma/providers/` | Audited ministry AI workflows for events, tasks, communications, and operations | Typed TypeScript registry |
| Camp EMMA | `lib/camp/emma*.ts`, `app/api/camp/emma/` | Camp operational search, restricted-safe summaries, and confirmed Camp actions | Camp-specific implementation |
| SAGE | Target: `lib/ai/skills/command-center/`, `lib/ai/prompts/sage/`, and gated Command Center routes | Andrew-only Personal Command Center assistant and personal playbooks | Deferred; Phase 1A has no SAGE chat runtime |

These systems are allowed to remain separate while their trust models differ,
but future work should converge shared concepts into a common `lib/ai` layer.

## Assistant Boundaries

### EMMA

EMMA is the ministry operations assistant layer. EMMA may help with events,
tasks, communication drafts, ministry summaries, operational alerts, Camp
operations, and future Planning Center or Google Workspace workflows.

EMMA must follow the ministry safety rule:

> AI may interpret, recommend, summarize, and draft. Application code validates
> and executes. Humans approve sensitive or external actions.

Core EMMA workflows are ministry-scoped, audited, role-aware, and designed for
Admin/Leader use. They should use typed inputs, output schemas, provider
attempt logs, action proposals, approval records, and activity logs.

Camp EMMA is part of EMMA, but it has a stricter Camp data boundary. It may use
Camp-specific code until it can safely plug into shared AI routing without
leaking student, medical, guardian, or transportation-sensitive data.

### SAGE

SAGE is Andrew's Personal Command Center assistant. It is not a ministry-wide
assistant, not a Camp assistant, and not a role-delegated staff tool.

SAGE may work with Andrew-only personal context such as military transition,
SOTF Fellowship, job search, personal task triage, personal memory, and future
personal integrations. SAGE must remain gated by the Personal Command Center
access layer and must not read ministry or Camp records unless a future feature
explicitly defines a safe bridge.

SAGE can reuse generic skill conventions and prompt-loading helpers, but its
personal memory and Andrew-only data must not be shared into EMMA prompts.

## Target Structure

Future shared AI infrastructure should live under:

```text
lib/ai/
  skills/
    shared/
    ministry/
    camp/
    command-center/
  prompts/
    shared/
    emma/
    sage/
  routing/
    skill-router.ts
```

This structure is a target, not a requirement to move all existing files in one
change. Move code only when a focused refactor can preserve behavior and tests.

## What Belongs Where

### `lib/ai/skills/shared/`

Use this for reusable skill contracts and helpers that are assistant-agnostic:

- skill metadata types
- registry uniqueness checks
- schema and version helpers
- prompt assembly utilities
- sensitive-context classification
- provider-neutral result wrappers
- audit-safe logging helpers

Shared skills must not assume an assistant identity, a database table, a user
role, or a provider.

### `lib/ai/skills/ministry/`

Use this for reusable ministry operations workflows that can be called by core
EMMA and future ministry modules:

- event summaries
- task generation proposals
- volunteer gap analysis
- communication draft preparation
- ministry briefing generation

Ministry skills must be ministry-scoped and must use the EMMA audit and approval
model before creating or changing ministry records.

### `lib/ai/skills/camp/`

Use this for Camp-specific EMMA skills:

- safe Camp finder/search behavior
- Camp schedule and team summaries
- confirmed operational changes such as team or room updates
- Camp launch-readiness checks

Camp skills must apply the Camp access model first, minimize context, block
restricted medical/contact topics before provider calls, and preserve pending
action plus audit behavior for writes.

### `lib/ai/skills/command-center/`

Use this for reusable Personal Command Center/SAGE skills that are personal to
Andrew:

- military transition playbooks
- job-search support
- personal task prioritization
- personal briefing generation
- personal integration guidance

These skills must not be exposed through ministry EMMA routes. Personal memory
must stay personal.

### `lib/ai/prompts/shared/`

Use this for prompt fragments that are true platform rules:

- structured output requirements
- no direct model writes
- provider error behavior
- sensitive-data minimization
- citation/source handling when applicable

### `lib/ai/prompts/emma/`

Use this for EMMA voice, ministry workflow instructions, and ministry-specific
guardrails.

### `lib/ai/prompts/sage/`

Use this for SAGE voice, Andrew-only personal context rules, and Personal
Command Center behavior.

## Naming Conventions

Skill keys should be stable, lowercase, and namespace-aware:

```text
shared.context_summarizer
ministry.event_summary
ministry.communication_draft
camp.safe_finder
camp.confirmed_team_assignment
command_center.task_prioritizer
command_center.daily_briefing
```

File names should match the skill key without the namespace prefix when the
directory already provides the namespace:

```text
lib/ai/skills/ministry/event-summary.ts
lib/ai/skills/camp/safe-finder.ts
lib/ai/skills/command-center/task-prioritizer.md
```

Prompt files should be named by behavior, not by provider:

```text
lib/ai/prompts/shared/structured-output.md
lib/ai/prompts/emma/ministry-summary.md
lib/ai/prompts/sage/personal-memory.md
```

Do not create duplicate prompt files with provider names such as
`openai-event-summary.md` unless the provider itself requires a different API
shape. Provider-specific formatting belongs in provider adapters.

## Skill Loading Rules

1. UI components must not load prompt files or call provider APIs directly.
2. API routes and server actions call a domain workflow or router.
3. The router resolves a registered skill by explicit trigger before using any
   free-text classification.
4. The selected skill declares allowed roles, allowed context categories, risk,
   schema versions, and output schema.
5. Context builders load the minimum verified records the user is authorized to
   access.
6. Prompt assembly combines shared platform rules, assistant-specific rules, and
   the selected skill instructions.
7. Provider adapters execute the request server-side only.
8. Application code validates structured output and performs any approved write.

For the current repository, that means:

- core EMMA continues through `lib/emma/skills/registry.ts` and
  `lib/emma/workflows/execute-workflow.ts`
- Camp EMMA continues through `app/api/camp/emma/` and `lib/camp/emma*.ts`
- Personal Command Center Phase 1A continues through `lib/command-center`
  repository, access, and deterministic capture-routing helpers only
- SAGE chat, SAGE memory behavior, provider calls, function calling, and
  markdown playbooks are deferred until a later focused PR

New shared helpers should be added under `lib/ai` only when at least two of
these systems will use them.

## Testing Rules

Every runtime skill should have focused tests before it is treated as live:

- registry tests confirm unique keys, supported workflows, and schema versions
- context tests prove forbidden fields are excluded before provider calls
- role/access tests prove unauthorized users cannot load or execute the skill
- provider tests use mock fetches or mock providers, never live credentials
- output tests validate every provider response with a schema
- write-action tests prove pending proposals do not mutate data until confirmed
- audit tests prove requests, runs, provider attempts, proposals, approvals, and
  domain activity are traceable where required
- fallback tests prove missing provider env vars fail safely

Camp AI tests must additionally prove that leader/driver surfaces never expose
medication names, dosages, medical notes, insurance, guardian contact, signature
data, or detailed restricted dietary notes.

SAGE tests must additionally prove that only Andrew's configured account can
access Personal Command Center routes and APIs.

## Sensitive Data Rules

### Student Data

Planning Center is the intended future source of truth for student and
attendance data. Do not create a parallel manually maintained student database
outside approved Camp operational needs. Student identifiers, attendance,
follow-up status, parent contact, and care context must be minimized before any
AI provider call.

### Camp Medical Data

Medication names, dosages, administration instructions, medical notes,
insurance information, physician data, guardian contact, emergency contact
details, signatures, and correction notes are restricted. General Camp views and
leader/driver AI responses may show only safe operational indicators.

Camp provider prompts must not include restricted medical/contact data unless a
future approved workflow documents exactly why it is required, who can trigger
it, how it is redacted, how it is audited, and why no deterministic approach is
sufficient.

### Pastoral Data

Pastoral care notes, counseling context, discipline concerns, confidential
family details, or spiritual-care notes are restricted. They must not be placed
in model prompts or AI logs unless a future approved pastoral workflow defines a
separate high-sensitivity policy.

### Personal Andrew-Only Data

SAGE memory, military transition details, job-search data, personal calendar or
email context, personal documents, and private relationship context are
Andrew-only. They must not be visible to ministry users, Camp users, EMMA
workflows, or shared AI logs.

### Secrets

Provider keys, OAuth tokens, service-role keys, webhook URLs, database
passwords, and raw environment values are never prompt context and never client
data. Server logs must use sanitized error codes and provider attempt metadata.

## Duplicate Avoidance Rules

Before adding a new AI prompt or skill:

1. Search `lib/ai`, `lib/emma`, `lib/camp`, `lib/command-center`, `docs/emma`,
   and `docs/camp`.
2. Reuse an existing shared prompt fragment when the rule is assistant-neutral.
3. Extend a skill registry instead of creating an unregistered one-off helper.
4. Keep assistant identity in assistant-specific prompts, not shared prompts.
5. Add or update tests that prove the new skill does not bypass access,
   sensitive-data, approval, or audit rules.

## Known Cleanup Queue

These items should be handled in later focused PRs:

- Move truly reusable EMMA skill contracts into `lib/ai/skills/shared/`.
- Design SAGE runtime skills under `lib/ai/skills/command-center/` before adding
  chat, memory, provider calls, or personal integration tool use.
- Update stale Camp EMMA docs that still describe provider files as missing.
- Decide whether Camp EMMA search queries should write a lightweight audit
  record.
- Reconcile duplicate Camp command paths:
  `app/api/camp/emma/command`, `app/api/camp/emma/confirm`, and
  `app/api/camp/emma/actions`.
- Keep `.claude/skills` and `.codex/skills` documented as developer-agent
  workflow skills, not product AI skills.
