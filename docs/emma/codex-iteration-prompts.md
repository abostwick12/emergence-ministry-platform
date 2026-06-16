# EMMA Codex Iteration Prompts

Use these prompts one at a time. Do not give Codex the next prompt until the current iteration has been reviewed, tested, and merged.

---

## Iteration 1 — EMMA Contract and Audit Foundation

```text
You are working in the existing Lead Emergence Next.js App Router application.

Current stack:
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth and PostgreSQL
- Vercel
- Playwright
- Existing Events, Tasks, Communications, People, Files, Budget, Settings, and Dashboard routes
- Existing Master Event Card
- Existing workflow_templates, template_tasks, active task records, and baseline task-generation behavior

Goal:
Establish the typed and auditable foundation for EMMA without yet calling an AI provider.

Important constraints:
1. Inspect the repository before changing anything.
2. Do not replace existing architecture or redesign the UI.
3. Do not modify committed migrations; create an additive migration.
4. Create a feature branch named feature/emma-foundation.
5. Preserve Supabase Auth, existing role behavior, and Stub Mode.
6. Scope every new record using the repository's current ministry or tenant pattern. If ministry_id is not yet implemented consistently, stop and report the exact conflict before inventing a parallel pattern.
7. No API keys or secrets may be committed.
8. No student, medical, parent, or pastoral-care data may be logged.
9. Do not build RAG, Planning Center, external sending, or a chatbot UI.
10. Keep UI components separate from server, service, and repository logic.

First report:
- repository structure relevant to AI integration
- current Supabase client patterns
- current role and authorization patterns
- current ministry-scoping behavior
- current activity-log and audit mechanisms
- migration numbering and schema conventions
- current AI adapter interface
- conflicts or missing prerequisites

Then implement:

A. Type contracts
Create a clear EMMA domain following current repository conventions, preferably:

lib/emma/
  types.ts
  schemas.ts
  errors.ts
  risk.ts

Define and validate:
- EmmaDomain
- EmmaWorkflow
- EmmaRequestSource
- EmmaRequestStatus
- EmmaActionType
- EmmaRiskLevel
- EmmaResponse<T>
- EmmaActionProposal<T>

Use Zod at every API boundary.

B. Database migration
Create an additive Supabase migration for:
1. ai_feature_configs
2. ai_requests
3. ai_runs
4. ai_provider_attempts
5. ai_action_proposals
6. ai_approvals

Requirements:
- UUID primary keys
- ministry or tenant relationship consistent with the repository
- requested_by and decided_by relationships where appropriate
- created_at and updated_at timestamps
- indexes on ministry scope, status, workflow, request_id, run_id, and created_at where appropriate
- JSONB only when a typed flexible payload is justified
- check constraints or enums consistent with existing schema style
- RLS enabled on every table
- cross-ministry access blocked
- permitted Admin or Leader roles may create requests
- only permitted roles may approve action proposals
- service-role access remains server-side

Do not store full private context snapshots. Store a context_manifest containing record IDs, record types, and context categories only.

C. Repository layer
Create server-only functions for:
- createAiRequest
- updateAiRequestStatus
- createAiRun
- completeAiRun
- createActionProposal
- recordAiApproval

Use the existing Supabase server-client pattern. Do not query Supabase directly from client components.

D. Tests
Add tests for:
- request validation
- invalid workflow rejection
- risk classification
- ministry or tenant scoping
- unauthorized approval
- no secret or sensitive-field serialization in context_manifest

E. Documentation
Confirm docs/emma/architecture.md remains accurate. Update it only when repository facts require a documented change.

Acceptance criteria:
- no external AI call exists
- a mocked EMMA request can be created, run, completed, proposed, and audited
- cross-ministry reads and writes are blocked
- existing tests still pass
- typecheck, lint, build, unit tests, and relevant Playwright tests pass

Before committing:
- show exact files changed
- explain migration and RLS design
- show test results
- do not merge or deploy
```

---

## Iteration 2 — Provider Abstraction and Health

