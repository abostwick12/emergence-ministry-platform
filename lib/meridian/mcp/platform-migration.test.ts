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
