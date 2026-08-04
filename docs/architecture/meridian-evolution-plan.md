# Meridian evolution plan

## Sandbox status (2026-08-01)

Two isolated Supabase sandbox cycles and one production schema cycle are complete. Four additive Meridian migrations are installed in production; the new tables remain empty and no MCP access grants exist. Ten of ten sandbox tests passed, and the five-check production cycle found and closed one default anonymous-grant gap. Application/OAuth launch remains gated as documented in `docs/benchmarks/meridian-production-rollout-2026-08-01.md`.

## Product goal

Meridian should produce reliable formation journeys and leader resources grounded in approved Scripture, Lead Emergence theology, and ministry culture. It should not imitate Andrew's sermon style or manufacture conceptual novelty.

## Architecture

Keep Meridian inside the existing Next.js and Supabase modular monolith. The server owns permission checks, evidence-pack construction, provider orchestration, validation, and traces. PostgreSQL owns tenant isolation, review state, immutable fragments, typed relationships, indexed retrieval, and durable provenance.

The generation path is:

1. Normalize the question and preserve any supplied Scripture anchor.
2. Build a task context containing ministry, audience, task type, sensitivity, time, query, and Scripture references.
3. Retrieve a bounded set of approved atomic claims using indexed full-text search.
4. Rank by authority, relevance, authored-source nuance, confidence, and temporal/context fit.
5. Load only the exact permitted fragments supporting those claims.
6. detect contradiction, qualification, dispute, supersession, staleness, and missing support.
7. Produce a structured Journey plan before prose.
8. Validate anchor fidelity, citations, YouVersion provenance, prohibited inference, permission use, and private-fragment overlap.
9. Return, abstain, or require leader review and record the full provider/evidence trace.

## Source policy

The reviewed Andrew-authored corpus contains three distinct subtypes:

- academic papers: primary source for difficult theological distinctions and qualifications
- curriculum materials: primary source for repeatable learning and formation sequences
- sermons: approved local teaching history and application, never automatic doctrine

Every source starts private, unreviewed, authority `none`, and discovery-only. Review assigns authority and independent quote, paraphrase, citation, final-answer, and external-communication permissions. Corpus location, editing quality, or authorship never implies approval.

## Performance plan

The first slice replaces broad claim loading with a GIN-indexed, 32-claim retrieval bound. It also avoids wasted provider calls for invalid verse ranges and blocks generic topic substitution.

Next, add versioned embeddings and HNSW search to approved fragments only, fuse lexical and semantic ranks, and cache evidence packs by `(ministry, corpus version, normalized task, Scripture anchor)`. Cache evidence, not final prose. Run independent provider timeouts and use deterministic formation templates when a provider fails.

Targets are recorded in the [pre-evolution benchmark](../benchmarks/meridian-pre-evolution-2026-08-01.md): p95 under 8 seconds for cached evidence and under 15 seconds uncached, 100% supplied-anchor fidelity, inspectable grounding for every theological synthesis, and zero private leakage or prohibited diagnosis.

## Rollout

1. Review the additive migration in a Supabase branch database and run database/security advisors.
2. Import only synthetic fixtures, then a small hand-selected set of academic papers, curriculum, and sermons into a review queue.
3. Approve atomic claims and fragments; do not bulk-approve whole documents.
4. Shadow-run new evidence packs beside the current Journey path and compare them with the locked benchmark.
5. Enable the new planner for leader review, then for student journeys after anchor, citation, leakage, and latency gates pass.
6. Add hybrid vector retrieval only after the reviewed corpus and golden evaluations are stable.

No production migration, private ingestion, provider configuration, or deployment is performed by this branch.

## MCP-first resource development

Meridian now includes a provider-independent MCP slice for volunteer and leader resource development. The external AI performs creative reasoning under the user's own account; Lead Emergence exposes only approved knowledge and accepts only grounded, review-required drafts. See [Meridian MCP architecture](./meridian-mcp.md).

The MCP rollout order is:

1. Apply and validate the primitive and MCP migrations on an isolated Supabase branch.
2. Add OAuth 2.1 connection and revocation before any volunteer pilot.
3. Add an admin grant screen and leader review queue.
4. Pilot with a small group using approved synthetic or reviewed corpus material.
5. Preserve platform-funded API generation only for student-facing and unattended workflows that cannot originate in a user's AI client.

## Reviewed authored-corpus bridge

The Resource Hub now exposes an admin-only, claim-by-claim review path for the existing source library. Academic papers, curriculum materials, and sermons share the `andrew_authored_ministry` corpus while retaining distinct source types and priority. The old library remains a holding area; visibility and authorship never confer Meridian authority.

Each review requires an exact excerpt, an atomic proposition, explicit authority, confidence, attribution when scholarly, sensitivity, rationale, and separate use permissions. The database verifies that the excerpt is an unchanged substring of the selected legacy chunk, preserves source/chunk provenance, blocks YouVersion substitution, and commits the governed objects atomically. Private Obsidian candidates remain on the separate discovery-only promotion path.

Production content remains intentionally empty until an admin uses this workflow to approve a small first corpus. Start with a few academically strongest papers, then curriculum sequences, then representative sermons. Evaluate retrieval and MCP output after each small batch instead of bulk-promoting the 80 legacy records.
