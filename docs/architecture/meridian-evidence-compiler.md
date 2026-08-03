# Meridian Evidence Compiler Architecture Decision

## Status

Accepted on 2026-08-03 after the first five-question production evaluation pilot. This document is the governing direction for the next Meridian infrastructure slices.

## Decision

Meridian will move from loosely coupled retrieval plus generation to a mandatory evidence-compilation path:

1. preserve the student's exact question and supplied Scripture anchor;
2. classify the request as passage, doctrine, formation, or mixed intent;
3. decompose only explicit question parts into required facets;
4. retrieve approved, permitted evidence for each facet;
5. expand only reviewed, typed relationships with rationale and scope;
6. build a structured Evidence Map before prose;
7. validate coverage, relevance, authority, contradiction, uncertainty, pastoral requirements, and Scripture-anchor fidelity;
8. generate for leader review, return a partial-grounding label, or abstain;
9. record an inspectable evaluation trace.

Legacy student-resource matches and static context maps may continue to shape reading recommendations and formation prompts. They must not be treated as theological evidence merely because they have token overlap or appear in the retrieved list.

## Why this is the highest-return path

The production pilot on merge commit `9929509` returned four structured answers from five submissions, but only one answer passed every automated capability gate. Plausible direct answers were sometimes paired with unrelated source matches, reading recommendations, and digging questions. One high-sensitivity question failed structured parsing.

The governed primitive architecture already supplies atomic claims, explicit authority, permissions, typed relationships, question facets, evidence packs, abstention, response validation, and provenance. The highest return comes from making that architecture mandatory for production generation rather than creating a parallel Meridian V2 schema.

## Intent routes

Passage-first is mandatory when a passage is supplied, but passage-only retrieval is not the universal model.

- **Passage intent:** primary passage, immediate literary context, reviewed historical context, exegetical claims, approved canonical relationships, and application boundaries.
- **Doctrine intent:** adopted doctrine, attributed perspectives, Scripture support, consensus level, faithful disagreement, ministry position, misconceptions, and uncertainty boundaries.
- **Formation intent:** pastoral posture, student context, practices, risks, and application, constrained by approved doctrine and Scripture.
- **Mixed intent:** an explicit plan declaring which facets require passage, doctrine, or formation evidence.

Topics and embeddings are routing and discovery aids. They are never evidence on their own.

## Evidence Map contract

The compiler should produce a provider-independent structure containing:

- normalized question and exact supplied anchor;
- intent route and required facets;
- primary passages and their role;
- approved claims supporting each facet;
- permitted fragments and provenance;
- relationship type, rationale, confidence, reviewer, and interpretive scope;
- consensus, disputed, qualified, contradicted, and superseded signals;
- explicit prohibited conclusions;
- uncertainty and pastoral-care requirements;
- missing evidence;
- decision: `generate`, `generate_for_review`, `partially_grounded`, or `abstain`.

The provider may write inside this map. It may not invent new evidence links or silently promote discovery material.

### Shadow implementation contract

Evidence Map version `1` runs beside the compatibility provider path before it can become authoritative. It records:

- dynamic overall intent and a passage, doctrine, or formation route for each explicit facet;
- supplied Scripture anchors and whether approved Scripture fragments support them;
- approved claim, fragment, and source identifiers for every facet;
- reviewed typed relationships and their rationale;
- uncertainty, pastoral-care, and human-review requirements derived from the live question;
- evidence issues, prohibited conclusions, and a deterministic generation decision;
- safe leader-facing counts that exclude raw claim IDs, fragment IDs, relationship rationale, and provider context.

The shadow scorer measures required-facet evidence, supplied-anchor retention, structured output, pastoral care, uncertainty, mandatory human review, and declared claim-to-fragment attribution. Shadow results cannot authorize student-facing output.

### Claim-attribution shadow extension

The provider receives a request-scoped evidence view with opaque handles instead of governed database identifiers:

- `Q#` identifies one explicit question facet;
- `C#` identifies one approved claim available to that facet;
- `F#` identifies one citation-permitted supporting fragment for that claim.

Every material theological statement in the structured provider draft must declare one facet handle, one claim handle, and at least one permitted fragment handle. The server retains the only ledger mapping those handles back to governed objects. It rejects invented handles, cross-facet claims, fragments that do not support the cited claim, fragments without citation permission, and responses that leave a supported required facet uncited.

