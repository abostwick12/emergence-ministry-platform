# Meridian sandbox validation — 2026-08-01

## Environment

- Supabase project: `lead-emergence-meridian-sandbox`
- Cost reported when created: $0/month
- Region: `us-west-1`
- Production connection: none
- Data: synthetic fixtures only
- Applied schema: `supabase/schema.sql`, followed by the two Meridian migrations

## Five-test cycle

No Gloo or AI-provider requests were made.

1. **Tenant isolation and approval filtering — passed.** A synthetic creator in ministry A saw exactly one approved ministry-A claim, no ministry-B claim, and no unreviewed claim.
2. **Private-note and quotation boundary — passed.** The creator saw the permitted approved fragment and source, but no raw private Obsidian fragment or source.
3. **Grounded draft submission — passed.** A draft linked to an approved same-ministry claim was stored as `submitted` with `review_required` and no reviewer.
4. **Self-approval prevention — passed.** The creating volunteer could not update the draft to approved.
5. **Review isolation and leader review — passed.** A leader from another ministry could not see the draft; a leader from the same ministry could review it.

## Advisor findings

All Meridian and MCP tables have RLS enabled. Supabase's advisors reported no RLS-disabled Meridian table.

The first advisor pass identified these hardening requirements:

- The legacy `set_updated_at` and `set_ministry_id_if_null` helpers need fixed `search_path` settings.
- The legacy `current_ministry_id` and `current_user_role` security-definer helpers should not be directly executable through the Data API.
- Meridian foreign-key access paths need additional indexes before representative production volume.
- Multiple permissive read policies are functionally correct but should be consolidated where doing so reduces per-query policy work.
- The sandbox Auth setting for leaked-password protection is disabled; production Auth settings must be reviewed separately from schema migrations.
- A dedicated non-quotable approved-fragment test was required to prove that direct Data API access cannot bypass service-layer quotation redaction.

## Hardening cycle

The additive `meridian_production_hardening` migration was applied to the sandbox. It removes authenticated table-level reads from `meridian_fragments`, adds a tenant-checked generation RPC that redacts exact text unless quotation is independently allowed, blocks anonymous execution of shared RLS helpers, fixes helper search paths, and adds covering foreign-key indexes.

A second five-test cycle passed with no AI-provider requests:

1. Direct authenticated fragment-table reads were denied.
2. Quote-allowed text was returned while approved paraphrase-only text was redacted; raw private text remained absent.
3. The fragment RPC rejected cross-ministry access while returning same-ministry approved evidence.
4. Anonymous callers could not execute the protected helpers or fragment RPC.
5. Grounded volunteer submission and independent same-ministry leader review still worked after hardening.

The second advisor pass reported no missing Meridian foreign-key index and no mutable-search-path or anonymous security-definer warning. Three authenticated security-definer notices remain intentional: two existing helpers support RLS without recursion, and the new fragment RPC uses explicit tenant/role predicates plus redaction. Multiple permissive-policy notices are performance opportunities rather than access failures and can be consolidated after representative query-volume measurements. Unused-index notices are expected in the synthetic, near-empty sandbox.

## Decision gate

The Meridian database slice has passed its isolated migration, RLS, quotation, and review checks. A read-only production comparison confirmed PostgreSQL 17.6, the required `ministries` and `profiles` foundations, no existing Meridian tables, and RLS enabled on all 78 exposed public tables. Production's Supabase branch metadata still carries an older `MIGRATIONS_FAILED` status even though later migrations are recorded, so rollout must use the migration API directly and verify each additive migration rather than relying on automatic branch deployment.

Production rollout was subsequently approved and completed using four additive migrations. The production verification record is in `docs/benchmarks/meridian-production-rollout-2026-08-01.md`. The sandbox should remain available through application/OAuth launch validation.