```text
Continue from the merged EMMA foundation.

Create branch:
feature/emma-provider-layer

Goal:
Build a provider-neutral server-side AI execution layer with controlled fallback, configuration, logging, and deterministic tests. Do not build skills, task generation, communications, or a chatbot yet.

Inspect package versions before implementation. Use the installed or latest compatible Vercel AI SDK API and avoid deprecated structured-output APIs. Use current structured output with Zod validation.

Implement under the existing architecture, preferably:

lib/emma/providers/
  registry.ts
  execute.ts
  error-classifier.ts
  types.ts
  config.ts

A. Provider registry
- support one configured primary and one configured fallback
- do not hardcode model names in feature code
- load provider and model choices from ai_feature_configs
- environment variables contain credentials only
- database configuration contains non-secret provider settings
- return a safe configuration error when required credentials are missing
- preserve a fake or stub adapter for local development and CI

B. Execution behavior
The central executor must:
1. receive a feature key, system instructions, user content, output schema, request ID, and run ID
2. load feature configuration server-side
3. call the primary provider
4. validate structured output
5. allow no more than one controlled repair attempt for invalid output
6. use fallback only for approved retryable failures
7. return typed output and provider metadata
8. never return raw provider errors to the browser

C. Normalized error categories
Implement at least:
- bad_request
- authentication
- payment_required
- forbidden
- timeout
- rate_limited
- provider_unavailable
- invalid_output
- unknown

Fallback may occur for timeout, rate_limited, provider_unavailable, retryable server failure, and payment_required when another provider is configured.

Fallback must not hide bad_request, authentication, forbidden, authorization defects, or application schema defects.

D. Logging
Write one ai_provider_attempts row per attempt with:
- provider and model
- attempt number
- success or failure
- normalized error category
- HTTP status when known
- duration
- token usage when available
- estimated cost only when reliable
- timestamp

Never log API keys, raw student records, parent contact details, medical data, confidential care notes, or entire sensitive prompts.

E. Admin health query
Create a server-only summary returning:
- attempts in the last 24 hours
- fallback count
- rate-limit count
- configuration failures
- payment-required alerts
- most recent successful request

Do not redesign the dashboard. A minimal Admin-only diagnostic surface is optional only when it matches current patterns.

F. Tests
Use fake providers. Do not call paid or live providers in automated tests.

Test:
- primary success
- primary rate limit then fallback success
- primary timeout then fallback success
- bad request does not fall back
- authentication failure does not fall back
- payment-required alert and fallback when configured
- malformed output receives one repair attempt
- all providers fail safely
- attempts are logged
- secrets never appear in returned errors

Acceptance criteria:
- provider switching requires configuration, not feature-code edits
- CI and local tests require no live credentials
- no existing product workflow depends on EMMA yet
- typecheck, lint, build, and tests pass
- do not merge or deploy
```

---

## Iteration 3 — Skill Registry and Router

```text
Continue from the merged provider layer.

Create branch:
feature/emma-skill-router

Goal:
Build the EMMA skill registry and typed workflow router.

Architecture rule:
Deterministic triggers bypass AI classification.

Examples:
- Generate Event Tasks selects GENERATE_EVENT_TASKS directly
- Draft Parent Email selects DRAFT_PARENT_EMAIL directly
- an overdue-task job selects ANALYZE_TASK_HEALTH directly

Only ambiguous free-text assistant requests may use an AI classifier.

Implement a skill registry following current conventions, preferably:

lib/emma/skills/
  registry.ts
  skill-definition.ts
  event-planning.ts
  event-task-generator.ts
  task-health-analyzer.ts
  parent-email.ts
  leader-groupme.ts
  text-message.ts
  ministry-summary.ts

Initially register metadata and schemas only. Do not implement every skill's generation logic.

Each skill definition must include:
- key
- display name
- domain
- description
- required context categories
- input schema
- output schema
- risk level
- approval requirement
- whether background execution is allowed
- enabled flag

Implement routing, preferably:

lib/emma/router/
  deterministic-router.ts
  free-text-classifier.ts
  resolve-skill.ts

Free-text classifier output:
{
  domain,
  workflow,
  confidence,
  needsClarification,
  clarificationQuestion,
  relevantRecordType,
  relevantRecordId
}

Rules:
- validate with Zod
- never allow the model to invent a workflow key
- confidence below a configured threshold returns needs_clarification
- unsupported requests return a safe unsupported result
- the router selects a skill but cannot mutate records
- record the selected workflow and classification outcome in the run

Create or adapt:
POST /api/ai/emma

Input:
{
  source,
  workflow?: explicit workflow,
  prompt?: string,
  recordType?: string,
  recordId?: string
}

Behavior:
- authenticate user
- verify role and ministry access
- verify referenced record ownership
- resolve an explicit workflow deterministically
- use classification only when workflow is absent and free text is present
- return selected workflow or clarification
- execute no database mutation beyond audit records

Tests:
- explicit workflow bypasses classifier
- unknown workflow rejected
- low confidence requests clarification
- malicious workflow injection rejected
- cross-ministry record rejected
- unauthorized role rejected
- destructive unsupported action rejected
- all registered skills have unique valid keys and schemas

Acceptance criteria:
- EMMA can safely decide what workflow should run
- EMMA cannot modify product records
- no chatbot redesign
- no RAG or Planning Center
- typecheck, lint, build, and tests pass
- do not merge or deploy
```

