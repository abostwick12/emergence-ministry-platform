import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import { randomUUID } from "crypto";
import { parseMedicationScheduleText } from "@/lib/camp/medication-schedule-text";
import { rosterTypeFromFlags, sourceChurchFromFlags, withRosterMetadataFlags } from "@/lib/camp/partner-roster";
import { campDocuments, campSchedule, campStartsOn, campTeams, campVehicles } from "@/lib/camp/public-data";
import { sanitizePublicSafetyFlags } from "@/lib/camp/public-safety";
import { isVehicleAssignableCamper } from "@/lib/camp/transportation-roster";
import {
  assertCampAdminAccess,
  assertAllCampersOperationalWriteAccess,
  assertCampBulletinPostAccess,
  assertCampEmmaOperationsAccess,
  assertCampMedicalCommandAccess,
  assertCampRestrictedAccess,
  canEditAllCampers,
  canEditPartnerChurchCampers,
  normalizeScopeId,
  type CampAccessContext
} from "@/lib/camp/permissions";
import * as mockStore from "@/lib/camp/store";
import type {
  CampAccessScope,
  CampAuditStatus,
  CampArchiveInput,
  CampCamperProfilePhotoRecord,
  CampDocument,
  CampEmmaActionAudit,
  CampEmmaConfirmInput,
  CampMedicationAdministrationEvent,
  CampMedicationAdministrationItem,
  CampMedicationAdministrationLog,
  CampMedicationArchiveInput,
  CampMedicationGroupedAdministrationInput,
  CampMedicationIntakeInput,
  CampMedicationIntakeRecord,
  CampMedicationIntakeSession,
  CampMedicationIntakeSessionInput,
  CampMedicationPhotoRecord,
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
  CampMedicationVoidInput,
  CampOakwoodImportCommitResult,
  CampOakwoodImportPreview,
  CampOverviewPayload,
  CampRestrictedMedicalRecord,
  CampScheduleBlock,
  CampScheduleInput,
  CampStaffMember,
  CampStaffInput,
  CampStudentInput,
  CampStudentPublic,
  CampTeam,
  CampTeamBulletinPost,
  CampTeamInput,
  CampVehicleInput,
  CampVehicle
} from "@/lib/camp/types";
import { getCampVisibleStudentsForData } from "@/lib/camp/access";
import { buildOakwoodImportPreviewFromCsv, mergeOakwoodImportPreviews, type OakwoodExistingPerson } from "@/lib/camp/oakwood-import";
import { resolveMinistryScope } from "@/lib/ministry/scope";

type CampSessionRow = {
  id: string;
  ministry_id: string | null;
  slug: string;
  name: string;
  starts_on: string;
  status: string;
};

type CampTeamRow = {
  id: string;
  name: string;
  color: string | null;
  leader: string | null;
  co_leader: string | null;
  room: string | null;
  notes?: string | null;
  display_order: number | null;
  archived_at?: string | null;
};

type CampVehicleRow = {
  id: string;
  name: string;
  driver: string | null;
  departure_window: string | null;
  departure_location?: string | null;
  capacity: number | null;
  notes?: string | null;
  display_order: number | null;
  archived_at?: string | null;
};

type CampScheduleItemRow = {
  id: string;
  day: string;
  time: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  title: string;
  location: string | null;
  owner: string | null;
  audience: CampScheduleBlock["audience"];
  notes: string | null;
  status: NonNullable<CampScheduleBlock["status"]>;
  visibility: NonNullable<CampScheduleBlock["visibility"]>;
  display_order: number | null;
  archived_at: string | null;
};

type CampCamperRow = {
  id: string;
  ministry_id: string;
  name: string;
  photo_initials: string | null;
  grade: string | null;
  team_id: string | null;
  vehicle_id: string | null;
  cabin: string | null;
  profile_photo_url?: string | null;
  limited_safety_flags: string[] | null;
  shirt_size: string | null;
  source_church?: string | null;
  roster_type?: "emerge" | "partner" | null;
  registration_external_id: string | null;
  emergency_contact_on_file: boolean | null;
  has_medical_alert: boolean | null;
  has_dietary_alert: boolean | null;
  has_restricted_medical_info: boolean | null;
  has_medication_plan: boolean | null;
  needs_parent_clarification: boolean | null;
  archived_at: string | null;
  archived_by_user_id: string | null;
  archive_reason: string | null;
};

type CampRestrictedMedicalRow = {
  id: string;
  camper_id: string;
  medical_form_status: CampRestrictedMedicalRecord["medicalFormStatus"];
  restricted_notes: string | null;
  allergy_notes: string | null;
  insurance_status: string | null;
  parent_medical_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  dietary_requirements: string | null;
};

type CampStaffRow = {
  id: string;
  name: string;
  profile_photo_url?: string | null;
  role: CampStaffMember["role"];
  shirt_size: string | null;
  registration_external_id: string | null;
  source_church?: string | null;
  team_id: string | null;
  archived_at: string | null;
  archive_reason: string | null;
};

type CampMedicationRow = {
  id: string;
  camper_id: string;
  medication_name: string | null;
  medicine_photo_status: CampMedicationRecord["medicinePhotoStatus"];
  parent_provided_instructions: string | null;
  check_in_status: CampMedicationRecord["checkInStatus"];
  quantity_remaining?: string | null;
  schedule_type?: CampMedicationRecord["scheduleType"] | null;
  is_prn?: boolean | null;
  received_by: string | null;
  received_at: string | null;
  clarification_status: CampMedicationRecord["clarificationStatus"];
  supersedes_medication_record_id: string | null;
  correction_note: string | null;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
  archived_at?: string | null;
  archived_by_user_id?: string | null;
  archived_by_name?: string | null;
  archive_reason?: string | null;
};

type CampMedicationScheduleRow = {
  id: string;
  medication_record_id: string;
  camper_id: string;
  time_window: string;
  parent_provided_instructions: string | null;
  status: CampMedicationScheduleItem["status"];
  last_logged_at: string | null;
  last_logged_by: string | null;
  supersedes_schedule_item_id: string | null;
  correction_note: string | null;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
  archived_at?: string | null;
  archived_by_user_id?: string | null;
  archived_by_name?: string | null;
  archive_reason?: string | null;
};

type CampMedicationLogRow = {
  id: string;
  medication_record_id: string;
  schedule_item_id: string | null;
  camper_id: string;
  time_window: string;
  logged_at: string;
  logged_by: string;
  status: CampMedicationAdministrationLog["status"];
  notes: string | null;
  student_acknowledgement_initials?: string | null;
  student_acknowledgement_unavailable?: boolean | null;
  student_acknowledgement_unavailable_reason?: string | null;
  supersedes_administration_log_id: string | null;
  correction_note: string | null;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
  archived_at?: string | null;
  archived_by_user_id?: string | null;
  archived_by_name?: string | null;
  archive_reason?: string | null;
};

type CampMedicationAdministrationEventRow = {
  id: string;
  camper_id: string;
  time_window: string;
  administered_at: string;
  administered_by: string;
  student_acknowledgement_initials?: string | null;
  student_acknowledgement_unavailable?: boolean | null;
  student_acknowledgement_unavailable_reason?: string | null;
  notes: string | null;
  item_count: number;
  created_at: string;
};

type CampMedicationAdministrationItemRow = {
  id: string;
  administration_event_id: string;
  medication_record_id: string;
  schedule_item_id: string | null;
  camper_id: string;
  medication_name: string;
  time_window: string;
  status: CampMedicationAdministrationItem["status"];
  dose_given: string | null;
  administered_at: string;
  notes: string | null;
  created_at: string;
};

type CampMedicationReturnRow = {
  id: string;
  medication_record_id: string;
  camper_id: string;
  return_status: CampMedicationReturnItem["returnStatus"];
  returned_at: string | null;
  returned_by: string | null;
  recipient_name: string | null;
  recipient_relationship: string | null;
  return_notes: string | null;
  supersedes_return_item_id: string | null;
  correction_note: string | null;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
  archived_at?: string | null;
  archived_by_user_id?: string | null;
  archived_by_name?: string | null;
  archive_reason?: string | null;
};

type CampMedicationIntakeRow = {
  id: string;
  medication_record_id: string | null;
  camper_id: string;
  medication_name: string;
  dose: string;
  schedule_text: string;
  parent_instructions: string;
  staff_notes: string;
  quantity_received: string;
  container_status: string;
  received_by_name: string;
  received_at: string;
  guardian_name: string;
  guardian_relationship: string;
  guardian_signature_data: CampMedicationIntakeRecord["guardianSignatureData"];
  clarification_status: CampMedicationIntakeRecord["clarificationStatus"];
  confirmation_acknowledged: boolean;
  supersedes_intake_id: string | null;
  correction_note: string;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
  archived_at?: string | null;
  archived_by_user_id?: string | null;
  archived_by_name?: string | null;
  archive_reason?: string | null;
  created_at: string;
};

type CampMedicationIntakeSessionRow = {
  id: string;
  camper_id: string;
  received_by_name: string;
  received_at: string;
  guardian_name: string;
  guardian_relationship: string;
  guardian_signature_data: CampMedicationIntakeSession["guardianSignatureData"];
  status: CampMedicationIntakeSession["status"];
  notes: string | null;
  medication_count: number;
  archived_at?: string | null;
  archived_by_name?: string | null;
  archive_reason?: string | null;
  created_at: string;
  updated_at: string;
};

type CampMedicationPhotoRow = {
  id: string;
  camper_id: string;
  medication_record_id: string;
  intake_record_id?: string | null;
  content_type: string;
  file_size: number;
  uploaded_at: string;
};

type CampCamperProfilePhotoRow = {
  id: string;
  camper_id: string;
  content_type: string;
  file_size: number;
  uploaded_at: string;
  removed_at: string | null;
};

type CampCamperProfilePhotoStorageRow = CampCamperProfilePhotoRow & {
  storage_bucket: string;
  storage_object_path: string;
};

type CampBasics = {
  camp: CampSessionRow;
  teams: CampTeam[];
  vehicles: CampVehicle[];
  schedule: CampScheduleBlock[];
  staff: CampStaffMember[];
};

function shouldUseMock(session: AuthSession) {
  return session.isMock || !isSupabaseConfigured();
}

const OAKWOOD_LIVE_IMPORT_APPROVAL_ENV = "CAMP_OAKWOOD_LIVE_IMPORT_APPROVED";

const OAKWOOD_IMPORT_SCHEMA_CHECKS = [
  {
    label: "public.camp_staff table",
    table: "camp_staff",
    columns: ["id"]
  },
  {
    label: "camp_campers migration 013 columns",
    table: "camp_campers",
    columns: ["registration_external_id", "shirt_size", "emergency_contact_on_file", "has_medical_alert", "has_dietary_alert"]
  },
  {
    label: "camp_restricted_medical_records migration 013 columns",
    table: "camp_restricted_medical_records",
    columns: ["emergency_contact_name", "emergency_contact_phone", "guardian_name", "guardian_phone", "dietary_requirements"]
  },
  {
    label: "camp_import_batches migration 013 audit columns",
    table: "camp_import_batches",
    columns: ["source_file", "source_checksum", "created_count", "updated_count", "skipped_count", "ambiguous_count", "invalid_count", "restricted_count", "safe_count", "staff_count"]
  }
] as const;

type OakwoodReadinessEnv = Record<string, string | undefined>;

type OakwoodSchemaReadinessClient = {
  // Supabase query builders are thenable rather than plain Promises; keep this
  // helper scoped to the tiny read-only surface the readiness probes use.
  from(table: string): any;
};

export type OakwoodImportReadiness =
  | { ready: true }
  | { ready: false; reason: "approval" | "schema"; failures: string[]; message: string };

export function isOakwoodLiveImportApproved(env: OakwoodReadinessEnv = process.env): boolean {
  return env[OAKWOOD_LIVE_IMPORT_APPROVAL_ENV] === "true";
}

export async function checkOakwoodImportSchemaReadinessWithClient(
  supabase: OakwoodSchemaReadinessClient
): Promise<{ ready: true } | { ready: false; failures: string[] }> {
  const failures: string[] = [];

  for (const check of OAKWOOD_IMPORT_SCHEMA_CHECKS) {
    const { error } = await supabase
      .from(check.table)
      .select(check.columns.join(","))
      .limit(0)
      .returns();

    if (error) {
      failures.push(`${check.label}: ${error.message}`);
    }
  }

  return failures.length ? { ready: false, failures } : { ready: true };
}

export async function getOakwoodLiveImportReadiness(
  session: AuthSession,
  options: { env?: OakwoodReadinessEnv; supabase?: OakwoodSchemaReadinessClient } = {}
): Promise<OakwoodImportReadiness> {
  if (!isOakwoodLiveImportApproved(options.env)) {
    return {
      ready: false,
      reason: "approval",
      failures: [OAKWOOD_LIVE_IMPORT_APPROVAL_ENV],
      message: `Oakwood live import approval is not enabled. Set the server-only ${OAKWOOD_LIVE_IMPORT_APPROVAL_ENV}=true only after migration 013 schema readiness and real-name preview approval are complete.`
    };
  }

  if (!options.supabase && !isSupabaseConfigured()) {
    return {
      ready: false,
      reason: "schema",
      failures: ["Supabase environment variables are not configured."],
      message: "Oakwood import schema readiness could not be checked because live Supabase is not configured."
    };
  }

  const schema = await checkOakwoodImportSchemaReadinessWithClient(options.supabase ?? getSupabaseAuthClient(session.accessToken));
  if (!schema.ready) {
    return {
      ready: false,
      reason: "schema",
      failures: schema.failures,
      message: `Oakwood import schema readiness check failed: ${schema.failures.join("; ")}`
    };
  }

  return { ready: true };
}

function ministryScopeColumns(ministryId: string | undefined): { ministry_id?: string } {
  return ministryId ? { ministry_id: ministryId } : {};
}

export async function getCampOverview(
  session: AuthSession,
  context: CampAccessContext,
  scope: CampAccessScope = {}
): Promise<CampOverviewPayload> {
  if (shouldUseMock(session)) {
    return mockStore.getCampOverview(context.effectiveRole, scope);
  }

  const basics = await ensureCampBasics(session);
  const students = await loadActiveCampStudents(session, basics.camp.id);
  return {
    campName: basics.camp.name,
    campStartsOn: basics.camp.starts_on,
    teams: basics.teams,
    vehicles: basics.vehicles,
    schedule: context.effectiveRole === "driver" ? basics.schedule.filter((item) => item.audience === "All Camp") : basics.schedule,
    documents: filterDocumentsForRole(context),
    students: getCampVisibleStudentsForData(context.effectiveRole, scope, {
      students,
      teams: basics.teams,
      vehicles: basics.vehicles
    }),
    staff: basics.staff
  };
}

export async function getOakwoodImportPreview(
  session: AuthSession,
  context: CampAccessContext,
  input: { csv: string; sourceFile?: string }
) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;

  if (shouldUseMock(session)) {
    return {
      allowed: true as const,
      status: 200,
      preview: buildOakwoodImportPreviewFromCsv(input.csv, {
        sourceFile: input.sourceFile,
        existingCampers: mockStore.listOakwoodExistingCampers(),
        existingStaff: mockStore.listOakwoodExistingStaff()
      })
    };
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const [campers, staff] = await Promise.all([
    supabase
      .from("camp_campers")
      .select("id,name,registration_external_id")
      .eq("camp_id", basics.camp.id)
      .is("archived_at", null)
      .returns<Array<{ id: string; name: string; registration_external_id: string | null }>>(),
    supabase
      .from("camp_staff")
      .select("id,name,registration_external_id")
      .eq("camp_id", basics.camp.id)
      .is("archived_at", null)
      .returns<Array<{ id: string; name: string; registration_external_id: string | null }>>()
  ]);

  throwIfSupabaseError(campers.error);
  throwIfSupabaseError(staff.error);

  return {
    allowed: true as const,
    status: 200,
    preview: buildOakwoodImportPreviewFromCsv(input.csv, {
      sourceFile: input.sourceFile,
      existingCampers: (campers.data ?? []).map((row) => ({ id: row.id, name: row.name, registrationExternalId: row.registration_external_id ?? undefined })),
      existingStaff: (staff.data ?? []).map((row) => ({ id: row.id, name: row.name, registrationExternalId: row.registration_external_id ?? undefined }))
    })
  };
}

