# Meridian Primitive Knowledge Architecture

## Status

The governed primitive model is an additive production slice alongside the legacy `knowledge_sources` / `knowledge_chunks` compatibility path. New private material must enter through `meridian_candidates`; legacy rows are not automatically approved or backfilled.

## Object model

- **Source** records what a thing is: academic paper, curriculum material, sermon, external scholarship, policy, doctrine, strategy, Obsidian note, operational record, Scripture reference, or AI draft. A separate corpus family preserves provenance across those subtypes.
- **Fragment** is an immutable, addressable portion with a locator, SHA-256 hash, provenance, sensitivity, generation policy, and five independent permissions: quote, paraphrase, cite, final-answer use, and external-communication use.
- **Claim** is one atomic proposition with attribution, authority, review status, confidence, temporal/context scope, and explicit supporting fragments.
- **Context** describes ministry, audience, task, tradition, sensitivity, and effective dates.
- **Relationship** links typed objects using the governed vocabulary, including contradiction, qualification, supersession, derivation, and Scripture use.
- **Guardrail** is a machine-enforceable access, authority, quotation, theological, privacy, or generation rule.

`meridian_objects` provides a tenant-scoped identity registry so relationship endpoints have real foreign keys. Composite `(ministry_id, id)` foreign keys prevent cross-ministry links.

## Authority and approval

Authority is explicit and never inferred from source kind or location:

1. canonical Scripture retrieved from YouVersion
2. approved theological and safeguarding policy
3. adopted doctrine, mission, and values
4. current strategy and seasonal priorities
5. approved teaching history
6. attributed scholarship
7. operational evidence
8. no authority: informal notes, AI output, and drafts

A sermon remains teaching history unless an admin explicitly reviews it. Scholarship requires attribution. AI-derived artifacts remain unreviewed with `authority_class = none` and cannot be silently promoted.

Academic papers, curriculum materials, and sermons belong to the reviewed `andrew_authored_ministry` corpus. They ground Lead Emergence theology and culture; they are not style-training data. Academic papers receive the strongest nuance priority when authority and task relevance are otherwise equal, followed by curriculum and then sermon history. Approval and authority remain explicit for every item, so membership in the corpus never makes a source doctrine or policy.

## Retrieval and generation boundaries

Discovery and generation are separate repositories and data paths:

1. Private candidate discovery is admin-only and may inspect raw text for review.
2. `SupabaseMeridianKnowledgeRepository.loadApprovedEvidence` uses the authenticated user client, strict profile-derived ministry scope, operator role checks, and the bounded `search_meridian_approved_claims` RPC. The RPC uses an indexed full-text search vector and returns at most 32 approved atomic claims before supporting fragments are loaded.
3. `buildMeridianEvidencePack` orders claims by authority, applies temporal/task scope, excludes unapproved or unsupported claims, and detects contradiction and supersession before generation.
4. `formatApprovedEvidencePackForGeneration` serializes approved claims first and permitted supporting fragments second. Candidate rows are not part of this formatter.
5. The response contract separates observations, Scripture, interpretation, recommendations, uncertainty, leader questions, citations, and abstention.
6. Response validation blocks prohibited diagnoses/inferences and ungrounded recommendations.
7. The leakage firewall compares final output against any private discovery fragments associated with the run using exact token windows and fuzzy bigram overlap. A match blocks output and requires review; diagnostics contain identifiers and hashes, not private text.
8. Journey generation treats a submitted Scripture reference as a hard constraint. A specialized topic template may expand a single verse to its immediate unit, but it cannot replace the primary passage.

Existing student-triggered generation no longer reads legacy `internal_grounding` rows. The compatibility adapter returns governed approved evidence only for admin/leader/staff sessions; student and guest calls receive no private grounding.

## Obsidian safety

Obsidian import is opt-in with `meridian_ingest: candidate`. Frontmatter such as `student_visible`, file location, prose quality, or prior editing never implies approval.

Every candidate is forced to:

- source kind `obsidian_note`
- authority `none`
- approval `unreviewed`
- quote policy `never`
- generation policy `discovery_only`
- external visibility `private`
- all five use permissions `false`

Sensitive keyword matches are quarantined before candidate creation. Raw text lives only in the admin-only candidate table. Promotion requires an authenticated ministry admin, reviewed replacement fragment text, an atomic claim, explicit authority and permissions, and a rationale. The transaction creates immutable approved objects and an audit event; it does not mutate or reinterpret the raw candidate.

Person-specific and pastoral fragments cannot be used in a final answer or external communication. They are excluded in database checks, RLS, repository filters, and the domain policy layer.

## Scripture boundary

Canonical Scripture text is retrieved transiently from YouVersion. The adapter returns provider, passage ID, Bible/translation identity, reference, and retrieval time. The database permits Scripture locator/provenance but rejects persisted Scripture text. Response contracts keep Scripture quotation structurally separate from AI interpretation.

## Migration and rollout

Migration: `supabase/migrations/20260801120000_meridian_primitive_knowledge.sql`.

Reviewed legacy-source bridge: `supabase/migrations/20260804130000_meridian_legacy_source_review.sql`.

The bridge does not reinterpret `student_visible`, `own_voice`, or any other legacy label as approval. An authenticated ministry admin must classify a source as an academic paper, curriculum material, or sermon, state one atomic claim, select one exact supporting excerpt, assign authority and sensitivity, and independently approve quotation, paraphrase, citation, final-answer use, and external-communication use. The transaction preserves the legacy source/chunk identifiers and creates the governed Source, Fragment, Claim, support relationship, and audit rows together. Obsidian candidates are excluded from this path.

The pre-evolution performance and quality baseline is recorded in [the Journey Journal benchmark](../benchmarks/meridian-pre-evolution-2026-08-01.md).

1. Review SQL and run Supabase database/security advisors in the target project.
2. Apply in a non-production branch database first. No migration was applied by this code change.
3. Verify RLS with two ministries and admin/leader/staff/student roles using real JWT impersonation.
4. Create synthetic candidates and test the complete promotion transaction.
5. Enable approved-evidence retrieval for leader-review workflows.
6. Backfill legacy content only through an explicit review queue; never bulk-mark it approved.
7. Retire legacy `internal_grounding` and visibility-based promotion after all production consumers use evidence packs.

Rollback is additive: disable new retrieval, leave the new tables intact for audit, and continue the legacy compatibility path. Do not drop governed tables while traces or review events reference them.

## Deferred work and risks

- No production Obsidian vault content has been ingested.
- No migration has been applied to a live Supabase project.
- Static migration tests supplement, but do not replace, a real local/branch database RLS test matrix.
- Hybrid semantic retrieval is deferred until primitive promotion quality is stable and embeddings can be versioned. The first slice uses indexed PostgreSQL full-text search; the next retrieval phase should add pgvector/HNSW and reciprocal-rank fusion without weakening RLS or approval filters.
- The existing control-room UI still manages the legacy corpus. The protected promotion API is the first affordance; a full typed review UI is a separate visual slice.
- Provider traces have governed tables and domain types; wiring every legacy Meridian provider call into those traces remains follow-up work.
