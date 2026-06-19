import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import { randomUUID } from "crypto";
import { campDocuments, campSchedule, campStartsOn, campTeams, campVehicles } from "@/lib/camp/public-data";
import { sanitizePublicSafetyFlags } from "@/lib/camp/public-safety";
import {
  assertCampRestrictedAccess,
  type CampAccessContext
} from "@/lib/camp/permissions";
import * as mockStore from "@/lib/camp/store";
import type {
  CampAccessScope,
  CampAuditStatus,
  CampArchiveInput,
  CampDocument,
  CampMedicationAdministrationLog,
  CampMedicationIntakeInput,
  CampMedicationIntakeRecord,
  CampMedicationPhotoRecord,
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
  CampMedicationVoidInput,
  CampOverviewPayload,
  CampRestrictedMedicalRecord,
  CampStudentInput,
  CampStudentPublic,
  CampTeam,
  CampVehicle
} from "@/lib/camp/types";
import { getCampVisibleStudentsForData } from "@/lib/camp/access";
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
  display_order: number | null;
};

type CampVehicleRow = {
  id: string;
  name: string;
  driver: string | null;
  departure_window: string | null;
  capacity: number | null;
  display_order: number | null;
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
  limited_safety_flags: string[] | null;
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
};

type CampMedicationRow = {
  id: string;
  camper_id: string;
  medication_name: string | null;
  medicine_photo_status: CampMedicationRecord["medicinePhotoStatus"];
  parent_provided_instructions: string | null;
  check_in_status: CampMedicationRecord["checkInStatus"];
  received_by: string | null;
  received_at: string | null;
  clarification_status: CampMedicationRecord["clarificationStatus"];
  supersedes_medication_record_id: string | null;
  correction_note: string | null;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
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
  supersedes_administration_log_id: string | null;
  correction_note: string | null;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
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
  created_at: string;
};

type CampMedicationPhotoRow = {
  id: string;
  camper_id: string;
  medication_record_id: string;
  content_type: string;
  file_size: number;
  uploaded_at: string;
};

type CampBasics = {
  camp: CampSessionRow;
  teams: CampTeam[];
  vehicles: CampVehicle[];
};

