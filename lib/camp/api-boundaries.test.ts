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
import { POST as uploadImportPOST } from "@/app/api/camp/import/upload/route";
import { POST as campEmmaPOST } from "@/app/api/camp/emma/route";
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
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelationship",
  "guardianPhone",
  "dietaryRequirements",
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

function session(role = "admin", overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    isMock: true,
    ...overrides,
    user: {
      id: overrides.user?.id ?? "usr_mock",
      email: overrides.user?.email ?? "staff@example.test",
      fullName: overrides.user?.fullName ?? "Mock Staff",
      role: overrides.user?.role ?? role
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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function oakwoodUploadRequest(url: string, file: File, options: { field?: "combinedFile" | "camperFile" | "staffFile"; sourceName?: string; mode?: "inspect" | "preview"; sheetName?: string } = {}) {
  const formData = new FormData();
  formData.set("mode", options.mode ?? "preview");
  if (options.sourceName) formData.set("sourceName", options.sourceName);
  const field = options.field ?? "combinedFile";
  formData.set(field, file);
  if (options.sheetName) {
    const sheetField = field === "combinedFile" ? "combinedSheet" : field === "camperFile" ? "camperSheet" : "staffSheet";
    formData.set(sheetField, options.sheetName);
  }
  return new Request(url, { method: "POST", body: formData });
}

function oakwoodCsvFile(name = "oakwood.csv", content = oakwoodCsvRows()) {
  return new File([content], name, { type: "text/csv" });
}

function oakwoodCsvRows() {
  return [
    "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Quick Filter,Emergency Contact,Medical Notes,Dietary Requirements",
    "70000100,Oakwood API Camper,Student,9th,,Adult Small,Medical + Food/Diet,Pat Parent - (555) 333-4444,Private medical note,Peanut-free",
    "70000101,Oakwood API Adult,Adult Volunteer,,Suite 1,Adult Large,No Concern,,,"
  ].join("\n");
}

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
    expect(JSON.stringify(payload)).not.toContain("Parent-labeled medication");
    expect(JSON.stringify(payload)).not.toContain("Follow the parent label");

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

  it("keeps Camp Finder safe for General Leaders and blocks EMMA modes", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const finder = await campEmmaPOST(jsonRequest("http://localhost/api/camp/emma?role=general_leader", {
      mode: "finder",
      query: "Where is Avery?",
      selectedDay: "Mon, Jun 29"
    }));
    const finderPayload = await finder.json();
    expect(finder.status).toBe(200);
    expect(JSON.stringify(finderPayload)).toContain("Avery Johnson");
    expectNoRestrictedPayloadDetails(finderPayload);

    const blocked = await campEmmaPOST(jsonRequest("http://localhost/api/camp/emma?role=general_leader", {
      mode: "ask_emma",
      query: "What still needs attention?"
    }));
    expect(blocked.status).toBe(403);
    expectNoRestrictedPayloadDetails(await json(blocked));
  });

  it("allows Jaci operational Camp EMMA but does not expose medical details", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await campEmmaPOST(jsonRequest("http://localhost/api/camp/emma?role=jaci", {
      mode: "ask_emma",
      query: "What medication dose does Avery need?",
      selectedDay: "Mon, Jun 29"
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(JSON.stringify(payload)).toMatch(/restricted medical details are not available/i);
    expectNoRestrictedPayloadDetails(payload);
  });

  it("does not expand Joel into Camp EMMA Smart Search or Ask EMMA", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await campEmmaPOST(jsonRequest("http://localhost/api/camp/emma?role=joel", {
      mode: "ask_emma",
      query: "What still needs attention?"
    }));

    expect(response.status).toBe(403);
    expectNoRestrictedPayloadDetails(await json(response));
  });

  it("allows Andrew Medical Command-aware EMMA counts without restricted medication payload details", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await campEmmaPOST(jsonRequest("http://localhost/api/camp/emma?role=andrew", {
      mode: "ask_emma",
      query: "What medicine is due?",
      selectedDay: "Mon, Jun 29",
      medicalCommandActive: true
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(JSON.stringify(payload)).toContain("andrew_medical");
    expect(JSON.stringify(payload)).toContain("scheduled for the selected Camp day");
    expect(JSON.stringify(payload)).toContain("medication blocks");
    // Temporal honesty: status counts are surfaced without claiming real-time "due now".
    expect(JSON.stringify(payload).toLowerCase()).not.toMatch(/due now|right now|tonight|today/);
    expectNoRestrictedPayloadDetails(payload);
  });

  it("requires restricted access and confirmation for Oakwood upload preview and commit", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["general_leader", "driver"]) {
      const denied = await uploadImportPOST(oakwoodUploadRequest(`http://localhost/api/camp/import/upload?role=${role}`, oakwoodCsvFile()));
      expect(denied.status).toBe(403);
      expectNoRestrictedPayloadDetails(await json(denied));
    }

    const previewResponse = await uploadImportPOST(oakwoodUploadRequest("http://localhost/api/camp/import/upload?role=andrew", oakwoodCsvFile(), {
      sourceName: "Camp Oakwood Upload"
    }));
    const previewPayload = await previewResponse.json() as { preview: { rows: Array<{ personType: string; matchStatus: string; person: { name: string } }>; summary: Record<string, number>; sourceKind?: string; importScope?: string } };
    expect(previewResponse.status).toBe(200);
    expect(previewPayload.preview.sourceKind).toBe("upload");
    expect(previewPayload.preview.importScope).toBe("full_roster");
    expect(previewPayload.preview.rows.find((row) => row.person.name === "Oakwood API Adult")).toMatchObject({ personType: "adult", matchStatus: "new" });
    expect(previewPayload.preview.rows.find((row) => row.person.name === "Oakwood API Camper")).toMatchObject({ personType: "student", matchStatus: "new" });
    expect(previewPayload.preview.summary.staffRows).toBe(1);
    expect(previewPayload.preview.summary.restrictedRecordRows).toBe(1);

    const unconfirmed = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "oakwoodCommit",
      oakwoodPreview: previewPayload.preview,
      confirmed: false
    }));
    expect(unconfirmed.status).toBe(400);

    const commitResponse = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "oakwoodCommit",
      oakwoodPreview: previewPayload.preview,
      confirmed: true
    }));
    const commitPayload = await commitResponse.json() as { result: { committed: Array<unknown>; auditBatch: Record<string, unknown> } };
    expect(commitResponse.status).toBe(200);
    expect(commitPayload.result.committed).toHaveLength(2);
    expect(commitPayload.result.auditBatch).toMatchObject({ sourceFile: "Camp Oakwood Upload", staffCount: 1, restrictedCount: 1 });

    const publicOverview = await campGET(new Request("http://localhost/api/camp?role=general_leader"));
    const publicPayload = await publicOverview.json();
    expect(JSON.stringify(publicPayload)).not.toContain("Private medical note");
    expect(JSON.stringify(publicPayload)).not.toContain("555");
    expectNoRestrictedPayloadDetails(publicPayload);
  });

  it("rejects invalid Oakwood upload extension and MIME combinations", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const badExtension = await uploadImportPOST(oakwoodUploadRequest(
      "http://localhost/api/camp/import/upload?role=andrew",
      new File(["not a roster"], "oakwood.txt", { type: "text/plain" })
    ));
    const badMime = await uploadImportPOST(oakwoodUploadRequest(
      "http://localhost/api/camp/import/upload?role=andrew",
      new File([oakwoodCsvRows()], "oakwood.csv", { type: "text/plain" })
    ));

    expect(badExtension.status).toBe(415);
    expect(badMime.status).toBe(415);
  });

  it("rejects oversized Oakwood uploads before parsing", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "oakwood.csv", { type: "text/csv" });
    const response = await uploadImportPOST(oakwoodUploadRequest("http://localhost/api/camp/import/upload?role=andrew", oversized));

    expect(response.status).toBe(413);
  });

  it("does not let live General Leaders or Drivers spoof Oakwood upload access with role=andrew", async () => {
    for (const liveSession of [
      session("leader", { isMock: false, user: { id: "live_leader", email: "leader@example.test", fullName: "Live Leader", role: "leader" } }),
      session("driver", { isMock: false, user: { id: "live_driver", email: "driver@example.test", fullName: "Live Driver", role: "driver" } })
    ]) {
      getServerSessionMock.mockResolvedValue(liveSession);

      const previewResponse = await uploadImportPOST(oakwoodUploadRequest("http://localhost/api/camp/import/upload?role=andrew", oakwoodCsvFile()));
      const commitResponse = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
        action: "oakwoodCommit",
        oakwoodPreview: {
          sourceFile: "Spoof.csv",
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
      }));

      expect(previewResponse.status).toBe(403);
      expect(commitResponse.status).toBe(403);
      expectNoRestrictedPayloadDetails(await json(previewResponse));
      expectNoRestrictedPayloadDetails(await json(commitResponse));
    }
  });

  it("uses live session identity, not the role query, for restricted Oakwood upload authorization", async () => {
    getServerSessionMock.mockResolvedValue(session("leader", {
      isMock: false,
      user: { id: "live_andrew", email: "andrew@example.test", fullName: "Andrew", role: "leader" }
    }));

    const response = await uploadImportPOST(oakwoodUploadRequest(
      "http://localhost/api/camp/import/upload?role=driver",
      oakwoodCsvFile("oakwood.csv", [
        "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Quick Filter,Emergency Contact",
        "70000121,Live Andrew Preview Staff,Adult Volunteer,,Room 1,Adult Small,No Concern,"
      ].join("\n"))
    ));

    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).toContain("Live Andrew Preview Staff");
  });

  it("keeps live Oakwood commits disabled even for restricted identities in this iteration", async () => {
    getServerSessionMock.mockResolvedValue(session("leader", {
      isMock: false,
      user: { id: "live_andrew", email: "andrew@example.test", fullName: "Andrew", role: "leader" }
    }));

    const response = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "oakwoodCommit",
      oakwoodPreview: {
        sourceFile: "Live Upload",
        sourceKind: "upload",
        importScope: "full_roster",
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
    }));
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toMatch(/Production Oakwood import commit is disabled/i);
  });

  it("rejects ambiguous Oakwood commits instead of overwriting automatically", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const firstPreview = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "oakwoodPreview",
      csv: [
        "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Quick Filter,Emergency Contact",
        "70000110,Ambiguous Staff,Adult Volunteer,,Room 1,Adult Small,No Concern,"
      ].join("\n")
    }));
    const firstPayload = await firstPreview.json() as { preview: unknown };
    const firstCommit = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "oakwoodCommit",
      oakwoodPreview: firstPayload.preview,
      confirmed: true
    }));
    expect(firstCommit.status).toBe(200);

    const ambiguousPreview = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "oakwoodPreview",
      csv: [
        "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Quick Filter,Emergency Contact",
        "99999999,Ambiguous Staff,Adult Volunteer,,Room 2,Adult Medium,No Concern,"
      ].join("\n")
    }));
    const ambiguousPayload = await ambiguousPreview.json() as { preview: { rows: Array<{ matchStatus: string }> } };
    expect(ambiguousPayload.preview.rows[0].matchStatus).toBe("ambiguous");

    const blockedCommit = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "oakwoodCommit",
      oakwoodPreview: ambiguousPayload.preview,
      confirmed: true
    }));
    expect(blockedCommit.status).toBe(409);
  });
});