export async function getOakwoodUploadImportPreview(
  session: AuthSession,
  context: CampAccessContext,
  input: {
    sourceName?: string;
    sources: Array<{ scope: "full_roster" | "camper_only" | "staff_only"; csv: string; fileName: string; checksumSha256: string; sheetName?: string }>;
  }
) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (!input.sources.length) {
    return { allowed: false as const, status: 400, error: "Upload at least one camper or staff registration file before previewing." };
  }

  // Existing camper + staff records for matching. Campers match against existing
  // campers and adults against existing staff — never across the two.
  const existing = await loadOakwoodExistingPeople(session);
  const parts: CampOakwoodImportPreview[] = [];
  const uploadSources: NonNullable<CampOakwoodImportPreview["uploadSources"]> = [];

  for (const source of input.sources) {
    const part = buildOakwoodImportPreviewFromCsv(source.csv, {
      sourceFile: source.sheetName ? `${source.fileName} / ${source.sheetName}` : source.fileName,
      sourceKind: "upload",
      importScope: source.scope,
      existingCampers: existing.campers,
      existingStaff: existing.staff
    });
    parts.push(part);
    uploadSources.push({
      fileName: source.fileName,
      checksumSha256: source.checksumSha256,
      sheetName: source.sheetName,
      scope: source.scope,
      rowCount: part.summary.totalSourceRows
    });
  }

  const scopes = new Set(input.sources.map((source) => source.scope));
  const importScope =
    scopes.has("full_roster") || (scopes.has("camper_only") && scopes.has("staff_only"))
      ? "full_roster"
      : input.sources[0].scope;

  const preview = mergeOakwoodImportPreviews(parts, {
    sourceFile: input.sourceName?.trim() || input.sources.map((source) => source.fileName).join(" + "),
    sourceKind: "upload",
    uploadSources,
    importScope
  });
  const teams = shouldUseMock(session) ? campTeams : (await ensureCampBasics(session)).teams;
  addOakwoodTeamWarnings(preview, teams);

  return { allowed: true as const, status: 200, preview };
}

function addOakwoodTeamWarnings(preview: CampOakwoodImportPreview, teams: CampTeam[]) {
  for (const row of preview.rows) {
    if (row.matchStatus !== "new" && row.matchStatus !== "matched") continue;
    if (!row.person.teamName.trim()) continue;
    if (resolveTeamId(row.person.teamName, teams)) continue;
    if (!row.warnings.includes("Team not matched; person will import without assigned team.")) {
      row.warnings.push("Team not matched; person will import without assigned team.");
    }
  }
}

async function loadOakwoodExistingPeople(session: AuthSession): Promise<{ campers: OakwoodExistingPerson[]; staff: OakwoodExistingPerson[] }> {
  if (shouldUseMock(session)) {
    return { campers: mockStore.listOakwoodExistingCampers(), staff: mockStore.listOakwoodExistingStaff() };
  }
  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const [campers, staff] = await Promise.all([
    supabase.from("camp_campers").select("id,name,registration_external_id").eq("camp_id", basics.camp.id).is("archived_at", null).returns<Array<{ id: string; name: string; registration_external_id: string | null }>>(),
    supabase.from("camp_staff").select("id,name,registration_external_id").eq("camp_id", basics.camp.id).is("archived_at", null).returns<Array<{ id: string; name: string; registration_external_id: string | null }>>()
  ]);
  throwIfSupabaseError(campers.error);
  throwIfSupabaseError(staff.error);
  return {
    campers: (campers.data ?? []).map((row) => ({ id: row.id, name: row.name, registrationExternalId: row.registration_external_id ?? undefined })),
    staff: (staff.data ?? []).map((row) => ({ id: row.id, name: row.name, registrationExternalId: row.registration_external_id ?? undefined }))
  };
}

export async function commitOakwoodImport(
  session: AuthSession,
  context: CampAccessContext,
  input: { preview: CampOakwoodImportPreview; confirmed?: boolean }
) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (!input.confirmed) {
    return { allowed: true as const, status: 400, error: "Oakwood import confirmation is required before commit." };
  }
  if (input.preview.summary.ambiguousCount > 0 || input.preview.summary.invalidCount > 0) {
    return { allowed: true as const, status: 409, error: "Resolve ambiguous or invalid Oakwood rows before committing." };
  }
  if (session.isMock) {
    const result = mockStore.commitOakwoodImportPreview(context.effectiveRole, input.preview, access.actor);
    if (!result.allowed) return result;
    return { allowed: true as const, status: 200, result: result.result };
  }

  const readiness = await getOakwoodLiveImportReadiness(session);
  if (!readiness.ready) {
    return { allowed: true as const, status: 403, error: readiness.message };
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const committed: CampOakwoodImportCommitResult["committed"] = [];
  const ministryId = await resolveMinistryScope(session);

  for (const row of input.preview.rows) {
    if (row.matchStatus !== "new" && row.matchStatus !== "matched") continue;

    if (row.personType === "adult") {
      const teamId = resolveTeamId(row.person.teamName, basics.teams);
      const staffRow = {
        name: row.person.name.trim(),
        profile_photo_url: row.person.profilePhotoUrl ?? "",
        role: "adult_volunteer" as const,
        shirt_size: row.person.shirtSize,
        registration_external_id: row.person.registrationExternalId || null,
        source_church: row.person.sourceChurch ?? "",
        team_id: teamId || null
      };
      const write = row.matchedExistingId
        ? await supabase.from("camp_staff").update(staffRow).eq("id", row.matchedExistingId).is("archived_at", null).select("*").single<CampStaffRow>()
        : await supabase.from("camp_staff").insert({
            ...ministryScopeColumns(ministryId),
            camp_id: basics.camp.id,
            ...staffRow
          }).select("*").single<CampStaffRow>();
      throwIfSupabaseError(write.error);
      if (!write.data) throw new Error("Camp staff write returned no row.");
      committed.push({ rowNumber: row.rowNumber, personType: "adult", action: row.matchedExistingId ? "updated" : "created", id: write.data.id, name: write.data.name });
      continue;
    }

    const studentPayload = await upsertCampStudent(session, context, {
      id: row.matchedExistingId,
      name: row.person.name,
      profilePhotoUrl: row.person.profilePhotoUrl,
      grade: row.person.grade,
      teamId: resolveTeamId(row.person.teamName, basics.teams),
      vehicleId: resolveVehicleId(row.person.vehicleName, basics.vehicles),
      cabin: row.person.cabin,
      shirtSize: row.person.shirtSize,
      registrationExternalId: row.person.registrationExternalId,
      emergencyContactOnFile: row.safeIndicators.emergencyContactOnFile,
      hasMedicalAlert: row.safeIndicators.hasMedicalAlert,
      hasDietaryAlert: row.safeIndicators.hasDietaryAlert,
      limitedSafetyFlags: row.safeOperationalFlags ?? []
    });
    if (!studentPayload.allowed) return studentPayload;

    if (row.restricted) {
      const restrictedPayload = await upsertRestrictedMedicalRecord(session, context, {
        studentId: studentPayload.student.id,
        studentName: studentPayload.student.name,
        medicalFormStatus: row.restricted.medicalFormStatus,
        restrictedNotes: row.restricted.restrictedNotes,
        allergyNotes: row.restricted.dietaryRequirements,
        insuranceStatus: row.restricted.insuranceStatus,
        parentMedicalNotes: row.restricted.parentMedicalNotes,
        emergencyContactName: row.restricted.emergencyContactName,
        emergencyContactPhone: row.restricted.emergencyContactPhone,
        emergencyContactRelationship: row.restricted.emergencyContactRelationship,
        guardianName: row.restricted.guardianName,
        guardianPhone: row.restricted.guardianPhone,
        dietaryRequirements: row.restricted.dietaryRequirements
      });
      if (!restrictedPayload.allowed) return restrictedPayload;
    }

    committed.push({
      rowNumber: row.rowNumber,
      personType: "student",
      action: row.matchedExistingId ? "updated" : "created",
      id: studentPayload.student.id,
      name: studentPayload.student.name
    });
  }

  const auditRow = {
    ...ministryScopeColumns(ministryId),
    camp_id: basics.camp.id,
    imported_by: session.user.id,
    source_name: input.preview.sourceFile,
    source_file: input.preview.sourceFile,
    source_checksum: input.preview.uploadSources?.map((source) => source.checksumSha256).join(", ") ?? null,
    row_count: input.preview.summary.totalSourceRows,
    status: "committed",
    warnings: input.preview.rows
      .filter((row) => row.warnings.length > 0)
      .map((row) => ({ rowNumber: row.rowNumber, warnings: row.warnings })),
    created_count: committed.filter((item) => item.action === "created").length,
    updated_count: committed.filter((item) => item.action === "updated").length,
    skipped_count: input.preview.summary.skippedCount,
    ambiguous_count: input.preview.summary.ambiguousCount,
    invalid_count: input.preview.summary.invalidCount,
    restricted_count: input.preview.summary.restrictedRecordRows,
    safe_count: input.preview.summary.safeFieldRows,
    staff_count: input.preview.summary.staffRows
  };
  const audit = await supabase.from("camp_import_batches").insert(auditRow).select("id,created_at").single<{ id: string; created_at: string }>();
  throwIfSupabaseError(audit.error);
  if (!audit.data) throw new Error("Camp import audit write returned no row.");

  return {
    allowed: true as const,
    status: 200,
    result: {
      auditBatch: {
        id: audit.data.id,
        sourceFile: input.preview.sourceFile,
        sourceChecksum: input.preview.uploadSources?.map((source) => source.checksumSha256).join(", "),
        importedByName: access.actor,
        importedAt: audit.data.created_at,
        createdCount: auditRow.created_count,
        updatedCount: auditRow.updated_count,
        skippedCount: auditRow.skipped_count,
        ambiguousCount: auditRow.ambiguous_count,
        invalidCount: auditRow.invalid_count,
        restrictedCount: auditRow.restricted_count,
        safeCount: auditRow.safe_count,
        staffCount: auditRow.staff_count
      },
      committed
    } satisfies CampOakwoodImportCommitResult
  };
}

export async function getArchivedCampStudents(session: AuthSession, context: CampAccessContext) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) {
    return { allowed: true as const, status: 200, students: mockStore.listArchivedCampStudents(context.effectiveRole) };
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const { data, error } = await supabase
    .from("camp_campers")
    .select("*")
    .eq("camp_id", basics.camp.id)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .returns<CampCamperRow[]>();

  throwIfSupabaseError(error);
  return { allowed: true as const, status: 200, students: (data ?? []).map((row) => toCampStudentPublic(row)) };
}

