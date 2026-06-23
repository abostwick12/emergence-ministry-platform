import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration014 = readFileSync(join(process.cwd(), "supabase/migrations/014_camp_access_roles.sql"), "utf8");

describe("camp access migration 014 audit integrity", () => {
  it("prevents direct client inserts into camp access audit while keeping admin reads", () => {
    expect(migration014).toContain("drop policy if exists camp_access_audit_insert on public.camp_access_audit");
    expect(migration014).not.toMatch(/create policy camp_access_audit_insert/i);
    expect(migration014).toContain("revoke insert, update, delete on public.camp_access_audit from authenticated");
    expect(migration014).toContain("grant select on public.camp_access_audit to authenticated");
  });

  it("generates audit rows from the member-table trigger with server-derived actor and timestamp", () => {
    expect(migration014).toContain("create schema if not exists private");
    expect(migration014).toContain("create or replace function private.camp_access_audit_member_change()");
    expect(migration014).toContain("actor_id uuid := auth.uid()");
    expect(migration014).toContain("create trigger camp_access_members_audit");
    expect(migration014).toContain("after insert or update or delete on public.camp_access_members");

    const auditInsertColumns = migration014.match(/insert into public\.camp_access_audit \(([\s\S]*?)\)\s*values/i)?.[1] ?? "";
    expect(auditInsertColumns).toContain("actor_user_id");
    expect(auditInsertColumns).toContain("target_user_id");
    expect(auditInsertColumns).toContain("action");
    expect(auditInsertColumns).not.toContain("created_at");
  });

  it("restricts grant, update, and removal audit actions to the actual access change", () => {
    expect(migration014).toContain("audit_action := case when new.is_active then 'grant' else 'revoke' end");
    expect(migration014).toContain("when old.is_active = false and new.is_active = true then 'grant'");
    expect(migration014).toContain("when new.is_active = false then 'revoke'");
    expect(migration014).toContain("audit_action := 'revoke'");
    expect(migration014).toContain("old.camp_role is not distinct from new.camp_role");
    expect(migration014).toContain("old.is_active is not distinct from new.is_active");
  });
});
