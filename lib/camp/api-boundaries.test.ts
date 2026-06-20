import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { __resetCampStoreForTests } from "@/lib/camp/store";

const { getServerSessionMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>()
}));

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    getServerSession: getServerSessionMock,
    unauthorizedResponse: () => Response.json({ error: "Authentication required" }, { status: 401 })
  };
});

import { POST as importPOST } from "@/app/api/camp/import/route";
import { GET as campGET } from "@/app/api/camp/route";
import { GET as medicalCommandGET } from "@/app/api/camp/medical-command/route";
import { GET as photoGET, POST as photoPOST } from "@/app/api/camp/medication/photos/route";
import { GET as medicationGET, POST as medicationPOST } from "@/app/api/camp/medication/route";
import { GET as medicalGET, POST as medicalPOST } from "@/app/api/camp/restricted-medical/route";
import { GET as studentsGET, PATCH as studentsPATCH } from "@/app/api/camp/students/route";

const restrictedNeedles = [
  "Parent-labeled medication A",
  "Parent-labeled medication B",
  "Follow the parent label",
  "Instruction conflict noted",
  "Insurance card copy received",
  "Parent requested leader check-in",
  "Food allergy details",
  "restrictedNotes",
  "allergyNotes",
  "insuranceStatus",
  "parentMedicalNotes",
  "medicationName",
  "parentProvidedInstructions",
  "guardianSignatureData",
  "guardianName",
  "dose",
  "quantityReceived",
  "intakeHistory",
  "administrationLog",
  "returnChecklist",
  "signedUrl",
  "storageObjectPath",
  "storageBucket",
  "photoRecords",
  "camp-medication-photos"
];

function session(role = "admin"): AuthSession {
  return {
    isMock: true,
    user: {
      id: "usr_mock",
      email: "staff@example.test",
      fullName: "Mock Staff",
      role
    }
  };
}

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function photoRequest(url: string, medicationRecordId = "med-1") {
  const formData = new FormData();
  formData.set("medicationRecordId", medicationRecordId);
  formData.set("photo", new File(["fake image"], "medicine.jpg", { type: "image/jpeg" }));
  return new Request(url, { method: "POST", body: formData });
}

async function json(response: Response) {
  return response.json() as Promise<unknown>;
}

function expectNoRestrictedPayloadDetails(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const needle of restrictedNeedles) {
    expect(serialized).not.toContain(needle);
  }
}

beforeEach(() => {
  __resetCampStoreForTests();
  getServerSessionMock.mockReset();
});