export async function upsertCampStudent(session: AuthSession, context: CampAccessContext, input: CampStudentInput) {
  if (context.isDriver) return deniedCampMutation(session, context, "camper.write", "camp_campers", input.id, "Camp roster editing is not available for this role.");
  if (shouldUseMock(session)) {
    const existing = input.id ? mockStore.getActiveCampStudentById(input.id) : undefined;
    const access = assertCampCamperWriteAccess(context, input, existing);
    if (!access.allowed) return deniedCampMutation(session, context, "camper.write", "camp_campers", input.id, access.error);
    return { allowed: true as const, status: input.id ? 200 : 201, student: mockStore.upsertCampStudent(input) };
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const existing = input.id ? await loadActiveCamperForAccess(session, input.id) : null;
  const access = assertCampCamperWriteAccess(context, input, existing ? toCampStudentPublic(existing) : undefined);
  if (!access.allowed) return deniedCampMutation(session, context, "camper.write", "camp_campers", input.id, access.error);
  const sourceChurch = input.sourceChurch?.trim() ?? "";
  const rosterType = input.rosterType ?? rosterTypeFromFlags(input.limitedSafetyFlags ?? []);
  const row = {
    name: input.name.trim(),
    photo_initials: initialsForName(input.name),
    grade: input.grade.trim(),
    team_id: input.teamId || null,
    vehicle_id: input.vehicleId || null,
    cabin: input.cabin.trim(),
    limited_safety_flags: normalizeFlags(withRosterMetadataFlags(input.limitedSafetyFlags ?? [], sourceChurch, rosterType)),
    ...(input.shirtSize !== undefined ? { shirt_size: input.shirtSize.trim() } : {}),
    ...(input.registrationExternalId !== undefined ? { registration_external_id: input.registrationExternalId.trim() || null } : {}),
    ...(input.emergencyContactOnFile !== undefined ? { emergency_contact_on_file: input.emergencyContactOnFile } : {}),
    ...(input.hasMedicalAlert !== undefined ? { has_medical_alert: input.hasMedicalAlert } : {}),
    ...(input.hasDietaryAlert !== undefined ? { has_dietary_alert: input.hasDietaryAlert } : {})
  };

  const result = input.id
    ? await supabase.from("camp_campers").update(row).eq("id", input.id).is("archived_at", null).select("*").single<CampCamperRow>()
    : await supabase.from("camp_campers").insert({
        ...ministryScopeColumns(await resolveMinistryScope(session)),
        camp_id: basics.camp.id,
        ...row
      }).select("*").single<CampCamperRow>();

  throwIfSupabaseError(result.error);
  if (!result.data) throw new Error("Camp camper write returned no row.");
  return { allowed: true as const, status: input.id ? 200 : 201, student: toCampStudentPublic(result.data) };
}

export async function saveCampCamperProfilePhoto(
  session: AuthSession,
  context: CampAccessContext,
  input: { studentId: string; file: File }
) {
  if (context.isDriver) return deniedCampMutation(session, context, "camper_photo.write", "camp_camper_profile_photo_records", input.studentId, "Camper photo editing is not available for this role.");

  const contentType = input.file.type || "application/octet-stream";
  const fileSize = input.file.size;
  assertCamperProfilePhotoFile(contentType, fileSize);

  if (shouldUseMock(session)) {
    const existing = mockStore.getActiveCampStudentById(input.studentId);
    const access = assertCampCamperWriteAccess(context, { id: input.studentId, name: existing?.name ?? "", grade: existing?.grade ?? "", teamId: existing?.teamId ?? "", vehicleId: existing?.vehicleId ?? "", cabin: existing?.cabin ?? "", sourceChurch: existing?.sourceChurch, rosterType: existing?.rosterType }, existing);
    if (!access.allowed) return deniedCampMutation(session, context, "camper_photo.write", "camp_camper_profile_photo_records", input.studentId, access.error);
    const buffer = Buffer.from(await input.file.arrayBuffer());
    return mockStore.saveCampCamperProfilePhoto({
      studentId: input.studentId,
      contentType,
      fileSize,
      mockSignedUrl: `data:${contentType};base64,${buffer.toString("base64")}`
    });
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const camper = await requireActiveCamper(session, input.studentId);
  const access = assertCampCamperWriteAccess(context, {
    id: camper.id,
    name: camper.name,
    grade: camper.grade ?? "",
    teamId: camper.team_id ?? "",
    vehicleId: camper.vehicle_id ?? "",
    cabin: camper.cabin ?? "",
    sourceChurch: camper.source_church ?? undefined,
    rosterType: camper.roster_type ?? undefined
  }, toCampStudentPublic(camper));
  if (!access.allowed) return deniedCampMutation(session, context, "camper_photo.write", "camp_camper_profile_photo_records", input.studentId, access.error);
  const photoId = randomUUID();
  const extension = extensionForContentType(contentType);
  const objectPath = `ministry/${camper.ministry_id}/camp/${basics.camp.id}/camper/${camper.id}/profile/${photoId}.${extension}`;
  const upload = await supabase.storage.from("camp-camper-profile-photos").upload(objectPath, input.file, {
    contentType,
    upsert: false
  });
  if (upload.error) throw upload.error;

  const { data, error } = await supabase
    .from("camp_camper_profile_photo_records")
    .insert({
      id: photoId,
      ...ministryScopeColumns(await resolveMinistryScope(session)),
      camp_id: basics.camp.id,
      camper_id: camper.id,
      storage_bucket: "camp-camper-profile-photos",
      storage_object_path: objectPath,
      content_type: contentType,
      file_size: fileSize,
      uploaded_by_user_id: session.user.id
    })
    .select("*")
    .single<CampCamperProfilePhotoRow>();

  if (error) {
    await supabase.storage.from("camp-camper-profile-photos").remove([objectPath]);
    throwIfSupabaseError(error);
  }
  if (!data) throw new Error("Camper photo write returned no row.");

  const replacement = await supabase
    .from("camp_camper_profile_photo_records")
    .update({ replaced_by_photo_id: photoId })
    .eq("camp_id", basics.camp.id)
    .eq("camper_id", camper.id)
    .neq("id", photoId)
    .is("removed_at", null)
    .is("replaced_by_photo_id", null);
  throwIfSupabaseError(replacement.error);

  const signed = await supabase.storage.from("camp-camper-profile-photos").createSignedUrl(objectPath, 300);
  if (signed.error) throw signed.error;
  return {
    allowed: true as const,
    status: 201,
    photo: toCamperProfilePhotoRecord(data, new Map([[camper.id, toCampStudentPublic(camper)]])),
    student: toCampStudentPublic(camper, signed.data.signedUrl)
  };
}

export async function removeCampCamperProfilePhoto(session: AuthSession, context: CampAccessContext, input: { studentId: string }) {
  if (context.isDriver) return deniedCampMutation(session, context, "camper_photo.remove", "camp_camper_profile_photo_records", input.studentId, "Camper photo editing is not available for this role.");
  if (shouldUseMock(session)) {
    const existing = mockStore.getActiveCampStudentById(input.studentId);
    const access = assertCampCamperWriteAccess(context, { id: input.studentId, name: existing?.name ?? "", grade: existing?.grade ?? "", teamId: existing?.teamId ?? "", vehicleId: existing?.vehicleId ?? "", cabin: existing?.cabin ?? "", sourceChurch: existing?.sourceChurch, rosterType: existing?.rosterType }, existing);
    if (!access.allowed) return deniedCampMutation(session, context, "camper_photo.remove", "camp_camper_profile_photo_records", input.studentId, access.error);
    return mockStore.removeCampCamperProfilePhoto(input);
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const camper = await requireActiveCamper(session, input.studentId);
  const access = assertCampCamperWriteAccess(context, {
    id: camper.id,
    name: camper.name,
    grade: camper.grade ?? "",
    teamId: camper.team_id ?? "",
    vehicleId: camper.vehicle_id ?? "",
    cabin: camper.cabin ?? "",
    sourceChurch: camper.source_church ?? undefined,
    rosterType: camper.roster_type ?? undefined
  }, toCampStudentPublic(camper));
  if (!access.allowed) return deniedCampMutation(session, context, "camper_photo.remove", "camp_camper_profile_photo_records", input.studentId, access.error);
  const { error } = await supabase
    .from("camp_camper_profile_photo_records")
    .update({ removed_at: new Date().toISOString() })
    .eq("camp_id", basics.camp.id)
    .eq("camper_id", camper.id)
    .is("removed_at", null)
    .is("replaced_by_photo_id", null);
  if (isMissingTableError(error, "camp_camper_profile_photo_records")) {
    return { allowed: true as const, status: 200, student: toCampStudentPublic(camper) };
  }
  throwIfSupabaseError(error);
  return { allowed: true as const, status: 200, student: toCampStudentPublic(camper) };
}

export async function upsertCampScheduleItem(session: AuthSession, context: CampAccessContext, input: CampScheduleInput) {
  const access = assertAllCampersOperationalWriteAccess(context, "Camp schedule editing");
  if (!access.allowed) return deniedCampMutation(session, context, "schedule.write", "camp_schedule_items", input.id, context.isDriver ? "Camp schedule editing is not available for this role." : access.error);
  if (shouldUseMock(session)) return { allowed: true as const, status: input.id ? 200 : 201, item: mockStore.upsertCampScheduleItem(input) };

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const row = scheduleInputToRow(input);
  const result = input.id
    ? await supabase.from("camp_schedule_items").update(row).eq("id", input.id).is("archived_at", null).select("*").single<CampScheduleItemRow>()
    : await supabase.from("camp_schedule_items").insert({
        ...ministryScopeColumns(await resolveMinistryScope(session)),
        camp_id: basics.camp.id,
        display_order: basics.schedule.length + 1,
        ...row
      }).select("*").single<CampScheduleItemRow>();

  throwIfSupabaseError(result.error);
  if (!result.data) throw new Error("Camp schedule write returned no row.");
  return { allowed: true as const, status: input.id ? 200 : 201, item: toCampScheduleBlock(result.data) };
}

export async function archiveCampScheduleItem(session: AuthSession, context: CampAccessContext, input: { id: string }) {
  const access = assertAllCampersOperationalWriteAccess(context, "Camp schedule editing");
  if (!access.allowed) return deniedCampMutation(session, context, "schedule.archive", "camp_schedule_items", input.id, context.isDriver ? "Camp schedule editing is not available for this role." : access.error);
  if (shouldUseMock(session)) return mockStore.archiveCampScheduleItem(input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_schedule_items")
    .update({ archived_at: new Date().toISOString(), status: "Canceled" })
    .eq("id", input.id)
    .is("archived_at", null)
    .select("*")
    .single<CampScheduleItemRow>();
  throwIfSupabaseError(error);
  if (!data) return { allowed: true as const, status: 404, error: "Active schedule item not found." };
  return { allowed: true as const, status: 200, item: toCampScheduleBlock(data) };
}

export async function upsertCampTeam(session: AuthSession, context: CampAccessContext, input: CampTeamInput) {
  const access = assertAllCampersOperationalWriteAccess(context, "Camp team editing");
  if (!access.allowed) return deniedCampMutation(session, context, "team.write", "camp_teams", input.id, context.isDriver ? "Camp team editing is not available for this role." : access.error);
  if (shouldUseMock(session)) return { allowed: true as const, status: input.id ? 200 : 201, team: mockStore.upsertCampTeam(input) };

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const row = {
    name: input.name.trim(),
    color: input.color.trim() || input.name.trim(),
    leader: input.leader?.trim() ?? "",
    co_leader: input.coLeader?.trim() ?? "",
    room: input.room?.trim() ?? "",
    notes: input.notes?.trim() ?? ""
  };
  const result = input.id
    ? await supabase.from("camp_teams").update(row).eq("id", input.id).is("archived_at", null).select("*").single<CampTeamRow>()
    : await supabase.from("camp_teams").insert({
        ...ministryScopeColumns(await resolveMinistryScope(session)),
        camp_id: basics.camp.id,
        display_order: basics.teams.length + 1,
        ...row
      }).select("*").single<CampTeamRow>();
  throwIfSupabaseError(result.error);
  if (!result.data) throw new Error("Camp team write returned no row.");
  return { allowed: true as const, status: input.id ? 200 : 201, team: toCampTeam(result.data) };
}

export async function archiveCampTeam(session: AuthSession, context: CampAccessContext, input: { id: string }) {
  const access = assertAllCampersOperationalWriteAccess(context, "Camp team editing");
  if (!access.allowed) return deniedCampMutation(session, context, "team.archive", "camp_teams", input.id, context.isDriver ? "Camp team editing is not available for this role." : access.error);
  if (shouldUseMock(session)) return mockStore.archiveCampTeam(input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_teams")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", input.id)
    .is("archived_at", null)
    .select("*")
    .single<CampTeamRow>();
  throwIfSupabaseError(error);
  if (!data) return { allowed: true as const, status: 404, error: "Active team not found." };

  const clearAssignments = await supabase.from("camp_campers").update({ team_id: null }).eq("team_id", input.id).is("archived_at", null);
  throwIfSupabaseError(clearAssignments.error);
  return { allowed: true as const, status: 200, team: toCampTeam(data) };
}

export async function upsertCampVehicle(session: AuthSession, context: CampAccessContext, input: CampVehicleInput) {
  const access = assertAllCampersOperationalWriteAccess(context, "Camp vehicle editing");
  if (!access.allowed) return deniedCampMutation(session, context, "vehicle.write", "camp_vehicles", input.id, context.isDriver ? "Camp vehicle editing is not available for this role." : access.error);
  if (shouldUseMock(session)) return { allowed: true as const, status: input.id ? 200 : 201, vehicle: mockStore.upsertCampVehicle(input) };

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const row = {
    name: input.name.trim(),
    driver: input.driver?.trim() ?? "",
    departure_window: input.departureWindow?.trim() ?? "",
    departure_location: input.departureLocation?.trim() ?? "",
    capacity: Number.isFinite(input.capacity) ? Math.max(0, Math.floor(input.capacity)) : 0,
    notes: input.notes?.trim() ?? ""
  };
  const result = input.id
    ? await supabase.from("camp_vehicles").update(row).eq("id", input.id).select("*").single<CampVehicleRow>()
    : await supabase.from("camp_vehicles").insert({
        ...ministryScopeColumns(await resolveMinistryScope(session)),
        camp_id: basics.camp.id,
        display_order: basics.vehicles.length + 1,
        ...row
      }).select("*").single<CampVehicleRow>();
  throwIfSupabaseError(result.error);
  if (!result.data) throw new Error("Camp vehicle write returned no row.");
  return { allowed: true as const, status: input.id ? 200 : 201, vehicle: toCampVehicle(result.data) };
}

export async function archiveCampVehicle(session: AuthSession, context: CampAccessContext, input: { id: string }) {
  const access = assertAllCampersOperationalWriteAccess(context, "Camp vehicle editing");
  if (!access.allowed) return deniedCampMutation(session, context, "vehicle.archive", "camp_vehicles", input.id, context.isDriver ? "Camp vehicle editing is not available for this role." : access.error);
  if (shouldUseMock(session)) return mockStore.archiveCampVehicle(input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_vehicles")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", input.id)
    .select("*")
    .single<CampVehicleRow>();
  throwIfSupabaseError(error);
  if (!data) return { allowed: true as const, status: 404, error: "Active vehicle not found." };

  const clearAssignments = await supabase.from("camp_campers").update({ vehicle_id: null }).eq("vehicle_id", input.id).is("archived_at", null);
  throwIfSupabaseError(clearAssignments.error);
  return { allowed: true as const, status: 200, vehicle: toCampVehicle(data) };
}

export async function assignCampStudent(
  session: AuthSession,
  context: CampAccessContext,
  input: { studentId: string; teamId?: string; vehicleId?: string; cabin?: string }
) {
  if (context.isDriver) return deniedCampMutation(session, context, "camper.assign", "camp_campers", input.studentId, "Camp roster editing is not available for this role.");
  if (shouldUseMock(session)) {
    const existing = mockStore.getActiveCampStudentById(input.studentId);
    if (!existing) throw new Error("Active camper not found.");
    const access = assertCampCamperWriteAccess(context, { id: input.studentId, name: existing.name, grade: existing.grade ?? "", teamId: existing.teamId ?? "", vehicleId: existing.vehicleId ?? "", cabin: existing.cabin ?? "", sourceChurch: existing.sourceChurch, rosterType: existing.rosterType }, existing);
    if (!access.allowed) return deniedCampMutation(session, context, "camper.assign", "camp_campers", input.studentId, access.error);
    if (input.vehicleId && !isVehicleAssignableCamper(existing)) {
      return { allowed: false as const, status: 403, error: "Vehicle assignment is limited to CLC/emergency roster campers." };
    }
    return { allowed: true as const, status: 200, student: mockStore.assignCampStudent(input) };
  }

  const update: Record<string, string | null> = {};
  if (input.teamId !== undefined) update.team_id = input.teamId || null;
  if (input.vehicleId !== undefined) update.vehicle_id = input.vehicleId || null;
  if (input.cabin !== undefined) update.cabin = input.cabin;

  const supabase = getSupabaseAuthClient(session.accessToken);
  const existingForAccess = await loadActiveCamperForAccess(session, input.studentId);
  const access = assertCampCamperWriteAccess(context, {
    id: existingForAccess?.id,
    name: existingForAccess?.name ?? "",
    grade: existingForAccess?.grade ?? "",
    teamId: existingForAccess?.team_id ?? "",
    vehicleId: existingForAccess?.vehicle_id ?? "",
    cabin: existingForAccess?.cabin ?? "",
    sourceChurch: existingForAccess?.source_church ?? undefined,
    rosterType: existingForAccess?.roster_type ?? undefined
  }, existingForAccess ? toCampStudentPublic(existingForAccess) : undefined);
  if (!access.allowed) return deniedCampMutation(session, context, "camper.assign", "camp_campers", input.studentId, access.error);
  if (input.vehicleId) {
    const { data: existing, error: existingError } = await supabase
      .from("camp_campers")
      .select("*")
      .eq("id", input.studentId)
      .is("archived_at", null)
      .maybeSingle<CampCamperRow>();
    throwIfSupabaseError(existingError);
    if (!existing) throw new Error("Active camper not found.");
    if (!isVehicleAssignableCamper({
      rosterType: existing.roster_type ?? undefined,
      sourceChurch: existing.source_church ?? sourceChurchFromFlags(existing.limited_safety_flags ?? []),
      limitedSafetyFlags: existing.limited_safety_flags ?? []
    })) {
      return { allowed: false as const, status: 403, error: "Vehicle assignment is limited to CLC/emergency roster campers." };
    }
  }
  const { data, error } = await supabase.from("camp_campers").update(update).eq("id", input.studentId).is("archived_at", null).select("*").single<CampCamperRow>();
  throwIfSupabaseError(error);
  if (!data) throw new Error("Camp assignment update returned no row.");
  return { allowed: true as const, status: 200, student: toCampStudentPublic(data) };
}

export async function postCampTeamBulletin(
  session: AuthSession,
  context: CampAccessContext,
  input: { teamId: string; message: string }
): Promise<{ allowed: true; status: number; bulletin: CampTeamBulletinPost } | { allowed: true; status: number; error: string } | { allowed: false; status: number; error: string }> {
  if (!input.teamId.trim()) return { allowed: true as const, status: 400, error: "Team is required." };
  if (!input.message.trim()) return { allowed: true as const, status: 400, error: "Bulletin message is required." };

  const access = assertCampBulletinPostAccess(context, input.teamId);
  if (!access.allowed) return deniedCampMutation(session, context, "team_bulletin.post", "camp_team_bulletins", input.teamId, access.error);

  if (shouldUseMock(session)) {
    return mockStore.postTeamBulletin({
      teamId: input.teamId,
      message: input.message,
      partnerChurchId: access.partnerChurchId,
      postedByName: session.user.fullName
    });
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  if (!basics.teams.some((team) => team.id === input.teamId)) {
    return { allowed: true as const, status: 404, error: "Active team not found." };
  }
  const { data, error } = await supabase
    .from("camp_team_bulletins")
    .insert({
      ...ministryScopeColumns(await resolveMinistryScope(session)),
      camp_id: basics.camp.id,
      team_id: input.teamId,
      partner_church_id: access.partnerChurchId,
      message: input.message.trim(),
      posted_by_user_id: session.user.id,
      posted_by_name: session.user.fullName
    })
    .select("id,team_id,partner_church_id,message,posted_by_name,created_at")
    .single<{
      id: string;
      team_id: string;
      partner_church_id: string | null;
      message: string;
      posted_by_name: string;
      created_at: string;
    }>();
  throwIfSupabaseError(error);
  if (!data) throw new Error("Team bulletin write returned no row.");
  return {
    allowed: true,
    status: 201,
    bulletin: {
      id: data.id,
      teamId: data.team_id,
      partnerChurchId: data.partner_church_id,
      message: data.message,
      postedByName: data.posted_by_name,
      postedAt: data.created_at
    }
  };
}

export async function listCampTeamBulletins(
  session: AuthSession,
  context: CampAccessContext,
  teamId: string
): Promise<{ allowed: true; status: number; bulletins: CampTeamBulletinPost[] } | { allowed: false; status: number; error: string }> {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (!teamId.trim()) return { allowed: true as const, status: 200, bulletins: [] };

  if (shouldUseMock(session)) {
    return { allowed: true as const, status: 200, bulletins: mockStore.listTeamBulletins(teamId) };
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const { data, error } = await supabase
    .from("camp_team_bulletins")
    .select("id,team_id,partner_church_id,message,posted_by_name,created_at")
    .eq("camp_id", basics.camp.id)
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<{
      id: string;
      team_id: string;
      partner_church_id: string | null;
      message: string;
      posted_by_name: string;
      created_at: string;
    }[]>();

  throwIfSupabaseError(error);
  return {
    allowed: true as const,
    status: 200,
    bulletins: (data ?? []).map((row) => ({
      id: row.id,
      teamId: row.team_id,
      partnerChurchId: row.partner_church_id,
      message: row.message,
      postedByName: row.posted_by_name,
      postedAt: row.created_at
    }))
  };
}

// Non-throwing active-student lookup. Used by the EMMA room-change confirm
// path to read the current room before writing, without needing the caller
// to catch a "not found" exception.
export async function getActiveCampStudentById(session: AuthSession, studentId: string): Promise<CampStudentPublic | undefined> {
  if (shouldUseMock(session)) return mockStore.getActiveCampStudentById(studentId);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_campers")
    .select("*")
    .eq("id", studentId)
    .is("archived_at", null)
    .maybeSingle<CampCamperRow>();
  throwIfSupabaseError(error);
  return data ? toCampStudentPublic(data) : undefined;
}

// Confirms an EMMA-proposed room/cabin change. This is the ONLY place model
// output can ever result in a database write, and only after: (1) the caller
// has already re-resolved the user's server-side access context (never
// trusting role data from the browser), (2) this function re-asserts the
// Andrew-only EMMA operations gate itself, and (3) the room value is
// re-validated here regardless of what the model proposed. The model's job
// ended at producing a proposal; nothing here re-invokes the model.
export async function confirmCampEmmaRoomChange(session: AuthSession, context: CampAccessContext, input: CampEmmaConfirmInput) {
  const access = assertCampEmmaOperationsAccess(context);
  if (!access.allowed) return access;

  const proposedRoom = input.proposedRoom.trim();
  if (!proposedRoom) return { allowed: false as const, status: 400, error: "A room or cabin value is required." };
  if (proposedRoom.length > 80) return { allowed: false as const, status: 400, error: "Room value is too long." };

  const student = await getActiveCampStudentById(session, input.studentId);
  if (!student) return { allowed: false as const, status: 404, error: "Active camper not found." };

  const oldRoom = student.cabin ?? "";

  const assignResult = await assignCampStudent(session, context, { studentId: input.studentId, cabin: proposedRoom });
  if (!assignResult.allowed) return assignResult;

  const audit = await recordCampEmmaAction(session, {
    actor: access.actor,
    studentId: student.id,
    studentName: student.name,
    oldRoom,
    newRoom: proposedRoom,
    source: "emma",
    originalRequest: input.originalRequest,
    model: input.model,
    deployment: input.deployment
  });

  return { allowed: true as const, status: 200, student: assignResult.student, audit };
}

async function recordCampEmmaAction(
  session: AuthSession,
  input: Omit<CampEmmaActionAudit, "id" | "createdAt">
): Promise<CampEmmaActionAudit> {
  const createdAt = new Date().toISOString();

  if (shouldUseMock(session)) {
    return mockStore.recordCampEmmaAction({ id: randomUUID(), createdAt, ...input });
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const row = {
    ...ministryScopeColumns(await resolveMinistryScope(session)),
    camp_id: basics.camp.id,
    camper_id: input.studentId,
    actor_name: input.actor,
    student_name: input.studentName,
    old_room: input.oldRoom,
    new_room: input.newRoom,
    source: input.source,
    original_request: input.originalRequest,
    model: input.model,
    deployment: input.deployment
  };
  const { data, error } = await supabase
    .from("camp_emma_actions")
    .insert(row)
    .select("id, created_at")
    .single<{ id: string; created_at: string }>();
  throwIfSupabaseError(error);

  return { id: data?.id ?? randomUUID(), createdAt: data?.created_at ?? createdAt, ...input };
}

export async function archiveCampStudent(session: AuthSession, context: CampAccessContext, input: CampArchiveInput) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.archiveCampStudent(context.effectiveRole, input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_campers")
    .update({
      archived_at: new Date().toISOString(),
      archived_by_user_id: session.user.id,
      archive_reason: input.archiveReason?.trim() || ""
    })
    .eq("id", input.studentId)
    .is("archived_at", null)
    .select("*")
    .single<CampCamperRow>();

  throwIfSupabaseError(error);
  if (!data) return { allowed: true as const, status: 404, error: "Active camper not found." };
  return { allowed: true as const, status: 200, student: toCampStudentPublic(data) };
}

export async function restoreCampStudent(session: AuthSession, context: CampAccessContext, input: { studentId: string }) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.restoreCampStudent(context.effectiveRole, input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_campers")
    .update({ archived_at: null, archived_by_user_id: null, archive_reason: "" })
    .eq("id", input.studentId)
    .not("archived_at", "is", null)
    .select("*")
    .single<CampCamperRow>();

  throwIfSupabaseError(error);
  if (!data) return { allowed: true as const, status: 404, error: "Archived camper not found." };
  return { allowed: true as const, status: 200, student: toCampStudentPublic(data) };
}

export async function getRestrictedCampMedicalPayload(session: AuthSession, context: CampAccessContext) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.getRestrictedCampMedicalPayload(context.effectiveRole);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const campers = await getCampersById(session, basics.camp.id);
  const { data, error } = await supabase
    .from("camp_restricted_medical_records")
    .select("*")
    .eq("camp_id", basics.camp.id)
    .order("updated_at", { ascending: false })
    .returns<CampRestrictedMedicalRow[]>();

  throwIfSupabaseError(error);
  const activeCamperIds = new Set(campers.keys());
  return {
    allowed: true as const,
    status: 200,
    records: (data ?? []).filter((row) => activeCamperIds.has(row.camper_id)).map((row) => toRestrictedMedicalRecord(row, campers))
  };
}

export async function upsertRestrictedMedicalRecord(
  session: AuthSession,
  context: CampAccessContext,
  input: CampRestrictedMedicalRecord
) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.upsertRestrictedMedicalRecord(context.effectiveRole, input);

  await requireActiveCamper(session, input.studentId);
  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const row = {
    ...ministryScopeColumns(await resolveMinistryScope(session)),
    camp_id: basics.camp.id,
    camper_id: input.studentId,
    medical_form_status: input.medicalFormStatus,
    restricted_notes: input.restrictedNotes,
    allergy_notes: input.allergyNotes,
    insurance_status: input.insuranceStatus,
    parent_medical_notes: input.parentMedicalNotes,
    emergency_contact_name: input.emergencyContactName ?? "",
    emergency_contact_phone: input.emergencyContactPhone ?? "",
    emergency_contact_relationship: input.emergencyContactRelationship ?? "",
    guardian_name: input.guardianName ?? "",
    guardian_phone: input.guardianPhone ?? "",
    dietary_requirements: input.dietaryRequirements ?? ""
  };
  const { data, error } = await supabase
    .from("camp_restricted_medical_records")
    .upsert(row, { onConflict: "camp_id,camper_id" })
    .select("*")
    .single<CampRestrictedMedicalRow>();

  throwIfSupabaseError(error);
  if (!data) throw new Error("Restricted medical write returned no row.");
  await refreshCamperRestrictedFlags(session, input.studentId);
  return { allowed: true as const, status: 200, record: toRestrictedMedicalRecord(data, await getCampersById(session, basics.camp.id)) };
}

export async function getRestrictedCampMedicationPayload(session: AuthSession, context: CampAccessContext, options: { includeArchived?: boolean } = {}) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.getRestrictedCampMedicationPayload(context.effectiveRole, options);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const campers = await getCampersById(session, basics.camp.id);
  const [checkIn, schedule, logs, returns, intake, photos, intakeSessions, administrationEvents, administrationItems] = await Promise.all([
    supabase.from("camp_medication_records").select("*").eq("camp_id", basics.camp.id).order("updated_at", { ascending: false }).returns<CampMedicationRow[]>(),
    supabase.from("camp_medication_schedule_items").select("*").eq("camp_id", basics.camp.id).order("created_at", { ascending: false }).returns<CampMedicationScheduleRow[]>(),
    supabase.from("camp_medication_administration_logs").select("*").eq("camp_id", basics.camp.id).order("logged_at", { ascending: false }).returns<CampMedicationLogRow[]>(),
    supabase.from("camp_medication_return_items").select("*").eq("camp_id", basics.camp.id).order("updated_at", { ascending: false }).returns<CampMedicationReturnRow[]>(),
    supabase.from("camp_medication_intake_records").select("*").eq("camp_id", basics.camp.id).order("received_at", { ascending: false }).returns<CampMedicationIntakeRow[]>(),
    supabase.from("camp_medication_photo_records").select("medication_record_id").eq("camp_id", basics.camp.id).returns<Array<{ medication_record_id: string }>>(),
    supabase.from("camp_medication_intake_sessions").select("*").eq("camp_id", basics.camp.id).order("received_at", { ascending: false }).returns<CampMedicationIntakeSessionRow[]>(),
    supabase.from("camp_medication_administration_events").select("*").eq("camp_id", basics.camp.id).order("administered_at", { ascending: false }).returns<CampMedicationAdministrationEventRow[]>(),
    supabase.from("camp_medication_administration_items").select("*").eq("camp_id", basics.camp.id).order("created_at", { ascending: false }).returns<CampMedicationAdministrationItemRow[]>()
  ]);

  throwIfSupabaseError(checkIn.error);
  throwIfSupabaseError(schedule.error);
  throwIfSupabaseError(logs.error);
  throwIfSupabaseError(returns.error);
  throwIfSupabaseError(intake.error);
  throwIfSupabaseError(photos.error);
  const groupedSchemaErrors = [intakeSessions.error, administrationEvents.error, administrationItems.error];
  const missingGroupedSchema = groupedSchemaErrors.every(isMissingMedicationWorkflowTableError);
  if (!missingGroupedSchema) {
    throwIfSupabaseError(intakeSessions.error);
    throwIfSupabaseError(administrationEvents.error);
    throwIfSupabaseError(administrationItems.error);
  }

  const medication = buildRestrictedCampMedicationPayloadFromRows({
    campers,
    checkInRows: checkIn.data ?? [],
    scheduleRows: schedule.data ?? [],
    logRows: logs.data ?? [],
    returnRows: returns.data ?? [],
    intakeRows: intake.data ?? [],
    photoRows: photos.data ?? [],
    intakeSessionRows: missingGroupedSchema ? [] : intakeSessions.data ?? [],
    administrationEventRows: missingGroupedSchema ? [] : administrationEvents.data ?? [],
    administrationItemRows: missingGroupedSchema ? [] : administrationItems.data ?? [],
    includeArchived: options.includeArchived
  });
  logEmptyRestrictedMedicationPayloadDiagnostic({
    campId: basics.camp.id,
    activeCamperCount: campers.size,
    includeArchived: Boolean(options.includeArchived),
    rawCounts: {
      checkIn: checkIn.data?.length ?? 0,
      schedule: schedule.data?.length ?? 0,
      administrationLog: logs.data?.length ?? 0,
      returnChecklist: returns.data?.length ?? 0,
      intakeHistory: intake.data?.length ?? 0,
      photos: photos.data?.length ?? 0
    },
    mappedCounts: countMedicationPayloadRows(medication)
  });

  return {
    allowed: true as const,
    status: 200,
    ...medication
  };
}

export async function getCampStaffManagementPayload(session: AuthSession, context: CampAccessContext) {
  const access = assertAllCampersOperationalWriteAccess(context, "Camp leader detail management");
  if (!access.allowed) return access;
  const overview = await getCampOverview(session, context);
  return {
    allowed: true as const,
    status: 200,
    staff: overview.staff,
    teams: overview.teams
  };
}

export async function updateCampStaffMember(session: AuthSession, context: CampAccessContext, input: CampStaffInput & { id: string }) {
  const access = assertAllCampersOperationalWriteAccess(context, "Camp leader detail management");
  if (!access.allowed) return deniedCampMutation(session, context, "staff.write", "camp_staff", input.id, access.error);
  if (!input.name.trim()) return { allowed: true as const, status: 400, error: "Staff display name is required." };
  if (input.role !== undefined && !isCampStaffRole(input.role)) return { allowed: true as const, status: 400, error: "Choose a valid staff role." };
  if (shouldUseMock(session)) return mockStore.updateCampStaffMember(input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const teamId = input.teamId !== undefined ? input.teamId.trim() || null : undefined;
  if (teamId !== undefined && teamId && !basics.teams.some((team) => team.id === teamId)) {
    return { allowed: true as const, status: 400, error: "Choose an active Camp team for this staff member." };
  }

  const coreUpdate: Partial<CampStaffRow> = {
    name: input.name.trim(),
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(teamId !== undefined ? { team_id: teamId } : {})
  };
  const optionalUpdate: Partial<CampStaffRow> = {
    ...(input.shirtSize !== undefined ? { shirt_size: input.shirtSize.trim() } : {}),
    ...(input.profilePhotoUrl !== undefined ? { profile_photo_url: sanitizeProfilePhotoUrl(input.profilePhotoUrl) ?? "" } : {}),
    ...(input.sourceChurch !== undefined ? { source_church: input.sourceChurch.trim() } : {})
  };

  const firstUpdate = await supabase
    .from("camp_staff")
    .update({ ...coreUpdate, ...optionalUpdate })
    .eq("camp_id", basics.camp.id)
    .eq("id", input.id)
    .is("archived_at", null)
    .select("*")
    .maybeSingle<CampStaffRow>();

  let data = firstUpdate.data;
  let warning: string | undefined;
  if (isMissingOptionalStaffColumnError(firstUpdate.error)) {
    const fallbackUpdate = await supabase
      .from("camp_staff")
      .update(coreUpdate)
      .eq("camp_id", basics.camp.id)
      .eq("id", input.id)
      .is("archived_at", null)
      .select("*")
      .maybeSingle<CampStaffRow>();
    throwIfSupabaseError(fallbackUpdate.error);
    data = fallbackUpdate.data;
    warning = "Basic staff details saved, but one or more optional fields could not be saved because the production schema is missing a column. Apply migration 020 or reload the Supabase schema cache to restore optional staff fields.";
  } else {
    throwIfSupabaseError(firstUpdate.error);
  }

  if (!data) return { allowed: true as const, status: 404, error: "Active Camp staff member not found." };
  return { allowed: true as const, status: 200, staff: toCampStaff(data, basics.teams), warning, optionalFieldsDropped: Boolean(warning) };
}

export function buildRestrictedCampMedicationPayloadFromRows(input: {
  campers: Map<string, CampStudentPublic>;
  checkInRows: CampMedicationRow[];
  scheduleRows: CampMedicationScheduleRow[];
  logRows: CampMedicationLogRow[];
  returnRows: CampMedicationReturnRow[];
  intakeRows: CampMedicationIntakeRow[];
  photoRows: Array<{ medication_record_id: string }>;
  intakeSessionRows?: CampMedicationIntakeSessionRow[];
  administrationEventRows?: CampMedicationAdministrationEventRow[];
  administrationItemRows?: CampMedicationAdministrationItemRow[];
  includeArchived?: boolean;
}) {
  const activeCamperIds = new Set(input.campers.keys());
  const allIntakeRows = retainWorkflowRowsWhenCamperLookupIsEmpty(input.intakeRows, activeCamperIds);
  const allCheckInRows = retainWorkflowRowsWhenCamperLookupIsEmpty(input.checkInRows, activeCamperIds);
  const allScheduleRows = retainWorkflowRowsWhenCamperLookupIsEmpty(input.scheduleRows, activeCamperIds);
  const allLogRows = retainWorkflowRowsWhenCamperLookupIsEmpty(input.logRows, activeCamperIds);
  const allReturnRows = retainWorkflowRowsWhenCamperLookupIsEmpty(input.returnRows, activeCamperIds);
  const allIntakeSessionRows = retainWorkflowRowsWhenCamperLookupIsEmpty(input.intakeSessionRows ?? [], activeCamperIds);
  const allAdministrationEventRows = retainWorkflowRowsWhenCamperLookupIsEmpty(input.administrationEventRows ?? [], activeCamperIds);
  const allAdministrationItemRows = retainWorkflowRowsWhenCamperLookupIsEmpty(input.administrationItemRows ?? [], activeCamperIds);
  const intakeRows = visibleMedicationHistoryRows(allIntakeRows, input.includeArchived);
  const intakeSessionRows = visibleMedicationHistoryRows(allIntakeSessionRows, input.includeArchived);
  const logRows = visibleMedicationHistoryRows(allLogRows, input.includeArchived);
  const activeIntakeRows = activeAuditRows(allIntakeRows, "supersedes_intake_id").filter((row) => !row.archived_at);
  const activeIntakeHistory = activeIntakeRows.map((item) => toMedicationIntakeRecord(item, input.campers));
  const intakeHistory = intakeRows.map((row) => toMedicationIntakeRecord(row, input.campers, auditStatusFor(row, intakeRows, "supersedes_intake_id")));
  const medicationIdsWithPhotoRecords = new Set(input.photoRows.map((row) => row.medication_record_id));

  return {
    campers: Array.from(input.campers.values()),
    checkIn: activeAuditRows(allCheckInRows, "supersedes_medication_record_id")
      .map((row) => toMedicationRecord(row, input.campers, activeIntakeHistory, auditStatusFor(row, allCheckInRows, "supersedes_medication_record_id"), medicationIdsWithPhotoRecords.has(row.id))),
    schedule: activeAuditRows(allScheduleRows, "supersedes_schedule_item_id")
      .map((row) => toScheduleItem(row, input.campers, auditStatusFor(row, allScheduleRows, "supersedes_schedule_item_id"))),
    administrationLog: logRows.map((row) => toAdministrationLog(row, input.campers, auditStatusFor(row, logRows, "supersedes_administration_log_id"))),
    administrationEvents: allAdministrationEventRows.map((row) => toAdministrationEvent(row, input.campers)),
    administrationItems: allAdministrationItemRows.map((row) => toAdministrationItem(row, input.campers)),
    returnChecklist: activeAuditRows(allReturnRows, "supersedes_return_item_id")
      .map((row) => toReturnItem(row, input.campers, auditStatusFor(row, allReturnRows, "supersedes_return_item_id"))),
    intakeHistory,
    intakeSessions: intakeSessionRows.map((row) => toMedicationIntakeSession(row, input.campers))
  };
}

function countMedicationPayloadRows(payload: {
  checkIn: unknown[];
  schedule: unknown[];
  administrationLog: unknown[];
  returnChecklist: unknown[];
  intakeHistory: unknown[];
}) {
  return {
    checkIn: payload.checkIn.length,
    schedule: payload.schedule.length,
    administrationLog: payload.administrationLog.length,
    returnChecklist: payload.returnChecklist.length,
    intakeHistory: payload.intakeHistory.length
  };
}

function logEmptyRestrictedMedicationPayloadDiagnostic(input: {
  campId: string;
  activeCamperCount: number;
  includeArchived: boolean;
  rawCounts: ReturnType<typeof countMedicationPayloadRows> & { photos: number };
  mappedCounts: ReturnType<typeof countMedicationPayloadRows>;
}) {
  if (process.env.NODE_ENV !== "production") return;
  const mappedTotal = Object.values(input.mappedCounts).reduce((sum, count) => sum + count, 0);
  if (mappedTotal > 0) return;
  console.warn("[camp-medication] Empty restricted medication workflow payload", input);
}

export async function saveMedicationIntake(session: AuthSession, context: CampAccessContext, input: CampMedicationIntakeInput) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  assertSignature(input.guardianSignatureData);
  if (!input.confirmationAcknowledged) throw new Error("Medication intake confirmation is required.");
  if (shouldUseMock(session)) return mockStore.saveMedicationIntake(context.effectiveRole, { ...input, receivedByName: input.receivedByName || access.actor });

  await requireActiveCamper(session, input.studentId);
  const clarificationStatus = mockStore.normalizeClarification(input.clarificationStatus, input.parentInstructions);
  const medicationPayload = await upsertMedicationRecord(session, context, {
    id: input.medicationRecordId,
    studentId: input.studentId,
    medicationName: input.medicationName,
    parentProvidedInstructions: input.parentInstructions,
    checkInStatus: clarificationStatus === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Checked In",
    quantityRemaining: input.quantityReceived,
    scheduleType: medicationScheduleType(input.scheduleText),
    isPrn: medicationScheduleType(input.scheduleText) === "prn",
    receivedBy: input.receivedByName || access.actor,
    receivedAt: input.receivedAt,
    clarificationStatus
  });
  if (!medicationPayload.allowed) return medicationPayload;

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const row = {
    ...ministryScopeColumns(await resolveMinistryScope(session)),
    camp_id: basics.camp.id,
    camper_id: input.studentId,
    medication_record_id: medicationPayload.record.id,
    medication_name: medicationPayload.record.medicationName,
    dose: input.dose.trim(),
    schedule_text: input.scheduleText.trim(),
    parent_instructions: input.parentInstructions.trim() || "Needs Parent Clarification.",
    staff_notes: input.staffNotes.trim(),
    quantity_received: input.quantityReceived.trim(),
    container_status: input.containerStatus.trim(),
    received_by_user_id: session.user.id,
    received_by_name: input.receivedByName.trim() || access.actor,
    received_at: input.receivedAt || new Date().toISOString(),
    guardian_name: input.guardianName.trim(),
    guardian_relationship: input.guardianRelationship.trim(),
    guardian_signature_data: input.guardianSignatureData,
    signature_format: "json_strokes_v1",
    clarification_status: clarificationStatus,
    confirmation_acknowledged: true,
    supersedes_intake_id: input.supersedesIntakeId || null,
    correction_note: input.correctionNote?.trim() || ""
  };

  const { data, error } = await supabase
    .from("camp_medication_intake_records")
    .insert(row)
    .select("*")
    .single<CampMedicationIntakeRow>();

  throwIfSupabaseError(error);
  if (!data) throw new Error("Medication intake write returned no row.");
  await refreshCamperRestrictedFlags(session, input.studentId);
  const scheduleItems = await ensureMedicationScheduleItemsForIntake(session, context, medicationPayload.record.id, input.scheduleText, input.parentInstructions);
  const campers = await getCampersById(session, basics.camp.id);
  const intake = toMedicationIntakeRecord(data, campers);
  return {
    allowed: true as const,
    status: 201,
    intake,
    record: { ...medicationPayload.record, latestQuantityReceived: intake.quantityReceived, latestIntakeAt: intake.receivedAt },
    scheduleItems
  };
}

export async function saveMedicationIntakeSession(session: AuthSession, context: CampAccessContext, input: CampMedicationIntakeSessionInput) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  assertSignature(input.guardianSignatureData);
  if (!input.confirmationAcknowledged) throw new Error("Medication intake confirmation is required.");
  if (!input.medications.length) throw new Error("Add at least one medication before completing intake.");
  const medicationValidationError = medicationIntakeSessionValidationError(input.medications);
  if (medicationValidationError) throw new Error(medicationValidationError);
  if (shouldUseMock(session)) return mockStore.saveMedicationIntakeSession(context.effectiveRole, { ...input, receivedByName: input.receivedByName || access.actor });

  const camper = await findActiveCamper(session, input.studentId);
  if (!camper) return { allowed: true as const, status: 404, error: "Camper not found." };
  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const receivedAt = input.receivedAt || new Date().toISOString();
  const { data: sessionRow, error: sessionError } = await supabase
    .from("camp_medication_intake_sessions")
    .insert({
      ...ministryScopeColumns(await resolveMinistryScope(session)),
      camp_id: basics.camp.id,
      camper_id: camper.id,
      received_by_user_id: session.user.id,
      received_by_name: input.receivedByName.trim() || access.actor,
      received_at: receivedAt,
      guardian_name: input.guardianName.trim(),
      guardian_relationship: input.guardianRelationship.trim(),
      guardian_signature_data: input.guardianSignatureData,
      signature_format: "json_strokes_v1",
      status: "completed",
      notes: input.notes?.trim() || "",
      medication_count: input.medications.length
    })
    .select("*")
    .single<CampMedicationIntakeSessionRow>();
  throwIfSupabaseError(sessionError);
  if (!sessionRow) throw new Error("Medication intake session write returned no row.");

  const intakes: CampMedicationIntakeRecord[] = [];
  const records: CampMedicationRecord[] = [];
  const scheduleItems: CampMedicationScheduleItem[] = [];
  const campers = await getCampersById(session, basics.camp.id);

  for (const medicationInput of input.medications) {
    if (!medicationInput.medicationName.trim() || !medicationInput.dose.trim() || !medicationInput.quantityReceived.trim() || !medicationInput.parentInstructions.trim()) {
      throw new Error("Each medication row needs name, dose, quantity, and instructions before completing intake.");
    }
    const scheduleType = medicationInput.scheduleType ?? medicationScheduleType(medicationInput.scheduleText);
    const clarificationStatus = mockStore.normalizeClarification(medicationInput.clarificationStatus, medicationInput.parentInstructions);
    const medicationPayload = await upsertMedicationRecord(session, context, {
      id: medicationInput.medicationRecordId,
      studentId: camper.id,
      medicationName: medicationInput.medicationName,
      parentProvidedInstructions: medicationInput.parentInstructions,
      checkInStatus: clarificationStatus === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Checked In",
      quantityRemaining: medicationInput.quantityReceived,
      scheduleType,
      isPrn: medicationInput.isPrn ?? scheduleType === "prn",
      receivedBy: sessionRow.received_by_name,
      receivedAt,
      clarificationStatus,
      correctionNote: medicationInput.correctionNote
    });
    if (!medicationPayload.allowed) return medicationPayload;

    const { data, error } = await supabase
      .from("camp_medication_intake_records")
      .insert({
        ...ministryScopeColumns(await resolveMinistryScope(session)),
        camp_id: basics.camp.id,
        camper_id: camper.id,
        medication_record_id: medicationPayload.record.id,
        intake_session_id: sessionRow.id,
        medication_name: medicationPayload.record.medicationName,
        dose: medicationInput.dose.trim(),
        schedule_text: medicationInput.scheduleText.trim(),
        parent_instructions: medicationInput.parentInstructions.trim(),
        staff_notes: medicationInput.staffNotes?.trim() || "",
        quantity_received: medicationInput.quantityReceived.trim(),
        container_status: medicationInput.containerStatus.trim() || "Original labeled container received",
        received_by_user_id: session.user.id,
        received_by_name: sessionRow.received_by_name,
        received_at: receivedAt,
        guardian_name: sessionRow.guardian_name,
        guardian_relationship: sessionRow.guardian_relationship,
        guardian_signature_data: sessionRow.guardian_signature_data,
        signature_format: "json_strokes_v1",
        clarification_status: clarificationStatus,
        confirmation_acknowledged: true,
        correction_note: medicationInput.correctionNote?.trim() || ""
      })
      .select("*")
      .single<CampMedicationIntakeRow>();
    throwIfSupabaseError(error);
    if (!data) throw new Error("Medication intake write returned no row.");
    await refreshCamperRestrictedFlags(session, camper.id);
    const intake = toMedicationIntakeRecord(data, campers);
    intakes.push(intake);
    records.push({ ...medicationPayload.record, latestQuantityReceived: intake.quantityReceived, latestIntakeAt: intake.receivedAt });
    if (scheduleType !== "prn") {
      scheduleItems.push(...await ensureMedicationScheduleItemsForIntake(session, context, medicationPayload.record.id, medicationInput.scheduleText, medicationInput.parentInstructions));
    }
  }

  return { allowed: true as const, status: 201, session: toMedicationIntakeSession(sessionRow, campers), intakes, records, scheduleItems };
}

export async function upsertMedicationRecord(
  session: AuthSession,
  context: CampAccessContext,
  input: Partial<CampMedicationRecord> & { studentId: string }
) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.upsertMedicationRecord(context.effectiveRole, { ...input, receivedBy: input.receivedBy ?? access.actor });

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  let existingMedication: CampMedicationRow | undefined;
  if (input.id && !input.supersedesMedicationRecordId) {
    const existing = await requireMedication(session, input.id);
    existingMedication = existing;
    await requireActiveCamper(session, existing.camper_id);
  }
  if (!input.id || input.supersedesMedicationRecordId) await requireActiveCamper(session, input.studentId);
  const clarificationStatus = mockStore.normalizeClarification(input.clarificationStatus, input.parentProvidedInstructions);
  const checkInStatus = mockStore.normalizeCheckInStatus(input.checkInStatus, clarificationStatus);
  const medicinePhotoStatus = input.supersedesMedicationRecordId ? "Photo Needed" : input.medicinePhotoStatus ?? "Photo Needed";
  const row = {
    medication_name: input.medicationName?.trim() || "Parent-labeled medication",
    medicine_photo_status: medicinePhotoStatus,
    parent_provided_instructions: input.parentProvidedInstructions?.trim() || existingMedication?.parent_provided_instructions || "Needs Parent Clarification.",
    check_in_status: checkInStatus,
    ...(input.quantityRemaining !== undefined || !existingMedication ? { quantity_remaining: input.quantityRemaining?.trim() || existingMedication?.quantity_remaining || null } : {}),
    ...(input.scheduleType !== undefined || input.parentProvidedInstructions !== undefined || !existingMedication ? { schedule_type: input.scheduleType ?? existingMedication?.schedule_type ?? medicationScheduleType(input.parentProvidedInstructions) } : {}),
    ...(input.isPrn !== undefined || input.scheduleType !== undefined || input.parentProvidedInstructions !== undefined || !existingMedication ? { is_prn: input.isPrn ?? existingMedication?.is_prn ?? medicationScheduleType(input.parentProvidedInstructions) === "prn" } : {}),
    received_by: checkInStatus === "Checked In" ? input.receivedBy ?? access.actor : input.receivedBy ?? null,
    received_at: checkInStatus === "Checked In" ? input.receivedAt ?? new Date().toISOString() : input.receivedAt ?? null,
    clarification_status: clarificationStatus,
    supersedes_medication_record_id: input.supersedesMedicationRecordId || null,
    correction_note: input.correctionNote?.trim() || ""
  };
  const result = input.id && !input.supersedesMedicationRecordId
    ? await supabase.from("camp_medication_records").update(row).eq("id", input.id).select("*").single<CampMedicationRow>()
    : await supabase.from("camp_medication_records").insert({
        ...ministryScopeColumns(await resolveMinistryScope(session)),
        camp_id: basics.camp.id,
        camper_id: input.studentId,
        ...row
      }).select("*").single<CampMedicationRow>();

  throwIfSupabaseError(result.error);
  if (!result.data) throw new Error("Medication write returned no row.");
  await ensureReturnChecklist(session, basics.camp.id, result.data, clarificationStatus);
  await refreshCamperRestrictedFlags(session, result.data.camper_id);
  return { allowed: true as const, status: 200, record: toMedicationRecord(result.data, await getCampersById(session, basics.camp.id)) };
}

export async function upsertMedicationScheduleItem(
  session: AuthSession,
  context: CampAccessContext,
  input: Partial<CampMedicationScheduleItem> & { medicationRecordId: string; timeWindow: string }
) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.upsertMedicationScheduleItem(context.effectiveRole, input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const medication = await requireMedication(session, input.medicationRecordId);
  await requireActiveCamper(session, medication.camper_id);
  const parentInstructions = input.parentProvidedInstructions?.trim() || medication.parent_provided_instructions || "Needs Parent Clarification.";
  const status = mockStore.normalizeScheduleStatus(input.status, parentInstructions);
  const row = {
    medication_record_id: medication.id,
    camper_id: medication.camper_id,
    time_window: input.timeWindow.trim(),
    parent_provided_instructions: parentInstructions,
    status,
    supersedes_schedule_item_id: input.supersedesScheduleItemId || null,
    correction_note: input.correctionNote?.trim() || ""
  };
  const result = input.id && !input.supersedesScheduleItemId
    ? await supabase.from("camp_medication_schedule_items").update(row).eq("id", input.id).select("*").single<CampMedicationScheduleRow>()
    : await supabase.from("camp_medication_schedule_items").insert({
        ...ministryScopeColumns(await resolveMinistryScope(session)),
        camp_id: basics.camp.id,
        ...row
      }).select("*").single<CampMedicationScheduleRow>();

  throwIfSupabaseError(result.error);
  if (!result.data) throw new Error("Medication schedule write returned no row.");
  await refreshCamperRestrictedFlags(session, result.data.camper_id);
  return { allowed: true as const, status: 200, item: toScheduleItem(result.data, await getCampersById(session, basics.camp.id)) };
}

async function ensureMedicationScheduleItemsForIntake(
  session: AuthSession,
  context: CampAccessContext,
  medicationRecordId: string,
  scheduleText: string,
  parentProvidedInstructions: string
): Promise<CampMedicationScheduleItem[]> {
  const timeWindows = parseMedicationScheduleText(scheduleText);
  if (!timeWindows.length) return [];

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const { data, error } = await supabase
    .from("camp_medication_schedule_items")
    .select("*")
    .eq("camp_id", basics.camp.id)
    .eq("medication_record_id", medicationRecordId)
    .is("voided_at", null)
    .is("archived_at", null)
    .returns<CampMedicationScheduleRow[]>();

  throwIfSupabaseError(error);
  const rows = data ?? [];
  const supersededIds = new Set(rows.map((row) => row.supersedes_schedule_item_id).filter(Boolean));
  const existingWindows = new Set(
    rows
      .filter((row) => !supersededIds.has(row.id))
      .map((row) => row.time_window.trim().toLowerCase())
  );
  const created: CampMedicationScheduleItem[] = [];

  for (const timeWindow of timeWindows) {
    const key = timeWindow.trim().toLowerCase();
    if (!key || existingWindows.has(key)) continue;
    const payload = await upsertMedicationScheduleItem(session, context, {
      medicationRecordId,
      timeWindow,
      parentProvidedInstructions
    });
    if (!payload.allowed) throw new Error(payload.error);
    created.push(payload.item);
    existingWindows.add(key);
  }

  return created;
}

export async function saveMedicationPhoto(
  session: AuthSession,
  context: CampAccessContext,
  input: { medicationRecordId: string; file: File; intakeRecordId?: string }
) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;

  const contentType = input.file.type || "application/octet-stream";
  const fileSize = input.file.size;
  assertMedicationPhotoFile(contentType, fileSize);

  if (shouldUseMock(session)) {
    const buffer = Buffer.from(await input.file.arrayBuffer());
    return mockStore.saveMedicationPhoto(context.effectiveRole, {
      medicationRecordId: input.medicationRecordId,
      intakeRecordId: input.intakeRecordId,
      contentType,
      fileSize,
      mockSignedUrl: `data:${contentType};base64,${buffer.toString("base64")}`
    });
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const medication = await requireMedication(session, input.medicationRecordId);
  const camper = await requireActiveCamper(session, medication.camper_id);
  if (medication.camper_id !== camper.id) throw new Error("Medication record does not match camper.");
  const intake = input.intakeRecordId ? await requireMedicationIntake(session, input.intakeRecordId) : undefined;
  if (intake && (intake.medication_record_id !== medication.id || intake.camper_id !== camper.id)) {
    throw new Error("Medication photo intake link does not match the selected medication record.");
  }

  const photoId = randomUUID();
  const extension = extensionForContentType(contentType);
  const objectPath = `ministry/${camper.ministry_id}/camp/${basics.camp.id}/medication/${medication.id}/${photoId}.${extension}`;
  const upload = await supabase.storage.from("camp-medication-photos").upload(objectPath, input.file, {
    contentType,
    upsert: false
  });
  if (upload.error) throw upload.error;

  const { data, error } = await supabase
    .from("camp_medication_photo_records")
    .insert({
      id: photoId,
      ...ministryScopeColumns(await resolveMinistryScope(session)),
      camp_id: basics.camp.id,
      camper_id: camper.id,
      medication_record_id: medication.id,
      ...(intake ? { intake_record_id: intake.id } : {}),
      storage_bucket: "camp-medication-photos",
      storage_object_path: objectPath,
      content_type: contentType,
      file_size: fileSize,
      uploaded_by_user_id: session.user.id
    })
    .select("*")
    .single<CampMedicationPhotoRow>();

  if (error) {
    await supabase.storage.from("camp-medication-photos").remove([objectPath]);
    throwIfSupabaseError(error);
  }
  if (!data) throw new Error("Medication photo write returned no row.");

  const update = await supabase.from("camp_medication_records").update({ medicine_photo_status: "Photo On File" }).eq("id", medication.id);
  throwIfSupabaseError(update.error);
  return {
    allowed: true as const,
    status: 201,
    photo: toMedicationPhotoRecord(data, new Map([[camper.id, toCampStudentPublic(camper)]])),
    record: toMedicationRecord({ ...medication, medicine_photo_status: "Photo On File" }, new Map([[camper.id, toCampStudentPublic(camper)]]), [], undefined, true)
  };
}

export async function getMedicationPhotoAccess(session: AuthSession, context: CampAccessContext, medicationRecordId: string) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.getMedicationPhotoAccess(context.effectiveRole, medicationRecordId);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const medication = await requireMedication(session, medicationRecordId);
  const camper = await requireActiveCamper(session, medication.camper_id);
  const { data, error } = await supabase
    .from("camp_medication_photo_records")
    .select("*")
    .eq("medication_record_id", medication.id)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle<CampMedicationPhotoRow & { storage_bucket: string; storage_object_path: string }>();

  throwIfSupabaseError(error);
  if (!data) return { allowed: true as const, status: 404, error: "Medication photo not found." };

  const signed = await supabase.storage.from(data.storage_bucket).createSignedUrl(data.storage_object_path, 60);
  if (signed.error) throw signed.error;
  return {
    allowed: true as const,
    status: 200,
    signedUrl: signed.data.signedUrl,
    photo: toMedicationPhotoRecord(data, new Map([[camper.id, toCampStudentPublic(camper)]]))
  };
}

export async function logMedicationAdministration(
  session: AuthSession,
  context: CampAccessContext,
  input: {
    scheduleItemId: string;
    loggedBy: string;
    status: CampMedicationAdministrationLog["status"];
    notes?: string;
    studentAcknowledgementInitials?: string;
    studentAcknowledgementUnavailable?: boolean;
    studentAcknowledgementUnavailableReason?: string;
    supersedesAdministrationLogId?: string;
    correctionNote?: string;
  }
) {
  const access = assertCampMedicalCommandAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.logMedicationAdministration(context.effectiveRole, input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const { data: scheduleItem, error: scheduleError } = await supabase
    .from("camp_medication_schedule_items")
    .select("*")
    .eq("id", input.scheduleItemId)
    .single<CampMedicationScheduleRow>();
  throwIfSupabaseError(scheduleError);
  if (!scheduleItem) return { allowed: true as const, status: 404, error: "Medication schedule item not found." };
  await requireActiveCamper(session, scheduleItem.camper_id);

  const status = mockStore.normalizeAdministrationStatus(input.status, input.notes);
  const acknowledgement = normalizeStudentAcknowledgement(input);
  const loggedAt = new Date().toISOString();
  const { data, error } = await supabase.from("camp_medication_administration_logs").insert({
    ...ministryScopeColumns(await resolveMinistryScope(session)),
    camp_id: basics.camp.id,
    medication_record_id: scheduleItem.medication_record_id,
    schedule_item_id: scheduleItem.id,
    camper_id: scheduleItem.camper_id,
    time_window: scheduleItem.time_window,
    logged_at: loggedAt,
    logged_by: input.loggedBy.trim() || access.actor,
    status,
    notes: input.notes?.trim() || "Logged per parent-provided instructions.",
    student_acknowledgement_initials: acknowledgement.initials,
    student_acknowledgement_unavailable: acknowledgement.unavailable,
    student_acknowledgement_unavailable_reason: acknowledgement.unavailableReason,
    supersedes_administration_log_id: input.supersedesAdministrationLogId || null,
    correction_note: input.correctionNote?.trim() || ""
  }).select("*").single<CampMedicationLogRow>();

  throwIfSupabaseError(error);
  if (!data) throw new Error("Medication log write returned no row.");

  const scheduleStatus = status === "Logged" ? "Logged" : status === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Pending";
  const updateResult = await supabase.from("camp_medication_schedule_items").update({
    status: scheduleStatus,
    last_logged_at: loggedAt,
    last_logged_by: data.logged_by
  }).eq("id", scheduleItem.id);
  throwIfSupabaseError(updateResult.error);
  await refreshCamperRestrictedFlags(session, data.camper_id);
  return { allowed: true as const, status: 200, log: toAdministrationLog(data, await getCampersById(session, basics.camp.id)) };
}

export async function logGroupedMedicationAdministration(session: AuthSession, context: CampAccessContext, input: CampMedicationGroupedAdministrationInput) {
  const access = assertCampMedicalCommandAccess(context);
  if (!access.allowed) return access;
  if (!input.items.length) throw new Error("Select at least one medication before submitting a med pass.");
  const timeWindow = input.timeWindow.trim();
  if (!timeWindow) throw new Error("Medication time block is required.");
  for (const item of input.items) {
    if (!isAdministrationItemStatus(item.status)) throw new Error("Medication item status is required.");
  }
  if (shouldUseMock(session)) return mockStore.logGroupedMedicationAdministration(context.effectiveRole, { ...input, timeWindow });

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const camper = await findActiveCamper(session, input.studentId);
  if (!camper) return { allowed: true as const, status: 404, error: "Camper not found." };
  const acknowledgement = normalizeStudentAcknowledgement(input);
  const administeredAt = input.administeredAt || new Date().toISOString();
  const administeredBy = input.administeredBy.trim() || access.actor;
  const validatedItems: Array<{
    input: CampMedicationGroupedAdministrationInput["items"][number];
    scheduleItem: CampMedicationScheduleRow;
    medication: CampMedicationRow;
    legacyStatus: CampMedicationAdministrationLog["status"];
    notes: string;
  }> = [];
  const seenScheduleItems = new Set<string>();

  for (const itemInput of input.items) {
    if (seenScheduleItems.has(itemInput.scheduleItemId)) {
      return { allowed: true as const, status: 400, error: "Medication item appears more than once in this med pass." };
    }
    seenScheduleItems.add(itemInput.scheduleItemId);

    const { data: scheduleItem, error: scheduleError } = await supabase
      .from("camp_medication_schedule_items")
      .select("*")
      .eq("id", itemInput.scheduleItemId)
      .maybeSingle<CampMedicationScheduleRow>();
    throwIfSupabaseError(scheduleError);
    if (!scheduleItem) return { allowed: true as const, status: 404, error: "Medication schedule item not found." };

    const medication = await findMedication(session, itemInput.medicationRecordId);
    if (!medication) return { allowed: true as const, status: 404, error: "Medication item not found." };

    if (scheduleItem.camper_id !== camper.id || scheduleItem.medication_record_id !== medication.id || scheduleItem.time_window !== timeWindow || medication.camper_id !== camper.id) {
      return { allowed: true as const, status: 400, error: "Medication item does not belong to this grouped med pass." };
    }

    validatedItems.push({
      input: itemInput,
      scheduleItem,
      medication,
      legacyStatus: administrationItemStatusToLegacy(itemInput.status),
      notes: itemInput.notes?.trim() || input.notes?.trim() || defaultAdministrationItemNote(itemInput.status)
    });
  }

  const { data: eventRow, error: eventError } = await supabase
    .from("camp_medication_administration_events")
    .insert({
      ...ministryScopeColumns(await resolveMinistryScope(session)),
      camp_id: basics.camp.id,
      camper_id: camper.id,
      administered_by_user_id: session.user.id,
      administered_by: administeredBy,
      administered_at: administeredAt,
      time_window: timeWindow,
      student_acknowledgement_initials: acknowledgement.initials,
      student_acknowledgement_unavailable: acknowledgement.unavailable,
      student_acknowledgement_unavailable_reason: acknowledgement.unavailableReason,
      notes: input.notes?.trim() || "",
      item_count: input.items.length
    })
    .select("*")
    .single<CampMedicationAdministrationEventRow>();
  throwIfSupabaseError(eventError);
  if (!eventRow) throw new Error("Medication administration event write returned no row.");

  const campers = await getCampersById(session, basics.camp.id);
  const items: CampMedicationAdministrationItem[] = [];
  const logs: CampMedicationAdministrationLog[] = [];

  for (const { input: itemInput, scheduleItem, medication, legacyStatus, notes } of validatedItems) {
    const { data: itemRow, error: itemError } = await supabase
      .from("camp_medication_administration_items")
      .insert({
        ...ministryScopeColumns(await resolveMinistryScope(session)),
        camp_id: basics.camp.id,
        administration_event_id: eventRow.id,
        medication_record_id: medication.id,
        schedule_item_id: scheduleItem.id,
        camper_id: camper.id,
        medication_name: medication.medication_name ?? "Parent-labeled medication",
        time_window: scheduleItem.time_window,
        status: itemInput.status,
        dose_given: itemInput.doseGiven?.trim() || "",
        administered_at: administeredAt,
        notes
      })
      .select("*")
      .single<CampMedicationAdministrationItemRow>();
    throwIfSupabaseError(itemError);
    if (!itemRow) throw new Error("Medication administration item write returned no row.");

    const { data: logRow, error: logError } = await supabase
      .from("camp_medication_administration_logs")
      .insert({
        ...ministryScopeColumns(await resolveMinistryScope(session)),
        camp_id: basics.camp.id,
        medication_record_id: scheduleItem.medication_record_id,
        schedule_item_id: scheduleItem.id,
        camper_id: scheduleItem.camper_id,
        administration_event_id: eventRow.id,
        administration_item_id: itemRow.id,
        time_window: scheduleItem.time_window,
        logged_at: administeredAt,
        logged_by: administeredBy,
        status: legacyStatus,
        notes,
        student_acknowledgement_initials: acknowledgement.initials,
        student_acknowledgement_unavailable: acknowledgement.unavailable,
        student_acknowledgement_unavailable_reason: acknowledgement.unavailableReason
      })
      .select("*")
      .single<CampMedicationLogRow>();
    throwIfSupabaseError(logError);
    if (!logRow) throw new Error("Medication log write returned no row.");

    const scheduleStatus = legacyStatus === "Logged" ? "Logged" : legacyStatus === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Pending";
    const updateSchedule = await supabase.from("camp_medication_schedule_items").update({
      status: scheduleStatus,
      last_logged_at: administeredAt,
      last_logged_by: administeredBy
    }).eq("id", scheduleItem.id);
    throwIfSupabaseError(updateSchedule.error);

    if (itemInput.status === "administered") {
      const updateMedication = await supabase.from("camp_medication_records").update({
        quantity_remaining: decrementQuantityText(medication.quantity_remaining ?? undefined)
      }).eq("id", medication.id);
      throwIfSupabaseError(updateMedication.error);
    }

    items.push(toAdministrationItem(itemRow, campers));
    logs.push(toAdministrationLog(logRow, campers));
  }

  await refreshCamperRestrictedFlags(session, camper.id);
  return { allowed: true as const, status: 200, event: toAdministrationEvent(eventRow, campers), items, logs };
}

function normalizeStudentAcknowledgement(input: {
  studentAcknowledgementInitials?: string;
  studentAcknowledgementUnavailable?: boolean;
  studentAcknowledgementUnavailableReason?: string;
}) {
  const unavailable = input.studentAcknowledgementUnavailable === true;
  const initials = input.studentAcknowledgementInitials?.trim() ?? "";
  const unavailableReason = input.studentAcknowledgementUnavailableReason?.trim() ?? "";
  if (unavailable) {
    if (!unavailableReason) throw new Error("Reason is required when the student is unavailable or declined to initial.");
    return { initials: "", unavailable: true, unavailableReason };
  }
  if (!initials) throw new Error("Student acknowledgement initials are required, or mark unavailable/declined with a reason.");
  if (initials.length > 64_000) throw new Error("Student acknowledgement is too large.");
  return { initials, unavailable: false, unavailableReason: "" };
}

export async function updateMedicationReturnItem(
  session: AuthSession,
  context: CampAccessContext,
  input: { id: string; returnStatus: CampMedicationReturnItem["returnStatus"]; returnedBy?: string; returnedAt?: string; recipientName?: string; recipientRelationship?: string; returnNotes?: string; supersedesReturnItemId?: string; correctionNote?: string }
) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.updateMedicationReturnItem(context.effectiveRole, input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const update = {
    return_status: input.returnStatus,
    returned_at: input.returnStatus === "Returned to Parent/Guardian" ? input.returnedAt || new Date().toISOString() : input.returnedAt ?? null,
    returned_by: input.returnedBy?.trim() || "",
    recipient_name: input.recipientName?.trim() || "",
    recipient_relationship: input.recipientRelationship?.trim() || "",
    return_notes: input.returnNotes?.trim() || "",
    supersedes_return_item_id: input.supersedesReturnItemId || null,
    correction_note: input.correctionNote?.trim() || ""
  };
  const current = await supabase.from("camp_medication_return_items").select("camper_id, medication_record_id").eq("id", input.id).single<{ camper_id: string; medication_record_id: string }>();
  throwIfSupabaseError(current.error);
  if (!current.data) return { allowed: true as const, status: 404, error: "Medication return item not found." };
  await requireActiveCamper(session, current.data.camper_id);

  const { data, error } = input.supersedesReturnItemId
    ? await supabase.from("camp_medication_return_items").insert({
        ...ministryScopeColumns(await resolveMinistryScope(session)),
        camp_id: basics.camp.id,
        medication_record_id: current.data.medication_record_id,
        camper_id: current.data.camper_id,
        ...update
      }).select("*").single<CampMedicationReturnRow>()
    : await supabase.from("camp_medication_return_items").update(update).eq("id", input.id).select("*").single<CampMedicationReturnRow>();
  throwIfSupabaseError(error);
  if (!data) return { allowed: true as const, status: 404, error: "Medication return item not found." };
  await refreshCamperRestrictedFlags(session, data.camper_id);
  return { allowed: true as const, status: 200, item: toReturnItem(data, await getCampersById(session, basics.camp.id)) };
}

export async function voidMedicationWorkflowItem(session: AuthSession, context: CampAccessContext, input: CampMedicationVoidInput) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (!input.voidReason.trim()) throw new Error("Void reason is required.");
  if (shouldUseMock(session)) return mockStore.voidMedicationWorkflowItem(context.effectiveRole, { ...input, voidedByName: input.voidedByName || access.actor });

  const supabase = getSupabaseAuthClient(session.accessToken);
  const table = tableForMedicationTarget(input.target);
  const update = {
    voided_at: new Date().toISOString(),
    voided_by_user_id: session.user.id,
    voided_by_name: input.voidedByName?.trim() || access.actor,
    void_reason: input.voidReason.trim()
  };
  const { data, error } = await supabase.from(table).update(update).eq("id", input.id).select("*").single();
  throwIfSupabaseError(error);
  if (!data) return { allowed: true as const, status: 404, error: "Medication workflow item not found." };

  const camperId = (data as { camper_id?: string }).camper_id;
  if (camperId) await refreshCamperRestrictedFlags(session, camperId);
  return { allowed: true as const, status: 200, item: data };
}

export async function archiveMedicationWorkflowItem(session: AuthSession, context: CampAccessContext, input: CampMedicationArchiveInput) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.archiveMedicationWorkflowItem(context.effectiveRole, { ...input, archivedByName: input.archivedByName || access.actor });

  const supabase = getSupabaseAuthClient(session.accessToken);
  const table = tableForMedicationTarget(input.target);
  const update = {
    archived_at: new Date().toISOString(),
    archived_by_user_id: session.user.id,
    archived_by_name: input.archivedByName?.trim() || access.actor,
    archive_reason: input.archiveReason?.trim() || ""
  };
  const { data, error } = await supabase.from(table).update(update).eq("id", input.id).select("*").single();
  throwIfSupabaseError(error);
  if (!data) return { allowed: true as const, status: 404, error: "Medication workflow item not found." };
  return { allowed: true as const, status: 200, item: data };
}