---

## Iteration 4 — Event Task Generator

```text
Continue from the merged skill router.

Create branch:
feature/emma-event-task-generator

Goal:
Implement the first complete EMMA skill: GENERATE_EVENT_TASKS.

User workflow:
1. user opens or creates an event
2. user clicks Generate Tasks with EMMA
3. EMMA loads verified event details and a matching approved workflow template when available
4. EMMA proposes a checklist
5. user sees an editable preview
6. no tasks are inserted yet

A. Context builder
Create a server-only event context builder.

Load only:
- event ID
- event name and type
- ministry area
- start and end datetime
- location
- priority
- owner
- vision or purpose
- operational notes explicitly safe for planning
- matching workflow template
- existing event tasks
- current user and ministry IDs

Exclude:
- medical data
- confidential pastoral notes
- unrelated student records
- parent contact details
- secrets

B. Output schema
Return:
{
  eventId,
  templateUsed: {
    templateId?: string,
    templateName?: string,
    matchReason: string
  },
  assumptions: string[],
  warnings: string[],
  tasks: [
    {
      clientGeneratedId,
      title,
      description,
      category,
      ownerId: string | null,
      ownerRecommendation: string | null,
      dueDate: string | null,
      dueDateBasis: string,
      priority,
      status: "Not Started",
      source: "template" | "ai_suggested",
      templateTaskId: string | null,
      requiresHumanDecision: boolean
    }
  ]
}

C. Guardrails
- never invent user IDs
- ownerId is null unless it matches a real eligible ministry user
- no due date after event start unless explicitly post-event
- never duplicate an existing task
- never silently remove a template task
- preserve template and AI source provenance
- missing event type or start date returns clarification rather than a guess
- the model may recommend a role but application code resolves real users
- no sensitive student information may appear in task content

D. UI
Integrate with the existing Master Event Card task step without redesigning the modal.

Add:
- Generate Tasks with EMMA action
- loading state
- safe failure state
- preview grouped into Template Tasks and EMMA Suggested Tasks
- editing for title, description, due date, owner, and priority
- removal of AI-suggested tasks
- visible warning before excluding template tasks
- clear text that no tasks have been created yet

E. Persistence
Save the preview as ai_action_proposals with:
- action type CREATE_TASKS
- risk INTERNAL_WRITE
- requires approval true
- target event ID
- validated payload
- human-readable summary

F. Tests
Test:
- matching template
- no matching template
- missing start date
- duplicate existing task
- invalid model-supplied owner
- invalid due date
- cross-ministry event
- proposal saved while tasks remain unchanged
- editable preview
- mobile and desktop modal usability

Acceptance criteria:
- a real event produces a useful task proposal
- zero tasks are created before approval
- existing event and task behavior remains intact
- typecheck, lint, build, and tests pass
- do not merge or deploy
```

---

## Iteration 5 — Approval and Transactional Task Execution

```text
Continue from the merged event task generator.

Create branch:
feature/emma-action-approval

Goal:
Implement safe approval, rejection, and transactional execution for task proposals.

Create authenticated routes following current conventions:
- POST /api/ai/actions/[proposalId]/approve
- POST /api/ai/actions/[proposalId]/reject

Approval input:
{
  editedPayload,
  decisionNotes?: string
}

A. Authorization
- re-read proposal server-side
- verify ministry ownership
- verify user permission to create event tasks
- verify proposal is pending and unexpired
- never trust ministry or target IDs supplied by the browser

B. Revalidation
Before execution:
- validate edited payload with Zod
- confirm event still exists and belongs to the same ministry
- confirm owners remain valid and eligible
- confirm due dates remain valid
- check duplicates again
- confirm action type is CREATE_TASKS

C. Transactional execution
- insert approved tasks transactionally
- use existing task repository patterns
- preserve source, run ID, proposal ID, and template task ID
- prefer all-or-nothing behavior
- do not silently partially succeed

D. Audit
Record:
- original proposal
- approved edited payload
- approver and timestamp
- created task IDs
- rejection reason
- activity log entries consistent with current conventions

E. Idempotency
- repeated approval cannot create duplicates
- rejected proposals cannot be approved
- expired proposals cannot execute
- proposals cannot execute twice
- use database constraints or locking where appropriate

F. UI
- Approve and Create Tasks
- Reject Proposal
- explicit confirmation summary
- refresh event tasks and task views on success
- show created tasks
- keep modal open until success
- recover safely from network failure

G. Tests
Test:
- successful approval
- edited approval
- expired proposal
- duplicate approval request
- unauthorized approver
- rejected proposal cannot be approved
- owner removed after generation
- event date changed after generation
- transaction rollback
- activity log
- UI refresh

Acceptance criteria:
- approved tasks are created exactly once
- all changes are attributable to the approver and EMMA run
- typecheck, lint, build, and tests pass
- do not merge or deploy
```

