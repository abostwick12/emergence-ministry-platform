# Competition Ecosystem Proof

Lead Emergence is positioned for the Scripture in New Frontiers submission as a ministry operating system, not a standalone Bible app or ministry tracker. The competition path should show how operations, Scripture, AI, ministry memory, and human discernment work together.

## Core Claim

Lead Emergence creates more space for relational ministry by connecting the work leaders already do:

- plan events
- assign tasks
- prepare communication previews
- review ministry readiness
- ground student formation in Scripture
- draft AI-assisted discussion and reading-plan material
- require leader approval before anything becomes student-facing or operationally binding

## Judge-Facing App Path

Use this order when reviewing or filming:

1. `/login`
2. Continue as guest
3. `/dashboard`
4. `/ministry`
5. `/student/scripture/resources?reference=John%203%3A16`
6. `/student/scripture/plans/new`
7. `/student/scripture/questions`
8. `/discipleship`
9. `/hackathon`

## Ecosystem Layer

| Layer | Current proof | Boundary |
| --- | --- | --- |
| Operations | Dashboard, Events, Tasks, Communications, Budget, activity logs, isolated guest sandbox | Guest writes require an explicit server flag and never become canonical ministry records. Communication outputs remain previews. |
| Meridian | Ministry Alignment, organizational memory demo, evidence stack, EMMA prompts | Meridian does not create autonomous ministry verdicts or pastoral decisions. |
| YouVersion | Visible server-side passage lookup, reader links, reference parsing, `/api/student/scripture/lookup` | Lead Emergence stores references and relationships, not fetched Bible text as permanent Meridian memory. |
| Gloo AI Studio | Discussion and reading-plan generation, diagnostics, OAuth token exchange, Gloo-first provider wrapper | Guest live generation requires `GUEST_AI_GENERATION_ENABLED=true`; provider output is candidate material for leader review. |
| Human approval | Discipleship review, safety labels, promote/review actions, audit language | AI cannot approve, publish, send, or decide pastoral follow-up alone. |

## What Is Built

- Guest-accessible competition review path
- Ministry Hub with leadership-authored alignment context
- Seeded public organizational-memory demo
- Decision-center evidence and judged provider flow disclosure
- Student Scripture reader and Journey Journal
- Leader Discipleship Review with Gloo diagnostics and safety labeling
- Server-side YouVersion and Gloo integration seams
- Tests covering public demo, guest mode, ministry alignment, Scripture surfaces, and end-to-end core workflows
- Server-only controls that independently enable guest AI generation and isolated guest sandbox edits
- [API usage evidence](competition-api-usage.md) and a [runtime architecture diagram](architecture/competition-runtime.md)

## What Is Intentionally Not Claimed

- No live Planning Center sync is claimed.
- No live Google Drive or Calendar writes are claimed from the core ministry event adapters.
- No AI output is treated as pastoral authority.
- No student reflection, pastoral-care note, medical data, or private volunteer note is promoted into Meridian.
- No licensed Bible text is stored as permanent Meridian content.
- No communication is automatically sent by AI.

## Why This Matters For The Competition

The judging rubric rewards impact, storytelling, and real execution. This proof layer supports all three:

- **Impact:** leaders recover attention for students, volunteers, families, and follow-up.
- **Storytelling:** one student question connects to the ministry's current Scripture Practice season and the leader's operational week.
- **Execution:** YouVersion and Gloo are visible in real app routes, API boundaries, tests, and documentation.