async function ensureCampBasics(session: AuthSession): Promise<CampBasics> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  let { data: sessions, error } = await supabase
    .from("camp_sessions")
    .select("*")
    .eq("status", "active")
    .order("starts_on", { ascending: false })
    .limit(1)
    .returns<CampSessionRow[]>();
  throwIfSupabaseError(error);

  if (!sessions?.length) {
    const insert = await supabase.from("camp_sessions").insert({
      ...ministryScopeColumns(await resolveMinistryScope(session)),
      slug: "summer-camp-2026",
      name: "Summer Camp 2026",
      starts_on: campStartsOn
    }).select("*").single<CampSessionRow>();
    throwIfSupabaseError(insert.error);
    sessions = insert.data ? [insert.data] : [];
  }

  const camp = sessions?.[0];
  if (!camp) throw new Error("Camp session could not be loaded.");

  let teams = await loadTeams(session, camp.id);
  if (!teams.length) {
    const rows = campTeams.map((team, index) => ({
      ...ministryScopeColumns(undefined),
      camp_id: camp.id,
      name: team.name,
      color: team.color,
      leader: team.leader,
      display_order: index + 1
    }));
    const insert = await supabase.from("camp_teams").insert(rows);
    throwIfSupabaseError(insert.error);
    teams = await loadTeams(session, camp.id);
  }

  let vehicles = await loadVehicles(session, camp.id);
  if (!vehicles.length) {
    const rows = campVehicles.map((vehicle, index) => ({
      ...ministryScopeColumns(undefined),
      camp_id: camp.id,
      name: vehicle.name,
      driver: vehicle.driver,
      departure_window: vehicle.departureWindow,
      capacity: vehicle.capacity,
      display_order: index + 1
    }));
    const insert = await supabase.from("camp_vehicles").insert(rows);
    throwIfSupabaseError(insert.error);
    vehicles = await loadVehicles(session, camp.id);
  }

  let schedule = await loadSchedule(session, camp.id);
  if (!schedule.length) {
    const rows = campSchedule.map((item, index) => ({
      ...ministryScopeColumns(undefined),
      camp_id: camp.id,
      title: item.title,
      day: item.day,
      time: item.time,
      date: item.date ?? null,
      start_time: item.startTime ?? null,
      end_time: item.endTime ?? null,
      location: item.location,
      owner: item.owner ?? "",
      audience: item.audience,
      notes: item.notes ?? "",
      status: item.status ?? "Planned",
      visibility: item.visibility ?? "All Camp",
      display_order: index + 1
    }));
    const insert = await supabase.from("camp_schedule_items").insert(rows);
    throwIfSupabaseError(insert.error);
    schedule = await loadSchedule(session, camp.id);
  }

  const staff = await loadStaff(session, camp.id, teams);
  return { camp, teams, vehicles, schedule, staff };
}

