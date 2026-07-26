# Architecture Roadmap

## Phase 1-3 First Build

This first Architecture Evolution build combines the safe portions of the first three phases:

- architecture vision and roadmap docs
- shared decision-center contracts and display primitives
- Ministry Hub redesign into a decision center using existing data only
- portal-layer philosophy: operational layer plus Meridian intelligence layer
- explicit YouVersion and Gloo scoring-path documentation

No migrations, route renames, Volunteer Hub split, live Meridian publishing, or Camp changes belong in this first build.

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
- Use existing event, task, budget, communication, and activity data.
- Add a visible competition-proof section for YouVersion and Gloo.
- Preserve operational pages and sidebar behavior.

## Later Phases

- Volunteer Hub Meridian layer for volunteer-facing weekly preparation, student care prompts, training suggestions, lesson resources, and recurring-question reminders.
- Leader Hub volunteer intelligence at `/leader/volunteers` while preserving the operational Volunteer Hub workspace.
- Leader Hub formation, teaching, resource-development, and leadership-pipeline intelligence.
- Meridian metadata model and publish-preview workflow.
- Obsidian export structure and manifest.
- Scope-first retrieval with Journey Journal exclusion tests.
- Meridian Web and Vision Platform after the competition build is stable.

## Approval Gates

Wait for explicit approval before:

- renaming routes
- adding Supabase tables
- changing RLS policies
- moving Volunteer Hub operational behavior
- exposing leader-level volunteer analytics in the Volunteer Hub
- implementing live Obsidian writes
- changing retrieval rules for student-facing generation
- touching Camp or medical/restricted data paths
