import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260806123000_student_journey_review_drafts.sql"),
  "utf8"
);

describe("student Journey Journal review draft migration", () => {
  it("adds idempotent JSON columns and match-status indexing without changing access policies", () => {
    expect(migration).toMatch(/add column if not exists journey_selection jsonb/i);
    expect(migration).toMatch(/add column if not exists journey_content jsonb/i);
    expect(migration).toMatch(/jsonb_typeof\(journey_selection\) = 'object'/i);
    expect(migration).toMatch(/jsonb_typeof\(journey_content\) = 'object'/i);
    expect(migration).toMatch(/create index if not exists idx_student_discussion_prompts_journey_match_status/i);
    expect(migration).not.toMatch(/disable row level security|drop policy|grant\s+all/i);
  });

  it("documents the parent prompt status as the publication gate", () => {
    expect(migration).toMatch(/parent prompt status is\s*\n-- the publication gate/i);
    expect(migration).toMatch(/must never be exposed while the parent prompt is unapproved/i);
  });
});