async function loadTeams(session: AuthSession, campId: string): Promise<CampTeam[]> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase.from("camp_teams").select("*").eq("camp_id", campId).is("archived_at", null).order("display_order", { ascending: true }).returns<CampTeamRow[]>();
  throwIfSupabaseError(error);
  return (data ?? []).map(toCampTeam);
}

async function loadVehicles(session: AuthSession, campId: string): Promise<CampVehicle[]> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_vehicles")
    .select("*")
    .eq("camp_id", campId)
    .is("archived_at", null)
    .order("display_order", { ascending: true })
    .returns<CampVehicleRow[]>();
  if (isMissingColumnError(error, "archived_at")) {
    const fallback = await supabase.from("camp_vehicles").select("*").eq("camp_id", campId).order("display_order", { ascending: true }).returns<CampVehicleRow[]>();
    throwIfSupabaseError(fallback.error);
    return (fallback.data ?? []).map(toCampVehicle);
  }
  throwIfSupabaseError(error);
  return (data ?? []).map(toCampVehicle);
}

async function loadSchedule(session: AuthSession, campId: string): Promise<CampScheduleBlock[]> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_schedule_items")
    .select("*")
    .eq("camp_id", campId)
    .is("archived_at", null)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .order("display_order", { ascending: true })
    .returns<CampScheduleItemRow[]>();

  if (isMissingTableError(error, "camp_schedule_items")) {
    return campSchedule.map((item) => ({ ...item }));
  }
  throwIfSupabaseError(error);
  return (data ?? []).map(toCampScheduleBlock);
}