---

## Iteration 6 — Voice Profiles and Communication Drafts

```text
Continue from the merged action approval system.

Create branch:
feature/emma-communication-drafts

Goal:
Implement draft-only generation for:
- parent email
- leader GroupMe
- SMS or blast text

No message may be sent in this iteration.

A. Voice profile data
Create an additive migration for voice_profiles only if an equivalent does not exist.

Suggested fields:
- id
- ministry_id or current tenant equivalent
- name
- optional sender user ID
- platform
- audience
- active
- style_rules JSONB
- approved example references
- created_by
- timestamps

Store concise approved style rules rather than entire private email or GroupMe archives.

Style rules may include:
- tone
- expected length
- warmth
- directness
- formatting habits
- spiritual language
- humor level
- urgency
- call-to-action style
- phrases to avoid

B. Draft context
May include:
- event identity and dates
- location
- registration and deadline fields
- approved operational notes
- attached document names and approved metadata
- intended sender
- audience
- voice profile
- platform
- user-provided purpose
- required call to action

Must not invent:
- dates
- deadlines
- cost
- transportation times
- policies
- contact details
- medical requirements
- registration links

Missing facts must appear in missingInformation and block later approval until resolved.

C. Output schemas
Parent email:
{
  subject,
  greeting,
  body,
  callToAction,
  closing,
  verifiedFactsUsed: [],
  missingInformation: [],
  assumptions: [],
  voiceProfileId,
  recommendedSendWindow
}

GroupMe:
{
  message,
  verifiedFactsUsed: [],
  missingInformation: [],
  assumptions: [],
  voiceProfileId
}

SMS:
{
  message,
  characterCount,
  verifiedFactsUsed: [],
  missingInformation: [],
  assumptions: [],
  voiceProfileId
}

D. Guardrails
- all parent and public communication requires review
- no external sending
- no shame, manipulation, fear pressure, or guaranteed spiritual outcomes
- no confidential care information
- parent communication prioritizes clarity and completeness
- GroupMe remains shorter and conversational
- SMS remains concise and actionable
- unresolved placeholders are obvious
- Scripture quotations are never invented
- sender-specific phrasing must be supported by approved voice rules

E. UI
Integrate with the existing Communications route and Master Event Card communication preview section.

Allow:
- platform selection
- sender selection
- audience selection
- voice profile confirmation
- purpose entry
- draft generation
- editing
- save as communication_drafts

Generated status: pending_review

Display:
- voice profile
- verified facts
- assumptions
- missing information
- related event and task
- generation timestamp

F. Logging
- create request and run
- create CREATE_COMMUNICATION_DRAFT proposal
- save draft
- link run and proposal
- write activity log
- do not retain unnecessary sensitive provider prompt content

G. Tests
Test:
- complete parent email
- missing deadline
- invented date blocked by validation
- GroupMe length and style
- SMS character count
- cross-ministry voice profile blocked
- confidential note excluded
- no sending API called
- pending_review status
- voice metadata retained

Acceptance criteria:
- a real event produces an editable attributable draft
- facts trace to existing records
- no message is sent
- typecheck, lint, build, and tests pass
- do not merge or deploy
```

---

## Iteration 7 — Communication Review Queue

