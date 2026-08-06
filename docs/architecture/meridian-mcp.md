# Meridian MCP architecture

## Outcome

Lead Emergence exposes a tool-only MCP endpoint at `/mcp`. A leader or volunteer can use an external AI client for creative reasoning while Lead Emergence remains responsible for tenant boundaries, approved knowledge, quotation rules, draft provenance, automated review, and human authority.

Normal Meridian search, fetch, and creative drafting use the connected client's model account. The separately granted Phase 5 bundle-review tool invokes Lead Emergence's audited, provider-independent EMMA abstraction only for the final structured alignment and safety check. Provider failure cannot approve or advance a bundle.

## Approved north-star expansion

The three-tool Meridian surface is the safe foundation for a future permission-aware platform MCP. The target is for an authenticated user to work from a personal AI client, retrieve only the Lead Emergence records they may access, create or update controlled platform drafts, assemble sermon resource bundles in the correct event or teaching workspace, and submit the result through EMMA's alignment and safety review.

Private Obsidian material remains a separate, user-owned, opt-in discovery source. Raw notes do not become shared Meridian context, and a resource influenced by private discovery must pass exact/fuzzy leakage protection before entering the platform review queue.

The expansion does not change the current endpoint's trust model: OAuth establishes identity, explicit capabilities authorize tools, application services enforce record permissions, Supabase RLS provides defense in depth, generated artifacts remain drafts, EMMA cannot self-approve, and people retain final authority.

See [Personal AI Platform MCP Roadmap](personal-ai-platform-mcp.md) for the proposed event/resource tools, linked sermon-bundle model, EMMA review contract, and phased release gates. None of those proposed tools should be described as live until its corresponding phase is implemented and verified.

The local/private half of Phase 4 is documented in [Private Obsidian discovery](private-obsidian-discovery.md). Vault discovery runs in a separate user-owned STDIO server; the hosted Meridian endpoint receives private text only transiently for a requested leakage check or through a separately confirmed candidate nomination.

The Phase 5 review contract is documented in [MCP EMMA bundle review](mcp-emma-bundle-review.md). EMMA stores findings and approved evidence links, not provider prompts or private-note bodies, and every outcome remains pending human review.

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

## OAuth connection

The application implements the Supabase Auth OAuth 2.1 authorization-code flow with PKCE for Streamable HTTP MCP clients:

- `/.well-known/oauth-protected-resource` identifies `/mcp` as the protected resource and points clients to the project's Supabase authorization server.
- Unauthenticated `/mcp` requests return a `401` bearer challenge containing the protected-resource metadata URL. Middleware never converts MCP authentication into an HTML login redirect.
- `/oauth/consent` is the application-owned consent screen. It retrieves the registered client details from Supabase, explains Meridian's enforced boundaries, and lets the user approve or deny the request.
- Supabase issues, refreshes, validates, and revokes OAuth tokens. Lead Emergence never receives or stores the user's Codex or ChatGPT credentials.
- `/settings#meridian-personal-ai` lets a user copy the MCP address and revoke authorized AI clients. An admin can separately enable or disable their own Meridian tool grant.

OAuth consent and Meridian authorization are deliberately separate. Successful OAuth proves the user's Lead Emergence identity, but every search, fetch, or draft submission still requires an active `meridian_mcp_access_grants` capability. OAuth identity scopes (`openid email profile`) do not grant database access.

### Supabase dashboard setup

Before deploying the connection flow to an environment:

1. In Supabase Auth, enable the OAuth 2.1 server.
2. Set the authorization/consent path to `https://<application-host>/oauth/consent`.
3. Enable Dynamic Client Registration for Codex clients, or register the supported client explicitly.
4. Ensure the application's production URL is configured as `NEXT_PUBLIC_APP_URL`; discovery does not trust arbitrary request hosts.
5. Confirm the authorization server metadata endpoint and its JWKS are public.
6. Test sign-in, approval, tool access, token refresh, disconnect, and revoked Meridian grants in the sandbox before enabling a volunteer pilot.

Codex desktop setup is: **Settings → MCP servers → Add server → Streamable HTTP**, enter `https://www.leademergence.com/mcp`, save, restart if prompted, and choose **Authenticate**. The equivalent CLI setup is `codex mcp add lead-emergence --url https://www.leademergence.com/mcp`, followed by `codex mcp login lead-emergence`.

## Data model

`20260801130000_meridian_mcp_resource_drafts.sql` adds:

- `meridian_mcp_access_grants`: explicit, revocable, ministry-scoped capabilities.
- `meridian_resource_drafts`: provider-independent AI-derived artifacts with provenance and review state.
- `meridian_resource_draft_claims`: grounded links to approved Meridian claims.
- `submit_meridian_resource_draft(...)`: an idempotent, security-invoker transaction for grounded draft submission.

The additive Meridian migrations are installed in production. Access remains fail-closed because no user receives an MCP grant merely from deployment, OAuth consent, or platform role.

## Deferred work

- Admin UI for managing other users' grants and the resource review queue. This slice provides self-management for an administrator and read-only status for other users.
- Leader review actions and immutable revision history.
- Hosted MCP observability, rate limits, domain verification, and production Codex compatibility testing.
- Optional deterministic private-memory leakage detection on submitted volunteer text.
- External-client golden evaluations after the database branch is available.

## Current documentation basis

- [OpenAI: Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [OpenAI: Define tools](https://developers.openai.com/plugins/plan/tools)
- [OpenAI: MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart)