async function loadStaff(session: AuthSession, campId: string, teams: CampTeam[]): Promise<CampStaffMember[]> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_staff")
    .select("*")
    .eq("camp_id", campId)
    .is("archived_at", null)
    .order("name", { ascending: true })
    .returns<CampStaffRow[]>();

  if (isMissingTableError(error, "camp_staff")) {
    return [];
  }
  throwIfSupabaseError(error);
  return (data ?? []).map((row) => toCampStaff(row, teams));
}

async function getCampersById(session: AuthSession, campId: string): Promise<Map<string, CampStudentPublic>> {
  const students = await loadActiveCampStudents(session, campId);
  return new Map(students.map((student) => [student.id, student]));
}

async function loadActiveCampStudents(session: AuthSession, campId: string): Promise<CampStudentPublic[]> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase.from("camp_campers").select("*").eq("camp_id", campId).is("archived_at", null).returns<CampCamperRow[]>();
  throwIfSupabaseError(error);
  const photoUrls = await loadCamperProfilePhotoUrls(session, campId);
  return (data ?? []).map((row) => toCampStudentPublic(row, photoUrls.get(row.id)));
}

async function loadCamperProfilePhotoUrls(session: AuthSession, campId: string): Promise<Map<string, string>> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_camper_profile_photo_records")
    .select("*")
    .eq("camp_id", campId)
    .is("removed_at", null)
    .is("replaced_by_photo_id", null)
    .order("uploaded_at", { ascending: false })
    .returns<CampCamperProfilePhotoStorageRow[]>();

  if (isMissingTableError(error, "camp_camper_profile_photo_records")) return new Map();
  throwIfSupabaseError(error);

  const latestByCamper = new Map<string, CampCamperProfilePhotoStorageRow>();
  for (const row of data ?? []) {
    if (!latestByCamper.has(row.camper_id)) latestByCamper.set(row.camper_id, row);
  }

  const entries = await Promise.all(Array.from(latestByCamper.values()).map(async (row) => {
    const signed = await supabase.storage.from(row.storage_bucket).createSignedUrl(row.storage_object_path, 300);
    if (signed.error) return undefined;
    return [row.camper_id, signed.data.signedUrl] as const;
  }));

  return new Map(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
}

