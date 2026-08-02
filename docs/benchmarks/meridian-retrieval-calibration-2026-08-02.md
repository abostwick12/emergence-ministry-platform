# Meridian retrieval calibration — 2026-08-02

## Decision summary

The merged lexical relevance floor passed isolated Supabase calibration for relevance ranking, approval gating, task and audience scope, two-way tenant isolation, empty and unrelated-query abstention, and text-query safety. No production database, real ministry data, AI provider, or external communication was used.

The run also exposed one provider-context weakness: an explicitly contradictory lower-authority claim was flagged for review but remained available for generation. The application policy now withholds that weaker claim while preserving the leader-review requirement. Equal-authority contradictions still force abstention.

## Environment

- Supabase project: `lead-emergence-meridian-sandbox`
- Project ref: `lpqgjnuvfvuuashcmlxq`
- Production connection: none
- Applied sandbox migration: `20260802195134 meridian_retrieval_relevance_floor`
- Fixture namespace: `meridian_retrieval_calibration_2026_08_02`
- Synthetic fixture size: 4 sources, 14 fragments, 14 claims, 3 governed relationships
- Authenticated actors: synthetic primary-tenant and neighbor-tenant leaders

## Locked corpus

The versioned corpus is stored in `tests/fixtures/meridian-retrieval-corpus-v1.ts`. Its 24 cases lock behavior rather than preferred prose, so it cannot reward an answer for copying benchmark wording. It covers:

- exact and partial relevance
- relevance-before-authority ranking
- task and audience scope
- approval status
- both directions of tenant isolation
- empty, generic, numeric-only, stopword-only, and unrelated queries
- known and unseen paraphrases
- Scripture-reference retrieval
- contradiction and negation prompts
- typo-driven safe abstention
- query-syntax characters treated as plain text
- stale and superseded evidence

## Results

- Core database invariants: 13 of 13 passed.
- Primary actor requesting the neighbor tenant: zero rows, passed.
- Neighbor actor requesting its own tenant: only the neighbor claim, passed.
- Relevance-before-authority: the more relevant approved teaching ranked above a less relevant approved policy, passed.
- Exact-topic separation: policy, lament, and Trinity identity queries each returned only their intended fixture claim, passed.
- Approval gate: the unreviewed claim never entered results, passed.
- Empty and unrelated input: zero rows, passed.
- Plain-text safety: full-text syntax characters were normalized as text and did not alter query structure, passed.
- Stale evidence: the RPC can retrieve a lexically strong stale claim, but the evidence-pack validity and supersession policy excludes it before generation, passed at the governed-pack boundary.
- Unseen paraphrase and misspelling: both safely over-abstained. This is a known recall limitation, not a reason to add question-specific exceptions.
- Contradictory weaker evidence: the RPC correctly surfaced the explicit conflict graph, but calibration showed the weaker claim could still reach provider context. The local policy fix now excludes it and keeps `requiresReview=true`.

## Performance sample

A 100-query authenticated mixed-topic run completed in 74.5 ms inside one database transaction. The function scan averaged 0.741 ms per invocation on the 14-claim synthetic corpus, with all blocks served from cache. This confirms no immediate sandbox regression, but it is not a production-volume capacity result. The full-text index remains intentionally retained even though Supabase reports it unused against this near-empty fixture.

## Advisor comparison

The post-migration advisor set introduced no new warning for `search_meridian_approved_claims`; it is security-invoker, has an empty search path, denies anonymous execution, and permits authenticated execution.

Pre-existing sandbox notices remain:

- authenticated execution of three intentional security-definer helpers/RPCs
- leaked-password protection disabled in sandbox Auth
- multiple permissive read policies that should be consolidated only after representative volume measurements
- unused-index notices expected for a tiny synthetic dataset
- unrelated legacy application foreign keys without covering indexes

## Release boundary and next gate

This calibration authorizes neither a production migration nor live provider generation. The next high-return slice is shadow-scoring real provider outputs against the locked behavioral corpus and structured answer contract. Semantic or hybrid retrieval should run in shadow mode first, specifically measuring whether it recovers the two lexical safe misses without increasing wrong-topic, cross-scope, or contradiction leakage.
