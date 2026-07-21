import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260720200513_volunteer_hub_groupme_workflow.sql"), "utf8");

describe("Volunteer Hub GroupMe migration", () => {
  it("keeps encrypted tokens in the private schema", () => {
    expect(migration).toContain("lead_emergence_private.groupme_tokens");
    expect(migration).toContain("access_token_ciphertext text not null");
    expect(migration).toContain("revoke all on table lead_emergence_private.groupme_tokens from authenticated");
    expect(migration).toContain("grant select, insert, update, delete on table lead_emergence_private.groupme_tokens to service_role");
  });

  it("adds per-group conversation references and sent-message audit fields", () => {
    expect(migration).toContain("group_me_group_id text");
    expect(migration).toContain("group_me_group_name text");
    expect(migration).toContain("external_message_id text");
    expect(migration).toContain("source_guid text");
    expect(migration).toContain("'planning_center', 'groupme'");
  });
});
