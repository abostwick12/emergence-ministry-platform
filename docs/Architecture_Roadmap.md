# Architecture Roadmap

## Phase 1-3 First Build

This first Architecture Evolution build combines the safe portions of the first three phases:

- architecture vision and roadmap docs
- shared decision-center contracts and display primitives
- Ministry Hub redesign into a decision center using existing data only
- leadership-authored Ministry Alignment context without scoring
- portal-layer philosophy: operational layer plus Meridian intelligence layer
- explicit YouVersion and Gloo scoring-path documentation

No migrations, route renames, Volunteer Hub split, live Meridian publishing, alignment scoring engine, or Camp changes belong in this first build.

## Phase 1: Architecture Foundation

- Add the vision docs that define Decision Centers, Meridian, the Vision Platform, and Obsidian hierarchy.
- Audit current hubs and reusable components.
- Identify breaking changes before they happen.
- Establish approval gates for route, schema, and retrieval refactors.

## Phase 2: Shared Decision-Center System

- Introduce shared types for metrics, signals, evidence, confidence, freshness, and attention items.
- Build reusable UI primitives from existing platform components.
- Keep signals factual and evidence-linked.
- Keep recommendations as leadership prompts, not autonomous decisions.

## Phase 3: Ministry Hub Decision Center

- Replace workspace-launcher behavior with direction, health snapshot, signals, attention items, evidence drawers, and action links.
- Lead with editable Vision, Mission, Values, Current Season, and Success Looks Like context.
- Let EMMA compare evidence against leadership-authored criteria without setting priorities.
- Use existing event, task, budget, communication, and activity data.
- Keep the competition-proof YouVersion and Gloo path available in evidence details.
- Preserve operational pages and sidebar behavior.

## Later Phases

- Volunteer Hub Meridian layer for volunteer-facing weekly preparation, student care prompts, training suggestions, lesson resources, and recurring-question reminders.
- Leader Hub volunteer intelligence at `/leader/volunteers` while preserving the operational Volunteer Hub workspace.
- Leader Hub formation, teaching, resource-development, and leadership-pipeline intelligence.
- Meridian metadata model and publish-preview workflow.
- Obsidian export structure and manifest.
- Scope-first retrieval with Journey Journal exclusion tests.
- Meridian Web and Vision Platform after the competition build is stable.

## Approved Direction: Personal AI Platform MCP

The existing Meridian MCP will evolve into a permission-aware connection between a user's personal AI client and the Lead Emergence platform. This is a governed extension of the current `search`, `fetch`, and `submit_resource_draft` tools, not direct database access and not a replacement for EMMA.

The intended flow is:

```text
opt-in private Obsidian discovery
  -> personal Codex creation
  -> approved Meridian grounding
  -> authenticated platform placement
  -> EMMA alignment and safety review
  -> human approval
```

The delivery order is:

1. permission-filtered reads for events, tasks, sermon workspaces, and resource bundles;
2. controlled, idempotent draft creation and event/resource updates;
3. linked sermon resource bundles for guides, questions, slides, activities, and related materials;
4. user-owned, opt-in Obsidian discovery with raw-note isolation and leakage protection;
5. a versioned EMMA review gate that returns ready, changes-required, or blocked; and
6. an administrator/leader pilot before volunteer-safe expansion.

Every action must use the authenticated user's ministry, role, capabilities, and record access. Generated work remains draft-only, EMMA cannot self-approve, and publication or external communication continues to require a person.

The complete target architecture, phased tool surface, Obsidian boundary, EMMA contract, and release gates are defined in [Personal AI Platform MCP Roadmap](architecture/personal-ai-platform-mcp.md).

## Approval Gates

Wait for explicit approval before:

- renaming routes
- adding Supabase tables
- changing RLS policies
- moving Volunteer Hub operational behavior
- exposing leader-level volunteer analytics in the Volunteer Hub
- implementing live Obsidian writes
- exposing new platform-wide MCP write capabilities
- allowing MCP-driven publishing, sending, deleting, or bulk mutation
- changing retrieval rules for student-facing generation
- touching Camp or medical/restricted data paths
