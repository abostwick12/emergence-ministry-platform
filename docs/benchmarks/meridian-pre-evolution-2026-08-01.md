# Meridian pre-evolution Journey Journal benchmark

Date: 2026-08-01

Environment: production, `https://www.leademergence.com/student/scripture/questions`

Role: authenticated Admin

Displayed journey provider: Gloo

Timing method: elapsed wall-clock time from selecting **Ask and wrestle with it** until the submitted question appeared in the rendered Journey Journal selector. This is a user-perceived render measurement, not provider-only latency.

## Scoring rubric

Each quality dimension is scored from 0 to 5:

- 5: strong enough to use as-is
- 4: strong with minor leader edits
- 3: usable with substantive leader review
- 2: materially weak or incomplete
- 1: misleading, mismatched, or mostly unhelpful
- 0: unsafe or wrong

## Question 1: Trinity

**Question:** How can God be one and three persons, and why does the Trinity matter for Christian life?

**Submitted passage:** Matthew 28:19

**Rendered journey:** Spirit-formed people and witness Journey

**Time to rendered journey:** 1.624 seconds

### What the journey produced

- Anchored the Receive step in Matthew 28:19 and linked to the NIV passage in YouVersion.
- Suggested Genesis 1:2 and Ezekiel 36 as storyline/hope passages.
- Recommended a word study, prayer from the passage, group discussion, and a concrete weekly response.
- Asked how Father, Son, and Spirit shape prayer, community care, and witness.
- Did not actually explain the classical claim that God is one being/essence in three distinct persons.
- Did not identify common misunderstandings such as modalism, tritheism, or treating the persons as parts of God.
- Did not cite an approved church source, academic source, curriculum, or teaching source for its theological framing.

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Question fidelity | 3 | The Walk prompt addresses the practical half of the question but the journey does not directly answer the doctrinal half. |
| Scripture fit and context | 3 | Matthew 28:19 is appropriate; the secondary passages are plausible but thinly explained. |
| Theological correctness | 4 | No obvious doctrinal error, but correctness is achieved partly by avoiding a substantive explanation. |
| Nuance and ambiguity | 2 | No account of unity, distinction, relations, limits of analogy, or competing misunderstandings. |
| Journey coherence | 4 | Receive/Explore/Practice/Walk/See forms a coherent progression. |
| Actionability | 4 | Includes a concrete prayer practice and group application. |
| Culture and formation alignment | 3 | Formation rhythm is evident, but the material is generic rather than demonstrably grounded in approved Lead Emergence sources. |
| Provenance and citations | 2 | Scripture has a YouVersion boundary; theological assertions have no inspectable source support. |
| Safety and restraint | 5 | Makes no prohibited diagnosis or claim about motive, divine intent, or health. |
| Consistency | 3 | The response is internally stable but its generic study cards are only loosely tailored to the Trinity. |

**Question 1 total:** 33/50 (66%)

## Question 2: grace, faith, and works

**Question:** What does it mean that Christians are saved by grace through faith, and how should we understand James saying faith without works is dead?

**Initial submitted passage:** Ephesians 2:8-10

**Initial result:** Client validation rejected the common verse-range notation and displayed: “Use a specific chapter or verse reference, like John 3:16 or JHN.3.16.” No generation request completed.

**Benchmark retry passage:** Ephesians 2:8

**Rendered journey:** Gospel Scripture Journey

**Time to rendered journey after valid retry:** 18.913 seconds

### What the journey produced

- The generated Receive step did not use the submitted Ephesians 2:8 anchor.
- It substituted Mark 1:14-15, 1 Corinthians 15:1-8, and Romans 3:21-26, with Mark 1:14 displayed in YouVersion.
- The Explore step became a generic word study of *euangelion*, *basileia*, and *charis*.
- Only the Walk prompt directly mentioned the tension between grace and living faith.
- It offered a basically sound summary—grace is received through trust in Jesus and deeds evidence living faith—but did not exegete Ephesians 2:8-10 or James 2:14-26.
- It did not distinguish justification, the evidentiary role of works, the differing argumentative contexts of Paul and James, or legitimate interpretive cautions.
- It provided no approved theological or authored-source citations.

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Question fidelity | 2 | One generated prompt acknowledges the tension; the main journey follows a generic gospel track. |
| Scripture fit and context | 1 | The system ignored the supplied Ephesians anchor and did not retrieve James. |
| Theological correctness | 3 | The short synthesis is broadly orthodox but too compressed to resolve the question reliably. |
| Nuance and ambiguity | 1 | No contextual reconciliation of Paul and James or treatment of interpretive distinctions. |
| Journey coherence | 3 | The substituted gospel journey is internally coherent but does not cohere with the requested evidence. |
| Actionability | 4 | It gives a concrete community practice. |
| Culture and formation alignment | 3 | Formation language is consistent, but grounding in approved local theology is not visible. |
| Provenance and citations | 2 | YouVersion provenance exists for the substituted Scripture; theological support is untraceable. |
| Safety and restraint | 5 | No prohibited personal, spiritual, medical, or mental-health inference. |
| Consistency | 1 | A valid question and anchor produced an unrelated primary passage set; verse ranges also failed validation. |

**Question 2 total:** 25/50 (50%)

## Baseline summary

| Measure | Result |
| --- | ---: |
| Median rendered-journey time | 10.269 seconds |
| Fastest rendered journey | 1.624 seconds |
| Slowest rendered journey | 18.913 seconds |
| Mean quality score | 29/50 (58%) |
| Supplied anchors honored | 1 of 2 |
| Answers with inspectable theological-source citations | 0 of 2 |
| Prohibited inferences | 0 of 2 |

The current system's strongest qualities are its stable formation rhythm, actionable practices, YouVersion boundary, and restraint. Its principal weaknesses are retrieval/topic substitution, lack of inspectable theological grounding, shallow handling of difficult distinctions, generic study scaffolding, variable latency, and rejection of ordinary verse-range syntax.

## Evolution targets

The first Meridian evolution should improve these measurable outcomes without trying to imitate a personal writing style:

- p95 rendered journey under 8 seconds for cached/reusable evidence packs and under 15 seconds for uncached generation
- supplied Scripture anchor honored in 100% of non-abstained journeys
- approved authored-source or church-source grounding visible for every theological synthesis
- at least 4/5 on question fidelity, Scripture fit, theological correctness, journey coherence, safety, and consistency in the golden suite
- at least 3/5 on nuance for genuinely difficult questions, with uncertainty or leader review when the corpus cannot support more
- zero private/raw-note leakage and zero prohibited diagnosis
- academic papers, curriculum materials, and sermons supported as distinct subtypes within a reviewed Andrew-authored ministry corpus
