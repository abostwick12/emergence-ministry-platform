import { beforeEach, describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import { resolveCampAccessContext } from "@/lib/camp/permissions";
import {
  archiveCampStudent,
  getCampOverview,
  getArchivedCampStudents,
  getMedicationPhotoAccess,
  getRestrictedCampMedicationPayload,
  restoreCampStudent,
  saveMedicationPhoto,
  saveMedicationIntake,
  upsertCampStudent,
  upsertMedicationRecord
} from "@/lib/camp/repository";
import { __resetCampStoreForTests } from "@/lib/camp/store";

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
      teamId: "team-cypress",
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
      teamId: "team-cypress",
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
      medicinePhotoStatus: "Photo On File",
      hasMedicationPhoto: false,
      auditStatus: "Corrected"
    }));
  });
});
