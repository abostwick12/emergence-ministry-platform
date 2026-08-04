# Obsidian Knowledge Model

> Safety update: Obsidian material is private, unreviewed, authority-none, never-quote, discovery-only candidate knowledge by default. Only `meridian_ingest: candidate` opts a synthetic/reviewed note into the candidate queue; it does not approve it. The explicit admin promotion workflow is documented in [Meridian Primitive Knowledge Architecture](architecture/meridian-primitive-knowledge.md).

## Purpose

Obsidian is the first practical container for Meridian artifacts. It gives approved ministry memory a readable folder hierarchy, stable Markdown files, and front matter that future retrieval can filter before semantic matching.

Obsidian also has a separate future role as an opt-in private discovery source for a user's personal AI workspace. In that flow, selected notes may help the user think and draft in Codex, but raw note text does not enter Lead Emergence's normal final-answer generator or become shared organizational memory. Drafts submitted to Lead Emergence must pass exact/fuzzy private-note leakage protection, and reusable ideas still require explicit Meridian promotion.

The connected Codex, Meridian, EMMA, and platform workflow is defined in [Personal AI Platform MCP Roadmap](architecture/personal-ai-platform-mcp.md).

## Folder Direction

```text
00_Governance
01_Church_Core
02_Ministry_Core
03_Teaching
04_Formation
05_Volunteers
06_Events
07_Decisions
08_Resources
90_Archive
99_Quarantine
```

## File Naming

Use stable IDs, not titles alone:

```text
YYYY-MM-DD__content-type__slug__short-id.md
```

## Retrieval Order

Semantic relevance is never the first filter. Retrieval must apply:

1. permission and sensitivity
2. publication status
3. ministry scope
4. requested AI scope
5. excluded scopes
6. authority threshold
7. freshness
8. semantic relevance
9. relationship links
10. final ranking

## Current Related Work

The existing Scripture RAG importer is a narrow launch-safe precedent, not the full Meridian publishing framework. It imports reviewed Obsidian source notes into Scripture knowledge tables for student-facing retrieval safeguards.
