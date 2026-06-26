import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/022_camp_emma_controlled_actions.sql"), "utf8");

describe("camp EMMA controlled actions migration", () => {
  it("adds pending-action and full audit tables with expected status coverage", () => {
    expect(migration).toContain("create table if not exists public.camp_emma_pending_actions");
    expect(migration).toContain("create table if not exists public.camp_emma_actions_audit");
    expect(migration).toContain("status in ('pending', 'completed', 'cancelled', 'expired')");
    expect(migration).toContain("status in ('proposed', 'completed', 'denied', 'failed', 'cancelled')");
  });

  it("keeps both EMMA tables protected by RLS and actor-scoped writes", () => {
    expect(migration).toContain("alter table public.camp_emma_pending_actions enable row level security");
    expect(migration).toContain("alter table public.camp_emma_actions_audit enable row level security");
    expect(migration).toContain("actor_user_id = (select auth.uid())");
    expect(migration).toContain("grant select, insert on public.camp_emma_actions_audit to authenticated");
  });
});
