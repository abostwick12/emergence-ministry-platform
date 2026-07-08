import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/027_student_group_self_join.sql"), "utf8");

describe("student group self-join migration", () => {
  it("adds group, invite, and membership tables with RLS enabled", () => {
    for (const table of ["student_groups", "student_group_invites", "student_group_members"]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security;`);
      expect(migration).toContain(`on public.${table}`);
    }
  });

  it("keeps public join links out of anon table access and scopes authenticated policies", () => {
    expect(migration).toContain("create policy \"leaders can manage ministry student invites\"");
    expect(migration).toContain("public.current_user_role() in ('admin','leader','staff')");
    expect(migration).not.toContain("to anon");
    expect(migration).not.toContain("using (true)");
  });

  it("connects discussion prompts to a group without requiring a group for older data", () => {
    expect(migration).toContain("alter table public.student_discussion_prompts");
    expect(migration).toContain("add column if not exists group_id uuid references public.student_groups(id) on delete set null;");
    expect(migration).toContain("idx_student_discussion_prompts_group_created");
  });
});
