# Meridian Alignment Engine

## Status

Open design problem. No production scoring mechanism has been approved.

## Problem

How should Meridian responsibly compare observable ministry signals against leadership-defined Vision, Mission, Values, Current Season, and Success Looks Like statements without replacing pastoral discernment?

Signal interpretation, not replacement for discernment or the work of the Holy Spirit.

Metrics without mission become noise. Mission gives every insight meaning.

## Core Model

```text
Identity
  -> Vision
  -> Mission
  -> Values
  -> Current Season
  -> Success Looks Like
  -> Meridian
  -> Objective Ministry Signals
  -> Evidence Interpretation
  -> EMMA
  -> Leadership Prayer and Discussion
  -> Leadership Decisions
  -> Operational Work
  -> Outcomes
  -> Meridian learns
```

## What Shipped Before Competition

- Vision field
- Mission field
- Values
- Current Season
- Success Looks Like
- static Ministry Alignment display
- EMMA reads leadership-authored alignment context
- Season may reorder existing signals
- signals and evidence expanded by default
- no scoring engine
- no autonomous prioritization

## What Did Not Ship

- alignment scores
- weighted signal mapping
- axis thresholds
- automated priority ranking
- causal inference
- spiritual-health measurement
- autonomous ministry recommendations

## Constitutional Guardrail

EMMA compares evidence against leadership-authored criteria. EMMA never independently sets ministry priorities.

EMMA may surface observable alignment, possible misalignment, mixed evidence, insufficient evidence, unavailable evidence, or questions requiring leadership review.

EMMA must not declare what God is telling the ministry to do, rank one concern above another unless leadership defined that ordering, fabricate confidence, or present interpretation as pastoral discernment.

## Evidence Boundary

Operational data can show events, task status, budget records, communication readiness, visible ownership fields, Scripture engagement boundaries, approved question themes, and other objective signals currently available to the application.

Operational data cannot directly measure spiritual maturity, love for Christ, prayerfulness, discipleship depth, the work of the Holy Spirit, theological faithfulness, or pastoral wisdom.

Available indicators may support a leadership conversation. They must not be treated as proof of spiritual formation.

## Open Design Questions

- Which signals map to Vision?
- Which signals map to Mission?
- Which signals map to Values?
- Which signals map to Current Season?
- How should custom Success Looks Like criteria map to observable evidence?
- How should thresholds be defined?
- How should mixed evidence appear?
- How should missing data appear?
- How should qualitative leader observations be included?
- How should bias and metric gaming be limited?
- How should confidence be explained?
- Should leadership configure weights?
- How should historical comparisons work?
- How should ministry-specific and church-wide context interact?

## Possible Approaches

### 1. Leadership-Authored Indicator Mapping

Benefits: gives leaders explicit control over which signals matter for each criterion; keeps Meridian from inventing priorities.

Risks: requires careful UX so leaders do not accidentally create confusing mappings.

Theological concerns: must avoid reducing discipleship to leader-selected metrics.

Operational complexity: moderate. Needs mapping UI, versioning, and review history.

Competition relevance: strong future path, but too much to ship safely before judging.

### 2. Rule-Based Thresholds

Benefits: transparent, inspectable, and testable.

Risks: brittle if the ministry context changes or if thresholds are copied between churches without discernment.

Theological concerns: can imply certainty where ministry reality is more nuanced.

Operational complexity: moderate to high. Needs threshold governance and missing-data rules.

Competition relevance: useful later, not approved for this phase.

### 3. Evidence Matrix Without Scoring

Benefits: keeps evidence visible while avoiding premature scoring.

Risks: may feel less decisive to users who expect a verdict.

Theological concerns: lowest risk because it preserves human interpretation.

Operational complexity: low to moderate. Needs clean evidence grouping and clear empty states.

Competition relevance: best fit for the current pre-competition boundary.

### 4. Human-Reviewed AI Interpretation

Benefits: EMMA can synthesize qualitative and quantitative evidence into review-ready language.

Risks: provider output can sound more authoritative than it is.

Theological concerns: requires strong language rules so AI never claims pastoral discernment.

Operational complexity: high. Needs prompt governance, review queues, audit logs, and rejection workflows.

Competition relevance: visible as an architectural pathway, but production use needs more review.

### 5. Hybrid Approach

Benefits: combines explicit leader mappings, inspectable evidence, cautious AI synthesis, and human review.

Risks: most complex option and easiest to overbuild.

Theological concerns: must clearly separate signal, interpretation, and pastoral judgment.

Operational complexity: high. Needs configuration, testing, explainability, and governance.

Competition relevance: likely long-term direction, not the current shipped engine.

## Required Work Before Production

- research how ministry leaders naturally describe alignment and evidence
- design UX for mapping criteria to observable indicators
- define signal-to-axis mappings
- define thresholds, missing-data handling, conflicting-signal handling, and confidence rules
- review theological language and pastoral authority boundaries
- add audit trails for alignment edits and AI interpretations
- test against empty, mixed, stale, and conflicting data states
- validate role-based visibility for students, volunteers, parents, leaders, and directors
- evaluate bias and metric-gaming risks
- define human review, approval, rejection, and correction flows
- document how Meridian learns from approved outcomes without treating raw AI output as institutional memory

## Decision Log

- 2026-07-26: Pre-competition build ships leadership-authored alignment context, EMMA comparison, visible signals, visible evidence, and no scoring engine.
