import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const persistenceMigration = readFileSync(join(process.cwd(), "supabase/migrations/007_camp_persistence.sql"), "utf8");
const auditMigration = readFileSync(join(process.cwd(), "supabase/migrations/008_camp_restricted_data_audit.sql"), "utf8");
const intakeMigration = readFileSync(join(process.cwd(), "supabase/migrations/009_camp_medication_intake_signature.sql"), "utf8");
const archivePhotoMigration = readFileSync(join(process.cwd(), "supabase/migrations/010_camp_archive_camper.sql"), "utf8");
const correctionAuditMigration = readFileSync(join(process.cwd(), "supabase/migrations/011_camp_medication_correction_audit.sql"), "utf8");
const oakwoodMigration = readFileSync(join(process.cwd(), "supabase/migrations/013_camp_oakwood_operational_data.sql"), "utf8");
const intakeCamperPhotoMigration = readFileSync(join(process.cwd(), "supabase/migrations/018_camp_intake_and_camper_profile_photos.sql"), "utf8");

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

  it("adds camper archive columns and private restricted medication photo storage", () => {
    expect(archivePhotoMigration).toContain("alter table public.camp_campers add column if not exists archived_at");
    expect(archivePhotoMigration).toContain("archive_reason");
    expect(archivePhotoMigration).toContain("insert into storage.buckets");
    expect(archivePhotoMigration).toContain("'camp-medication-photos'");
    expect(archivePhotoMigration).toContain("false");
    expect(archivePhotoMigration).toContain("create table if not exists public.camp_medication_photo_records");
    expect(archivePhotoMigration).toContain("alter table public.camp_medication_photo_records enable row level security;");
    expect(archivePhotoMigration).toContain("create policy \"restricted can select camp_medication_photo_records\"");
    expect(archivePhotoMigration).toContain("create policy \"restricted can insert camp_medication_photo_records\"");
    expect(archivePhotoMigration).toContain("create policy \"restricted can select camp medication photo objects\"");
    expect(archivePhotoMigration).toContain("create policy \"restricted can insert camp medication photo objects\"");
    expect(archivePhotoMigration).not.toContain("public = true");
  });

  it("keeps camper profile photos separate from restricted medication photos", () => {
    expect(intakeCamperPhotoMigration).toContain("add column if not exists intake_record_id");
    expect(intakeCamperPhotoMigration).toContain("references public.camp_medication_intake_records(id)");
    expect(intakeCamperPhotoMigration).toContain("'camp-camper-profile-photos'");
    expect(intakeCamperPhotoMigration).toContain("create table if not exists public.camp_camper_profile_photo_records");
    expect(intakeCamperPhotoMigration).toContain("alter table public.camp_camper_profile_photo_records enable row level security;");
    expect(intakeCamperPhotoMigration).toContain("create policy \"ministry can select camp_camper_profile_photo_records\"");
    expect(intakeCamperPhotoMigration).toContain("create policy \"staff can insert camp_camper_profile_photo_records\"");
    expect(intakeCamperPhotoMigration).toContain("create policy \"ministry can select camp camper profile photo objects\"");
    expect(intakeCamperPhotoMigration).toContain("bucket_id = 'camp-camper-profile-photos'");
    expect(intakeCamperPhotoMigration).not.toContain("public = true");
  });

  it("adds restricted medication correction and void audit fields without hard-delete policies", () => {
    const correctionTables = [
      "camp_medication_intake_records",
      "camp_medication_records",
      "camp_medication_schedule_items",
      "camp_medication_administration_logs",
      "camp_medication_return_items"
    ];

    for (const table of correctionTables) {
      expect(correctionAuditMigration).toContain(`alter table public.${table} add column if not exists voided_at`);
      expect(correctionAuditMigration).toContain(`alter table public.${table} add column if not exists void_reason`);
      expect(correctionAuditMigration).toContain(`public.current_user_can_access_camp_restricted()`);
    }

    expect(correctionAuditMigration).toContain("supersedes_medication_record_id");
    expect(correctionAuditMigration).toContain("supersedes_schedule_item_id");
    expect(correctionAuditMigration).toContain("supersedes_administration_log_id");
    expect(correctionAuditMigration).toContain("supersedes_return_item_id");
    expect(correctionAuditMigration).toContain("return_status in");
    expect(correctionAuditMigration).not.toContain("for delete");
    expect(correctionAuditMigration).toContain("create policy \"restricted can update camp_medication_intake_records\"");
    expect(correctionAuditMigration).toContain("create policy \"restricted can update camp_medication_administration_logs\"");
  });

  it("adds Oakwood operational fields without moving restricted detail into public camper rows", () => {
    for (const safeColumn of [
      "registration_external_id",
      "shirt_size",
      "emergency_contact_on_file",
      "has_medical_alert",
      "has_dietary_alert"
    ]) {
      expect(oakwoodMigration).toContain(`alter table public.camp_campers add column if not exists ${safeColumn}`);
    }

    for (const restrictedColumn of [
      "emergency_contact_name",
      "emergency_contact_phone",
      "guardian_name",
      "guardian_phone",
      "dietary_requirements"
    ]) {
      expect(oakwoodMigration).toContain(`alter table public.camp_restricted_medical_records add column if not exists ${restrictedColumn}`);
      expect(oakwoodMigration).not.toContain(`alter table public.camp_campers add column if not exists ${restrictedColumn}`);
    }

    expect(oakwoodMigration).toContain("create table if not exists public.camp_staff");
    expect(oakwoodMigration).toContain("alter table public.camp_staff enable row level security");
    expect(oakwoodMigration).toContain("create policy \"ministry can select camp_staff\"");
    expect(oakwoodMigration).toContain("alter table public.camp_import_batches add column if not exists created_count");
    expect(oakwoodMigration).toContain("alter table public.camp_import_batches add column if not exists staff_count");
  });
});
