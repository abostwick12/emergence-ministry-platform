# EMMA Documentation

EMMA is the controlled AI orchestration layer for Lead Emergence.

For the cross-platform AI baseline that explains how EMMA, Camp EMMA, SAGE,
and reusable skills relate, see
[`docs/architecture/ai-skill-system.md`](../architecture/ai-skill-system.md).

## Documents

- [Architecture and Workflow Specification](architecture.md) — system boundaries, Mermaid diagrams, request lifecycle, data model, risk rules, provider policy, security requirements, and launch test.
- [Implementation Roadmap](roadmap.md) — recommended build order, deliverables, exit criteria, deferred Planning Center and RAG phases, and release rules.
- [Codex Iteration Prompts](codex-iteration-prompts.md) — eight prompts intended to be run one at a time after the prior iteration is reviewed, tested, and merged.

## Required Build Order

1. EMMA contract and audit foundation
2. Provider abstraction and health
3. Skill registry and router
4. Event task generator
5. Approval and transactional execution
6. Voice profiles and communication drafting
7. Communication review queue
8. Background operational intelligence

Planning Center-triggered workflows and ministry-library RAG remain deferred until the first eight iterations are stable in real ministry use.

## Governing Rule

> AI may interpret, recommend, summarize, and draft. Application code validates and executes. Humans approve sensitive or external actions.