The provider attribution payload and raw ledger are removed before the leader-browser response. Leaders see only the safe pass/fail gate and aggregate detail. This gate proves that the provider declared valid support paths; it does not independently prove theological correctness or semantic entailment. Human review, held-out production evaluation, and explicit release approval remain mandatory.

## Grounding labels

- **Grounded:** every required facet has relevant, permitted support and the answer's material claims remain inside that support.
- **Partially grounded:** at least one facet has support, but another required facet is missing or only weakly supported. The missing facet must be visible to the leader.
- **Ungrounded:** retrieved material does not support the question or no generation-permitted evidence exists.
- **Provider invalid:** the provider failed the structured response contract after one constrained repair attempt.

A positive source count is not sufficient to claim grounding.

## Authority and relevance

Ranking is gated in this order:

1. tenant, role, approval, sensitivity, and permissions;
2. intent and required-facet relevance;
3. supplied Scripture-anchor fidelity;
4. authority class and attribution;
5. reviewed relationship validity;
6. confidence, temporal scope, and task/audience fit;
7. lexical or semantic ranking within the surviving evidence.

High-authority but irrelevant material must not outrank lower-authority material that actually addresses the question. Original-language interpretation remains attributed scholarship unless an approved doctrinal object adopts the claim; it is not automatically equivalent to canonical Scripture.

## Obsidian boundary

Obsidian is a private authoring and discovery surface. Supabase remains the enforcement and approval system.

Do not reorganize the entire vault or infer authority from folders, tags, links, prose quality, or authorship. Add a curated Meridian-ready overlay incrementally with proposed object types:

- passage;
- doctrine;
- formation;
- question;
- relationship proposal;
- guardrail proposal;
- derived journey.

Candidate metadata may propose primary passages, question aliases, relationship types, rationale, confidence, tradition scope, and guardrail hints. It cannot approve its own authority or generation permissions. Promotion remains a human-reviewed Supabase transaction.

Scripture notes store locators, observations, and provenance. Canonical Scripture text remains transient through the approved Scripture provider boundary.

## Vault auditing direction

A generic note-count/link-density dashboard is not a Meridian quality system. A future Meridian Vault Readiness Auditor should instead check:

- candidate opt-in and discovery safety;
- proposed object type and required metadata;
- Scripture locator validity;
- relationship rationale, confidence, provenance, and scope;
- claims without support;
- unsupported fulfillment or typology assertions;
- missing disagreement/tradition boundaries;
- derived artifacts incorrectly treated as authority;
- duplicate hashes, broken links, and superseded objects;
- reviewed facet and passage coverage over time.

Raw note growth and raw link count are informational only and must not become optimization targets.

## Delivery sequence

### Slice 1 — Grounding integrity firewall

- separate student-resource retrieval from theological-answer evidence;
- reject or relabel irrelevant matches;
- enforce required pastoral and uncertainty fields;
- require explicit human review;
- permit one constrained structured-output repair;
- show grounding status and missing support in the leader preview;
- trace why evidence was accepted or rejected.

### Slice 2 — Evidence Compiler shadow path

- add intent planning;
- compile governed claims, fragments, and relationships into the Evidence Map;
- shadow-score it beside the compatibility path;
- do not expose it to students until production evaluation gates pass.

### Slice 3 — Curated Obsidian overlay

- define Meridian candidate templates;
- extend dry-run auditing and import previews;
- review and promote a small representative corpus;
- preserve existing vault paths and raw-source provenance.

### Slice 4 — Hybrid retrieval

- add versioned embeddings only to approved fragments;
- fuse lexical and semantic rank;
- cache evidence packs, not prose;
- expand relationship traversal only when reviewed edge quality is stable.

## Success metrics

- 100% supplied-anchor fidelity;
- 100% required-facet support or visible partial/abstain decision;
- 0 unrelated sources labeled grounded;
- 0 empty required pastoral/uncertainty fields;
- at least 95% valid structured provider responses after one repair attempt;
- 100% outputs remain leader-review required for this workflow;
- inspectable claim-to-source provenance for every material theological statement;
- no private, discovery-only, or prohibited fragments reach generation;
- production evaluation performance improves on held-out questions, not only the development corpus.

## Explicit non-goals

- no wholesale vault move;
- no bulk approval of Obsidian notes;
- no answer-key corpus disguised as question objects;
- no embedding-first redesign;
- no model upgrade presented as a grounding fix;
- no persistence of full canonical Scripture text;
- no autonomous doctrinal or pastoral authority.
