# Architecture Vision

## North Star

Lead Emergence is evolving from a ministry operations app into a ministry intelligence platform. The competition-ready MVP must keep working, but the architecture should now make room for Decision Centers, Meridian, the Meridian Web, and the future Vision Platform.

Architecture Evolution - Phase 1 is the first intentional step in that progression. It establishes the language, boundaries, and reusable structures that let the platform mature without sabotaging the competition build.

## Platform Direction

- Operational work stays in operational workspaces: Events, Tasks, Communications, Budget, Student Scripture, Volunteer Hub, Leader tools, and Camp.
- Decision Centers summarize direction, verified signals, leadership attention, evidence, and action links without replacing the operational workspace.
- Meridian becomes the approved ministry-memory layer. It preserves reviewed knowledge, decisions, resources, outcomes, and metadata for future retrieval.
- The Vision Platform is the future church-level decision environment. The Ministry Hub and Leader Hub decision surfaces are the first smaller versions of that model; the Volunteer Hub remains the complete volunteer-facing workspace.

## Portal Philosophy

Every portal has two layers.

Operational Layer: where the user does the work.

Intelligence Layer: where Meridian helps that same user make better decisions with scoped, permission-aware context.

The intelligence layer must match the portal audience. Volunteer-facing intelligence should help a leader serve students well this week, not expose leadership analytics. Director-facing intelligence should reveal ministry function, constraints, and follow-through. Leader Hub intelligence should support formation, teaching, volunteer sustainability, and leadership development.

## Hub Boundaries

### Ministry Hub

Primary question: How is the ministry functioning?

Audience:

- ministry directors
- operations leaders
- planning owners
- event, budget, and communication owners

Operational layer:

- events
- tasks
- budget
- communications

Meridian intelligence layer:

- event effectiveness
- capacity constraints
- operational bottlenecks
- communication trends
- evidence-linked readiness signals

### Volunteer Hub

Primary question: How can I serve my students well this week?

Audience:

- volunteers
- small-group leaders
- parents serving
- future student leaders

Operational layer:

- attendance
- leader guide
- students
- calendar
- group communication preparation

Meridian intelligence layer:

- students the volunteer may want to check in on
- suggested training
- resources related to this week's lesson
- reminders of recurring student-question themes
- preparation suggestions

Boundary:

The Volunteer Hub remains the daily volunteer-facing workspace. Meridian may personalize it, but it must not expose leadership-level analytics such as volunteer health, workload sustainability, coverage strategy, recruitment pressure, or formation trends.

### Leader Hub

Primary question: How do we form people more effectively?

Audience:

- teaching pastors
- youth directors
- assistant directors
- discipleship leaders

Operational layer:

- sermon preparation
- resource development
- teaching planning
- leadership pipeline work

Meridian intelligence layer:

- Volunteer Health
- Formation Health
- Teaching Strategy
- Resource Development
- Leadership Pipeline
- Scripture engagement
- student-question patterns
- volunteer readiness
- formation trends

Boundary:

Volunteer health, recruitment, coverage, workload, training strategy, and sustainability intelligence belong in the Leader Hub, preferably under `/leader/volunteers` when a route change is explicitly approved. They do not replace or relocate the Volunteer Hub.

## Judged Integration Flow

The competition-scored provider path must remain visible in the product and docs. Do not bury it under generic Decision Center or Meridian language.

### YouVersion Platform API

Visible step: Scripture grounding.

Primary app surfaces:

- `/student/scripture/resources`
- Journey Journal reading cards in `/student/scripture/questions`
- `POST /api/student/scripture/lookup`

Current code seam:

```text
components/student/scripture-lookup.tsx
  -> buildYouVersionReaderLink(...)

components/student/student-journey-journal.tsx
  -> buildYouVersionReaderLink(...)

app/api/student/scripture/lookup/route.ts
  -> lookupYouVersionPassage(...)
  -> YouVersion /v1/bibles/{bibleId}/passages/{passageId}
```

Architectural rule:

YouVersion sits before generation as the Scripture grounding step. Bible text from the lookup endpoint is transient and must not become stored Meridian content unless a future licensing-safe workflow is explicitly approved. Reader links may be shown to open Bible.com surfaces.

### Gloo AI Studio - Discussion Generation

Visible step: leader-reviewed discussion prompt generation.

Primary app surface:

- `POST /api/student/scripture/discussion`

Current code seam:

```text
app/api/student/scripture/discussion/route.ts
  -> createStudentDiscussionPrompt(...)
  -> generateMeridianDiscussionDraft(...)
  -> generateGlooDiscussionDraft(...)
  -> Gloo AI Studio chat completions
```

Architectural rule:

Gloo AI Studio is the primary generation provider for student-question discussion drafts. It may use student-visible Meridian context and internal grounding for posture, but generated output remains leader-reviewed and safety-labeled.

### Gloo AI Studio - Reading Plan Generation

Visible step: reading-plan draft generation.

Primary app surface:

- `POST /api/student/scripture/reading-plan`

Current code seam:

```text
app/api/student/scripture/reading-plan/route.ts
  -> generateMeridianReadingPlanDraft(...)
  -> generateGlooReadingPlanDraft(...)
  -> Gloo AI Studio chat completions
```

Architectural rule:

Gloo is the first provider for reading-plan drafts. Gemini and OpenAI are fallback providers only when configured and only through the Meridian AI wrapper. Drafts are preview-only until a leader reviews and publishes through a later Meridian workflow.

## Guardrails

- Main must remain competition-ready.
- Architecture branches should avoid large refactors without approval.
- No live Meridian publishing is implied until the publish workflow exists.
- No student reflections, medical data, pastoral care notes, or private volunteer notes enter Meridian.
- Retrieval must filter by permission, status, ministry, scope, sensitivity, and authority before semantic similarity.

## Storyline

The repository history should tell a deliberate maturity story:

```text
Competition MVP
Architecture Evolution
Meridian
Meridian Web
Vision Platform
```

That story matters because the platform has grown beyond a youth ministry app. The first build should prove that the current product works today while its architecture points toward a much larger ministry intelligence ecosystem.
