# Competition Judge Walkthrough

This runbook keeps the competition path visible and repeatable. It describes what judges should see today, what is intentionally preview-only, and where the scored YouVersion and Gloo AI Studio integration flow sits in the platform.

## Production Entry

Production URL:

```text
https://www.leademergence.com
```

Recommended judge path:

1. Open `/login`.
2. Select **Continue as guest**.
3. Confirm the dashboard loads with the Lead Emergence shell.
4. Open the Ministry Hub and review Ministry Alignment.
5. Open Student Scripture resources with a passage reference.
6. Open `/student/scripture/plans/new`, add a Scripture reference and context, and select **Generate with Meridian**.
7. Confirm the result identifies the provider/model that actually answered; `guest-stock-responses` means no external AI call ran.
8. Review `/student/scripture/questions` and `/discipleship` for the human-review path.
9. Open `/hackathon` to see the public ecosystem proof page.
10. Confirm restricted Camp routes redirect rather than exposing protected data.

Production must have `GUEST_AI_GENERATION_ENABLED=true` plus valid Gloo credentials for step 6 to call Gloo. `GUEST_SANDBOX_WRITES_ENABLED=true` is optional and affects only isolated guest edits; it is not required for an unsaved AI draft.

## What To Evaluate

Lead Emergence is competition-ready as an operational ministry platform with visible architecture for a larger ministry intelligence ecosystem.

Evaluate the current build for:

- authenticated and guest-accessible review flows
- clear operational surfaces for events, tasks, communications, budget, students, and ministry health
- a visible ecosystem story that connects operations, Meridian, Scripture, Gloo AI Studio, and human approval
- scoped preview behavior instead of live sending or unsafe automation
- visible evidence that provider integrations have defined boundaries
- architecture that can grow into Meridian, Meridian Web, and the Vision Platform without replacing the current MVP

## Ecosystem Proof Surface

The public `/hackathon` page is the fastest judge-facing orientation surface. It should show:

- Lead Emergence as a Scripture-native ministry operating system
- operational hub, Meridian context, YouVersion grounding, Gloo AI Studio, and leader approval cards
- live-versus-demo boundaries
- verification links into `/login`, `/dashboard`, `/ministry`, `/student/scripture/resources`, `/student/scripture/questions`, and `/discipleship`

This page supports the video and writeup; it is not a replacement for the real authenticated/guest walkthrough.

## Judged Provider Flow

The judged provider path should remain easy to identify during review.

### YouVersion Platform

YouVersion sits in the Scripture grounding step before generation.

Current visible surfaces:

- `/student/scripture/resources`
- `/student/scripture/questions`
- `/student/scripture/plans/new`
- `POST /api/student/scripture/lookup`

Expected behavior:

- The visible lookup sends the reference through the server-side passage route and displays the returned passage when the API is configured.
- The app can direct users to Bible.com surfaces.
- Lead Emergence stores references and relationships, not licensed Bible text as permanent Meridian memory.

### Gloo AI Studio

Meridian orchestrates insight generation by providing governed context to Gloo AI Studio.

Current visible surfaces:

- `POST /api/student/scripture/discussion`
- `POST /api/student/scripture/reading-plan`
- `POST /api/student/scripture/gloo-diagnostics`
- discipleship and AI readiness indicators

Expected behavior:

- Gloo AI Studio is the primary ministry intelligence provider for configured student-question and reading-plan drafts.
- Guest requests call Gloo only when `GUEST_AI_GENERATION_ENABLED=true`; otherwise the response is explicitly labeled stock output.
- Generated outputs remain candidate outputs until reviewed or approved by a human leader.
- No AI provider receives direct operational database access.

## Live Today

The production build currently demonstrates:

- Lead Emergence dashboard and app shell
- guest competition review path
- operational event, task, communication, and budget workflows
- Ministry Alignment decision surface
- Student Scripture resource and question surfaces
- YouVersion reader/reference seams
- Gloo AI Studio generation, model provenance, diagnostics, and readiness boundaries
- protected Camp route behavior

## Structurally Enabled

These capabilities are intentionally architectural in this phase:

- Meridian governed retrieval
- Meridian publishing
- YouVersion reading-plan integration beyond current reference and reader-link seams
- Meridian Web
- Vision Platform

## Review Boundaries

- Communication outputs are drafts or previews unless explicitly sent by a future approved workflow.
- AI outputs are candidate outputs, not institutional memory.
- Human leaders remain responsible for teaching, theology, pastoral care, staffing, and ministry direction.
- Volunteer Hub remains the volunteer-facing workspace at `/volunteer`.
- Leadership-level volunteer health intelligence belongs under the Leader Hub.

See [Competition API Usage](competition-api-usage.md) and [Competition Runtime Architecture](architecture/competition-runtime.md) for request examples, feature-gate behavior, and trust boundaries.
