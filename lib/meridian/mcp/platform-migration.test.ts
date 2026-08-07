import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260804193736_platform_mcp_operations.sql"),
  "utf8"
);
const privateDiscoveryMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260805171914_platform_mcp_private_discovery.sql"),
  "utf8"
);
const emmaReviewMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260805190000_platform_mcp_emma_review.sql"),
  "utf8"
);
const pilotMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260805202500_platform_mcp_pilot_readiness.sql"),
  "utf8"
);
const privateProvenanceRlsRepairMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260807021000_platform_mcp_private_provenance_rls_repair.sql"),
  "utf8"
);

describe("platform MCP operations migration", () => {
  it("keeps every platform capability explicit and disabled by default", () => {
    for (const capability of ["can_read_platform", "can_manage_events", "can_manage_tasks", "can_save_resources"]) {
      expect(migration).toContain(`${capability} boolean not null default false`);
    }
  });

  it("stores resource bundles as unreviewed drafts with deterministic idempotency", () => {
    expect(migration).toContain("create table if not exists public.meridian_mcp_resource_bundles");
    expect(migration).toContain("create table if not exists public.meridian_mcp_resource_bundle_items");
    expect(migration).toContain("emma_status text not null default 'not_reviewed'");
    expect(migration).toContain("unique (ministry_id, created_by_user_id, idempotency_key)");
  });

  it("uses tenant-scoped RLS and provides no delete permission", () => {
    expect(migration).toContain("grant_row.ministry_id = meridian_mcp_resource_bundles.ministry_id");
    expect(migration).toContain("bundle.ministry_id = meridian_mcp_resource_bundle_items.ministry_id");
    expect(migration).toContain("alter table public.meridian_mcp_resource_bundles enable row level security");
    expect(migration).not.toMatch(/grant[^;]*delete[^;]*meridian_mcp_resource_bundle/i);
    expect(migration).not.toMatch(/for delete to authenticated/i);
  });

  it("prevents MCP creators from claiming an EMMA review result", () => {
    expect(migration).toContain("and emma_status = 'not_reviewed'");
    expect(migration).toContain("grant update (status)");
    expect(migration).not.toContain("grant update (status, emma_status)");
    expect(migration).not.toContain("emma_status = 'passed'");
  });
});

describe("platform MCP private discovery migration", () => {
  it("keeps candidate submission opt-in and stores no private note text in bundle provenance", () => {
    expect(privateDiscoveryMigration).toContain("can_submit_candidates boolean not null default false");
    expect(privateDiscoveryMigration).toContain("create table if not exists public.meridian_mcp_bundle_private_provenance");
    expect(privateDiscoveryMigration).toContain("source_reference text not null");
    expect(privateDiscoveryMigration).toContain("content_hash text not null");
    const provenanceTable = privateDiscoveryMigration.slice(
      privateDiscoveryMigration.indexOf("create table if not exists public.meridian_mcp_bundle_private_provenance"),
      privateDiscoveryMigration.indexOf(");", privateDiscoveryMigration.indexOf("create table if not exists public.meridian_mcp_bundle_private_provenance"))
    );
    expect(provenanceTable).not.toMatch(/raw_text|body_text|note_text/i);
  });

  it("requires a passed provenance row before a bundle may claim private discovery passed", () => {
    expect(privateDiscoveryMigration).toContain("private_discovery_status in ('not_used','passed')");
    expect(privateDiscoveryMigration).toContain("private_discovery_status = 'not_used'");
    expect(privateDiscoveryMigration).toContain("from public.meridian_mcp_bundle_private_provenance provenance");
    expect(privateDiscoveryMigration).toContain("provenance.check_status = 'passed'");
  });

  it("limits candidate submission to confirmed review-only defaults and keeps promotion admin-owned", () => {
    expect(privateDiscoveryMigration).toContain("metadata ->> 'privateDiscoveryExplicitSubmission' = 'true'");
    expect(privateDiscoveryMigration).toContain("meridian_candidates_raw_text_hash_matches");
    expect(privateDiscoveryMigration).toContain("source_uri ~ '^obsidian-private://");
    expect(privateDiscoveryMigration).toContain("grant_row.access_level in ('leader_creator','admin')");
    expect(privateDiscoveryMigration).toContain("authority_class = 'none'");
    expect(privateDiscoveryMigration).toContain("quote_policy = 'never'");
    expect(privateDiscoveryMigration).toContain("generation_policy = 'discovery_only'");
    expect(privateDiscoveryMigration).toContain("security invoker");
    expect(privateDiscoveryMigration).not.toContain("update public.meridian_candidates set approval_status = 'promoted'");
  });

  it("enables RLS and grants no anonymous or delete access", () => {
    expect(privateDiscoveryMigration).toContain("alter table public.meridian_mcp_bundle_private_provenance enable row level security");
    expect(privateDiscoveryMigration).toContain("revoke all on public.meridian_mcp_bundle_private_provenance from anon");
    expect(privateDiscoveryMigration).not.toMatch(/grant[^;]*delete[^;]*meridian_mcp_bundle_private_provenance/i);
  });
});

