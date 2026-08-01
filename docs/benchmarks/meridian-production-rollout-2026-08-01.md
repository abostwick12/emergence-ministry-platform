# Meridian production database rollout — 2026-08-01

## Scope

Four additive Meridian migrations were applied directly to the production Supabase project after isolated sandbox validation:

1. `meridian_primitive_knowledge`
2. `meridian_mcp_resource_drafts`
3. `meridian_production_hardening`
4. `meridian_anon_privilege_hardening`

No existing ministry records were read, altered, copied, or seeded. All 15 new Meridian tables were empty after rollout.

## Five-check production cycle

No Gloo or AI-provider requests were made.

1. **Installation and RLS — passed.** All 15 expected tables exist and have RLS enabled.
2. **Initial privilege audit — identified a gap.** RLS denied anonymous rows, but a Supabase default Data API grant still reported anonymous table-level `SELECT` on fragments.
3. **Privilege audit after additive fix — passed.** Anonymous table and RPC privileges are explicitly revoked, authenticated users cannot select fragment rows directly, and the approved claims/redacted RPC contract remains available to authenticated users.
4. **Functions, triggers, and indexes — passed.** Four critical functions have fixed search paths and intended invoker/definer modes; both fragment guard triggers and all representative retrieval/review indexes exist.
5. **Data-integrity check — passed.** All 15 Meridian tables remained empty after installation.

## Advisor results

- No missing Meridian foreign-key indexes.
- No Meridian multiple-permissive-policy performance notice.
- One intentional Meridian security notice remains: `fetch_meridian_generation_fragments` is an authenticated security-definer RPC. It contains explicit `auth.uid()`, ministry, role, approval, visibility, sensitivity, and permission predicates and redacts exact text unless independent quotation permission is present. Anonymous execution is revoked.
- Supabase Auth leaked-password protection is disabled at the project level. Enable it in the Supabase Dashboard before volunteer account launch: Authentication → Security and Protection → Password Security.

## Launch boundary

The production database foundation is installed but contains no knowledge and grants no volunteer MCP access. The public creator experience remains gated on application deployment, OAuth, explicit MCP grants, the leader review interface, and a capped end-to-end launch cycle.
