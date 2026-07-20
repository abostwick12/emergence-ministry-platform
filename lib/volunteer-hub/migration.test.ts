import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260720144927_volunteer_hub_persistence.sql"), "utf8");
const hardeningMigration = readFileSync(join(process.cwd(), "supabase/migrations/20260720145130_volunteer_hub_persistence_hardening.sql"), "utf8");

const tables = [
  "volunteer_hub_leaders",
  "volunteer_hub_services",
  "volunteer_hub_small_groups",
  "volunteer_hub_small_group_members",
  "volunteer_hub_event_leader_assignments",
  "volunteer_hub_items",
  "volunteer_hub_item_progress",
  "volunteer_hub_follow_ups",
  "volunteer_hub_attendance_reviews",
  "volunteer_hub_chat_previews",
  "volunteer_hub_audit_entries"
];

describe("Volunteer Hub persistence migration", () => {
  it("creates durable ministry-scoped tables with RLS and grants", () => {
    for (const table of tables) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`grant select`);
      expect(migration).toContain(`on table public.${table} to authenticated`);
      expect(migration).toContain(`on table public.${table} to service_role`);
    }
    expect(migration).toContain("ministry_id uuid not null references public.ministries");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("uses operator-scoped policies without deprecated auth.role checks", () => {
    expect(migration).toContain("current_user_is_ministry_operator");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("with check (ministry_id = public.current_ministry_id() and public.current_user_is_ministry_operator())");
    expect(migration).not.toContain("auth.role()");
  });

  it("hardens helper grants and indexes nullable foreign keys", () => {
    expect(hardeningMigration).toContain("revoke execute on function public.current_user_is_ministry_operator() from anon");
    expect(hardeningMigration).toContain("volunteer_hub_small_groups_leader_idx");
    expect(hardeningMigration).toContain("volunteer_hub_follow_ups_volunteer_leader_idx");
    expect(hardeningMigration).toContain("notify pgrst, 'reload schema'");
  });
});