```text
Continue from the merged communication drafting feature.

Create branch:
feature/emma-review-queue

Goal:
Build an accountable Admin Review Queue for AI-generated communications. Do not add sending integrations.

A. Statuses
Support:
- pending_review
- changes_requested
- approved
- rejected
- sent
- failed

Sent and failed remain future-ready display states only.

B. UI
Use the existing Communications route and design system.

Include:
- Pending Review section
- filters for platform, audience, event, sender, and age
- cards showing event, platform, audience, sender, voice profile, generation time, and missing-information warning
- focused detail modal, drawer, or current application pattern

Reviewer actions:
- edit
- approve
- request changes
- reject
- copy text
- open related event

Do not send.

C. Approval
On approval:
- validate required event facts again
- block unresolved missing information
- save the exact approved version
- preserve original generated version
- record approver and timestamp
- update status
- write approval and activity logs

On request changes:
- store reviewer instructions
- set changes_requested
- allow manual edit or later regeneration
- preserve previous versions

On rejection:
- require a reason
- preserve record for accountability

D. Revision history
Implement append-only revisions with:
- version number
- source: ai, user_edit, reviewer_edit
- subject when applicable
- body or message
- changed_by
- changed_at
- change notes

E. Permissions
- Admin reviewers may approve or reject
- authorized leaders may create and edit drafts
- cross-ministry access is blocked
- volunteers cannot approve unless an existing explicit role rule allows it

F. Tests
Test:
- approval
- required rejection reason
- request changes
- unresolved missing info blocks approval
- original generated version preserved
- editing creates revision
- unauthorized approval
- cross-ministry access
- filters
- mobile usability
- related event opening

Acceptance criteria:
- every draft has visible history
- every decision has an attributable user and timestamp
- no external sending occurs
- typecheck, lint, build, and tests pass
- do not merge or deploy
```

---

## Iteration 8 — Background Operational Intelligence

```text
Continue from the merged review queue.

Create branch:
feature/emma-operational-intelligence

Goal:
Add EMMA's invisible operational value without making it autonomous or noisy.

Initial analyses:
1. upcoming event missing required planning fields
2. event with no active tasks
3. overdue tasks
4. blocked tasks
5. unassigned tasks
6. workload concentrated on one person
7. event approaching with low checklist completion
8. approved communication not yet marked sent
9. volunteer requirement not satisfied when current schema supports it

Do not build student attendance follow-up, Planning Center, external notifications, or sending.

A. Deterministic first
Use SQL or application rules for:
- overdue and blocked counts
- missing fields
- completion percentage
- event thresholds
- unassigned tasks
- workload totals
- approved-unsent drafts

Use AI only to:
- summarize verified alerts
- prioritize them in plain language
- recommend next actions
- draft an internal planning brief

B. Background execution
Implement a secure scheduled route or repository-compatible job mechanism.

Requirements:
- protected from public invocation
- idempotent for the same ministry and analysis window
- separate processing per ministry
- bounded batch sizes
- no unnecessary sensitive data sent to a model
- run status and failure logging
- concurrent duplicate-run prevention

C. Alert data
Create ai_operational_alerts only if no existing structure fits.

Fields:
- id
- ministry scope
- alert_type
- severity
- optional event, task, or assignee reference
- title
- deterministic_details
- optional ai_summary
- recommended_action
- status
- first_detected_at
- last_detected_at
- resolved_at
- source_run_id

Statuses:
- open
- acknowledged
- resolved
- dismissed

D. Dashboard
Add a focused EMMA Needs Attention panel.

Show:
- critical and high severity first
- related event
- factual reason
- recommended action
- open event or task link
- acknowledge and dismiss controls

Do not add a generic dashboard chatbot.

E. Ministry Brief
Implement a manual Generate Ministry Brief action first.

Output:
- what is on track
- what is approaching
- what is overdue
- what is blocked
- workload concentration
- decisions required
- approved communications awaiting action

Use verified counts only. AI may explain but cannot alter the values.

F. Tests
Test:
- overdue detection
- approaching event detection
- no duplicate alert
- condition resolution
- ministry separation
- AI summary cannot change deterministic count
- scheduled endpoint authentication
- concurrent-run prevention
- dashboard permissions
- correct empty state

Acceptance criteria:
- EMMA surfaces real operational issues without a prompt
- alerts are factual, traceable, and non-duplicative
- no external communication is sent
- typecheck, lint, build, and tests pass
- do not merge or deploy
```

---

## Deferred Prompt Guidance

Do not start Planning Center-triggered student follow-up or ministry-library RAG until Iterations 1–8 have been used with real ministry workflows and the primary coordinator has completed a full week without developer help.
