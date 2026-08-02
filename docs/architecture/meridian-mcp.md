# Meridian MCP architecture

## Outcome

Lead Emergence exposes a provider-independent, tool-only MCP endpoint at `/mcp`. A leader or volunteer can use an external AI client for creative reasoning while Lead Emergence remains responsible for tenant boundaries, approved knowledge, quotation rules, draft provenance, and human review.

The MCP server never invokes Gloo, OpenAI, or another model provider. Inference is performed by the connected client under that user's account or membership.

## First production slice

The tool surface is deliberately small:

- `search`: standard company-knowledge search over approved Meridian atomic claims.
- `fetch`: standard company-knowledge fetch for one claim, its authority, attribution, source titles, and only those exact fragments that permit quotation.
- `submit_resource_draft`: saves a grounded resource as `submitted` and `review_required`. It cannot approve, publish, send, or mutate Meridian claims.

This is a `tool-only` MCP archetype. No custom ChatGPT widget is included in the first slice.

## Trust boundary

The AI client is untrusted. Tool descriptions and annotations help client behavior, but the server enforces every rule:

1. A live Lead Emergence bearer token identifies the user.
2. The user's ministry comes from the server-side profile, never a tool argument.
3. `meridian_mcp_access_grants` explicitly grants search and draft capabilities. Platform role alone is insufficient.
4. Supabase RLS independently enforces tenant and user boundaries.
5. Search and fetch return only approved-generation claims and fragments. Private, pastoral, person-specific, discovery-only, and unapproved content is excluded.
6. Exact fragment text is returned only when quotation is explicitly allowed. Otherwise fetch returns the approved atomic claim without raw source text.
7. Drafts require approved claim identifiers, reject prohibited diagnosis/inference language, carry a content hash and client provenance, and always enter human review.
8. MCP-created text never becomes an approved primitive claim automatically.

## Volunteer workflow

1. An admin grants `volunteer_creator` MCP access with only the required capabilities.
2. The volunteer connects an AI client to the Lead Emergence MCP endpoint.
3. The client searches approved Meridian knowledge and fetches relevant claims.
4. The volunteer develops a resource with creative freedom in their own AI environment.
5. The client submits the draft with cited claim IDs and an idempotency key.
6. Lead Emergence stores the draft for a different leader or admin to review.

Volunteers cannot self-approve, publish, communicate externally, access raw Obsidian material, or elevate their own grant.

## Authentication maturity

The implemented endpoint accepts a validated Lead Emergence Supabase access token and is suitable for internal development and transport validation. Before a volunteer pilot, add the complete OAuth 2.1 authorization-code flow and protected-resource discovery required by ChatGPT/Codex so users can connect without handling tokens manually. OAuth must issue narrow scopes and support revocation; it must not expose or store a user's Codex credentials.

## Data model

`20260801130000_meridian_mcp_resource_drafts.sql` adds:

- `meridian_mcp_access_grants`: explicit, revocable, ministry-scoped capabilities.
- `meridian_resource_drafts`: provider-independent AI-derived artifacts with provenance and review state.
- `meridian_resource_draft_claims`: grounded links to approved Meridian claims.
- `submit_meridian_resource_draft(...)`: an idempotent, security-invoker transaction for grounded draft submission.

The migration is additive and has not been applied to production. It must first run on an isolated Supabase branch.

## Deferred work

- OAuth 2.1 discovery, authorization, refresh, and revocation.
- Admin UI for grants and the resource review queue.
- Leader review actions and immutable revision history.
- Hosted MCP observability, rate limits, domain verification, and client compatibility testing.
- Optional deterministic private-memory leakage detection on submitted volunteer text.
- External-client golden evaluations after the database branch is available.

## Current documentation basis

- [OpenAI: Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [OpenAI: Define tools](https://developers.openai.com/plugins/plan/tools)
- [OpenAI: MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart)
