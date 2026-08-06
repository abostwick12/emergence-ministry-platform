# MCP EMMA bundle review

## Boundary

`submit_bundle_for_emma_review` is a separately granted, confirmed MCP write. It reviews one complete, already-saved resource bundle. It cannot edit artifacts, approve the bundle for a person, publish, send, synchronize, or promote any text into Meridian.

The server—not the connected AI client—enforces the review boundary:

- the authenticated user's ministry and `can_review_resources` grant are rechecked;
- the caller must own the bundle unless the grant is administrative;
- every submitted artifact identifier must belong to the bundle;
- every submitted body must hash to the saved artifact content hash;
- every grounding claim is fetched again from approved Meridian evidence;
- missing grounding, incomplete linkage, and prohibited inference are checked deterministically;
- provider findings may make an outcome stricter but can never override a deterministic blocker or required change; and
- every non-failed outcome leaves `human_review_status = pending`.

## Contract 1.0

EMMA returns exactly one of:

1. `ready_for_human_review`
2. `changes_required`
3. `blocked`

Every finding includes:

- a stable code;
- category and severity;
- the affected artifact identifier, or `null` for a bundle-wide finding;
- a human-readable explanation; and
- approved claim/fragment identifiers or a deterministic `rule:` reference.

Findings cover grounding, culture, theology, Scripture, privacy, permission, prohibited inference, citations, audience/temporal fit, and linkage. The provider output is strictly validated. Artifact and evidence references outside the submitted review context fail closed.

## Stored provenance

The review record retains:

- contract version, outcome, and concise human-facing summary;
- content fingerprint and idempotency key;
- findings;
- provider/model identifiers;
- EMMA request and run identifiers;
- approved claim and fragment links per bundle artifact;
- private-discovery check status; and
- pending human-review state.

It does not retain the provider prompt, draft body copies, private-note text, vault paths, or private-note excerpts. Draft bodies remain in their existing resource attachments. Private discovery remains represented only by the Phase 4 hash-only provenance.

Review and evidence tables are append-only to authenticated clients. A single locked-down transactional RPC performs the explicit tenant, grant, bundle-state, audit-run, and evidence checks before it writes provenance and maps the outcome; direct authenticated inserts and mutations are revoked.

## Failure and retry behavior

Provider timeout, invalid structured output, unavailable provider, invalid artifact references, and invalid evidence references fail safely. The bundle stays `emma_status = not_reviewed`, and the failed attempt is retained with its EMMA request identifier and sanitized failure code.

Repeating the same idempotency key returns the stored result and does not create another completed review. A failed key is not silently retried; the user must choose a new key after correcting provider readiness.

## Outcome mapping

| EMMA outcome | Bundle status | EMMA status | Human status |
|---|---|---|---|
| `ready_for_human_review` | `review_required` | `passed` | `pending` |
| `changes_required` | `changes_requested` | `changes_required` | `pending` |
| `blocked` | `blocked` | `blocked` | `pending` |
| failed provider/contract | unchanged | `not_reviewed` | `pending` |

No publication or external-communication tool exists in this phase. A later execution project must independently require an approved human decision on the exact reviewed version.

## Activation

Application activation requires the Phase 4 migration first, followed by additive migration `20260805190000_platform_mcp_emma_review.sql` and the matching application deployment. Enable `can_review_resources` only after both application and database versions are confirmed.

Verify with synthetic bundles:

1. cross-tenant, revoked-grant, non-owner, incomplete-bundle, and changed-content requests fail;
2. approved claim and fragment links are retained without prompt or draft-body duplication;
3. a deterministic prohibited inference cannot be downgraded by a provider-ready response;
4. provider invalid output leaves the bundle unreviewed;
5. all three outcomes map to the expected bundle and item states;
6. repeated idempotency keys do not duplicate reviews; and
7. every successful outcome still displays pending human review.
