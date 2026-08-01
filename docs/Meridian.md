# Meridian

> Architecture update: governed primitive Sources, Fragments, Claims, Contexts, Relationships, and Guardrails are defined in [the primitive knowledge architecture](architecture/meridian-primitive-knowledge.md). Legacy visibility-based source/chunk retrieval remains a compatibility fallback and must not be treated as the approval model.

## Purpose

Meridian is the church's evolving ministry memory. It preserves approved ministry knowledge, resources, decisions, lessons, outcomes, and context so future AI responses can be more ministry-specific without mixing unsafe or unrelated content.

Meridian supports discernment. It does not replace pastoral leadership.

## Portal Personalization Boundaries

Meridian should personalize each portal according to that portal's audience.

- Ministry Hub may surface director-level operational intelligence such as event effectiveness, capacity constraints, bottlenecks, and communication trends.
- Volunteer Hub may surface weekly volunteer helps such as student check-in prompts, suggested training, lesson-related resources, recurring-question reminders, and preparation suggestions.
- Leader Hub may surface formation and leadership intelligence such as volunteer health, teaching gaps, Scripture engagement, student-question patterns, volunteer readiness, and leadership pipeline needs.

Leader-level analytics must not leak into the Volunteer Hub. Volunteer-facing personalization should help volunteers serve students well without exposing recruitment pressure, workload sustainability, coverage strategy, or private leadership notes.

## What Meridian May Store

- approved sermons
- approved academic papers and curriculum materials
- leader guides
- reading plans
- Journey Journal frameworks and approved content
- moderated student-question theme summaries
- volunteer training resources
- event outcomes
- leadership decisions and rationale
- ministry goals and direction

## What Meridian Must Exclude

- student private reflections
- raw student questions unless moderated and approved for aggregate use
- medical, legal, discipline, or pastoral-care details
- private volunteer notes
- raw GroupMe content
- unapproved AI output
- secrets, provider tokens, or environment values

## Metadata Baseline

Every future Meridian entry should identify:

- content type
- ministry area
- audience
- authority level
- status
- sensitivity
- source record
- allowed AI scopes
- excluded AI scopes
- publication version
- supersession or archive status

## Publishing Direction

Phase one publishing should be one-way and controlled:

```text
Lead Emergence record
  -> validate
  -> redact
  -> preview
  -> approve
  -> write Markdown
  -> update manifest
  -> log result
```

Two-way Obsidian sync is intentionally deferred.

## Authored Corpus Direction

Andrew's academic papers, curriculum materials, and sermons form one reviewed authored corpus with preserved subtypes. Meridian uses that corpus to ground theology, ministry culture, and reliable formation journeys. It does not attempt to recreate Andrew's artistic or preaching style. Academic papers normally carry the strongest nuance signal; curriculum contributes tested formation structure; sermons contribute local teaching history rather than permanent doctrine.
