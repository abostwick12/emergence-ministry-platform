import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260721120000_google_demo_platform_sync.sql"), "utf8");

describe("Google demo integration migration", () => {
  it("stores Google refresh tokens only in the private schema", () => {
    expect(migration).toContain("create table if not exists lead_emergence_private.google_demo_tokens");
    expect(migration).toContain("google_refresh_token_encrypted text not null");
    expect(migration).toContain("revoke all on table lead_emergence_private.google_demo_tokens from authenticated");
    expect(migration).toContain("grant select, insert, update, delete on table lead_emergence_private.google_demo_tokens to service_role");
  });

  it("adds one-calendar and one-root-folder identifiers for the demo workflow", () => {
    expect(migration).toContain("google_account_email text not null");
    expect(migration).toContain("google_calendar_id text not null");
    expect(migration).toContain("google_calendar_name text not null default 'Emerge'");
    expect(migration).toContain("google_drive_folder_id text not null");
    expect(migration).toContain("google_drive_folder_name text not null default 'Lead Emergence automated Platform'");
    expect(migration).toContain("calendar_sync_token text");
  });

  it("links platform events to Google Calendar and Drive records", () => {
    expect(migration).toContain("add column if not exists google_calendar_event_id text");
    expect(migration).toContain("add column if not exists google_calendar_event_url text");
    expect(migration).toContain("add column if not exists google_drive_folder_id text");
    expect(migration).toContain("add column if not exists google_drive_folder_url text");
    expect(migration).toContain("'imported_from_google', 'planning_details_incomplete'");
    expect(migration).toContain("'planning_center', 'groupme', 'google_demo'");
  });
});
