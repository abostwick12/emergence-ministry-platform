# Meridian candidate source review

Date: 2026-08-03

## Decision

All six curated Obsidian candidates are structurally ready to enter the Meridian candidate review queue. This is a source-fidelity and contract-readiness decision, not doctrinal adoption, production authorization, or approval for answer generation.

Three candidates were narrowed during review so their claims do not outrun the source material. After revision, the dry audit found six ready candidates and zero blockers. No Supabase write, promotion, provider call, or production evaluation occurred.

## Review method

The candidate overlays were checked against the original Word sources in the private vault:

- `The Trinity essay final.docx`
- `Bound in Grace New Covenant Student Scripture sheet formatted.docx`

The environment did not contain Python, LibreOffice, or Pandoc, so visual rendering was unavailable. Review used direct OOXML paragraph extraction from each Word document and compared the candidate claims, passage locators, facets, rationales, and boundaries with the extracted source text. This supports structural source review but does not constitute visual-layout quality assurance of the Word files.

The final six vault notes were also compared with their staged copies by SHA-256 hash; all six matched.

## Source evidence index

Paragraph numbers below refer to the nonempty paragraphs extracted from each original Word document during this review.

### Trinity academic source

- Paragraphs 5 and 8: one divine being, Father/Son/Spirit distinction, equality, and rejection of modalism and tritheism.
- Paragraphs 11-12: biblical witness, including John and Luke 3:22.
- Paragraphs 17-20: unity, distinction, equality, monotheism, and the explicit three-gods objection.
- Paragraphs 22-24: limits of finite comprehension and the claim that Trinity and monotheism are not contradictory.

### Bound in Grace student resource

- Paragraphs 2-20: the Scripture sequence, including Jeremiah 31:31-34, Luke 22:20, Ezekiel 36:22-32, and Romans 6:3-4.
- Paragraphs 34-43: covenant vocabulary, including loyalty, obedience, blessing, consequence, sign, loyal love, and mediator.
- Paragraphs 63-64: New Covenant framing across Jeremiah 31, Luke 22, and Hebrews 8-10.
- Paragraphs 73, 77, 80, 86, and 89: student research prompts and resource context.

## Candidate decisions

| Candidate | Source-review decision | Conditions that remain |
| --- | --- | --- |
| Trinity Scripture Witness (`passage`) | Advance to candidate import review. The passage set and two proposed claims are supported by the Trinity source. | Verify transient Scripture text and exact claim wording before promotion. |
| One God and Triune Confession (`doctrine`) | Advance to candidate import review. The unity/distinction formulation is supported by the source. | Human doctrinal review must set authority, qualifications, tradition scope, and adoption status. |
| New Covenant Vocabulary for Student Formation (`formation`) | Advance after revision. Passage ranges, vocabulary, and formation posture now track the student resource. | A ministry leader must approve audience use and applications. |
| Trinity and Monotheism Question Map (`question`) | Advance after revision. The fourth facet now states the source-supported limit of finite human comprehension. | Remains a question/facet map only; it contains no model answer or generation authority. |
| Trinity Witness Supports Confession (`relationship_proposal`) | Advance conditionally. The proposed support edge is structurally justified by the paired passage and doctrine candidates. | Review both endpoint candidates before accepting the edge, scope, or confidence. |
| Trinity Explanation Boundaries (`guardrail_proposal`) | Advance after revision. The third prohibition now tracks the source's finite-comprehension boundary. | Human doctrinal review must approve every prohibited conclusion before promotion. |

## Revisions made during review

1. Replaced an analogy-focused question facet with `limits of finite human comprehension`, which is directly supported by the Trinity source.
2. Replaced the analogy/exhaustive-explanation guardrail with a narrower prohibition against claiming that finite human reasoning can exhaustively explain the Trinity.
3. Reworked the formation candidate's passage ranges, claims, and pastoral posture to follow the Bound in Grace Scripture sequence and glossary instead of inferring a broader formation model.

## Post-review readiness audit

| Measure | Count |
| --- | ---: |
| Markdown notes scanned | 572 |
| Explicit candidate opt-ins | 6 |
| Contract-ready candidates | 6 |
| Contract-blocked candidates | 0 |
| Existing notes safely skipped | 566 |

Each candidate remains `private`, `unreviewed`, authority `none`, quote policy `never`, and `discovery_only`.

## Production candidate import verification

On 2026-08-04, explicit approval was given to import the reviewed set into the production Supabase candidate queue. The first REST attempt returned `401 Invalid API key`; direct verification confirmed that it inserted zero rows. The authenticated fallback then submitted the six reviewed rows as one atomic database statement.

Post-write verification found:

| Invariant | Result |
| --- | ---: |
| Candidate rows | 6 |
| Distinct content hashes | 6 |
| Object types represented | 6 of 6 |
| Private, unreviewed, authority `none` | 6 of 6 |
| Quote policy `never`, generation policy `discovery_only` | 6 of 6 |
| Reviewed or promoted candidates | 0 |
| Promoted sources, claims, guardrails, or relationships | 0 |

The importer was subsequently hardened to send a ready set as one PostgREST batch request. This makes the normal apply path transactional at the request boundary and removes the former risk of a network failure leaving only part of a reviewed batch in the queue.

## Next gate

Promotion remains a later, explicit human decision after reviewing the imported candidate records and their source provenance. No candidate may become generation evidence merely because it was imported successfully.