async function requireActiveCamper(session: AuthSession, camperId: string): Promise<CampCamperRow> {
  const data = await findActiveCamper(session, camperId);
  if (!data) throw new Error("Active camper not found.");
  return data;
}

async function findActiveCamper(session: AuthSession, camperId: string): Promise<CampCamperRow | null> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase.from("camp_campers").select("*").eq("id", camperId).is("archived_at", null).maybeSingle<CampCamperRow>();
  throwIfSupabaseError(error);
  return data;
}

async function requireMedication(session: AuthSession, medicationRecordId: string): Promise<CampMedicationRow> {
  const data = await findMedication(session, medicationRecordId);
  if (!data) throw new Error("Medication record not found.");
  return data;
}

async function findMedication(session: AuthSession, medicationRecordId: string): Promise<CampMedicationRow | null> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase.from("camp_medication_records").select("*").eq("id", medicationRecordId).maybeSingle<CampMedicationRow>();
  throwIfSupabaseError(error);
  return data;
}

async function requireMedicationIntake(session: AuthSession, intakeRecordId: string): Promise<CampMedicationIntakeRow> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase.from("camp_medication_intake_records").select("*").eq("id", intakeRecordId).single<CampMedicationIntakeRow>();
  throwIfSupabaseError(error);
  if (!data) throw new Error("Medication intake record not found.");
  return data;
}

async function ensureReturnChecklist(
  session: AuthSession,
  campId: string,
  medication: CampMedicationRow,
  clarificationStatus: CampMedicationRecord["clarificationStatus"]
) {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_medication_return_items")
    .select("id")
    .eq("medication_record_id", medication.id)
    .maybeSingle<{ id: string }>();
  throwIfSupabaseError(error);
  if (data?.id) return;

  const insert = await supabase.from("camp_medication_return_items").insert({
    ...ministryScopeColumns(await resolveMinistryScope(session)),
    camp_id: campId,
    medication_record_id: medication.id,
    camper_id: medication.camper_id,
    return_status: clarificationStatus === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Pending Return"
  });
  throwIfSupabaseError(insert.error);
}

async function refreshCamperRestrictedFlags(session: AuthSession, camperId: string) {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const [medical, medication, schedule, returnItems] = await Promise.all([
    supabase.from("camp_restricted_medical_records").select("medical_form_status").eq("camper_id", camperId).returns<Array<{ medical_form_status: string }>>(),
    supabase.from("camp_medication_records").select("clarification_status").eq("camper_id", camperId).is("voided_at", null).returns<Array<{ clarification_status: string }>>(),
    supabase.from("camp_medication_schedule_items").select("status").eq("camper_id", camperId).is("voided_at", null).returns<Array<{ status: string }>>(),
    supabase.from("camp_medication_return_items").select("return_status").eq("camper_id", camperId).is("voided_at", null).returns<Array<{ return_status: string }>>()
  ]);

  throwIfSupabaseError(medical.error);
  throwIfSupabaseError(medication.error);
  throwIfSupabaseError(schedule.error);
  throwIfSupabaseError(returnItems.error);

  const hasRestrictedMedicalInfo = Boolean(medical.data?.length);
  const hasMedicationPlan = Boolean(medication.data?.length);
  const needsParentClarification =
    (medical.data ?? []).some((row) => row.medical_form_status === "Needs Parent Clarification") ||
    (medication.data ?? []).some((row) => row.clarification_status === "Needs Parent Clarification") ||
    (schedule.data ?? []).some((row) => row.status === "Needs Parent Clarification") ||
    (returnItems.data ?? []).some((row) => row.return_status === "Needs Parent Clarification");

  const update = await supabase.from("camp_campers").update({
    has_restricted_medical_info: hasRestrictedMedicalInfo,
    has_medication_plan: hasMedicationPlan,
    needs_parent_clarification: needsParentClarification
  }).eq("id", camperId);
  throwIfSupabaseError(update.error);
}

function tableForMedicationTarget(target: CampMedicationVoidInput["target"]) {
  if (target === "intake") return "camp_medication_intake_records";
  if (target === "medication") return "camp_medication_records";
  if (target === "schedule") return "camp_medication_schedule_items";
  if (target === "administrationLog") return "camp_medication_administration_logs";
  return "camp_medication_return_items";
}

function visibleMedicationHistoryRows<T extends { archived_at?: string | null }>(rows: T[], includeArchived?: boolean): T[] {
  return includeArchived ? rows : rows.filter((row) => !row.archived_at);
}

function retainWorkflowRowsWhenCamperLookupIsEmpty<T extends { camper_id: string }>(rows: T[], activeCamperIds: Set<string>): T[] {
  if (!rows.length) return [];
  const rowsForActiveCampers = rows.filter((row) => activeCamperIds.has(row.camper_id));
  return rowsForActiveCampers.length ? rowsForActiveCampers : rows;
}

function activeAuditRows<T extends { id: string; voided_at?: string | null }>(rows: T[], supersedesKey: keyof T): T[] {
  const supersededIds = new Set<string>();
  for (const row of rows) {
    const value = row[supersedesKey];
    if (typeof value === "string" && value) supersededIds.add(value);
  }
  return rows.filter((row) => !row.voided_at && !supersededIds.has(row.id));
}

function auditStatusFor<T extends { id: string; voided_at?: string | null }>(row: T, rows: T[], supersedesKey: keyof T): CampAuditStatus {
  if (row.voided_at) return "Voided";
  if (row[supersedesKey]) return "Corrected";
  return rows.some((candidate) => candidate[supersedesKey] === row.id) ? "Superseded" : "Active";
}

function toCampTeam(row: CampTeamRow): CampTeam {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? "",
    leader: row.leader ?? "",
    coLeader: row.co_leader ?? "",
    room: row.room ?? "",
    notes: row.notes ?? "",
    archivedAt: row.archived_at ?? undefined
  };
}

function toCampVehicle(row: CampVehicleRow): CampVehicle {
  return {
    id: row.id,
    name: row.name,
    driver: row.driver ?? "",
    departureWindow: row.departure_window ?? "",
    departureLocation: row.departure_location ?? "",
    capacity: row.capacity ?? 0,
    notes: row.notes ?? "",
    archivedAt: row.archived_at ?? undefined
  };
}

function toCampScheduleBlock(row: CampScheduleItemRow): CampScheduleBlock {
  return {
    id: row.id,
    day: row.day,
    time: row.time,
    date: row.date ?? undefined,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    title: row.title,
    location: row.location ?? "",
    owner: row.owner ?? "",
    audience: row.audience,
    notes: row.notes ?? "",
    status: row.status,
    visibility: row.visibility
  };
}

function scheduleInputToRow(input: CampScheduleInput) {
  return {
    title: input.title.trim(),
    day: input.day.trim(),
    time: input.time.trim(),
    date: input.date?.trim() || null,
    start_time: input.startTime?.trim() || null,
    end_time: input.endTime?.trim() || null,
    location: input.location?.trim() ?? "",
    owner: input.owner?.trim() ?? "",
    audience: input.audience,
    notes: input.notes?.trim() ?? "",
    status: input.status ?? "Planned",
    visibility: input.visibility ?? "All Camp"
  };
}

function resolveTeamId(name: string, teams: CampTeam[]): string {
  if (!name.trim()) return "";
  const normalized = normalizeTeamLookup(name);
  return teams.find((team) => normalizeTeamLookup(team.name) === normalized || normalizeTeamLookup(team.color) === normalized)?.id ?? "";
}

function normalizeTeamLookup(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\s+team$/, "");
}

function resolveVehicleId(name: string, vehicles: CampVehicle[]): string {
  if (!name.trim()) return "";
  const normalized = name.trim().toLowerCase();
  return vehicles.find((vehicle) => vehicle.name.toLowerCase() === normalized || vehicle.driver.toLowerCase() === normalized)?.id ?? "";
}

function isCampStaffRole(value: unknown): value is CampStaffMember["role"] {
  return value === "adult_volunteer" || value === "leader" || value === "staff";
}

function toCampStaff(row: CampStaffRow, teams: CampTeam[]): CampStaffMember {
  const team = row.team_id ? teams.find((candidate) => candidate.id === row.team_id) : undefined;
  return {
    id: row.id,
    name: row.name,
    profilePhotoUrl: sanitizeProfilePhotoUrl(row.profile_photo_url ?? ""),
    role: row.role,
    shirtSize: row.shirt_size ?? "",
    registrationExternalId: row.registration_external_id ?? undefined,
    sourceChurch: row.source_church ?? undefined,
    teamId: row.team_id ?? undefined,
    teamName: team?.name,
    archivedAt: row.archived_at ?? undefined,
    archiveReason: row.archive_reason ?? undefined
  };
}

function toCampStudentPublic(row: CampCamperRow, profilePhotoUrl?: string): CampStudentPublic {
  const limitedSafetyFlags = normalizeFlags(row.limited_safety_flags ?? []);
  return {
    id: row.id,
    name: row.name,
    photoInitials: row.photo_initials || initialsForName(row.name),
    profilePhotoUrl,
    grade: row.grade ?? "",
    teamId: row.team_id ?? "",
    vehicleId: row.vehicle_id ?? "",
    cabin: row.cabin ?? "",
    shirtSize: row.shirt_size ?? "",
    sourceChurch: row.source_church ?? sourceChurchFromFlags(limitedSafetyFlags),
    rosterType: row.roster_type ?? rosterTypeFromFlags(limitedSafetyFlags),
    registrationExternalId: row.registration_external_id ?? undefined,
    limitedSafetyFlags,
    hasRestrictedMedicalInfo: Boolean(row.has_restricted_medical_info),
    hasMedicationPlan: Boolean(row.has_medication_plan),
    needsParentClarification: Boolean(row.needs_parent_clarification),
    emergencyContactOnFile: Boolean(row.emergency_contact_on_file),
    hasMedicalAlert: Boolean(row.has_medical_alert),
    hasDietaryAlert: Boolean(row.has_dietary_alert),
    archivedAt: row.archived_at ?? undefined,
    archiveReason: row.archive_reason ?? undefined
  };
}

