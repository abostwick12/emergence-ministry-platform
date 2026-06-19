import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const persistenceMigration = readFileSync(join(process.cwd(), "supabase/migrations/007_camp_persistence.sql"), "utf8");
const auditMigration = readFileSync(join(process.cwd(), "supabase/migrations/008_camp_restricted_data_audit.sql"), "utf8");
const intakeMigration = readFileSync(join(process.cwd(), "supabase/migrations/009_camp_medication_intake_signature.sql"), "utf8");

describe("camp persistence RLS migration shape", () => {
  it("keeps restricted medical and medication tables behind the restricted access helper", () => {
    const restrictedTables = [
      "camp_restricted_medical_records",
      "camp_medication_records",
      "camp_medication_schedule_items",
      "camp_medication_administration_logs",
      "camp_medication_return_items"
    ];

    for (const table of restrictedTables) {
      expect(persistenceMigration).toContain(`alter table public.${table} enable row level security;`);
      expect(persistenceMigration).toContain(`on public.${table}`);
    }
    expect(persistenceMigration.match(/public\.current_user_can_access_camp_restricted\(\)/g)?.length ?? 0).toBeGreaterThan(10);
  });

  it("leaves medication administration logs append-only through RLS", () => {
    const logPolicySection = persistenceMigration.slice(
      persistenceMigration.indexOf("drop policy if exists \"restricted can select camp_medication_administration_logs\""),
      persistenceMigration.indexOf("drop policy if exists \"restricted can select camp_medication_return_items\"")
    );

    expect(logPolicySection).toContain("for select to authenticated");
    expect(logPolicySection).toContain("for insert to authenticated");
    expect(logPolicySection).not.toContain("for update");
    expect(logPolicySection).not.toContain("for delete");
  });

  it("keeps public camper storage free of restricted medical and medication columns", () => {
    const camperTable = persistenceMigration.slice(
      persistenceMigration.indexOf("create table if not exists public.camp_campers"),
      persistenceMigration.indexOf("create table if not exists public.camp_restricted_medical_records")
    );

    for (const restrictedColumn of ["medication_name", "parent_provided_instructions", "restricted_notes", "allergy_notes", "insurance_status", "parent_medical_notes"]) {
      expect(camperTable).not.toContain(restrictedColumn);
    }
  });

  it("tightens restricted identity checks to authenticated email and locks import batches to restricted users", () => {
    const restrictedFunction = auditMigration.slice(
      auditMigration.indexOf("create or replace function public.current_user_can_access_camp_restricted()"),
      auditMigration.indexOf("drop policy if exists \"staff can select camp_import_batches\"")
    );

    expect(restrictedFunction).toContain("split_part(lower(coalesce(p.email");
    expect(restrictedFunction).not.toContain("full_name");
    expect(auditMigration).toContain("drop policy if exists \"staff can select camp_import_batches\"");
    expect(auditMigration).toContain("create policy \"restricted can select camp_import_batches\"");
    expect(auditMigration).toContain("public.current_user_can_access_camp_restricted()");
  });

  it("adds medication intake signatures as restricted append-only records", () => {
    expect(intakeMigration).toContain("create table if not exists public.camp_medication_intake_records");
    expect(intakeMigration).toContain("guardian_signature_data jsonb not null");
    expect(intakeMigration).toContain("confirmation_acknowledged boolean not null check (confirmation_acknowledged = true)");
    expect(intakeMigration).toContain("alter table public.camp_medication_intake_records enable row level security;");
    expect(intakeMigration).toContain("create policy \"restricted can select camp_medication_intake_records\"");
    expect(intakeMigration).toContain("create policy \"restricted can insert camp_medication_intake_records\"");
    expect(intakeMigration).toContain("public.current_user_can_access_camp_restricted()");
    expect(intakeMigration).not.toContain("for update");
    expect(intakeMigration).not.toContain("for delete");
  });
});
