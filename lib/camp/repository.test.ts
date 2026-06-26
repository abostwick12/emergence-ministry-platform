import { beforeEach, describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import { resolveCampAccessContext } from "@/lib/camp/permissions";
import {
  archiveMedicationWorkflowItem,
  archiveCampStudent,
  buildRestrictedCampMedicationPayloadFromRows,
  checkOakwoodImportSchemaReadinessWithClient,
  commitOakwoodImport,
  getOakwoodLiveImportReadiness,
  getCampOverview,
  getArchivedCampStudents,
  getOakwoodImportPreview,
  getOakwoodUploadImportPreview,
  isOakwoodLiveImportApproved,
  getMedicationPhotoAccess,
  getRestrictedCampMedicalPayload,
  getRestrictedCampMedicationPayload,
  getCampStaffManagementPayload,
  restoreCampStudent,
  saveMedicationPhoto,
  saveMedicationIntake,
  upsertCampStudent,
  upsertRestrictedMedicalRecord,
  upsertMedicationRecord,
  updateCampStaffMember
} from "@/lib/camp/repository";
import { __resetCampStoreForTests } from "@/lib/camp/store";
import { parseMedicationScheduleText } from "@/lib/camp/medication-schedule-text";
import { getMedicineIntakeReturnVisibility } from "@/lib/camp/medication-workflow-visibility";

function session(fullName = "MVP Staff User", email = "staff@example.com"): AuthSession {
  return {
    isMock: true,
    user: {
      id: "usr_mock",
      email,
      fullName,
      role: "admin"
    }
  };
}

beforeEach(() => {
  __resetCampStoreForTests();
});

function oakwoodSchemaReadinessClient(errors: Record<string, string> = {}) {
  return {
    from(table: string) {
      return {
        select() {
          const query = {
            limit() {
              return query;
            },
            async returns() {
              return { data: [], error: errors[table] ? { message: errors[table] } : null };
            }
          };
          return query;
        }
      };
    }
  };
}

describe("Oakwood live import readiness", () => {
  const liveSession: AuthSession = {
    isMock: false,
    accessToken: "live-token",
    user: {
      id: "live-andrew",
      email: "andrew@example.com",
      fullName: "Andrew",
      role: "admin"
    }
  };

  it("requires the server-only live import approval flag", async () => {
    expect(isOakwoodLiveImportApproved({ CAMP_OAKWOOD_LIVE_IMPORT_APPROVED: "true" })).toBe(true);
    expect(isOakwoodLiveImportApproved({ CAMP_OAKWOOD_LIVE_IMPORT_APPROVED: "TRUE" })).toBe(false);
    expect(isOakwoodLiveImportApproved({})).toBe(false);

    const readiness = await getOakwoodLiveImportReadiness(liveSession, {
      env: {},
      supabase: oakwoodSchemaReadinessClient()
    });

    expect(readiness).toMatchObject({
      ready: false,
      reason: "approval"
    });
    expect(readiness.ready ? "" : readiness.message).toMatch(/live import approval is not enabled/i);
  });

  it("reports the exact migration 013 schema readiness failure", async () => {
    const readiness = await getOakwoodLiveImportReadiness(liveSession, {
      env: { CAMP_OAKWOOD_LIVE_IMPORT_APPROVED: "true" },
      supabase: oakwoodSchemaReadinessClient({
        camp_staff: "relation public.camp_staff does not exist",
        camp_campers: "column registration_external_id does not exist"
      })
    });

    expect(readiness).toMatchObject({
      ready: false,
      reason: "schema"
    });
    expect(readiness.ready ? [] : readiness.failures).toEqual(expect.arrayContaining([
      expect.stringContaining("public.camp_staff table"),
      expect.stringContaining("camp_campers migration 013 columns")
    ]));
  });

  it("is ready only when approval and every schema check pass", async () => {
    const schema = await checkOakwoodImportSchemaReadinessWithClient(oakwoodSchemaReadinessClient());
    expect(schema).toEqual({ ready: true });

    const readiness = await getOakwoodLiveImportReadiness(liveSession, {
      env: { CAMP_OAKWOOD_LIVE_IMPORT_APPROVED: "true" },
      supabase: oakwoodSchemaReadinessClient()
    });

    expect(readiness).toEqual({ ready: true });
  });
});

describe("camp repository mock fallback", () => {
  it("filters public overview payloads before they reach general leaders", async () => {
    const mockSession = session();
    const context = resolveCampAccessContext(mockSession, "general_leader");
    const overview = await getCampOverview(mockSession, context);

    expect(overview.documents.some((doc) => doc.audience === "Restricted Medical")).toBe(false);
    expect(JSON.stringify(overview)).not.toContain("Parent-labeled medication A");
    expect(JSON.stringify(overview)).not.toContain("Insurance card copy received");
  });

  it("scrubs public safety flags to prevent medical detail text from reaching public roster payloads", async () => {
    const mockSession = session();
    const context = resolveCampAccessContext(mockSession, "general_leader");
    const student = await upsertCampStudent(mockSession, context, {
      name: "Safety Flag Camper",
      grade: "9",
      teamId: "team-blue",
      vehicleId: "van-1",
      cabin: "Cabin S",
      limitedSafetyFlags: ["Benadryl at bedtime", "Hydration reminder"]
    });
    expect(student.allowed).toBe(true);

    const overview = await getCampOverview(mockSession, context);
    const serialized = JSON.stringify(overview);

    expect(serialized).not.toContain("Benadryl");
    expect(serialized).toContain("Hydration reminder");
    expect(serialized).toContain("Restricted info on file");
  });

  it("blocks restricted medication payloads unless the server context allows them", async () => {
    const mockSession = session();
    const general = resolveCampAccessContext(mockSession, "general_leader");
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    expect((await getRestrictedCampMedicationPayload(mockSession, general)).allowed).toBe(false);
    const payload = await getRestrictedCampMedicationPayload(mockSession, restricted);
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted medication payload");
    expect(payload.checkIn[0]?.medicationName).toBeTruthy();
  });

  it("persists roster and medication changes through the repository boundary in mock mode", async () => {
    const mockSession = session();
    const general = resolveCampAccessContext(mockSession, "general_leader");
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    const student = await upsertCampStudent(mockSession, general, {
      name: "Repository Camper",
      grade: "8",
      teamId: "team-blue",
      vehicleId: "van-1",
      cabin: "Cabin R",
      limitedSafetyFlags: ["Hydration reminder"]
    });
    expect(student.allowed).toBe(true);
    if (!student.allowed) throw new Error("expected camper create success");

    const medication = await upsertMedicationRecord(mockSession, restricted, {
      studentId: student.student.id,
      medicationName: "Parent-labeled medication",
      parentProvidedInstructions: "",
      checkInStatus: "Not Checked In",
      clarificationStatus: "Clear"
    });
    expect(medication.allowed).toBe(true);
    if (!medication.allowed) throw new Error("expected medication create success");
    expect(medication.record.clarificationStatus).toBe("Needs Parent Clarification");
  });

  it("saves restricted intake through the repository boundary and keeps it out of public overview", async () => {
    const mockSession = session();
    const general = resolveCampAccessContext(mockSession, "general_leader");
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    const intake = await saveMedicationIntake(mockSession, restricted, {
      studentId: "stu-1",
      medicationName: "Repository intake medication",
      dose: "Parent-labeled dose",
      scheduleText: "Breakfast",
      parentInstructions: "Follow signed parent instructions.",
      staffNotes: "Original container received.",
      quantityReceived: "8 tablets",
      containerStatus: "Original bottle",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 10, y: 20 }, { x: 30, y: 40 }]] },
      confirmationAcknowledged: true
    });

    expect(intake.allowed).toBe(true);
    if (!intake.allowed) throw new Error("expected intake save success");
    expect(intake.record).toMatchObject({ checkInStatus: "Checked In", latestQuantityReceived: "8 tablets" });

    const restrictedPayload = await getRestrictedCampMedicationPayload(mockSession, restricted);
    expect(restrictedPayload.allowed).toBe(true);
    if (!restrictedPayload.allowed) throw new Error("expected restricted payload");
    expect(restrictedPayload.intakeHistory[0]).toMatchObject({ guardianName: "Pat Parent", quantityReceived: "8 tablets" });

    const publicOverview = await getCampOverview(mockSession, general);
    expect(JSON.stringify(publicOverview)).not.toContain("Repository intake medication");
    expect(JSON.stringify(publicOverview)).not.toContain("Pat Parent");
  });

  it("parses medication handoff time lists into separate administration blocks", () => {
    expect(parseMedicationScheduleText("8am and 12pm")).toEqual(["8:00 AM", "12:00 PM"]);
    expect(parseMedicationScheduleText("0800, 1200")).toEqual(["8:00 AM", "12:00 PM"]);
    expect(parseMedicationScheduleText("8, 12")).toEqual(["8:00 AM", "12:00 PM"]);
    expect(parseMedicationScheduleText("Breakfast")).toEqual(["Breakfast"]);
  });

  it("creates separate medication schedule rows from intake time lists without duplicating active blocks", async () => {
    const mockSession = session();
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    const first = await saveMedicationIntake(mockSession, restricted, {
      studentId: "stu-1",
      medicationName: "Multi-time parent medication",
      dose: "Parent-labeled dose",
      scheduleText: "8am and 12pm",
      parentInstructions: "Follow signed parent instructions.",
      staffNotes: "",
      quantityReceived: "8 tablets",
      containerStatus: "Original bottle",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 10, y: 20 }, { x: 30, y: 40 }]] },
      confirmationAcknowledged: true
    });
    expect(first.allowed).toBe(true);
    if (!first.allowed) throw new Error("expected first intake save success");
    expect(first.scheduleItems.map((item) => item.timeWindow)).toEqual(["8:00 AM", "12:00 PM"]);

    const second = await saveMedicationIntake(mockSession, restricted, {
      medicationRecordId: first.record.id,
      studentId: "stu-1",
      medicationName: "Multi-time parent medication",
      dose: "Parent-labeled dose",
      scheduleText: "0800, 1200",
      parentInstructions: "Follow signed parent instructions.",
      staffNotes: "",
      quantityReceived: "8 tablets",
      containerStatus: "Original bottle",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 10, y: 20 }, { x: 30, y: 40 }]] },
      confirmationAcknowledged: true
    });
    expect(second.allowed).toBe(true);
    if (!second.allowed) throw new Error("expected second intake save success");
    expect(second.scheduleItems).toEqual([]);

    const payload = await getRestrictedCampMedicationPayload(mockSession, restricted);
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload");
    const generated = payload.schedule.filter((item) => item.medicationRecordId === first.record.id);
    expect(generated.map((item) => item.timeWindow).sort()).toEqual(["12:00 PM", "8:00 AM"]);
  });

  it("includes imported active campers without assignments or medication records in the restricted medication selector payload", async () => {
    const mockSession = session();
    const general = resolveCampAccessContext(mockSession, "general_leader");
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    const student = await upsertCampStudent(mockSession, general, {
      name: "Imported No Assignment Camper",
      grade: "9th",
      teamId: "",
      vehicleId: "",
      cabin: "",
      registrationExternalId: "70000991",
      limitedSafetyFlags: []
    });
    expect(student.allowed).toBe(true);
    if (!student.allowed) throw new Error("expected camper create success");

    const payload = await getRestrictedCampMedicationPayload(mockSession, restricted);
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted medication payload");

    expect(payload.campers).toContainEqual(expect.objectContaining({
      id: student.student.id,
      name: "Imported No Assignment Camper",
      teamId: "",
      vehicleId: "",
      cabin: "",
      registrationExternalId: "70000991"
    }));
    expect(payload.checkIn.some((record) => record.studentId === student.student.id)).toBe(false);
  });

  it("creates medication intake for an existing imported camper without duplicating the camper", async () => {
    const mockSession = session();
    const general = resolveCampAccessContext(mockSession, "general_leader");
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    const student = await upsertCampStudent(mockSession, general, {
      name: "Imported Medication Camper",
      grade: "10th",
      teamId: "",
      vehicleId: "",
      cabin: "",
      registrationExternalId: "70000992",
      limitedSafetyFlags: []
    });
    expect(student.allowed).toBe(true);
    if (!student.allowed) throw new Error("expected camper create success");

    const before = await getCampOverview(mockSession, general);
    const intake = await saveMedicationIntake(mockSession, restricted, {
      studentId: student.student.id,
      medicationName: "Imported camper parent medication",
      dose: "Parent label dose",
      scheduleText: "Breakfast",
      parentInstructions: "Follow parent instructions.",
      staffNotes: "",
      quantityReceived: "12 tablets",
      containerStatus: "Original labeled container received",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 4, y: 4 }, { x: 18, y: 18 }]] },
      clarificationStatus: "Clear",
      confirmationAcknowledged: true
    });
    expect(intake.allowed).toBe(true);
    if (!intake.allowed) throw new Error("expected intake success");

    const after = await getCampOverview(mockSession, general);
    expect(after.students.filter((camper) => camper.name === "Imported Medication Camper")).toHaveLength(1);
    expect(after.students).toHaveLength(before.students.length);

    const payload = await getRestrictedCampMedicationPayload(mockSession, restricted);
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted medication payload");
    expect(payload.checkIn).toContainEqual(expect.objectContaining({
      studentId: student.student.id,
      medicationName: "Imported camper parent medication"
    }));
  });

  it("keeps active medication workflow records available when history archive filtering is applied", async () => {
    const mockSession = session();
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    const before = await getRestrictedCampMedicationPayload(mockSession, restricted);
    expect(before.allowed).toBe(true);
    if (!before.allowed) throw new Error("expected restricted payload");
    const medication = before.checkIn[0];
    const returnItem = before.returnChecklist[0];
    expect(medication).toBeTruthy();
    expect(returnItem).toBeTruthy();

    const archiveMedication = await archiveMedicationWorkflowItem(mockSession, restricted, {
      target: "medication",
      id: medication.id,
      archiveReason: "Hide resolved correction row"
    });
    expect(archiveMedication.allowed).toBe(true);
    const archiveReturn = await archiveMedicationWorkflowItem(mockSession, restricted, {
      target: "return",
      id: returnItem.id,
      archiveReason: "Hide resolved correction row"
    });
    expect(archiveReturn.allowed).toBe(true);

    const after = await getRestrictedCampMedicationPayload(mockSession, restricted);
    expect(after.allowed).toBe(true);
    if (!after.allowed) throw new Error("expected restricted payload");
    expect(after.checkIn.find((item) => item.id === medication.id)).toMatchObject({ archivedAt: expect.any(String) });
    expect(after.returnChecklist.find((item) => item.id === returnItem.id)).toMatchObject({ archivedAt: expect.any(String) });
  });

  it("maps Supabase active medication workflow rows even when camper roster metadata is unavailable", () => {
    const payload = buildRestrictedCampMedicationPayloadFromRows({
      campers: new Map(),
      checkInRows: [{
        id: "med-prod-1",
        camper_id: "camper-prod-1",
        medication_name: "Parent-labeled medication",
        medicine_photo_status: "Photo Needed",
        parent_provided_instructions: "Follow parent label.",
        check_in_status: "Checked In",
        received_by: "Andrew",
        received_at: "2026-06-24T14:00:00.000Z",
        clarification_status: "Clear",
        supersedes_medication_record_id: null,
        correction_note: "",
        voided_at: null,
        voided_by_name: null,
        void_reason: null,
        archived_at: null,
        archived_by_user_id: null,
        archived_by_name: null,
        archive_reason: null
      }],
      scheduleRows: [{
        id: "sched-prod-1",
        medication_record_id: "med-prod-1",
        camper_id: "camper-prod-1",
        time_window: "Breakfast",
        parent_provided_instructions: "Follow parent label.",
        status: "Pending",
        last_logged_at: null,
        last_logged_by: null,
        supersedes_schedule_item_id: null,
        correction_note: null,
        voided_at: null,
        voided_by_name: null,
        void_reason: null,
        archived_at: null,
        archived_by_user_id: null,
        archived_by_name: null,
        archive_reason: null
      }],
      logRows: [],
      returnRows: [{
        id: "return-prod-1",
        medication_record_id: "med-prod-1",
        camper_id: "camper-prod-1",
        return_status: "Pending Return",
        returned_at: null,
        returned_by: null,
        recipient_name: null,
        recipient_relationship: null,
        return_notes: null,
        supersedes_return_item_id: null,
        correction_note: null,
        voided_at: null,
        voided_by_name: null,
        void_reason: null,
        archived_at: null,
        archived_by_user_id: null,
        archived_by_name: null,
        archive_reason: null
      }],
      intakeRows: [{
        id: "intake-prod-1",
        camper_id: "camper-prod-1",
        medication_record_id: "med-prod-1",
        medication_name: "Parent-labeled medication",
        dose: "Parent-labeled dose",
        schedule_text: "Breakfast",
        parent_instructions: "Follow parent label.",
        staff_notes: "",
        quantity_received: "11 tablets",
        container_status: "Original bottle",
        received_by_name: "Andrew",
        received_at: "2026-06-24T14:00:00.000Z",
        guardian_name: "Pat Parent",
        guardian_relationship: "Parent",
        guardian_signature_data: { width: 640, height: 220, strokes: [[{ x: 1, y: 1 }, { x: 2, y: 2 }]] },
        clarification_status: "Clear",
        confirmation_acknowledged: true,
        supersedes_intake_id: null,
        correction_note: "",
        voided_at: null,
        voided_by_name: null,
        void_reason: null,
        archived_at: null,
        archived_by_user_id: null,
        archived_by_name: null,
        archive_reason: null,
        created_at: "2026-06-24T14:00:00.000Z"
      }],
      photoRows: [{ medication_record_id: "med-prod-1" }]
    });

    expect(payload.checkIn).toHaveLength(1);
    expect(payload.intakeHistory).toHaveLength(1);
    expect(payload.returnChecklist).toHaveLength(1);
    expect(payload.schedule).toHaveLength(1);
    expect(payload.checkIn[0]).toMatchObject({
      id: "med-prod-1",
      studentId: "camper-prod-1",
      studentName: "Camper",
      latestQuantityReceived: "11 tablets",
      hasMedicationPhoto: true
    });
    expect(payload.returnChecklist[0]).toMatchObject({ id: "return-prod-1", archivedAt: undefined });
    expect(getMedicineIntakeReturnVisibility(payload, false).hasOperationalWorkflow).toBe(true);
  });

  it("hides archived intake history by default but reveals it when Show archived is requested", async () => {
    const mockSession = session();
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    const intake = await saveMedicationIntake(mockSession, restricted, {
      studentId: "stu-1",
      medicationName: "Archived history medication",
      dose: "Parent-labeled dose",
      scheduleText: "Dinner",
      parentInstructions: "Follow signed parent instructions.",
      staffNotes: "",
      quantityReceived: "6 tablets",
      containerStatus: "Original bottle",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 10, y: 20 }, { x: 30, y: 40 }]] },
      confirmationAcknowledged: true
    });
    expect(intake.allowed).toBe(true);
    if (!intake.allowed) throw new Error("expected intake save success");

    const archive = await archiveMedicationWorkflowItem(mockSession, restricted, {
      target: "intake",
      id: intake.intake.id,
      archiveReason: "Resolved duplicate"
    });
    expect(archive.allowed).toBe(true);

    const defaultPayload = await getRestrictedCampMedicationPayload(mockSession, restricted);
    expect(defaultPayload.allowed).toBe(true);
    if (!defaultPayload.allowed) throw new Error("expected restricted payload");
    expect(defaultPayload.intakeHistory.some((item) => item.id === intake.intake.id)).toBe(false);
    expect(defaultPayload.checkIn.some((item) => item.id === intake.record.id)).toBe(true);

    const withArchived = await getRestrictedCampMedicationPayload(mockSession, restricted, { includeArchived: true });
    expect(withArchived.allowed).toBe(true);
    if (!withArchived.allowed) throw new Error("expected restricted payload");
    expect(withArchived.intakeHistory.find((item) => item.id === intake.intake.id)).toMatchObject({ archivedAt: expect.any(String) });
  });

  it("archives and restores campers while preserving restricted medication history", async () => {
    const mockSession = session();
    const general = resolveCampAccessContext(mockSession, "general_leader");
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    const medicationBefore = await getRestrictedCampMedicationPayload(mockSession, restricted);
    expect(medicationBefore.allowed).toBe(true);
    if (!medicationBefore.allowed) throw new Error("expected restricted payload");
    expect(medicationBefore.checkIn.some((record) => record.studentId === "stu-1")).toBe(true);

    const archive = await archiveCampStudent(mockSession, restricted, { studentId: "stu-1", archiveReason: "Duplicate registration" });
    expect(archive.allowed).toBe(true);

    const publicOverview = await getCampOverview(mockSession, general);
    expect(publicOverview.students.some((student) => student.id === "stu-1")).toBe(false);

    const medicationAfterArchive = await getRestrictedCampMedicationPayload(mockSession, restricted);
    expect(medicationAfterArchive.allowed).toBe(true);
    if (!medicationAfterArchive.allowed) throw new Error("expected restricted payload");
    expect(medicationAfterArchive.checkIn.some((record) => record.studentId === "stu-1")).toBe(false);
    expect(medicationAfterArchive.administrationLog.some((log) => log.studentId === "stu-1")).toBe(false);

    const archived = await getArchivedCampStudents(mockSession, restricted);
    expect(archived.allowed).toBe(true);
    if (!archived.allowed) throw new Error("expected archived payload");
    expect(archived.students[0]).toMatchObject({ id: "stu-1", archiveReason: "Duplicate registration" });

    const restore = await restoreCampStudent(mockSession, restricted, { studentId: "stu-1" });
    expect(restore.allowed).toBe(true);

    const restoredOverview = await getCampOverview(mockSession, general);
    expect(restoredOverview.students.some((student) => student.id === "stu-1")).toBe(true);
  });

  it("removes a synthetic john test camper from every active camp payload after archive", async () => {
    const mockSession = session();
    const general = resolveCampAccessContext(mockSession, "general_leader");
    const driver = resolveCampAccessContext(mockSession, "driver");
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    const john = await upsertCampStudent(mockSession, general, {
      name: "john test",
      grade: "9th",
      teamId: "team-blue",
      vehicleId: "van-1",
      cabin: "Test Cabin",
      limitedSafetyFlags: ["Hydration reminder"]
    });
    expect(john.allowed).toBe(true);
    if (!john.allowed) throw new Error("expected john test create success");

    const medical = await upsertRestrictedMedicalRecord(mockSession, restricted, {
      studentId: john.student.id,
      studentName: "john test",
      medicalFormStatus: "Received",
      restrictedNotes: "synthetic john test restricted note",
      allergyNotes: "",
      insuranceStatus: "",
      emergencyContactName: "Synthetic Parent",
      emergencyContactPhone: "555-0000",
      emergencyContactRelationship: "Parent",
      parentMedicalNotes: ""
    });
    expect(medical.allowed).toBe(true);

    const medication = await upsertMedicationRecord(mockSession, restricted, {
      studentId: john.student.id,
      medicationName: "synthetic john test medication",
      parentProvidedInstructions: "",
      checkInStatus: "Not Checked In",
      clarificationStatus: "Clear"
    });
    expect(medication.allowed).toBe(true);

    const archive = await archiveCampStudent(mockSession, restricted, {
      studentId: john.student.id,
      archiveReason: "Synthetic production cleanup"
    });
    expect(archive.allowed).toBe(true);

    const publicPayloads = [
      await getCampOverview(mockSession, general),
      await getCampOverview(mockSession, driver, { vehicleId: "van-1" })
    ];
    for (const payload of publicPayloads) {
      expect(JSON.stringify(payload).toLowerCase()).not.toContain("john test");
    }

    const medicalPayload = await getRestrictedCampMedicalPayload(mockSession, restricted);
    expect(medicalPayload.allowed).toBe(true);
    if (!medicalPayload.allowed) throw new Error("expected restricted medical payload");
    expect(JSON.stringify(medicalPayload).toLowerCase()).not.toContain("john test");

    const medicationPayload = await getRestrictedCampMedicationPayload(mockSession, restricted);
    expect(medicationPayload.allowed).toBe(true);
    if (!medicationPayload.allowed) throw new Error("expected restricted medication payload");
    expect(JSON.stringify(medicationPayload).toLowerCase()).not.toContain("john test");
  });

  it("keeps medication photos behind restricted repository access", async () => {
    const mockSession = session();
    const general = resolveCampAccessContext(mockSession, "general_leader");
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    const upload = await saveMedicationPhoto(mockSession, restricted, {
      medicationRecordId: "med-1",
      file: new File(["fake image"], "medicine.jpg", { type: "image/jpeg" })
    });
    expect(upload.allowed).toBe(true);
    if (!upload.allowed) throw new Error("expected upload success");
    expect(upload.record).toMatchObject({ medicinePhotoStatus: "Photo On File", hasMedicationPhoto: true });

    const publicOverview = await getCampOverview(mockSession, general);
    const serialized = JSON.stringify(publicOverview);
    expect(serialized).not.toContain("campphoto");
    expect(serialized).not.toContain("signedUrl");
    expect(serialized).not.toContain("medicine.jpg");

    const denied = await getMedicationPhotoAccess(mockSession, general, "med-1");
    expect(denied.allowed).toBe(false);

    const access = await getMedicationPhotoAccess(mockSession, restricted, "med-1");
    expect(access.allowed).toBe(true);
    if (!access.allowed || "error" in access) throw new Error("expected restricted photo access");
    expect(access.signedUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("does not point corrected active medication rows at superseded photo records", async () => {
    const mockSession = session();
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    const upload = await saveMedicationPhoto(mockSession, restricted, {
      medicationRecordId: "med-1",
      file: new File(["fake image"], "medicine.jpg", { type: "image/jpeg" })
    });
    expect(upload.allowed).toBe(true);
    if (!upload.allowed) throw new Error("expected upload success");

    const correction = await upsertMedicationRecord(mockSession, restricted, {
      studentId: "stu-1",
      medicationName: "Corrected active medication row",
      medicinePhotoStatus: "Photo On File",
      parentProvidedInstructions: "Corrected parent instructions.",
      checkInStatus: "Checked In",
      clarificationStatus: "Clear",
      supersedesMedicationRecordId: "med-1",
      correctionNote: "Corrected medication label."
    });
    expect(correction.allowed).toBe(true);
    if (!correction.allowed) throw new Error("expected correction success");

    const payload = await getRestrictedCampMedicationPayload(mockSession, restricted);
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted medication payload");

    expect(payload.checkIn.some((record) => record.id === "med-1")).toBe(false);
    expect(payload.checkIn).toContainEqual(expect.objectContaining({
      id: correction.record.id,
      medicinePhotoStatus: "Photo Needed",
      hasMedicationPhoto: false,
      auditStatus: "Corrected"
    }));
  });

  it("previews and commits Oakwood rows in mock mode without fabricating blank assignments", async () => {
    const mockSession = session();
    const general = resolveCampAccessContext(mockSession, "general_leader");
    const restricted = resolveCampAccessContext(mockSession, "andrew");
    const csv = [
      "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Quick Filter,Emergency Contact,Medical Notes,Dietary Requirements",
      "70000010,Oakwood Camper,Student,9th,,Adult Small,Medical + Food/Diet,Pat Parent - (555) 222-3333,Parent medical note,Gluten-free",
      "70000011,Oakwood Adult,Adult Volunteer,,Suite 1,Adult Large,No Concern,,,,"
    ].join("\n");

    const preview = await getOakwoodImportPreview(mockSession, restricted, { csv, sourceFile: "Camp_Quick_View.csv" });
    expect(preview.allowed).toBe(true);
    if (!preview.allowed) throw new Error("expected preview success");
    expect(preview.preview.summary).toMatchObject({ students: 1, adults: 1, newCount: 2, ambiguousCount: 0 });
    expect(preview.preview.rows[0].person).toMatchObject({ cabin: "", teamName: "", vehicleName: "" });

    const unconfirmed = await commitOakwoodImport(mockSession, restricted, { preview: preview.preview, confirmed: false });
    expect(unconfirmed.status).toBe(400);
    expect("error" in unconfirmed ? unconfirmed.error : "").toMatch(/confirmation/i);

    const commit = await commitOakwoodImport(mockSession, restricted, { preview: preview.preview, confirmed: true });
    expect(commit.allowed).toBe(true);
    if (!commit.allowed || "error" in commit) throw new Error("expected commit success");
    expect(commit.result.committed).toHaveLength(2);
    expect(commit.result.committed).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Oakwood Adult", personType: "adult" }),
      expect.objectContaining({ name: "Oakwood Camper", personType: "student" })
    ]));
    expect(commit.result.auditBatch).toMatchObject({ sourceFile: "Camp_Quick_View.csv", staffCount: 1, restrictedCount: 1 });

    const overview = await getCampOverview(mockSession, general);
    const camper = overview.students.find((student) => student.name === "Oakwood Camper");
    expect(camper).toMatchObject({
      cabin: "",
      teamId: "",
      vehicleId: "",
      hasMedicalAlert: true,
      hasDietaryAlert: true,
      emergencyContactOnFile: true
    });
    expect(overview.staff.find((staff) => staff.name === "Oakwood Adult")).toMatchObject({
      role: "adult_volunteer",
      shirtSize: "Adult Large",
      registrationExternalId: "70000011"
    });
    expect(overview.students.some((student) => student.name === "Oakwood Adult")).toBe(false);
    expect(JSON.stringify(overview)).not.toContain("Parent medical note");
    expect(JSON.stringify(overview)).not.toContain("555");
  });

  it("commits explicit staff-only Oakwood rows as staff visible to team assignment data", async () => {
    const mockSession = session();
    const general = resolveCampAccessContext(mockSession, "general_leader");
    const restricted = resolveCampAccessContext(mockSession, "andrew");
    const csv = [
      "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Team,Quick Filter,Emergency Contact,Leader Photo,Source Church",
      "70000041,Fixture Staff Leader,,,Cabin L,Adult XL,Blue Team,No Concern,,https://photos.example.test/fixture-leader.jpg,Partner Chapel"
    ].join("\n");

    const preview = await getOakwoodUploadImportPreview(mockSession, restricted, {
      sourceName: "Oakwood Leaders Fixture",
      sources: [{
        scope: "staff_only",
        csv,
        fileName: "Oakwood_Leaders.csv",
        checksumSha256: "safe-fixture"
      }]
    });
    expect(preview.allowed).toBe(true);
    if (!preview.allowed) throw new Error("expected staff preview success");
    expect(preview.preview.summary).toMatchObject({ adults: 1, students: 0, staffRows: 1, restrictedRecordRows: 0 });
    expect(preview.preview.rows[0]).toMatchObject({ personType: "adult", matchStatus: "new" });

    const commit = await commitOakwoodImport(mockSession, restricted, { preview: preview.preview, confirmed: true });
    expect(commit.allowed).toBe(true);
    if (!commit.allowed || "error" in commit) throw new Error("expected staff commit success");
    expect(commit.result.committed).toEqual([
      expect.objectContaining({ name: "Fixture Staff Leader", personType: "adult" })
    ]);

    const overview = await getCampOverview(mockSession, general);
    expect(overview.staff.find((staff) => staff.name === "Fixture Staff Leader")).toMatchObject({
      role: "adult_volunteer",
      profilePhotoUrl: "https://photos.example.test/fixture-leader.jpg",
      shirtSize: "Adult XL",
      registrationExternalId: "70000041",
      sourceChurch: "Partner Chapel"
    });
    expect(overview.students.some((student) => student.name === "Fixture Staff Leader")).toBe(false);
    expect(JSON.stringify(overview)).not.toContain("Emergency Contact");
  });

  it("lets Camp Admin edit imported staff details without duplicating staff or exposing restricted data", async () => {
    const mockSession = session();
    const general = resolveCampAccessContext(mockSession, "general_leader");
    const restricted = resolveCampAccessContext(mockSession, "andrew");
    const csv = [
      "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Team,Quick Filter,Emergency Contact",
      "70000042,Editable Staff Leader,,,Cabin L,Adult XL,Blue Team,No Concern,"
    ].join("\n");

    const preview = await getOakwoodUploadImportPreview(mockSession, restricted, {
      sourceName: "Oakwood Staff Edit Fixture",
      sources: [{
        scope: "staff_only",
        csv,
        fileName: "Oakwood_Leaders.csv",
        checksumSha256: "safe-edit-fixture"
      }]
    });
    if (!preview.allowed) throw new Error("expected staff preview success");
    const commit = await commitOakwoodImport(mockSession, restricted, { preview: preview.preview, confirmed: true });
    if (!commit.allowed || "error" in commit) throw new Error("expected staff commit success");

    const before = await getCampStaffManagementPayload(mockSession, restricted);
    expect(before.allowed).toBe(true);
    if (!before.allowed) throw new Error("expected staff management payload");
    const staff = before.staff.find((member) => member.name === "Editable Staff Leader");
    const team = before.teams.find((item) => item.name === "Red") ?? before.teams[0];
    expect(staff).toMatchObject({ registrationExternalId: "70000042" });
    expect(team).toBeDefined();
    if (!staff || !team) throw new Error("expected imported staff and team");

    const blocked = await updateCampStaffMember(mockSession, general, {
      id: staff.id,
      name: "Blocked Staff Edit",
      role: "leader",
      teamId: team.id
    });
    expect(blocked.allowed).toBe(false);

    const updated = await updateCampStaffMember(mockSession, restricted, {
      id: staff.id,
      name: "Editable Staff Leader Updated",
      profilePhotoUrl: "https://photos.example.test/editable-updated.jpg",
      role: "leader",
      shirtSize: "Adult Medium",
      sourceChurch: "Updated Church",
      teamId: team.id
    });
    expect(updated.allowed).toBe(true);
    if (!updated.allowed || "error" in updated) throw new Error("expected staff update success");
    expect(updated.staff).toMatchObject({
      id: staff.id,
      name: "Editable Staff Leader Updated",
      profilePhotoUrl: "https://photos.example.test/editable-updated.jpg",
      role: "leader",
      shirtSize: "Adult Medium",
      sourceChurch: "Updated Church",
      teamId: team.id
    });

    const overview = await getCampOverview(mockSession, general);
    expect(overview.staff.filter((member) => member.id === staff.id)).toHaveLength(1);
    expect(overview.staff).toContainEqual(expect.objectContaining({ id: staff.id, name: "Editable Staff Leader Updated" }));
    expect(overview.students.some((student) => student.name === "Editable Staff Leader Updated")).toBe(false);
    expect(JSON.stringify(overview.staff)).not.toContain("Parent medical note");
  });

  it("blocks Oakwood ambiguous rows and never matches household id alone", async () => {
    const mockSession = session();
    const restricted = resolveCampAccessContext(mockSession, "andrew");

    const existingPreview = await getOakwoodImportPreview(mockSession, restricted, {
      csv: [
        "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Quick Filter,Emergency Contact",
        "70000020,Household One,Student,9th,Room 1,Adult Small,No Concern,Pat Parent - (555) 111-2222"
      ].join("\n")
    });
    expect(existingPreview.allowed).toBe(true);
    if (!existingPreview.allowed) throw new Error("expected existing preview success");

    const existing = await commitOakwoodImport(mockSession, restricted, {
      preview: existingPreview.preview,
      confirmed: true
    });
    expect(existing.allowed).toBe(true);

    const siblingPreview = await getOakwoodImportPreview(mockSession, restricted, {
      csv: [
        "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Quick Filter,Emergency Contact",
        "70000020,Household Two,Student,10th,Room 2,Adult Medium,No Concern,Pat Parent - (555) 111-2222"
      ].join("\n")
    });
    expect(siblingPreview.allowed).toBe(true);
    if (!siblingPreview.allowed) throw new Error("expected sibling preview success");
    expect(siblingPreview.preview.rows[0].matchStatus).toBe("new");

    const ambiguousPreview = await getOakwoodImportPreview(mockSession, restricted, {
      csv: [
        "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Quick Filter,Emergency Contact",
        "99999999,Household One,Student,9th,Room X,Adult Small,No Concern,Pat Parent - (555) 111-2222"
      ].join("\n")
    });
    expect(ambiguousPreview.allowed).toBe(true);
    if (!ambiguousPreview.allowed) throw new Error("expected ambiguous preview success");
    expect(ambiguousPreview.preview.rows[0].matchStatus).toBe("ambiguous");

    const blocked = await commitOakwoodImport(mockSession, restricted, { preview: ambiguousPreview.preview, confirmed: true });
    expect(blocked.status).toBe(409);
  });

  it("blocks Oakwood import preview and commit outside restricted boundaries", async () => {
    const mockSession = session();
    const general = resolveCampAccessContext(mockSession, "general_leader");
    const csv = "Registration ID,Name,Selection,Grade\n70000030,Blocked Camper,Student,9th";

    const preview = await getOakwoodImportPreview(mockSession, general, { csv });
    expect(preview.allowed).toBe(false);

    const commit = await commitOakwoodImport(mockSession, general, {
      preview: {
        sourceFile: "Camp_Quick_View.csv",
        rows: [],
        summary: {
          totalSourceRows: 0,
          personRows: 0,
          students: 0,
          adults: 0,
          newCount: 0,
          matchedCount: 0,
          ambiguousCount: 0,
          skippedCount: 0,
          invalidCount: 0,
          safeFieldRows: 0,
          restrictedRecordRows: 0,
          staffRows: 0
        }
      },
      confirmed: true
    });
    expect(commit.allowed).toBe(false);
  });
});