describe("camp API restricted data boundaries", () => {
  it("requires an authenticated session for the Camp overview", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const response = await campGET(new Request("http://localhost/api/camp"));

    expect(response.status).toBe(401);
    expect(await json(response)).toEqual({ error: "Authentication required" });
  });

  it("returns no restricted medical or medication details to General Leaders", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await campGET(new Request("http://localhost/api/camp?role=general_leader"));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expectNoRestrictedPayloadDetails(payload);
  });

  it("exposes only safe Leader Safety indicators (booleans) to General Leaders, never restricted fields", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await campGET(new Request("http://localhost/api/camp?role=general_leader"));
    const payload = (await response.json()) as { students: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(payload.students.length).toBeGreaterThan(0);

    // The boolean indicators the Leader Safety View renders are present...
    const indicatorStudent = payload.students.find((student) => student.hasMedicationPlan === true);
    expect(indicatorStudent).toBeDefined();
    expect(typeof indicatorStudent?.hasRestrictedMedicalInfo).toBe("boolean");
    expect(typeof indicatorStudent?.needsParentClarification).toBe("boolean");

    // ...while no restricted field (key or value) ever crosses the boundary.
    for (const student of payload.students) {
      for (const restrictedKey of [
        "medicationName",
        "parentProvidedInstructions",
        "dose",
        "allergyNotes",
        "insuranceStatus",
        "parentMedicalNotes",
        "guardianName",
        "guardianSignatureData"
      ]) {
        expect(student).not.toHaveProperty(restrictedKey);
      }
    }
    expectNoRestrictedPayloadDetails(payload);
  });

  it("returns driver vehicle roster identity only and no restricted fields", async () => {
    getServerSessionMock.mockResolvedValue(session("driver"));

    const response = await campGET(new Request("http://localhost/api/camp?role=driver&vehicleId=van-2"));
    const payload = await response.json() as { students: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(payload.students.length).toBeGreaterThan(0);
    for (const student of payload.students) {
      expect(Object.keys(student).sort()).toEqual(["id", "name", "photoInitials", "vehicleId", "vehicleName"].sort());
      expect(student.vehicleId).toBe("van-2");
    }
    expectNoRestrictedPayloadDetails(payload);
  });

  it("blocks General Leaders from restricted medical read and write routes", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const getResponse = await medicalGET(new Request("http://localhost/api/camp/restricted-medical?role=general_leader"));
    const postResponse = await medicalPOST(jsonRequest("http://localhost/api/camp/restricted-medical?role=general_leader", {
      studentId: "stu-1",
      studentName: "Camper One",
      medicalFormStatus: "Received",
      restrictedNotes: "Should not write",
      allergyNotes: "Should not write",
      insuranceStatus: "Should not write",
      parentMedicalNotes: "Should not write"
    }));

    expect(getResponse.status).toBe(403);
    expect(postResponse.status).toBe(403);
  });

  it("blocks General Leaders from medication read and write routes", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const getResponse = await medicationGET(new Request("http://localhost/api/camp/medication?role=general_leader"));
    const postResponse = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=general_leader", {
      studentId: "stu-1",
      medicationName: "Should not write",
      parentProvidedInstructions: "Should not write"
    }));
    const intakeResponse = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=general_leader", {
      target: "intake",
      studentId: "stu-1",
      medicationName: "Should not write",
      parentInstructions: "Should not write",
      guardianName: "Should not write",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 1, y: 1 }, { x: 2, y: 2 }]] },
      confirmationAcknowledged: true
    }));
    const voidResponse = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=general_leader", {
      target: "void",
      voidTarget: "medication",
      id: "med-1",
      voidReason: "Should not void"
    }));

    expect(getResponse.status).toBe(403);
    expect(postResponse.status).toBe(403);
    expect(intakeResponse.status).toBe(403);
    expect(voidResponse.status).toBe(403);
  });

  it("blocks General Leaders and Drivers from archive, restore, archived list, and medication photo routes", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["general_leader", "driver"]) {
      const archivedList = await studentsGET(new Request(`http://localhost/api/camp/students?role=${role}`));
      const archive = await studentsPATCH(jsonRequest(`http://localhost/api/camp/students?role=${role}`, {
        action: "archive",
        studentId: "stu-1",
        archiveReason: "Should not archive"
      }, "PATCH"));
      const restore = await studentsPATCH(jsonRequest(`http://localhost/api/camp/students?role=${role}`, {
        action: "restore",
        studentId: "stu-1"
      }, "PATCH"));
      const upload = await photoPOST(photoRequest(`http://localhost/api/camp/medication/photos?role=${role}`));
      const getPhoto = await photoGET(new Request(`http://localhost/api/camp/medication/photos?role=${role}&medicationRecordId=med-1`));

      expect(archivedList.status).toBe(403);
      expect(archive.status).toBe(403);
      expect(restore.status).toBe(403);
      expect(upload.status).toBe(403);
      expect(getPhoto.status).toBe(403);
    }
  });

  it("allows Andrew, Jaci, and Joel to reach restricted medical and medication routes", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["andrew", "jaci", "joel"]) {
      const medicalResponse = await medicalGET(new Request(`http://localhost/api/camp/restricted-medical?role=${role}`));
      const medicationResponse = await medicationGET(new Request(`http://localhost/api/camp/medication?role=${role}`));

      expect(medicalResponse.status).toBe(200);
      expect(medicationResponse.status).toBe(200);
      expect(JSON.stringify(await medicalResponse.json())).toContain("Insurance card copy received");
      expect(JSON.stringify(await medicationResponse.json())).toContain("Parent-labeled medication");
    }
  });

  it("allows restricted users to archive, restore, upload, and retrieve medication photos", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const upload = await photoPOST(photoRequest("http://localhost/api/camp/medication/photos?role=andrew"));
    const uploadPayload = await upload.json() as { record: Record<string, unknown> };
    const access = await photoGET(new Request("http://localhost/api/camp/medication/photos?role=andrew&medicationRecordId=med-1"));
    const accessPayload = await access.json() as { signedUrl: string };
    const archive = await studentsPATCH(jsonRequest("http://localhost/api/camp/students?role=andrew", {
      action: "archive",
      studentId: "stu-1",
      archiveReason: "Duplicate"
    }, "PATCH"));
    const archivedList = await studentsGET(new Request("http://localhost/api/camp/students?role=andrew"));
    const restore = await studentsPATCH(jsonRequest("http://localhost/api/camp/students?role=andrew", {
      action: "restore",
      studentId: "stu-1"
    }, "PATCH"));

    expect(upload.status).toBe(201);
    expect(uploadPayload.record).toMatchObject({ medicinePhotoStatus: "Photo On File" });
    expect(access.status).toBe(200);
    expect(accessPayload.signedUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(archive.status).toBe(200);
    expect(archivedList.status).toBe(200);
    expect(JSON.stringify(await archivedList.json())).toContain("Duplicate");
    expect(restore.status).toBe(200);
  });

  it("allows restricted users to save medication intake with signature history", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=andrew", {
      target: "intake",
      studentId: "stu-1",
      medicationName: "Parent handoff medication",
      dose: "Parent-labeled dose",
      scheduleText: "Breakfast",
      parentInstructions: "Follow signed parent instructions.",
      staffNotes: "Original bottle received.",
      quantityReceived: "10 tablets",
      containerStatus: "Original bottle, label readable",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 4, y: 4 }, { x: 18, y: 18 }]] },
      clarificationStatus: "Clear",
      confirmationAcknowledged: true
    }));
    const payload = await response.json() as { intake: Record<string, unknown>; record: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(payload.intake).toMatchObject({
      medicationName: "Parent handoff medication",
      quantityReceived: "10 tablets",
      guardianName: "Pat Parent"
    });
    expect(payload.record).toMatchObject({
      checkInStatus: "Checked In",
      latestQuantityReceived: "10 tablets"
    });

    const medicationResponse = await medicationGET(new Request("http://localhost/api/camp/medication?role=andrew"));
    const medicationPayload = await medicationResponse.json() as { intakeHistory: Array<Record<string, unknown>> };
    expect(medicationPayload.intakeHistory[0]).toMatchObject({ quantityReceived: "10 tablets" });
  });

  it("blocks Medical Command for General Leaders and Drivers (no payload)", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["general_leader", "driver"]) {
      const response = await medicalCommandGET(new Request(`http://localhost/api/camp/medical-command?role=${role}`));
      expect(response.status).toBe(403);
      expectNoRestrictedPayloadDetails(await json(response));
    }
  });

  it("blocks Andrew-only Medical Command for Jaci and Joel while keeping their normal medication access", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["jaci", "joel"]) {
      const medCmd = await medicalCommandGET(new Request(`http://localhost/api/camp/medical-command?role=${role}`));
      expect(medCmd.status).toBe(403);
      expectNoRestrictedPayloadDetails(await json(medCmd));

      // They retain normal restricted medication access.
      const medication = await medicationGET(new Request(`http://localhost/api/camp/medication?role=${role}`));
      expect(medication.status).toBe(200);

      // And the overview never advertises the Medical Command capability to them.
      const overview = await campGET(new Request(`http://localhost/api/camp?role=${role}`));
      const caps = (await overview.json() as { capabilities?: { medicalCommand?: boolean; restrictedMedical?: boolean } }).capabilities;
      expect(caps?.medicalCommand).toBe(false);
      expect(caps?.restrictedMedical).toBe(true);
    }
  });

  it("allows Andrew to access Medical Command with a medication time-block payload", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await medicalCommandGET(new Request("http://localhost/api/camp/medical-command?role=andrew"));
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      timeBlocks: Array<Record<string, unknown>>;
      checkIn?: unknown;
      intakeHistory?: unknown;
    };
    expect(Array.isArray(payload.timeBlocks)).toBe(true);
    expect(payload.checkIn).toBeUndefined();
    expect(payload.intakeHistory).toBeUndefined();
    expectNoRestrictedPayloadDetails(payload);
    expect(payload.timeBlocks[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      studentName: expect.any(String),
      timeWindow: expect.any(String),
      parentHandoffOnFile: expect.any(Boolean),
      stateLabel: expect.any(String),
      tone: expect.any(String)
    }));
    expect(JSON.stringify(payload)).not.toContain("Due");
    expect(JSON.stringify(payload)).not.toContain("Completed");
    expect(JSON.stringify(payload)).not.toContain("Overdue");
    expect(JSON.stringify(payload)).not.toContain("Needs Attention");

    const overview = await campGET(new Request("http://localhost/api/camp?role=andrew"));
    const caps = (await overview.json() as { capabilities?: { medicalCommand?: boolean } }).capabilities;
    expect(caps?.medicalCommand).toBe(true);
  });

  it("does not advertise Medical Command capability to General Leaders or Drivers", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["general_leader", "driver"]) {
      const overview = await campGET(new Request(`http://localhost/api/camp?role=${role}`));
      const caps = (await overview.json() as { capabilities?: { medicalCommand?: boolean; restrictedMedical?: boolean } }).capabilities;
      expect(caps?.medicalCommand).toBe(false);
      expect(caps?.restrictedMedical).toBe(false);
    }
  });

  it("forbids import preview and commit for General Leaders and Drivers", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["general_leader", "driver"]) {
      const previewResponse = await importPOST(jsonRequest(`http://localhost/api/camp/import?role=${role}`, {
        action: "preview",
        csv: "Student Name,Team,Vehicle\nCamper,Blue,Van 1"
      }));
      const commitResponse = await importPOST(jsonRequest(`http://localhost/api/camp/import?role=${role}`, {
        action: "commit",
        preview: { rows: [], summary: { totalRows: 0, readyRows: 0, clarificationRows: 0, blockedRows: 0 } }
      }));

      expect(previewResponse.status).toBe(403);
      expect(commitResponse.status).toBe(403);
    }
  });

  it("allows restricted users to preview and commit registration imports", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const previewResponse = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "preview",
      csv: [
        "Student Name,Grade,Team,Vehicle,Medication Name,Medication Instructions,Medication Time,Parent Medical Notes",
        "Import Camper,8th,Blue,Van 1,Parent-labeled medication,Follow signed parent instructions,Breakfast,Restricted parent note"
      ].join("\n")
    }));
    const previewPayload = await previewResponse.json() as { preview: unknown };
    const commitResponse = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "commit",
      preview: previewPayload.preview
    }));
    const commitPayload = await commitResponse.json() as { committed: Array<unknown> };

    expect(previewResponse.status).toBe(200);
    expect(commitResponse.status).toBe(200);
    expect(commitPayload.committed).toHaveLength(1);
  });
});
