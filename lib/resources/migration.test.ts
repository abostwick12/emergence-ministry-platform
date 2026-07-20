import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260720154243_universal_resource_attachments.sql"), "utf8");

describe("resource attachment migration", () => {
  it("creates one private universal resource table, audit table, and bucket", () => {
    expect(migration).toContain("create table if not exists public.resource_attachments");
    expect(migration).toContain("create table if not exists public.resource_attachment_audit");
    expect(migration).toContain("'resource-attachments'");
    expect(migration).toContain("false,");
    expect(migration).toContain("alter table public.resource_attachments enable row level security;");
    expect(migration).toContain("alter table public.resource_attachment_audit enable row level security;");
  });

  it("locks parent type, resource type, visibility, and audit actions to central values", () => {
    for (const value of ["how_to_read_lesson", "journey_journal_day", "volunteer_training_module", "communication_draft"]) {
      expect(migration).toContain(`'${value}'`);
    }

    for (const value of ["pdf", "google_drive", "youtube", "inherit_parent", "admin_only"]) {
      expect(migration).toContain(`'${value}'`);
    }

    for (const value of ["resource_uploaded", "file_replaced", "resource_permanently_deleted"]) {
      expect(migration).toContain(`'${value}'`);
    }
  });

  it("keeps universal resources separate from restricted Camp buckets", () => {
    expect(migration).toContain("storage_bucket = 'resource-attachments'");
    expect(migration).not.toContain("'camp-medication-photos'");
    expect(migration).not.toContain("'camp-camper-profile-photos'");
  });
});