function shouldUseMock(session: AuthSession) {
  return session.isMock || !isSupabaseConfigured();
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

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const { data, error } = await supabase
    .from("camp_campers")
    .select("*")
    .eq("camp_id", basics.camp.id)
    .is("archived_at", null)
    .order("name", { ascending: true })
    .returns<CampCamperRow[]>();

  throwIfSupabaseError(error);

  const students = (data ?? []).map(toCampStudentPublic);
  return {
    campStartsOn: basics.camp.starts_on,
    teams: basics.teams,
    vehicles: basics.vehicles,
    schedule: context.effectiveRole === "driver" ? campSchedule.filter((item) => item.audience === "All Camp") : campSchedule.map((item) => ({ ...item })),
    documents: filterDocumentsForRole(context),
    students: getCampVisibleStudentsForData(context.effectiveRole, scope, {
      students,
      teams: basics.teams,
      vehicles: basics.vehicles
    })
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
  return { allowed: true as const, status: 200, students: (data ?? []).map(toCampStudentPublic) };
}

export async function upsertCampStudent(session: AuthSession, context: CampAccessContext, input: CampStudentInput) {
  if (context.isDriver) return { allowed: false as const, status: 403, error: "Camp roster editing is not available for this role." };
  if (shouldUseMock(session)) return { allowed: true as const, status: input.id ? 200 : 201, student: mockStore.upsertCampStudent(input) };

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const row = {
    name: input.name.trim(),
    photo_initials: initialsForName(input.name),
    grade: input.grade.trim(),
    team_id: input.teamId || null,
    vehicle_id: input.vehicleId || null,
    cabin: input.cabin.trim(),
    limited_safety_flags: normalizeFlags(input.limitedSafetyFlags ?? [])
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

export async function assignCampStudent(
  session: AuthSession,
  context: CampAccessContext,
  input: { studentId: string; teamId?: string; vehicleId?: string; cabin?: string }
) {
  if (context.isDriver) return { allowed: false as const, status: 403, error: "Camp roster editing is not available for this role." };
  if (shouldUseMock(session)) return { allowed: true as const, status: 200, student: mockStore.assignCampStudent(input) };

  const update: Record<string, string | null> = {};
  if (input.teamId !== undefined) update.team_id = input.teamId || null;
  if (input.vehicleId !== undefined) update.vehicle_id = input.vehicleId || null;
  if (input.cabin !== undefined) update.cabin = input.cabin;

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase.from("camp_campers").update(update).eq("id", input.studentId).is("archived_at", null).select("*").single<CampCamperRow>();
  throwIfSupabaseError(error);
  if (!data) throw new Error("Camp assignment update returned no row.");
  return { allowed: true as const, status: 200, student: toCampStudentPublic(data) };
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
    parent_medical_notes: input.parentMedicalNotes
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

export async function getRestrictedCampMedicationPayload(session: AuthSession, context: CampAccessContext) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.getRestrictedCampMedicationPayload(context.effectiveRole);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const campers = await getCampersById(session, basics.camp.id);
  const activeCamperIds = new Set(campers.keys());
  const [checkIn, schedule, logs, returns, intake, photos] = await Promise.all([
    supabase.from("camp_medication_records").select("*").eq("camp_id", basics.camp.id).order("updated_at", { ascending: false }).returns<CampMedicationRow[]>(),
    supabase.from("camp_medication_schedule_items").select("*").eq("camp_id", basics.camp.id).order("created_at", { ascending: false }).returns<CampMedicationScheduleRow[]>(),
    supabase.from("camp_medication_administration_logs").select("*").eq("camp_id", basics.camp.id).order("logged_at", { ascending: false }).returns<CampMedicationLogRow[]>(),
    supabase.from("camp_medication_return_items").select("*").eq("camp_id", basics.camp.id).order("updated_at", { ascending: false }).returns<CampMedicationReturnRow[]>(),
    supabase.from("camp_medication_intake_records").select("*").eq("camp_id", basics.camp.id).order("received_at", { ascending: false }).returns<CampMedicationIntakeRow[]>(),
    supabase.from("camp_medication_photo_records").select("medication_record_id").eq("camp_id", basics.camp.id).returns<Array<{ medication_record_id: string }>>()
  ]);

  throwIfSupabaseError(checkIn.error);
  throwIfSupabaseError(schedule.error);
  throwIfSupabaseError(logs.error);
  throwIfSupabaseError(returns.error);
  throwIfSupabaseError(intake.error);
  throwIfSupabaseError(photos.error);

  const intakeRows = (intake.data ?? []).filter((row) => activeCamperIds.has(row.camper_id));
  const activeIntakeRows = activeAuditRows(intakeRows, "supersedes_intake_id");
  const intakeHistory = intakeRows.map((row) => toMedicationIntakeRecord(row, campers, auditStatusFor(row, intakeRows, "supersedes_intake_id")));
  const medicationIdsWithPhotoRecords = new Set((photos.data ?? []).map((row) => row.medication_record_id));

  return {
    allowed: true as const,
    status: 200,
    checkIn: activeAuditRows((checkIn.data ?? []).filter((row) => activeCamperIds.has(row.camper_id)), "supersedes_medication_record_id")
      .map((row) => toMedicationRecord(row, campers, activeIntakeRows.map((item) => toMedicationIntakeRecord(item, campers)), auditStatusFor(row, checkIn.data ?? [], "supersedes_medication_record_id"), medicationIdsWithPhotoRecords.has(row.id))),
    schedule: activeAuditRows((schedule.data ?? []).filter((row) => activeCamperIds.has(row.camper_id)), "supersedes_schedule_item_id")
      .map((row) => toScheduleItem(row, campers, auditStatusFor(row, schedule.data ?? [], "supersedes_schedule_item_id"))),
    administrationLog: (logs.data ?? []).filter((row) => activeCamperIds.has(row.camper_id)).map((row) => toAdministrationLog(row, campers, auditStatusFor(row, logs.data ?? [], "supersedes_administration_log_id"))),
    returnChecklist: activeAuditRows((returns.data ?? []).filter((row) => activeCamperIds.has(row.camper_id)), "supersedes_return_item_id")
      .map((row) => toReturnItem(row, campers, auditStatusFor(row, returns.data ?? [], "supersedes_return_item_id"))),
    intakeHistory
  };
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
  const campers = await getCampersById(session, basics.camp.id);
  const intake = toMedicationIntakeRecord(data, campers);
  return {
    allowed: true as const,
    status: 201,
    intake,
    record: { ...medicationPayload.record, latestQuantityReceived: intake.quantityReceived, latestIntakeAt: intake.receivedAt }
  };
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
  if (input.id && !input.supersedesMedicationRecordId) {
    const existing = await requireMedication(session, input.id);
    await requireActiveCamper(session, existing.camper_id);
  }
  if (!input.id || input.supersedesMedicationRecordId) await requireActiveCamper(session, input.studentId);
  const clarificationStatus = mockStore.normalizeClarification(input.clarificationStatus, input.parentProvidedInstructions);
  const checkInStatus = mockStore.normalizeCheckInStatus(input.checkInStatus, clarificationStatus);
  const row = {
    medication_name: input.medicationName?.trim() || "Parent-labeled medication",
    medicine_photo_status: input.medicinePhotoStatus ?? "Photo Needed",
    parent_provided_instructions: input.parentProvidedInstructions?.trim() || "Needs Parent Clarification.",
    check_in_status: checkInStatus,
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

export async function saveMedicationPhoto(
  session: AuthSession,
  context: CampAccessContext,
  input: { medicationRecordId: string; file: File }
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
    record: toMedicationRecord({ ...medication, medicine_photo_status: "Photo On File" }, new Map([[camper.id, toCampStudentPublic(camper)]]))
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
  input: { scheduleItemId: string; loggedBy: string; status: CampMedicationAdministrationLog["status"]; notes?: string; supersedesAdministrationLogId?: string; correctionNote?: string }
) {
  const access = assertCampRestrictedAccess(context);
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
  const table = tableForVoidTarget(input.target);
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

  return { camp, teams, vehicles };
}

async function loadTeams(session: AuthSession, campId: string): Promise<CampTeam[]> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase.from("camp_teams").select("*").eq("camp_id", campId).order("display_order", { ascending: true }).returns<CampTeamRow[]>();
  throwIfSupabaseError(error);
  return (data ?? []).map(toCampTeam);
}

async function loadVehicles(session: AuthSession, campId: string): Promise<CampVehicle[]> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase.from("camp_vehicles").select("*").eq("camp_id", campId).order("display_order", { ascending: true }).returns<CampVehicleRow[]>();
  throwIfSupabaseError(error);
  return (data ?? []).map(toCampVehicle);
}

async function getCampersById(session: AuthSession, campId: string): Promise<Map<string, CampStudentPublic>> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase.from("camp_campers").select("*").eq("camp_id", campId).is("archived_at", null).returns<CampCamperRow[]>();
  throwIfSupabaseError(error);
  return new Map((data ?? []).map((row) => [row.id, toCampStudentPublic(row)]));
}

async function requireActiveCamper(session: AuthSession, camperId: string): Promise<CampCamperRow> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase.from("camp_campers").select("*").eq("id", camperId).is("archived_at", null).single<CampCamperRow>();
  throwIfSupabaseError(error);
  if (!data) throw new Error("Active camper not found.");
  return data;
}

async function requireMedication(session: AuthSession, medicationRecordId: string): Promise<CampMedicationRow> {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const { data, error } = await supabase.from("camp_medication_records").select("*").eq("id", medicationRecordId).single<CampMedicationRow>();
  throwIfSupabaseError(error);
  if (!data) throw new Error("Medication record not found.");
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

function tableForVoidTarget(target: CampMedicationVoidInput["target"]) {
  if (target === "intake") return "camp_medication_intake_records";
  if (target === "medication") return "camp_medication_records";
  if (target === "schedule") return "camp_medication_schedule_items";
  if (target === "administrationLog") return "camp_medication_administration_logs";
  return "camp_medication_return_items";
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
    leader: row.leader ?? ""
  };
}

function toCampVehicle(row: CampVehicleRow): CampVehicle {
  return {
    id: row.id,
    name: row.name,
    driver: row.driver ?? "",
    departureWindow: row.departure_window ?? "",
    capacity: row.capacity ?? 0
  };
}

function toCampStudentPublic(row: CampCamperRow): CampStudentPublic {
  return {
    id: row.id,
    name: row.name,
    photoInitials: row.photo_initials || initialsForName(row.name),
    grade: row.grade ?? "",
    teamId: row.team_id ?? "",
    vehicleId: row.vehicle_id ?? "",
    cabin: row.cabin ?? "",
    limitedSafetyFlags: normalizeFlags(row.limited_safety_flags ?? []),
    hasRestrictedMedicalInfo: Boolean(row.has_restricted_medical_info),
    hasMedicationPlan: Boolean(row.has_medication_plan),
    needsParentClarification: Boolean(row.needs_parent_clarification),
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
    parentMedicalNotes: row.parent_medical_notes ?? ""
  };
}

function toMedicationRecord(row: CampMedicationRow, campers: Map<string, CampStudentPublic>, intakeHistory: CampMedicationIntakeRecord[] = [], auditStatus?: CampAuditStatus, hasMedicationPhoto = row.medicine_photo_status === "Photo On File"): CampMedicationRecord {
  const latestIntake = intakeHistory.find((item) => item.medicationRecordId === row.id);
  return {
    id: row.id,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    medicationName: row.medication_name ?? "Parent-labeled medication",
    medicinePhotoStatus: row.medicine_photo_status,
    parentProvidedInstructions: row.parent_provided_instructions ?? "Needs Parent Clarification.",
    checkInStatus: row.check_in_status,
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
    voidReason: row.void_reason || undefined
  };
}

function toMedicationPhotoRecord(row: CampMedicationPhotoRow, campers: Map<string, CampStudentPublic>): CampMedicationPhotoRecord {
  return {
    id: row.id,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    medicationRecordId: row.medication_record_id,
    contentType: row.content_type,
    fileSize: row.file_size,
    uploadedAt: row.uploaded_at
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
    createdAt: row.created_at
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
    voidReason: row.void_reason || undefined
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
    supersedesAdministrationLogId: row.supersedes_administration_log_id ?? undefined,
    correctionNote: row.correction_note || undefined,
    auditStatus,
    voidedAt: row.voided_at ?? undefined,
    voidedByName: row.voided_by_name || undefined,
    voidReason: row.void_reason || undefined
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
    voidReason: row.void_reason || undefined
  };
}

function filterDocumentsForRole(context: CampAccessContext): CampDocument[] {
  return campDocuments
    .filter((doc) => context.canAccessRestricted || doc.audience !== "Restricted Medical")
    .filter((doc) => context.effectiveRole !== "driver" || doc.audience === "Drivers")
    .map((doc) => ({ ...doc }));
}

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "C").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function normalizeFlags(flags: string[]): string[] {
  return sanitizePublicSafetyFlags(flags);
}

function throwIfSupabaseError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
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