describe("platform MCP private provenance RLS repair", () => {
  it("breaks the circular policy lookup without weakening actor, tenant, or review-state checks", () => {
    expect(privateProvenanceRlsRepairMigration).toContain("create schema if not exists private");
    expect(privateProvenanceRlsRepairMigration).toContain("security definer");
    expect(privateProvenanceRlsRepairMigration).toContain("set search_path = ''");
    expect(privateProvenanceRlsRepairMigration).toContain("bundle.created_by_user_id = (select auth.uid())");
    expect(privateProvenanceRlsRepairMigration).toContain("bundle.ministry_id = p_ministry_id");
    expect(privateProvenanceRlsRepairMigration).toContain("grant_row.can_save_resources");
    expect(privateProvenanceRlsRepairMigration).toContain("provenance.check_status = 'passed'");
    expect(privateProvenanceRlsRepairMigration).toContain("bundle.human_review_status = 'pending'");
    expect(privateProvenanceRlsRepairMigration).toContain("bundle.active_emma_review_id is null");
  });

  it("keeps the helper outside the exposed API schema and limits execution to authenticated policy evaluation", () => {
    expect(privateProvenanceRlsRepairMigration).toContain("private.meridian_mcp_has_passed_private_provenance");
    expect(privateProvenanceRlsRepairMigration).toContain("revoke all on schema private from public, anon");
    expect(privateProvenanceRlsRepairMigration).toContain("revoke all on function private.meridian_mcp_has_passed_private_provenance(uuid, uuid) from public, anon, service_role");
    expect(privateProvenanceRlsRepairMigration).toContain("grant execute on function private.meridian_mcp_has_passed_private_provenance(uuid, uuid) to authenticated");
  });
});

describe("platform MCP EMMA review migration", () => {
  it("keeps EMMA bundle review separately granted and human approval pending", () => {
    expect(emmaReviewMigration).toContain("can_review_resources boolean not null default false");
    expect(emmaReviewMigration).toContain("human_review_status text not null default 'pending'");
    expect(emmaReviewMigration).toContain("human_review_status = 'pending'");
    expect(emmaReviewMigration).not.toContain("human_review_status = 'approved'");
  });

  it("stores the versioned three-outcome contract and audited provider provenance", () => {
    expect(emmaReviewMigration).toContain("create table if not exists public.meridian_mcp_bundle_reviews");
    expect(emmaReviewMigration).toContain("contract_version text not null check (contract_version = '1.0')");
    expect(emmaReviewMigration).toContain("'ready_for_human_review','changes_required','blocked','failed'");
    expect(emmaReviewMigration).toContain("summary text check (summary is null or char_length(summary) between 1 and 1200)");
    expect(emmaReviewMigration).toContain("emma_request_id uuid not null references public.ai_requests");
    expect(emmaReviewMigration).toContain("emma_run_id uuid references public.ai_runs");
  });

  it("retains only approved claim and fragment links and no prompt or private-note body", () => {
    expect(emmaReviewMigration).toContain("create table if not exists public.meridian_mcp_bundle_review_evidence");
    expect(emmaReviewMigration).toContain("claim.approval_status = 'approved'");
    expect(emmaReviewMigration).toContain("claim.authority_class <> 'none'");
    const reviewTables = emmaReviewMigration.slice(
      emmaReviewMigration.indexOf("create table if not exists public.meridian_mcp_bundle_reviews"),
      emmaReviewMigration.indexOf("alter table public.meridian_mcp_resource_bundles\n  add column if not exists active_emma_review_id")
    );
    expect(reviewTables).not.toMatch(/raw_text|body_markdown|prompt|private_note/i);
  });

  it("uses RLS, a locked-down transactional function, atomic outcome mapping, and no direct review writes", () => {
    expect(emmaReviewMigration).toContain("alter table public.meridian_mcp_bundle_reviews enable row level security");
    expect(emmaReviewMigration).toContain("security definer");
    expect(emmaReviewMigration).toContain("set search_path = ''");
    expect(emmaReviewMigration).toContain("revoke insert, update, delete on public.meridian_mcp_bundle_reviews from authenticated");
    expect(emmaReviewMigration).toContain("revoke update (emma_status, human_review_status, active_emma_review_id)");
    expect(emmaReviewMigration).toContain("when 'ready_for_human_review' then 'passed'");
    expect(emmaReviewMigration).toContain("when 'changes_required' then 'changes_requested'");
    expect(emmaReviewMigration).toContain("revoke all on public.meridian_mcp_bundle_reviews from anon");
    expect(emmaReviewMigration).not.toMatch(/grant[^;]*delete[^;]*meridian_mcp_bundle_reviews/i);
  });
});