function toRestrictedMedicalRecord(row: CampRestrictedMedicalRow, campers: Map<string, CampStudentPublic>): CampRestrictedMedicalRecord {
  return {
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    medicalFormStatus: row.medical_form_status,
    restrictedNotes: row.restricted_notes ?? "",
    allergyNotes: row.allergy_notes ?? "",
    insuranceStatus: row.insurance_status ?? "",
    parentMedicalNotes: row.parent_medical_notes ?? "",
    emergencyContactName: row.emergency_contact_name ?? "",
    emergencyContactPhone: row.emergency_contact_phone ?? "",
    emergencyContactRelationship: row.emergency_contact_relationship ?? "",
    guardianName: row.guardian_name ?? "",
    guardianPhone: row.guardian_phone ?? "",
    dietaryRequirements: row.dietary_requirements ?? ""
  };
}

function toMedicationRecord(row: CampMedicationRow, campers: Map<string, CampStudentPublic>, intakeHistory: CampMedicationIntakeRecord[] = [], auditStatus?: CampAuditStatus, hasMedicationPhoto = false): CampMedicationRecord {
  const latestIntake = intakeHistory.find((item) => item.medicationRecordId === row.id);
  return {
    id: row.id,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    medicationName: row.medication_name ?? "Parent-labeled medication",
    medicinePhotoStatus: row.medicine_photo_status,
    parentProvidedInstructions: row.parent_provided_instructions ?? "Needs Parent Clarification.",
    checkInStatus: row.check_in_status,
    quantityRemaining: row.quantity_remaining ?? undefined,
    scheduleType: row.schedule_type ?? undefined,
    isPrn: row.is_prn ?? undefined,
    receivedBy: row.received_by ?? undefined,
    receivedAt: row.received_at ?? undefined,
    clarificationStatus: row.clarification_status,
    hasMedicationPhoto,
    latestQuantityReceived: latestIntake?.quantityReceived,
    latestIntakeAt: latestIntake?.receivedAt,
    supersedesMedicationRecordId: row.supersedes_medication_record_id ?? undefined,
    correctionNote: row.correction_note || undefined,
    auditStatus,
    voidedAt: row.voided_at ?? undefined,
    voidedByName: row.voided_by_name || undefined,
    voidReason: row.void_reason || undefined,
    archivedAt: row.archived_at ?? undefined,
    archivedByName: row.archived_by_name || undefined,
    archiveReason: row.archive_reason || undefined
  };
}

function toMedicationPhotoRecord(row: CampMedicationPhotoRow, campers: Map<string, CampStudentPublic>): CampMedicationPhotoRecord {
  return {
    id: row.id,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    medicationRecordId: row.medication_record_id,
    intakeRecordId: row.intake_record_id ?? undefined,
    contentType: row.content_type,
    fileSize: row.file_size,
    uploadedAt: row.uploaded_at
  };
}

function toCamperProfilePhotoRecord(row: CampCamperProfilePhotoRow, campers: Map<string, CampStudentPublic>): CampCamperProfilePhotoRecord {
  return {
    id: row.id,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    contentType: row.content_type,
    fileSize: row.file_size,
    uploadedAt: row.uploaded_at,
    removedAt: row.removed_at ?? undefined
  };
}

function toMedicationIntakeRecord(row: CampMedicationIntakeRow, campers: Map<string, CampStudentPublic>, auditStatus?: CampAuditStatus): CampMedicationIntakeRecord {
  return {
    id: row.id,
    medicationRecordId: row.medication_record_id ?? undefined,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    medicationName: row.medication_name,
    dose: row.dose,
    scheduleText: row.schedule_text,
    parentInstructions: row.parent_instructions,
    staffNotes: row.staff_notes,
    quantityReceived: row.quantity_received,
    containerStatus: row.container_status,
    receivedByName: row.received_by_name,
    receivedAt: row.received_at,
    guardianName: row.guardian_name,
    guardianRelationship: row.guardian_relationship,
    guardianSignatureData: row.guardian_signature_data,
    clarificationStatus: row.clarification_status,
    confirmationAcknowledged: row.confirmation_acknowledged,
    supersedesIntakeId: row.supersedes_intake_id ?? undefined,
    correctionNote: row.correction_note || undefined,
    auditStatus,
    voidedAt: row.voided_at ?? undefined,
    voidedByName: row.voided_by_name || undefined,
    voidReason: row.void_reason || undefined,
    archivedAt: row.archived_at ?? undefined,
    archivedByName: row.archived_by_name || undefined,
    archiveReason: row.archive_reason || undefined,
    createdAt: row.created_at
  };
}

function toMedicationIntakeSession(row: CampMedicationIntakeSessionRow, campers: Map<string, CampStudentPublic>): CampMedicationIntakeSession {
  return {
    id: row.id,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    receivedByName: row.received_by_name,
    receivedAt: row.received_at,
    guardianName: row.guardian_name,
    guardianRelationship: row.guardian_relationship,
    guardianSignatureData: row.guardian_signature_data,
    status: row.status,
    notes: row.notes ?? "",
    medicationCount: row.medication_count,
    archivedAt: row.archived_at ?? undefined,
    archivedByName: row.archived_by_name || undefined,
    archiveReason: row.archive_reason || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toScheduleItem(row: CampMedicationScheduleRow, campers: Map<string, CampStudentPublic>, auditStatus?: CampAuditStatus): CampMedicationScheduleItem {
  return {
    id: row.id,
    medicationRecordId: row.medication_record_id,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    timeWindow: row.time_window,
    parentProvidedInstructions: row.parent_provided_instructions ?? "Needs Parent Clarification.",
    status: row.status,
    lastLoggedAt: row.last_logged_at ?? undefined,
    lastLoggedBy: row.last_logged_by ?? undefined,
    supersedesScheduleItemId: row.supersedes_schedule_item_id ?? undefined,
    correctionNote: row.correction_note || undefined,
    auditStatus,
    voidedAt: row.voided_at ?? undefined,
    voidedByName: row.voided_by_name || undefined,
    voidReason: row.void_reason || undefined,
    archivedAt: row.archived_at ?? undefined,
    archivedByName: row.archived_by_name || undefined,
    archiveReason: row.archive_reason || undefined
  };
}

function toAdministrationLog(row: CampMedicationLogRow, campers: Map<string, CampStudentPublic>, auditStatus?: CampAuditStatus): CampMedicationAdministrationLog {
  return {
    id: row.id,
medicationRecordId: row.medication_record_id,
    scheduleItemId: row.schedule_item_id ?? undefined,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    timeWindow: row.time_window,
    loggedAt: row.logged_at,
    loggedBy: row.logged_by,
    status: row.status,
    notes: row.notes ?? "",
    studentAcknowledgementInitials: row.student_acknowledgement_initials ?? "",
    studentAcknowledgementUnavailable: row.student_acknowledgement_unavailable ?? false,
    studentAcknowledgementUnavailableReason: row.student_acknowledgement_unavailable_reason ?? "",
    supersedesAdministrationLogId: row.supersedes_administration_log_id ?? undefined,
    correctionNote: row.correction_note || undefined,
    auditStatus,
    voidedAt: row.voided_at ?? undefined,
    voidedByName: row.voided_by_name || undefined,
    voidReason: row.void_reason || undefined,
    archivedAt: row.archived_at ?? undefined,
    archivedByName: row.archived_by_name || undefined,
    archiveReason: row.archive_reason || undefined
  };
}

function toAdministrationEvent(row: CampMedicationAdministrationEventRow, campers: Map<string, CampStudentPublic>): CampMedicationAdministrationEvent {
  return {
    id: row.id,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    timeWindow: row.time_window,
    administeredAt: row.administered_at,
    administeredBy: row.administered_by,
    studentAcknowledgementInitials: row.student_acknowledgement_initials ?? undefined,
    studentAcknowledgementUnavailable: row.student_acknowledgement_unavailable ?? undefined,
    studentAcknowledgementUnavailableReason: row.student_acknowledgement_unavailable_reason ?? undefined,
    notes: row.notes ?? "",
    itemCount: row.item_count,
    createdAt: row.created_at
  };
}

function toAdministrationItem(row: CampMedicationAdministrationItemRow, campers: Map<string, CampStudentPublic>): CampMedicationAdministrationItem {
  return {
    id: row.id,
    administrationEventId: row.administration_event_id,
    medicationRecordId: row.medication_record_id,
    scheduleItemId: row.schedule_item_id ?? undefined,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    medicationName: row.medication_name,
    timeWindow: row.time_window,
    status: row.status,
    doseGiven: row.dose_given ?? "",
    administeredAt: row.administered_at,
    notes: row.notes ?? "",
    createdAt: row.created_at
  };
}

function toReturnItem(row: CampMedicationReturnRow, campers: Map<string, CampStudentPublic>, auditStatus?: CampAuditStatus): CampMedicationReturnItem {
  return {
    id: row.id,
    medicationRecordId: row.medication_record_id,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    returnStatus: row.return_status,
    returnedAt: row.returned_at ?? undefined,
    returnedBy: row.returned_by ?? undefined,
    recipientName: row.recipient_name ?? undefined,
    recipientRelationship: row.recipient_relationship ?? undefined,
    returnNotes: row.return_notes ?? undefined,
    supersedesReturnItemId: row.supersedes_return_item_id ?? undefined,
    correctionNote: row.correction_note || undefined,
    auditStatus,
    voidedAt: row.voided_at ?? undefined,
    voidedByName: row.voided_by_name || undefined,
    voidReason: row.void_reason || undefined,
    archivedAt: row.archived_at ?? undefined,
    archivedByName: row.archived_by_name || undefined,
    archiveReason: row.archive_reason || undefined
  };
}

function filterDocumentsForRole(context: CampAccessContext): CampDocument[] {
  return campDocuments
    .filter((doc) => context.canAccessRestricted || doc.audience !== "Restricted Medical")
    .filter((doc) => context.effectiveRole !== "driver" || doc.audience === "Drivers")
    .map((doc) => ({ ...doc }));
}

function assertCampCamperWriteAccess(
  context: CampAccessContext,
  input: Partial<CampStudentInput>,
  existing?: CampStudentPublic
) {
  if (canEditAllCampers(context)) return { allowed: true as const };

  if (!canEditPartnerChurchCampers(context)) {
    return {
      allowed: false as const,
      status: 403,
      error: "Camp roster editing requires assigned edit rights."
    };
  }

  const scopedChurch = normalizeScopeId(context.partnerChurchId);
  const existingChurch = normalizeScopeId(existing?.sourceChurch);
  const incomingChurch = normalizeScopeId(input.sourceChurch);
  const targetChurch = existingChurch || incomingChurch;
  const targetRosterType = existing?.rosterType ?? input.rosterType;

  if (!targetChurch || targetChurch !== scopedChurch || targetRosterType !== "partner") {
    return {
      allowed: false as const,
      status: 403,
      error: "Partner Church Only edit rights are limited to campers from the assigned partner church."
    };
  }

  if (existing && incomingChurch && incomingChurch !== scopedChurch) {
    return {
      allowed: false as const,
      status: 403,
      error: "Partner Church Only users cannot move campers to another source church."
    };
  }

  return { allowed: true as const };
}

async function loadActiveCamperForAccess(session: AuthSession, camperId?: string): Promise<CampCamperRow | null> {
  if (!camperId) return null;
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase
    .from("camp_campers")
    .select("*")
    .eq("id", camperId)
    .is("archived_at", null)
    .maybeSingle<CampCamperRow>();
  throwIfSupabaseError(error);
  return data ?? null;
}

async function deniedCampMutation(
  session: AuthSession,
  context: CampAccessContext,
  action: string,
  targetTable: string,
  targetId: string | undefined,
  error: string
) {
  await logDeniedMutationAttempt(session, context, { action, targetTable, targetId, reason: error });
  return { allowed: false as const, status: 403, error };
}

async function logDeniedMutationAttempt(
  session: AuthSession,
  context: CampAccessContext,
  input: { action: string; targetTable: string; targetId?: string; reason: string }
) {
  if (shouldUseMock(session)) {
    mockStore.recordDeniedMutationAttempt({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      action: input.action,
      targetTable: input.targetTable,
      targetId: input.targetId,
      reason: input.reason
    });
    return;
  }

  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    await supabase.from("camp_denied_mutation_audit").insert({
      ...ministryScopeColumns(await resolveMinistryScope(session)),
      actor_user_id: session.user.id,
      actor_email: session.user.email.toLowerCase(),
      camp_role: context.effectiveRole,
      camp_edit_scope: context.campEditScope,
      app_area_scope: context.appAreaScope,
      action: input.action,
      target_table: input.targetTable,
      target_id: input.targetId ?? null,
      reason: input.reason
    });
  } catch {
    // Denial logging should never turn a safe 403 into a 500.
  }
}

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "C").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function normalizeFlags(flags: string[]): string[] {
  return sanitizePublicSafetyFlags(flags);
}

function sanitizeProfilePhotoUrl(value?: string | null): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:" || url.protocol === "data:") return url.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

function throwIfSupabaseError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function isMissingTableError(error: { message: string } | null, tableName: string) {
  const message = error?.message.toLowerCase() ?? "";
  return Boolean(message.includes(tableName.toLowerCase()) && (message.includes("does not exist") || message.includes("schema cache")));
}

function isMissingColumnError(error: { message: string } | null, columnName: string) {
  return Boolean(error?.message.toLowerCase().includes(columnName.toLowerCase()) && error.message.toLowerCase().includes("column"));
}

function isMissingOptionalStaffColumnError(error: { message: string } | null) {
  return ["profile_photo_url", "source_church", "shirt_size"].some((columnName) => isMissingColumnError(error, columnName));
}

function isMissingMedicationWorkflowTableError(error: { message: string } | null) {
  return (
    isMissingTableError(error, "camp_medication_intake_sessions") ||
    isMissingTableError(error, "camp_medication_administration_events") ||
    isMissingTableError(error, "camp_medication_administration_items")
  );
}

function medicationScheduleType(value?: string): CampMedicationRecord["scheduleType"] {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "needs_review";
  if (/\bprn\b|as needed/i.test(normalized)) return "prn";
  return "scheduled";
}

function administrationItemStatusToLegacy(status: CampMedicationAdministrationItem["status"]): CampMedicationAdministrationLog["status"] {
  if (status === "administered") return "Logged";
  if (status === "held") return "Needs Parent Clarification";
  return "Skipped";
}

function isAdministrationItemStatus(value: unknown): value is CampMedicationAdministrationItem["status"] {
  return value === "administered" || value === "skipped" || value === "refused" || value === "held" || value === "not_present";
}

function medicationIntakeSessionValidationError(medications: CampMedicationIntakeSessionInput["medications"]) {
  for (const medicationInput of medications) {
    if (!medicationInput.medicationName.trim() || !medicationInput.dose.trim() || !medicationInput.quantityReceived.trim() || !medicationInput.parentInstructions.trim()) {
      return "Each medication row needs name, dose, quantity, and instructions before completing intake.";
    }
  }
  return "";
}

function defaultAdministrationItemNote(status: CampMedicationAdministrationItem["status"]) {
  if (status === "administered") return "Logged per parent-provided instructions.";
  if (status === "refused") return "Medication refused during grouped med pass.";
  if (status === "held") return "Medication held for review.";
  if (status === "not_present") return "Medication not present during grouped med pass.";
  return "Medication skipped during grouped med pass.";
}

function decrementQuantityText(value?: string): string | undefined {
  if (!value) return value;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return value;
  const current = Number(match[1]);
  if (!Number.isFinite(current)) return value;
  const next = Math.max(0, current - 1);
  return value.replace(match[1], Number.isInteger(current) ? String(next) : String(Number(next.toFixed(2))));
}

function assertSignature(signature: CampMedicationIntakeInput["guardianSignatureData"]) {
  if (!signature || !Array.isArray(signature.strokes) || !signature.strokes.some((stroke) => stroke.length > 0)) {
    throw new Error("Parent/guardian signature is required.");
  }
  if (JSON.stringify(signature).length > 64_000) {
    throw new Error("Parent/guardian signature is too large.");
  }
}

function assertMedicationPhotoFile(contentType: string, fileSize: number) {
  if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(contentType.toLowerCase())) {
    throw new Error("Medication photo must be a supported image file.");
  }
  if (fileSize <= 0 || fileSize > 10 * 1024 * 1024) {
    throw new Error("Medication photo must be under 10 MB.");
  }
}

function assertCamperProfilePhotoFile(contentType: string, fileSize: number) {
  if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(contentType.toLowerCase())) {
    throw new Error("Camper photo must be a supported image file.");
  }
  if (fileSize <= 0 || fileSize > 5 * 1024 * 1024) {
    throw new Error("Camper photo must be under 5 MB.");
  }
}

function extensionForContentType(contentType: string) {
  switch (contentType.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}
