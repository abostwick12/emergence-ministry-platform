import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260804193736_platform_mcp_operations.sql"),
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
