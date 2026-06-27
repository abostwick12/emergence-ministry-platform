import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration021 = readFileSync(join(process.cwd(), "supabase/migrations/021_camp_leader_permissions_upgrade.sql"), "utf8");

describe("camp leader permissions migration 021", () => {
  it("compares bulletin team ids at the uuid-to-text boundary without weakening RLS", () => {
    expect(migration021).toContain("alter table public.camp_team_bulletins enable row level security");
    expect(migration021).toContain("create policy camp_team_bulletins_insert on public.camp_team_bulletins");
    expect(migration021).toContain("team_id::text = any(public.current_user_assigned_team_ids())");
    expect(migration021).not.toContain("team_id = any(public.current_user_assigned_team_ids())");
  });
});
