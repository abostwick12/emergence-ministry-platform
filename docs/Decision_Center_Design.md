# Decision Center Design

## North Star

Lead Emergence exists to reduce administrative friction so leaders can spend more time making disciples. Meridian exists to preserve and organize the church's accumulated ministry wisdom so every future decision is made with greater context than the last. Every portal should help its primary user accomplish their work today while quietly benefiting from everything the ministry has learned over time.

## Core Principle

Lead Emergence is organized around portals, not around data.

Each portal exists for a primary user and contains everything that user needs to accomplish their role. Meridian does not create a separate intelligence portal. Instead, Meridian quietly enhances every portal with context appropriate to that user.

Every portal therefore contains two layers:

- Operational Layer: where work is completed.
- Intelligence Layer: where Meridian surfaces context, patterns, evidence, and insight appropriate to that user's responsibilities.

## Portal Architecture

### Dashboard

Primary user: everyone.

Primary question: What requires my attention today?

Contains:

- notifications
- today's schedule
- quick actions
- recent activity
- assigned tasks
- EMMA
- Command Center

Meridian adds:

- contextual reminders
- relevant alerts
- personal preparation suggestions

### Ministry Hub

Primary user: directors and ministry staff.

Primary question: How healthy is our ministry, and where should we focus next?

Operational Layer:

- events
- tasks
- communications
- budget
- worship
- planning

These operational workspaces are intentionally accessed through the sidebar rather than duplicated on the hub landing page.

Decision Layer:

- ministry direction
- ministry health
- event effectiveness
- operational capacity
- communication trends
- Meridian signals
- leadership attention items
- evidence-backed insights

### Volunteer Hub

Primary user: volunteers and small-group leaders.

Primary question: What do I need to serve students well this week?

Operational Layer:

- my students
- attendance
- leader guides
- resources
- audio overview
- GroupMe
- calendar
- training
- onboarding
- notifications

Meridian Layer:

- suggested preparation
- student follow-up reminders
- related leader resources
- recommended training
- relevant theological refreshers
- context for this week's lesson

The Volunteer Hub is not a director dashboard. It remains the volunteer's daily workspace. Meridian may personalize the Volunteer Hub, but it must not expose leadership-level analytics.

### Leader Hub

Primary user: teaching pastors, youth directors, assistant directors, and discipleship leaders.

Primary question: How do we form students and leaders more effectively?

Operational Layer:

- sermon prep
- resource development
- discipleship dashboard
- volunteer dashboard
- teaching resources

Meridian Layer:

- formation trends
- student question themes
- Scripture engagement
- resource usage
- teaching coverage
- volunteer health
- leadership pipeline
- training priorities

This is where strategic ministry intelligence lives.

## Shared Intelligence Ownership

Volunteer health, coverage, recruitment, workload, and sustainability are computed once within the Leader Hub intelligence layer.

The Leader Hub owns the canonical volunteer-health model and is responsible for generating all volunteer-health signals, ratios, workload metrics, recruitment projections, and sustainability indicators.

Other portals may consume these signals, but they must never independently calculate them.

Example flow:

```text
Leader Hub computes volunteer-health signals.
Ministry Hub consumes those signals when evaluating ministry capacity and operational readiness.
Volunteer Hub consumes only volunteer-specific, role-appropriate insights derived from those same signals.
```

This keeps every portal aligned to one consistent view of volunteer capacity while avoiding duplicate business logic and conflicting definitions.

The same ownership model should apply to other domains:

- Ministry Health: Ministry Hub owns it.
- Formation Health: Leader Hub owns it.
- Student Engagement: Student Portal owns it.
- Parent Engagement: future Parent Portal owns it.

Everyone else reads from the source.

## Meridian Philosophy

Meridian is not another page.

Meridian is the church's evolving ministry memory. It exists beneath the portals. Every approved resource contributes to Meridian. Every portal consumes Meridian differently.

Students never see leadership analytics. Volunteers never see staffing discussions. Directors see organizational context. Teaching leaders see formation context.

The same knowledge base serves different users through scoped retrieval.

## Meridian Intelligence Pipeline

Meridian is not an AI model.

Meridian is the structured ministry memory and orchestration layer. AI providers are consumers of Meridian and contributors to approved outputs.

### Responsibilities

Lead Emergence:

- source of operational data
- source of transactional records
- source of events, attendance, tasks, communications, resources, and planning

Meridian:

- stores approved ministry knowledge
- maintains relationships between ministry artifacts
- applies retrieval scopes, authority levels, permissions, and governance
- determines what context is eligible for AI retrieval
- never generates content independently

Gloo AI Studio:

- primary ministry intelligence provider
- used for insight generation, contextual synthesis, ministry-specific reasoning, leadership summaries, and discipleship-oriented recommendations
- receives only Meridian-approved context after governance filtering

Meridian orchestrates insight generation by providing governed context to Gloo AI Studio.

YouVersion Platform:

- canonical Scripture provider
- resolves Bible references
- supplies reading-plan integration
- provides Scripture metadata and approved Bible content where available
- keeps Meridian storing references and relationships rather than Bible text

OpenAI:

- general-purpose language generation
- drafting
- structured writing
- conversation
- summarization
- operational assistants
- uses Meridian-approved context through retrieval

### Provider Access Rule

No AI provider has direct access to the operational database.

Every external AI provider must receive context through Meridian's governance layer rather than querying operational data directly.

```text
Supabase
  -> Meridian Governance
  -> Scoped Retrieval
  -> AI Provider
  -> Human Review when required
  -> Application
```

## Design Rules

Every portal must answer:

1. Who is this portal primarily for?
2. What work does this user complete here?
3. What decisions does this user make?
4. What Meridian context helps them make those decisions?
5. What evidence supports Meridian's insights?

Navigation belongs in the sidebar. Decision support belongs on the portal landing page. Operational work belongs on the workspace pages.

## Decision Center Sections

Decision Centers should include:

- Direction: emphasis, horizon, owner, last reviewed or generated date.
- Health Snapshot: four to six meaningful measures.
- Signals: factual observations only.
- Leadership Attention: review prompts linked to operational workspaces.
- Evidence: source, date range or freshness, calculation, confidence, and boundary.
- Recent Meaningful Changes: not every CRUD event.

## Language Rules

Use:

- Review
- Consider
- Discuss
- Investigate
- Prepare
- Compare
- Clarify

Avoid:

- Must
- Proves
- The AI recommends
- The ministry should

## Evidence Rules

Every Meridian insight must link to evidence. Every recommendation must remain advisory. Every signal needs evidence before it becomes visible.

Evidence should include source kind, label, detail, freshness, and confidence. If data is missing, show an empty state instead of fabricating intelligence.

## Non-Negotiables

- Do not duplicate sidebar navigation inside portal landing pages.
- Do not expose leadership analytics to volunteers or students.
- Do not replace pastoral discernment with AI recommendations.
- Do not let AI providers query operational data directly.
- Do not independently calculate shared intelligence outside its owning hub.
- Every Meridian insight must link to evidence.
- Every recommendation must remain advisory.
- Every portal should feel tailored to its primary user.

## First Implementation

The first implementation is the Ministry Hub. It uses existing event, task, budget, activity, and Scripture integration boundaries. Later intelligence layers should reuse the same primitives while preserving each portal's audience, source-of-truth ownership, and operational boundary.
