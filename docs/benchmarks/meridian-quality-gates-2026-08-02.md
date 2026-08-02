# Meridian automated quality gates

Date: 2026-08-02

## Purpose

The pre-evolution Journey benchmark exposed three high-impact regressions that structural tests did not reliably catch: a supplied Scripture anchor could be replaced, plausible prose could lack inspectable theological support, and a generic formation template could avoid the distinctions in the submitted question.

`lib/meridian/quality-evaluation.ts` adds a deterministic, provider-free evaluation layer around the governed evidence pack and answer contract. It uses synthetic approved evidence only and makes no Supabase or AI-provider request.

## Automated gates

- response-contract validity
- supplied primary Scripture-anchor fidelity
- required approved-claim citation coverage
- required authored-source subtype coverage
- scenario-specific concept coverage
- scenario-specific nuance coverage
- preservation of required human review

Each evaluation also records 0–5 scores for question fidelity, Scripture fit, grounding, nuance, actionability, provenance and citations, safety and restraint, human-review discipline, and contract consistency.

## Explicit boundary

Automated gates cannot decide whether a theological explanation is correct or whether a resource is pastorally useful. Those dimensions remain mandatory human-review judgments. A 100% automated score means the response is ready for that review; it never means the resource is approved or publishable.

## Retrieval and generation invariants

The governed path now treats answer relevance as an infrastructure rule rather than an evaluation-corpus score:

- the normalized user question and supplied Scripture anchor survive into retrieval
- explicit compound questions become separately retrieved required facets
- empty or over-complex question plans abstain instead of executing a broad search
- the approved-claim RPC requires an actual full-text match and ranks relevance before authority
- facet coverage is rechecked after scope, permission, relationship, and supporting-fragment filters
- a claim returned for multiple facets must independently clear the lexical coverage floor for each facet
- leader-triggered provider regeneration is blocked when governed evidence coverage is incomplete
- relationships and sources are hydrated only for the retrieved evidence graph

The relevance-floor SQL is additive. It was applied and calibrated only in the isolated Meridian sandbox on 2026-08-02; production remains unchanged pending a separate release approval.

## Initial locked scenarios

The first two scenarios preserve the production benchmark questions:

1. the Trinity and Christian life, anchored in Matthew 28:19
2. grace, faith, and works, anchored in Ephesians 2:8-10

Regression cases prove that the harness rejects substituted Scripture, shallow concept coverage, missing expected distinctions, and fabricated claim/fragment citations.

## Remaining infrastructure risk

The principal retrieval risk is lexical brittleness: paraphrases and synonyms can cause safe over-abstention. Semantic retrieval should be evaluated in shadow mode against the locked corpus before it can affect production ranking or coverage decisions.

## Next expansion

Expand the suite to 20–30 reviewed scenarios before changing ranking weights or adding semantic retrieval. Each scenario should declare its required concepts, distinctions, claims, source subtypes, Scripture anchor, and actionability expectation. Provider outputs can then be shadow-scored against the same locked contract without storing or approving the output.