describe("platform MCP pilot readiness migration", () => {
  it("keeps enrollment explicit, role-bounded, and default-off", () => {
    expect(pilotMigration).toContain("pilot_stage text not null default 'not_enrolled'");
    expect(pilotMigration).toContain("Only administrators and leaders may join this pilot.");
    expect(pilotMigration).toContain("target.role <> 'admin'");
    expect(pilotMigration).toContain("target.role <> 'leader'");
    expect(pilotMigration).toContain("can_read_platform = p_pilot_stage <> 'not_enrolled'");
    expect(pilotMigration).toContain("can_manage_events = false");
    expect(pilotMigration).toContain("can_manage_tasks = false");
    expect(pilotMigration).toContain("can_save_resources = false");
    expect(pilotMigration).toContain("can_review_resources = false");
    expect(pilotMigration).toContain("target.role not in ('admin','leader')");
    expect(pilotMigration).toContain("The administrator pilot is limited to two people.");
    expect(pilotMigration).toContain("The leader pilot is limited to three people.");
  });

  it("stores bounded operational metrics without prompts, bodies, notes, or arbitrary JSON", () => {
    const eventTable = pilotMigration.slice(
      pilotMigration.indexOf("create table if not exists public.meridian_mcp_pilot_events"),
      pilotMigration.indexOf("create table if not exists public.meridian_mcp_pilot_review_feedback")
    );
    expect(eventTable).toContain("duration_ms integer not null");
    expect(eventTable).toContain("client_category text not null");
    expect(eventTable).toContain("placement_verified boolean");
    expect(eventTable).toContain("idempotent_replay boolean");
    expect(eventTable).toContain("private_discovery_status text");
    expect(eventTable).not.toMatch(/prompt|body|raw_text|note_text|payload|jsonb/i);
  });

  it("keeps telemetry and feedback append-only behind hardened RPCs", () => {
    expect(pilotMigration).toContain("security definer");
    expect(pilotMigration).toContain("set search_path = ''");
    expect(pilotMigration).toContain("revoke insert, update, delete on public.meridian_mcp_pilot_events from authenticated");
    expect(pilotMigration).toContain("revoke insert, update, delete on public.meridian_mcp_pilot_review_feedback from authenticated");
    expect(pilotMigration).toContain("perform public.assert_meridian_mcp_pilot_access(p_tool_name)");
    expect(pilotMigration).toContain("profile.ministry_id = grant_value.ministry_id");
    expect(pilotMigration).toContain("verified_placement := case p_target_record_type");
    expect(pilotMigration).toContain("revoke update, delete on public.meridian_mcp_access_grants from authenticated");
    expect(pilotMigration).not.toMatch(/grant[^;]*delete[^;]*meridian_mcp_pilot/i);
  });

  it("measures the roadmap gates and leaves feedback separate from human approval", () => {
    for (const metric of ["placementVerifiedWrites", "groundingHelpful", "privacyBlocks", "p95LatencyMs", "duplicateSafeReplays", "useful"]) {
      expect(pilotMigration).toContain(`'${metric}'`);
    }
    expect(pilotMigration).not.toMatch(/update\s+public\.meridian_mcp_resource_bundles[\s\S]*human_review_status\s*=\s*'approved'/i);
  });
});
