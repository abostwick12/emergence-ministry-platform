# Platform MCP pilot readiness

## Purpose

Phase 6 turns the completed platform MCP into an observable, reversible pilot. It does not activate the pilot, apply migrations, deploy production code, enroll anyone, add volunteer access, publish content, or send communications.

Every platform tool now has two independent gates:

1. the existing per-capability grant; and
2. an administrator-controlled pilot cohort preflight.

Search and existing review-only Meridian knowledge workflows remain outside this platform pilot gate. Event, task, team, resource, private-discovery bundle, and EMMA review tools require it.

## Cohort sequence

- Nothing is enrolled by default.
- The administrator cohort is capped at two people.
- The leader cohort is capped at three people.
- Leaders enter with platform read access only. Write capabilities remain separately controlled and default off.
- Removing a participant immediately clears every platform capability while retaining cohort audit history.
- Volunteers are excluded in both the database function and tool surface.

Begin with one administrator. Add a second administrator only after synthetic tenant, revocation, placement, privacy, idempotency, and telemetry-failure checks pass. Add one leader in read-only mode only after the administrator sample meets the exit thresholds below. Add the remaining leaders one at a time.

## Payload-free metrics

Successful platform calls must record their pilot metric. If a successful write cannot record telemetry, the tool returns a safe retry instruction; the same idempotency key must be reused. Failure telemetry is best effort so a telemetry outage never replaces the original bounded tool error.

The event record may retain only:

- ministry/user/cohort identifiers;
- tool name and bounded connected-client category;
- read/write outcome and latency;
- stable target and parent record identifiers;
- result, artifact, and grounding-claim counts;
- private-discovery status code;
- EMMA outcome and finding-severity counts;
- placement verification and idempotent-replay flags; and
- a bounded error code.

It has no JSON payload, prompt, title, description, draft body, raw note text, note path, provider response, person detail, pastoral note, or free-form error message. Direct authenticated inserts, updates, and deletes are revoked.

## Human usefulness feedback

Recent completed EMMA reviews appear in Settings for the review owner and administrators. Feedback is categorical:

- useful, mixed, or not useful;
- correct workspace placement;
- whether grounding review helped;
- correct, concern, or not-applicable privacy handling; and
- a bounded issue code, including reported duplicate writes.

Submitting feedback never changes `human_review_status`, approves a bundle, publishes an artifact, or sends anything. Corrections append a new feedback record; prior evaluations remain auditable.

## Pilot measurements

The 30-day administrator rollup covers the roadmap requirements:

| Roadmap measure | Pilot signal |
|---|---|
| Correct record placement | Database-verified write placement plus human `placement_correct` feedback |
| Grounding | Submitted approved-claim count, EMMA finding counts, and `grounding_helpful` feedback |
| Privacy | Leakage-block error count and categorical privacy concerns |
| Review usefulness | Useful/mixed/not-useful feedback on the exact review |
| Latency | Median and p95 call duration; per-tool events remain available for separating EMMA latency |
| Duplicate writes | Deterministic replay count plus human-reported duplicate-write incidents |

## Exit thresholds

Do not expand a cohort unless its last 30 days meet all applicable thresholds:

- at least 25 successful administrator calls spanning reads, event/task changes, resource placement, and all three EMMA outcome paths;
- 100% database-verified placement for successful writes and 100% correct placement in submitted feedback;
- zero cross-tenant access, revoked-grant bypasses, raw private-note storage, unresolved privacy concerns, or reported duplicate writes;
- every replay returns the original stable record with no duplicate database row;
- at least 80% of review feedback is useful or mixed, and at least 80% marks grounding helpful;
- p95 under 5 seconds for non-provider tools and under 60 seconds for EMMA review, checked from per-tool events;
- every non-failed EMMA outcome remains pending human review; and
- telemetry outage exercises fail as documented without creating duplicate writes.

A metric below threshold pauses expansion. It does not authorize weakening the threshold, deleting history, or broadening permissions.

## Synthetic activation order

After the preceding stacked PRs are merged and only with explicit environment approval:

1. verify the exact non-production Supabase and Vercel targets;
2. apply the Phase 3, Phase 4, Phase 5, then Phase 6 additive migrations in order;
3. deploy the matching application commit;
4. confirm all pilot stages are `not_enrolled` and all new platform capability defaults are false;
5. run cross-tenant, non-owner, wrong-role, revoked-grant, cohort-cap, and direct-table-write denial tests;
6. run idempotent create/update/resource/review retries and verify one record per key;
7. run exact and fuzzy private-note leakage blocks and confirm telemetry contains only the error code;
8. exercise ready, changes-required, blocked, invalid-provider, and telemetry-outage paths;
9. verify the Settings dashboard at desktop and mobile viewports; and
10. enroll one administrator only after the evidence is reviewed by a person.

## Deferred expansion

Volunteer platform tools, schedules, teams beyond assignable staff metadata, files beyond reviewed resource links, publishing, communication sending, external synchronization, pastoral data, Camp data, medical data, and mental-health workflows remain separate future projects. Each requires its own narrow contract, role tests, approval path, and release decision; Phase 6 does not silently authorize them.
