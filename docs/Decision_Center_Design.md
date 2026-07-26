# Decision Center Design

## Purpose

A Decision Center is a hub page that helps leaders understand current direction, verified signals, leadership attention, supporting evidence, and where to act next.

It is an intelligence layer, not a navigation launcher. It should link back to operational workspaces instead of absorbing the work those spaces already do well.

## Portal Layer Model

Each portal keeps its own operational layer and Meridian intelligence layer.

- Ministry Hub asks: How is the ministry functioning?
- Volunteer Hub asks: How can I serve my students well this week?
- Leader Hub asks: How do we form people more effectively?

The Volunteer Hub is not a director-facing analytics center. Volunteer-facing Meridian intelligence should support weekly preparation, student care, suggested training, lesson resources, and recurring-question reminders. Volunteer health, recruitment, coverage, workload, training strategy, sustainability, and formation trends belong in the Leader Hub.

## Required Sections

- Direction: emphasis, horizon, owner, last reviewed or generated date.
- Health Snapshot: four to six meaningful measures.
- Signals: factual observations only.
- Leadership Attention: review prompts linked to operational workspaces.
- Evidence: source, date range or freshness, calculation, confidence, and boundary.
- Recent Meaningful Changes: not every CRUD event.

## Language Rules

Use:

- Review
- Consider
- Discuss
- Investigate
- Prepare
- Compare
- Clarify

Avoid:

- Must
- Proves
- The AI recommends
- The ministry should

## Evidence Rules

Every signal needs evidence before it becomes visible. Evidence should include source kind, label, detail, freshness, and confidence. If data is missing, show an empty state instead of fabricating intelligence.

## First Implementation

The first implementation is the Ministry Hub. It uses existing event, task, budget, activity, and Scripture integration boundaries. Later intelligence layers should reuse the same primitives while preserving each portal's audience and operational boundary.
