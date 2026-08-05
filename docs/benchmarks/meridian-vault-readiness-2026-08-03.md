# Meridian vault readiness baseline

Date: 2026-08-03

## Purpose

Establish the first measured baseline for the curated Obsidian overlay after introducing Meridian candidate schema version `1`. This is a readiness audit, not an ingestion or approval run.

## Method

The local command was:

```bash
npm run rag:obsidian:dry-run
```

The importer read the existing `two-hemisphere brain` vault and wrote an ignored local preview to `tmp/obsidian-rag-launch-pack-preview.json`. It made no vault, Supabase, provider, or production write.

## Result

| Measure | Count |
| --- | ---: |
| Markdown notes scanned | 566 |
| Explicit `meridian_ingest: candidate` opt-ins | 0 |
| Contract-ready candidates | 0 |
| Contract-blocked candidates | 0 |
| Notes safely skipped | 566 |

Skip reasons:

- 492 had no explicit Meridian candidate opt-in;
- 42 were scholar-citation-only;
- 24 were leader-review;
- 8 were private-review.

## Interpretation

An empty result is the correct safe baseline. Existing folders, visibility labels, authorship, links, and note quality did not silently promote any material into the Meridian review queue. The result also confirms that the next constraint is deliberate curation rather than retrieval tuning: a reviewer must create a small set of versioned candidate overlays before corpus coverage can improve.

## Next controlled step

Copy the appropriate templates from `docs/templates/meridian-candidates/` into the vault's `10 Meridian Candidates/` overlay for a small representative set. Start with passage, doctrine, formation, question, relationship, and guardrail coverage tied to held-out evaluation needs. Rerun the dry audit, resolve every blocking issue, review the preview, and request separate approval before any Supabase candidate write or promotion.

## Curated overlay follow-up

After explicit approval, six additive notes were created under the vault's `10 Meridian Candidates/` overlay. Existing vault notes and paths were preserved. The representative set contains:

- one passage candidate grounded in the Trinity academic source;
- one doctrine candidate separating monotheism from triune personal distinction;
- one formation candidate grounded in the Bound in Grace student resource;
- one Trinity question/facet map without a model answer;
- one typed support-relationship proposal;
- one Trinity explanation guardrail proposal.

The follow-up dry audit produced:

| Measure | Count |
| --- | ---: |
| Markdown notes scanned | 572 |
| Explicit candidate opt-ins | 6 |
| Contract-ready candidates | 6 |
| Contract-blocked candidates | 0 |
| Existing notes safely skipped | 566 |

Every candidate remains `private`, `unreviewed`, authority `none`, quote policy `never`, and `discovery_only`. No Supabase, provider, production, or promotion write occurred.

The subsequent [source review](meridian-candidate-source-review-2026-08-03.md) checked all six candidates against the original Word sources, narrowed three statements that exceeded direct source support, reran the audit with zero blockers, and verified that all six vault files match their staged copies. The next gate is a separately approved candidate import; import is not promotion or doctrinal adoption.
