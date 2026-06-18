import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import { campDocuments, campSchedule, campStartsOn, campTeams, campVehicles } from "@/lib/camp/public-data";
import {
  assertCampRestrictedAccess,
  type CampAccessContext
} from "@/lib/camp/permissions";
import * as mockStore from "@/lib/camp/store";
import type {
  CampAccessScope,
  CampDocument,
  CampMedicationAdministrationLog,
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
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
};

type CampMedicationReturnRow = {
  id: string;
  medication_record_id: string;
  camper_id: string;
  return_status: CampMedicationReturnItem["returnStatus"];
  returned_at: string | null;
  returned_by: string | null;
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
    ? await supabase.from("camp_campers").update(row).eq("id", input.id).select("*").single<CampCamperRow>()
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
  const { data, error } = await supabase.from("camp_campers").update(update).eq("id", input.studentId).select("*").single<CampCamperRow>();
  throwIfSupabaseError(error);
  if (!data) throw new Error("Camp assignment update returned no row.");
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
  return {
    allowed: true as const,
    status: 200,
    records: (data ?? []).map((row) => toRestrictedMedicalRecord(row, campers))
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
  const [checkIn, schedule, logs, returns] = await Promise.all([
    supabase.from("camp_medication_records").select("*").eq("camp_id", basics.camp.id).order("updated_at", { ascending: false }).returns<CampMedicationRow[]>(),
    supabase.from("camp_medication_schedule_items").select("*").eq("camp_id", basics.camp.id).order("created_at", { ascending: false }).returns<CampMedicationScheduleRow[]>(),
    supabase.from("camp_medication_administration_logs").select("*").eq("camp_id", basics.camp.id).order("logged_at", { ascending: false }).returns<CampMedicationLogRow[]>(),
    supabase.from("camp_medication_return_items").select("*").eq("camp_id", basics.camp.id).order("updated_at", { ascending: false }).returns<CampMedicationReturnRow[]>()
  ]);

  throwIfSupabaseError(checkIn.error);
  throwIfSupabaseError(schedule.error);
  throwIfSupabaseError(logs.error);
  throwIfSupabaseError(returns.error);

  return {
    allowed: true as const,
    status: 200,
    checkIn: (checkIn.data ?? []).map((row) => toMedicationRecord(row, campers)),
    schedule: (schedule.data ?? []).map((row) => toScheduleItem(row, campers)),
    administrationLog: (logs.data ?? []).map((row) => toAdministrationLog(row, campers)),
    returnChecklist: (returns.data ?? []).map((row) => toReturnItem(row, campers))
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
  const clarificationStatus = mockStore.normalizeClarification(input.clarificationStatus, input.parentProvidedInstructions);
  const checkInStatus = mockStore.normalizeCheckInStatus(input.checkInStatus, clarificationStatus);
  const row = {
    medication_name: input.medicationName?.trim() || "Parent-labeled medication",
    medicine_photo_status: input.medicinePhotoStatus ?? "Photo Needed",
    parent_provided_instructions: input.parentProvidedInstructions?.trim() || "Needs Parent Clarification.",
    check_in_status: checkInStatus,
    received_by: checkInStatus === "Checked In" ? input.receivedBy ?? access.actor : input.receivedBy ?? null,
    received_at: checkInStatus === "Checked In" ? input.receivedAt ?? new Date().toISOString() : input.receivedAt ?? null,
    clarification_status: clarificationStatus
  };
  const result = input.id
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
  const parentInstructions = input.parentProvidedInstructions?.trim() || medication.parent_provided_instructions || "Needs Parent Clarification.";
  const status = mockStore.normalizeScheduleStatus(input.status, parentInstructions);
  const row = {
    medication_record_id: medication.id,
    camper_id: medication.camper_id,
    time_window: input.timeWindow.trim(),
    parent_provided_instructions: parentInstructions,
    status
  };
  const result = input.id
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

export async function logMedicationAdministration(
  session: AuthSession,
  context: CampAccessContext,
  input: { scheduleItemId: string; loggedBy: string; status: CampMedicationAdministrationLog["status"]; notes?: string }
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
    notes: input.notes?.trim() || "Logged per parent-provided instructions."
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
  input: { id: string; returnStatus: CampMedicationReturnItem["returnStatus"]; returnedBy?: string }
) {
  const access = assertCampRestrictedAccess(context);
  if (!access.allowed) return access;
  if (shouldUseMock(session)) return mockStore.updateMedicationReturnItem(context.effectiveRole, input);

  const supabase = getSupabaseAuthClient(session.accessToken);
  const basics = await ensureCampBasics(session);
  const update = {
    return_status: input.returnStatus,
    returned_at: input.returnStatus === "Returned to Parent" ? new Date().toISOString() : null,
    returned_by: input.returnStatus === "Returned to Parent" ? input.returnedBy?.trim() || access.actor : null
  };
  const { data, error } = await supabase.from("camp_medication_return_items").update(update).eq("id", input.id).select("*").single<CampMedicationReturnRow>();
  throwIfSupabaseError(error);
  if (!data) return { allowed: true as const, status: 404, error: "Medication return item not found." };
  await refreshCamperRestrictedFlags(session, data.camper_id);
  return { allowed: true as const, status: 200, item: toReturnItem(data, await getCampersById(session, basics.camp.id)) };
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
  const { data, error } = await supabase.from("camp_campers").select("*").eq("camp_id", campId).returns<CampCamperRow[]>();
  throwIfSupabaseError(error);
  return new Map((data ?? []).map((row) => [row.id, toCampStudentPublic(row)]));
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
    supabase.from("camp_medication_records").select("clarification_status").eq("camper_id", camperId).returns<Array<{ clarification_status: string }>>(),
    supabase.from("camp_medication_schedule_items").select("status").eq("camper_id", camperId).returns<Array<{ status: string }>>(),
    supabase.from("camp_medication_return_items").select("return_status").eq("camper_id", camperId).returns<Array<{ return_status: string }>>()
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
    needsParentClarification: Boolean(row.needs_parent_clarification)
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

function toMedicationRecord(row: CampMedicationRow, campers: Map<string, CampStudentPublic>): CampMedicationRecord {
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
    clarificationStatus: row.clarification_status
  };
}

function toScheduleItem(row: CampMedicationScheduleRow, campers: Map<string, CampStudentPublic>): CampMedicationScheduleItem {
  return {
    id: row.id,
    medicationRecordId: row.medication_record_id,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    timeWindow: row.time_window,
    parentProvidedInstructions: row.parent_provided_instructions ?? "Needs Parent Clarification.",
    status: row.status,
    lastLoggedAt: row.last_logged_at ?? undefined,
    lastLoggedBy: row.last_logged_by ?? undefined
  };
}

function toAdministrationLog(row: CampMedicationLogRow, campers: Map<string, CampStudentPublic>): CampMedicationAdministrationLog {
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
    notes: row.notes ?? ""
  };
}

function toReturnItem(row: CampMedicationReturnRow, campers: Map<string, CampStudentPublic>): CampMedicationReturnItem {
  return {
    id: row.id,
    medicationRecordId: row.medication_record_id,
    studentId: row.camper_id,
    studentName: campers.get(row.camper_id)?.name ?? "Camper",
    returnStatus: row.return_status,
    returnedAt: row.returned_at ?? undefined,
    returnedBy: row.returned_by ?? undefined
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
  return Array.from(new Set(flags.map((flag) => flag.trim()).filter(Boolean)));
}

function throwIfSupabaseError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
