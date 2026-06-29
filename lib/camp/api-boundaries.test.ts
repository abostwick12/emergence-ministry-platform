import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { BOOTSTRAP_CAMP_ADMIN_EMAIL } from "@/lib/camp/access-control";
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
import { GET as accessGET, PATCH as accessPATCH, POST as accessPOST } from "@/app/api/camp/access/route";
import { POST as campEmmaPOST } from "@/app/api/camp/emma/route";
import { POST as bulletinPOST } from "@/app/api/camp/bulletins/route";
import { GET as campGET } from "@/app/api/camp/route";
import { GET as medicalCommandGET } from "@/app/api/camp/medical-command/route";
import { GET as photoGET, POST as photoPOST } from "@/app/api/camp/medication/photos/route";
import { POST as scanLabelPOST } from "@/app/api/camp/medication/scan-label/route";
import { GET as medicationGET, POST as medicationPOST } from "@/app/api/camp/medication/route";
import { GET as medicalGET, POST as medicalPOST } from "@/app/api/camp/restricted-medical/route";
import { GET as staffGET, PATCH as staffPATCH } from "@/app/api/camp/staff/route";
import { DELETE as studentPhotoDELETE, POST as studentPhotoPOST } from "@/app/api/camp/students/photo/route";
import { GET as studentsGET, PATCH as studentsPATCH, POST as studentsPOST } from "@/app/api/camp/students/route";
import { PATCH as teamsPATCH } from "@/app/api/camp/teams/route";

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

function andrewSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return session("admin", {
    ...overrides,
    user: {
      id: overrides.user?.id ?? "usr_andrew",
      email: overrides.user?.email ?? BOOTSTRAP_CAMP_ADMIN_EMAIL,
      fullName: overrides.user?.fullName ?? "Andrew Bostwick",
      role: overrides.user?.role ?? "admin"
    }
  });
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

function medicationPhotoRequest(url: string, medicationRecordId: string, intakeRecordId?: string) {
  const formData = new FormData();
  formData.set("medicationRecordId", medicationRecordId);
  if (intakeRecordId) formData.set("intakeRecordId", intakeRecordId);
  formData.set("photo", new File(["fake image"], "medicine.jpg", { type: "image/jpeg" }));
  return new Request(url, { method: "POST", body: formData });
}

function medicationScanRequest(url: string, file = new File(["fake image"], "medicine-label.jpg", { type: "image/jpeg" })) {
  const formData = new FormData();
  formData.set("frame", file);
  return new Request(url, { method: "POST", body: formData });
}

function camperPhotoRequest(url: string, studentId = "stu-1") {
  const formData = new FormData();
  formData.set("studentId", studentId);
  formData.set("photo", new File(["fake image"], "camper.jpg", { type: "image/jpeg" }));
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

describe("Camp launch readiness guards", () => {
  it("blocks preview/production Camp access stubs with a readiness error", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    getServerSessionMock.mockResolvedValue(andrewSession());

    const response = await campGET(new Request("http://localhost/api/camp?role=andrew"));
    const payload = await response.json() as { error?: string; code?: string };

    expect(response.status).toBe(403);
    expect(payload.code).toBe("camp_mock_auth_blocked");
    expect(payload.error).toMatch(/real authenticated Supabase session/i);
  });

  it("blocks launch-mode EMMA actions before mock pending actions or audit can succeed", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    getServerSessionMock.mockResolvedValue(andrewSession());

    const response = await campEmmaPOST(jsonRequest("http://localhost/api/camp/emma/actions?role=andrew", {
      originalCommandText: "Move Avery Johnson to Red Team"
    }));
    const payload = await response.json() as { code?: string };

    expect(response.status).toBe(403);
    expect(payload.code).toBe("camp_mock_auth_blocked");
  });

  it("blocks launch-mode import commits before mock commits can succeed", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    getServerSessionMock.mockResolvedValue(andrewSession());

    const response = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "oakwoodCommit",
      oakwoodPreview: oakwoodCommitPreview(),
      confirmed: true
    }));
    const payload = await response.json() as { code?: string };

    expect(response.status).toBe(403);
    expect(payload.code).toBe("camp_mock_auth_blocked");
  });

  it("blocks launch-mode Team Bulletin posts before mock store writes can succeed", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    getServerSessionMock.mockResolvedValue(andrewSession());

    const response = await bulletinPOST(jsonRequest("http://localhost/api/camp/bulletins?role=andrew", {
      teamId: "team-blue",
      message: "Launch check"
    }));
    const payload = await response.json() as { code?: string };

    expect(response.status).toBe(403);
    expect(payload.code).toBe("camp_mock_auth_blocked");
  });
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

async function seedImportedStaff(name = "API Imported Staff Leader") {
  const csv = [
    "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Team,Quick Filter,Emergency Contact",
    `70000994,${name},Adult Volunteer,,Leader Cabin,Adult Large,Blue Team,No Concern,`
  ].join("\n");
  const previewResponse = await importPOST(jsonRequest("http://localhost/api/camp/import", {
    action: "oakwoodPreview",
    csv,
    sourceFile: "Oakwood_Staff.csv"
  }));
  const previewPayload = await previewResponse.json() as { preview: unknown };
  expect(previewResponse.status).toBe(200);

  const commitResponse = await importPOST(jsonRequest("http://localhost/api/camp/import", {
    action: "oakwoodCommit",
    oakwoodPreview: previewPayload.preview,
    confirmed: true
  }));
  expect(commitResponse.status).toBe(200);
}

function oakwoodCommitPreview(summaryOverrides: Partial<Record<"ambiguousCount" | "invalidCount", number>> = {}) {
  return {
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
      ambiguousCount: summaryOverrides.ambiguousCount ?? 0,
      skippedCount: 0,
      invalidCount: summaryOverrides.invalidCount ?? 0,
      safeFieldRows: 0,
      restrictedRecordRows: 0,
      staffRows: 0
    }
  };
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

  it("ignores driver role query params when the authenticated user has no driver assignment", async () => {
    getServerSessionMock.mockResolvedValue(session("driver"));

    const response = await campGET(new Request("http://localhost/api/camp?role=driver&vehicleId=van-2"));
    const payload = await response.json() as { students: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(payload.students.length).toBeGreaterThan(0);
    for (const student of payload.students) {
      expect(student).toHaveProperty("teamName");
      expect(student).toHaveProperty("vehicleName");
      expect(student).not.toHaveProperty("medicationName");
    }
    expectNoRestrictedPayloadDetails(payload);
  });

  it("rejects Camp access management endpoints for non-admin authenticated users", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const list = await accessGET();
    const update = await accessPATCH(jsonRequest("http://localhost/api/camp/access", {
      email: "leader@example.test",
      campRole: "leader"
    }, "PATCH"));
    const invite = await accessPOST(jsonRequest("http://localhost/api/camp/access", {
      email: "leader@example.test",
      campRole: "medical_coordinator"
    }));

    expect(list.status).toBe(403);
    expect(update.status).toBe(403);
    expect(invite.status).toBe(403);
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
    expectNoRestrictedPayloadDetails(await json(getResponse));
  });

  it("blocks General Leaders and Drivers from archive, restore, archived list, and medication photo routes", async () => {
    getServerSessionMock.mockResolvedValue(session());
    vi.stubEnv("CAMP_MEDICATION_SCAN_ENABLED", "true");

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
      const archiveHistory = await medicationPOST(jsonRequest(`http://localhost/api/camp/medication?role=${role}`, {
        target: "archive",
        archiveTarget: "medication",
        id: "med-1",
        archiveReason: "Should not hide restricted history"
      }));
      const upload = await photoPOST(photoRequest(`http://localhost/api/camp/medication/photos?role=${role}`));
      const getPhoto = await photoGET(new Request(`http://localhost/api/camp/medication/photos?role=${role}&medicationRecordId=med-1`));
      const scanLabel = await scanLabelPOST(medicationScanRequest(`http://localhost/api/camp/medication/scan-label?role=${role}`));

      expect(archivedList.status).toBe(403);
      expect(archive.status).toBe(403);
      expect(restore.status).toBe(403);
      expect(archiveHistory.status).toBe(403);
      expect(upload.status).toBe(403);
      expect(getPhoto.status).toBe(403);
      expect(scanLabel.status).toBe(403);
    }
  });

  it("keeps label scanning disabled safely when the feature flag is missing", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

    const before = await medicationGET(new Request("http://localhost/api/camp/medication?role=andrew"));
    const beforePayload = await before.json() as { checkIn: unknown[]; intakeHistory: unknown[]; scanEnabled?: boolean };
    const response = await scanLabelPOST(medicationScanRequest("http://localhost/api/camp/medication/scan-label?role=andrew"));
    const payload = await response.json() as { error?: string; confidence?: string; warnings?: string[]; rawText?: string; signedUrl?: string; storageObjectPath?: string; processingPath?: string };
    const after = await medicationGET(new Request("http://localhost/api/camp/medication?role=andrew"));
    const afterPayload = await after.json() as { checkIn: unknown[]; intakeHistory: unknown[] };

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      error: "Medication label scanning is disabled.",
      confidence: "low",
      warnings: ["Medication label scanning is disabled."],
      processingPath: "server-side transient frame processing, no permanent image storage"
    });
    expect(beforePayload.scanEnabled).toBe(false);
    expect(payload.rawText).toBeUndefined();
    expect(payload.signedUrl).toBeUndefined();
    expect(payload.storageObjectPath).toBeUndefined();
    expect(afterPayload.checkIn).toHaveLength(beforePayload.checkIn.length);
    expect(afterPayload.intakeHistory).toHaveLength(beforePayload.intakeHistory.length);
  });

  it("keeps label scanning disabled safely when the feature flag is false", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());
    vi.stubEnv("CAMP_MEDICATION_SCAN_ENABLED", "false");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await scanLabelPOST(medicationScanRequest("http://localhost/api/camp/medication/scan-label?role=andrew"));
    const payload = await response.json() as { error?: string; warnings?: string[] };

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      error: "Medication label scanning is disabled.",
      warnings: ["Medication label scanning is disabled."]
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires authentication before label scanning", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const response = await scanLabelPOST(medicationScanRequest("http://localhost/api/camp/medication/scan-label"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
  });

  it("returns extracted label fields without creating medication rows directly", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());
    vi.stubEnv("CAMP_MEDICATION_SCAN_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({
      model: "gpt-4o-mini",
      choices: [
        {
          message: {
            content: JSON.stringify({
              studentNameOnLabel: "Riley Brooks",
              medicationName: "Camp label med",
              dose: "5 mg",
              directions: "Take one tablet by mouth every morning.",
              suggestedTimes: ["Morning"],
              quantityReceived: "10 tablets",
              instructions: "Original prescription label text only.",
              rawText: "Riley Brooks Camp label med 5 mg",
              confidence: "medium",
              warnings: ["Verify quantity against bottle."]
            })
          }
        }
      ]
    }));
    vi.stubGlobal("fetch", fetchMock);

    const before = await medicationGET(new Request("http://localhost/api/camp/medication?role=andrew"));
    const beforePayload = await before.json() as { checkIn: unknown[]; intakeHistory: unknown[] };
    const response = await scanLabelPOST(medicationScanRequest("http://localhost/api/camp/medication/scan-label?role=andrew"));
    const payload = await response.json() as { medicationName?: string; dose?: string; suggestedTimes?: string[]; confidence?: string; warnings?: string[]; rawText?: string; signedUrl?: string; storageObjectPath?: string; processingPath?: string };
    const after = await medicationGET(new Request("http://localhost/api/camp/medication?role=andrew"));
    const afterPayload = await after.json() as { checkIn: unknown[]; intakeHistory: unknown[] };
    const providerBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      medicationName: "Camp label med",
      dose: "5 mg",
      suggestedTimes: ["Morning"],
      confidence: "medium",
      rawText: "Riley Brooks Camp label med 5 mg",
      processingPath: "server-side transient frame processing, no permanent image storage"
    });
    expect(payload.warnings).toEqual(expect.arrayContaining([
      "Verify quantity against bottle.",
      "AI/OCR may misread medication labels. Verify every field against the original bottle before saving."
    ]));
    expect(payload.signedUrl).toBeUndefined();
    expect(payload.storageObjectPath).toBeUndefined();
    expect(JSON.stringify(providerBody)).toContain("data:image/jpeg;base64");
    expect(afterPayload.checkIn).toHaveLength(beforePayload.checkIn.length);
    expect(afterPayload.intakeHistory).toHaveLength(beforePayload.intakeHistory.length);
  });

  it("validates temporary label scan uploads before the OCR response", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());
    vi.stubEnv("CAMP_MEDICATION_SCAN_ENABLED", "true");

    const wrongType = await scanLabelPOST(medicationScanRequest(
      "http://localhost/api/camp/medication/scan-label?role=andrew",
      new File(["not image"], "medicine.txt", { type: "text/plain" })
    ));
    const largeImage = await scanLabelPOST(medicationScanRequest(
      "http://localhost/api/camp/medication/scan-label?role=andrew",
      new File([new Uint8Array((4 * 1024 * 1024) + 1)], "large-medicine-label.jpg", { type: "image/jpeg" })
    ));
    const missingImage = await scanLabelPOST(new Request("http://localhost/api/camp/medication/scan-label?role=andrew", { method: "POST", body: new FormData() }));

    expect(wrongType.status).toBe(400);
    expect(await wrongType.json()).toEqual({ error: "Prescription label scan must be a JPEG, PNG, or WebP image." });
    expect(largeImage.status).toBe(413);
    expect(await largeImage.json()).toEqual({ error: "Prescription label scan image must be 4 MB or smaller." });
    expect(missingImage.status).toBe(400);
    expect(await missingImage.json()).toEqual({ error: "A temporary prescription label image is required." });
  });

  it("allows Andrew's authenticated bootstrap identity to reach restricted medical and medication routes", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

    const medicalResponse = await medicalGET(new Request("http://localhost/api/camp/restricted-medical"));
    const medicationResponse = await medicationGET(new Request("http://localhost/api/camp/medication"));

    expect(medicalResponse.status).toBe(200);
    expect(medicationResponse.status).toBe(200);
    expect(JSON.stringify(await medicalResponse.json())).toContain("Insurance card copy received");
    const medicationPayload = await medicationResponse.json();
    expect(JSON.stringify(medicationPayload)).toContain("Parent-labeled medication");
    expect(JSON.stringify(medicationPayload)).toContain("Follow signed parent instructions");
  });

  it("blocks General Leaders from leader/staff management", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const list = await staffGET(new Request("http://localhost/api/camp/staff?role=general_leader"));
    const update = await staffPATCH(jsonRequest("http://localhost/api/camp/staff?role=general_leader", {
      id: "campstaff-missing",
      name: "Should Not Edit",
      profilePhotoUrl: "https://photos.example.test/blocked-leader-photo.jpg",
      role: "leader"
    }, "PATCH"));

    expect(list.status).toBe(403);
    expect(update.status).toBe(403);
    expectNoRestrictedPayloadDetails(await json(list));
    expectNoRestrictedPayloadDetails(await json(update));
  });

  it("blocks unauthenticated vehicle and team management mutations", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const vehicleAssignment = await studentsPATCH(jsonRequest("http://localhost/api/camp/students", {
      studentId: "stu-1",
      assignmentOnly: true,
      vehicleId: "van-1"
    }, "PATCH"));
    const teamAssignment = await studentsPATCH(jsonRequest("http://localhost/api/camp/students", {
      studentId: "stu-1",
      assignmentOnly: true,
      teamId: "team-red"
    }, "PATCH"));
    const teamUpdate = await teamsPATCH(jsonRequest("http://localhost/api/camp/teams", {
      id: "team-blue",
      name: "Blue",
      color: "Blue",
      leader: "Blocked Driver",
      room: "Blocked Room"
    }, "PATCH"));

    expect(vehicleAssignment.status).toBe(401);
    expect(teamAssignment.status).toBe(401);
    expect(teamUpdate.status).toBe(401);
    expectNoRestrictedPayloadDetails(await json(vehicleAssignment));
    expectNoRestrictedPayloadDetails(await json(teamAssignment));
    expectNoRestrictedPayloadDetails(await json(teamUpdate));
  });

  it("keeps vehicle assignment to CLC emergency roster campers and preserves unrelated fields", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

    const clcCreate = await studentsPOST(jsonRequest("http://localhost/api/camp/students?role=andrew", {
      name: "API CLC Vehicle Camper",
      grade: "10th",
      teamId: "team-blue",
      vehicleId: "",
      cabin: "Cabin API",
      shirtSize: "Adult Small",
      registrationExternalId: "API-CLC-TRANSPORT",
      rosterType: "emerge",
      hasMedicalAlert: true,
      hasDietaryAlert: true,
      limitedSafetyFlags: ["Allergy: Peanuts"]
    }));
    expect(clcCreate.status).toBe(201);
    const clcPayload = await clcCreate.json() as { student: { id: string } };

    const restricted = await medicalPOST(jsonRequest("http://localhost/api/camp/restricted-medical?role=andrew", {
      studentId: clcPayload.student.id,
      studentName: "API CLC Vehicle Camper",
      medicalFormStatus: "Received",
      restrictedNotes: "Private API restricted note",
      allergyNotes: "Private API allergy detail",
      insuranceStatus: "Private API insurance status",
      parentMedicalNotes: "Private API parent note"
    }));
    expect(restricted.status).toBe(200);

    const assign = await studentsPATCH(jsonRequest("http://localhost/api/camp/students?role=andrew", {
      studentId: clcPayload.student.id,
      assignmentOnly: true,
      vehicleId: "van-1"
    }, "PATCH"));
    expect(assign.status).toBe(200);
    const assignPayload = await assign.json() as { student: { teamId: string; vehicleId: string; cabin: string; registrationExternalId?: string; hasMedicalAlert?: boolean; hasDietaryAlert?: boolean; limitedSafetyFlags?: string[] } };
    expect(assignPayload.student).toMatchObject({
      teamId: "team-blue",
      vehicleId: "van-1",
      cabin: "Cabin API",
      registrationExternalId: "API-CLC-TRANSPORT",
      hasMedicalAlert: true,
      hasDietaryAlert: true
    });
    expect(assignPayload.student.limitedSafetyFlags).toContain("Allergy: Peanuts");

    const restrictedAfter = await medicalGET(new Request("http://localhost/api/camp/restricted-medical?role=andrew"));
    const restrictedAfterPayload = await restrictedAfter.json() as { records: Array<{ studentId: string; restrictedNotes: string; insuranceStatus: string }> };
    expect(restrictedAfterPayload.records.find((record) => record.studentId === clcPayload.student.id)).toMatchObject({
      restrictedNotes: "Private API restricted note",
      insuranceStatus: "Private API insurance status"
    });

    const partnerCreate = await studentsPOST(jsonRequest("http://localhost/api/camp/students?role=andrew", {
      name: "API Partner Vehicle Camper",
      grade: "10th",
      teamId: "",
      vehicleId: "",
      cabin: "Partner Cabin",
      rosterType: "partner",
      sourceChurch: "Grace Chapel",
      limitedSafetyFlags: []
    }));
    expect(partnerCreate.status).toBe(201);
    const partnerPayload = await partnerCreate.json() as { student: { id: string } };

    const blockedPartnerVehicle = await studentsPATCH(jsonRequest("http://localhost/api/camp/students?role=andrew", {
      studentId: partnerPayload.student.id,
      assignmentOnly: true,
      vehicleId: "van-1"
    }, "PATCH"));
    const allowedPartnerTeam = await studentsPATCH(jsonRequest("http://localhost/api/camp/students?role=andrew", {
      studentId: partnerPayload.student.id,
      assignmentOnly: true,
      teamId: "team-red"
    }, "PATCH"));

    expect(blockedPartnerVehicle.status).toBe(403);
    expect(allowedPartnerTeam.status).toBe(200);
  });

  it("returns active campers for restricted medication intake selection without requiring existing medication records", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

    const create = await studentsPOST(jsonRequest("http://localhost/api/camp/students?role=andrew", {
      name: "API Imported No Assignment Camper",
      grade: "9th",
      teamId: "",
      vehicleId: "",
      cabin: "",
      registrationExternalId: "70000993",
      limitedSafetyFlags: []
    }));
    const created = await create.json() as { student: { id: string } };
    const medicationResponse = await medicationGET(new Request("http://localhost/api/camp/medication?role=andrew"));
    const payload = await medicationResponse.json() as {
      campers: Array<{ id: string; name: string; teamId?: string; vehicleId?: string; cabin?: string; registrationExternalId?: string }>;
      checkIn: Array<{ studentId: string }>;
    };

    expect(create.status).toBe(201);
    expect(medicationResponse.status).toBe(200);
    expect(payload.campers).toContainEqual(expect.objectContaining({
      id: created.student.id,
      name: "API Imported No Assignment Camper",
      teamId: "",
      vehicleId: "",
      cabin: "",
      registrationExternalId: "70000993"
    }));
    expect(payload.checkIn.some((record) => record.studentId === created.student.id)).toBe(false);
  });

  it("allows Camp Admin to access and edit existing imported leader/staff details", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());
    await seedImportedStaff();

    const before = await staffGET(new Request("http://localhost/api/camp/staff?role=andrew"));
    const beforePayload = await before.json() as {
      staff: Array<{ id: string; name: string; profilePhotoUrl?: string; role: string; shirtSize?: string; sourceChurch?: string; teamId?: string; registrationExternalId?: string }>;
      teams: Array<{ id: string; name: string }>;
    };
    const imported = beforePayload.staff.find((staff) => staff.name === "API Imported Staff Leader");
    const team = beforePayload.teams.find((candidate) => candidate.name === "Red") ?? beforePayload.teams[0];
    expect(before.status).toBe(200);
    expect(imported).toMatchObject({ registrationExternalId: "70000994" });
    expect(team).toBeDefined();
    if (!team) throw new Error("expected a Camp team");

    const update = await staffPATCH(jsonRequest("http://localhost/api/camp/staff?role=andrew", {
      id: imported?.id,
      name: "API Imported Staff Leader Edited",
      profilePhotoUrl: "https://photos.example.test/api-staff.jpg",
      role: "leader",
      shirtSize: "Adult Medium",
      sourceChurch: "API Partner Church",
      teamId: team.id
    }, "PATCH"));
    const updatePayload = await update.json() as { staff: { id: string; name: string; profilePhotoUrl?: string; role: string; shirtSize?: string; sourceChurch?: string; teamId?: string } };
    const after = await staffGET(new Request("http://localhost/api/camp/staff?role=andrew"));
    const afterPayload = await after.json() as { staff: Array<{ id: string; name: string }> };
    const overview = await campGET(new Request("http://localhost/api/camp?role=andrew"));
    const overviewPayload = await overview.json() as { staff: Array<{ id: string; name: string }>; students: Array<{ name: string }> };

    expect(update.status).toBe(200);
    expect(updatePayload.staff).toMatchObject({
      id: imported?.id,
      name: "API Imported Staff Leader Edited",
      profilePhotoUrl: "https://photos.example.test/api-staff.jpg",
      role: "leader",
      shirtSize: "Adult Medium",
      sourceChurch: "API Partner Church",
      teamId: team.id
    });
    expect(afterPayload.staff.filter((staff) => staff.id === imported?.id)).toHaveLength(1);
    expect(overviewPayload.staff).toContainEqual(expect.objectContaining({ id: imported?.id, name: "API Imported Staff Leader Edited" }));
    expect(overviewPayload.students.some((student) => student.name === "API Imported Staff Leader Edited")).toBe(false);
    expectNoRestrictedPayloadDetails(overviewPayload.staff);
  });

  it("allows Camp Admin to save existing leader/staff details with only a name change", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());
    await seedImportedStaff();

    const before = await staffGET(new Request("http://localhost/api/camp/staff?role=andrew"));
    const beforePayload = await before.json() as {
      staff: Array<{ id: string; name: string; role: string; shirtSize?: string; sourceChurch?: string; teamId?: string; registrationExternalId?: string }>;
    };
    const imported = beforePayload.staff.find((staff) => staff.name === "API Imported Staff Leader");
    expect(imported).toMatchObject({ registrationExternalId: "70000994" });
    if (!imported) throw new Error("expected imported staff");

    const update = await staffPATCH(jsonRequest("http://localhost/api/camp/staff?role=andrew", {
      id: imported.id,
      name: "API Name Only Staff Edit"
    }, "PATCH"));
    const updatePayload = await update.json() as { staff: { id: string; name: string; role: string; shirtSize?: string; sourceChurch?: string; teamId?: string } };

    expect(update.status).toBe(200);
    expect(updatePayload.staff).toMatchObject({
      id: imported.id,
      name: "API Name Only Staff Edit",
      role: imported.role,
      shirtSize: imported.shirtSize,
      sourceChurch: imported.sourceChurch,
      teamId: imported.teamId
    });
  });

  it("allows restricted users to archive, restore, upload, and retrieve medication photos", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

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

  it("keeps operational medication and return rows in the route payload after history archive filtering", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

    const before = await medicationGET(new Request("http://localhost/api/camp/medication?role=andrew"));
    const beforePayload = await before.json() as {
      checkIn: Array<{ id: string }>;
      returnChecklist: Array<{ id: string }>;
    };
    const medicationId = beforePayload.checkIn[0]?.id;
    const returnId = beforePayload.returnChecklist[0]?.id;
    expect(medicationId).toBeTruthy();
    expect(returnId).toBeTruthy();

    const archiveMedication = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=andrew", {
      target: "archive",
      archiveTarget: "medication",
      id: medicationId,
      archiveReason: "Resolved correction hidden from history"
    }));
    const archiveReturn = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=andrew", {
      target: "archive",
      archiveTarget: "return",
      id: returnId,
      archiveReason: "Resolved correction hidden from history"
    }));
    const after = await medicationGET(new Request("http://localhost/api/camp/medication?role=andrew"));
    const afterPayload = await after.json() as {
      checkIn: Array<{ id: string; archivedAt?: string }>;
      returnChecklist: Array<{ id: string; archivedAt?: string }>;
    };

    expect(archiveMedication.status).toBe(200);
    expect(archiveReturn.status).toBe(200);
    expect(after.status).toBe(200);
    expect(afterPayload.checkIn.find((item) => item.id === medicationId)).toMatchObject({ archivedAt: expect.any(String) });
    expect(afterPayload.returnChecklist.find((item) => item.id === returnId)).toMatchObject({ archivedAt: expect.any(String) });
  });

  it("links restricted medication photos to the intake record when provided", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

    const intakeResponse = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=andrew", {
      target: "intake",
      studentId: "stu-1",
      medicationRecordId: "med-1",
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
    const intakePayload = await intakeResponse.json() as { intake: { id: string; medicationRecordId: string } };

    const upload = await photoPOST(medicationPhotoRequest("http://localhost/api/camp/medication/photos?role=andrew", intakePayload.intake.medicationRecordId, intakePayload.intake.id));
    const uploadPayload = await upload.json() as { photo: Record<string, unknown> };

    expect(upload.status).toBe(201);
    expect(uploadPayload.photo).toMatchObject({ intakeRecordId: intakePayload.intake.id });
  });

  it("keeps ordinary camper profile photos on authenticated roster routes and away from EMMA answers", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

    const upload = await studentPhotoPOST(camperPhotoRequest("http://localhost/api/camp/students/photo", "stu-1"));
    const uploadPayload = await upload.json() as { student?: { profilePhotoUrl?: string } };
    const overview = await campGET(new Request("http://localhost/api/camp"));
    const overviewPayload = await overview.json() as { students: Array<{ id: string; profilePhotoUrl?: string }> };
    const emma = await campEmmaPOST(jsonRequest("http://localhost/api/camp/emma", { query: "Where is Avery Johnson?", mode: "finder" }));
    const emmaPayload = await emma.json();
    const removed = await studentPhotoDELETE(new Request("http://localhost/api/camp/students/photo?studentId=stu-1", { method: "DELETE" }));
    const afterRemove = await campGET(new Request("http://localhost/api/camp"));
    const afterRemovePayload = await afterRemove.json() as { students: Array<{ id: string; profilePhotoUrl?: string }> };

    expect(upload.status).toBe(201);
    expect(uploadPayload.student?.profilePhotoUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(overviewPayload.students.find((student) => student.id === "stu-1")?.profilePhotoUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(JSON.stringify(emmaPayload)).not.toContain("data:image");
    expect(removed.status).toBe(200);
    expect(afterRemovePayload.students.find((student) => student.id === "stu-1")?.profilePhotoUrl).toBeUndefined();
  });

  it("requires authentication for camper profile photo writes", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const upload = await studentPhotoPOST(camperPhotoRequest("http://localhost/api/camp/students/photo", "stu-1"));
    const removed = await studentPhotoDELETE(new Request("http://localhost/api/camp/students/photo?studentId=stu-1", { method: "DELETE" }));

    expect(upload.status).toBe(401);
    expect(removed.status).toBe(401);
  });

  it("allows restricted users to save medication intake with signature history", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

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
    const payload = await response.json() as { intake: Record<string, unknown>; record: Record<string, unknown>; scheduleItems: Array<Record<string, unknown>> };

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
    expect(payload.scheduleItems).toContainEqual(expect.objectContaining({ timeWindow: "Breakfast" }));

    const medicationResponse = await medicationGET(new Request("http://localhost/api/camp/medication?role=andrew"));
    const medicationPayload = await medicationResponse.json() as { intakeHistory: Array<Record<string, unknown>>; schedule: Array<Record<string, unknown>> };
    expect(medicationPayload.intakeHistory[0]).toMatchObject({ quantityReceived: "10 tablets" });
    expect(medicationPayload.schedule).toContainEqual(expect.objectContaining({ timeWindow: "Breakfast" }));
  });

  it("allows restricted users to complete one intake session with multiple medication rows", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());
    vi.stubEnv("CAMP_MEDICATION_SCAN_ENABLED", "false");

    const response = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=andrew", {
      target: "intakeSession",
      studentId: "stu-3",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 4, y: 4 }, { x: 18, y: 18 }]] },
      confirmationAcknowledged: true,
      medications: [
        {
          medicationName: "API breakfast med",
          dose: "1 tablet",
          scheduleText: "Breakfast",
          parentInstructions: "Take with breakfast.",
          quantityReceived: "10 tablets",
          containerStatus: "Original bottle"
        },
        {
          medicationName: "API dinner med",
          dose: "1 capsule",
          scheduleText: "Dinner",
          parentInstructions: "Take after dinner.",
          quantityReceived: "5 capsules",
          containerStatus: "Original bottle"
        }
      ]
    }));
    const payload = await response.json() as { session: Record<string, unknown>; intakes: Array<Record<string, unknown>>; records: Array<Record<string, unknown>> };

    expect(response.status).toBe(201);
    expect(payload.session).toMatchObject({ studentName: "Riley Brooks", medicationCount: 2, guardianName: "Pat Parent" });
    expect(payload.intakes).toHaveLength(2);
    expect(payload.records.map((record) => record.medicationName)).toEqual(expect.arrayContaining(["API breakfast med", "API dinner med"]));

    const medicationResponse = await medicationGET(new Request("http://localhost/api/camp/medication?role=andrew"));
    const medicationPayload = await medicationResponse.json() as { intakeSessions: Array<Record<string, unknown>>; intakeHistory: Array<Record<string, unknown>>; scanEnabled?: boolean };
    expect(medicationPayload.scanEnabled).toBe(false);
    expect(medicationPayload.intakeSessions[0]).toMatchObject({ medicationCount: 2 });
    expect(medicationPayload.intakeHistory.map((item) => item.medicationName)).toEqual(expect.arrayContaining(["API breakfast med", "API dinner med"]));
  });

  it("blocks grouped intake sessions for general leaders without leaking request details", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=general_leader", {
      target: "intakeSession",
      studentId: "stu-3",
      receivedByName: "Leader",
      guardianName: "Sensitive Guardian",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 4, y: 4 }, { x: 18, y: 18 }]] },
      confirmationAcknowledged: true,
      medications: [
        {
          medicationName: "Sensitive grouped intake med",
          dose: "Sensitive dose",
          scheduleText: "Breakfast",
          parentInstructions: "Sensitive parent instructions.",
          quantityReceived: "10 tablets",
          containerStatus: "Original bottle"
        }
      ]
    }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expectNoRestrictedPayloadDetails(payload);
    expect(JSON.stringify(payload)).not.toContain("Sensitive grouped intake med");
    expect(JSON.stringify(payload)).not.toContain("Sensitive Guardian");
  });

  it("returns safe 404s for missing grouped intake camper and grouped med-pass schedule", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

    const missingCamper = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=andrew", {
      target: "intakeSession",
      studentId: "missing-camper",
      receivedByName: "Andrew",
      guardianName: "Sensitive Guardian",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 4, y: 4 }, { x: 18, y: 18 }]] },
      confirmationAcknowledged: true,
      medications: [
        {
          medicationName: "Sensitive missing camper med",
          dose: "Sensitive dose",
          scheduleText: "Breakfast",
          parentInstructions: "Sensitive parent instructions.",
          quantityReceived: "10 tablets",
          containerStatus: "Original bottle"
        }
      ]
    }));
    const missingCamperPayload = await missingCamper.json();

    expect(missingCamper.status).toBe(404);
    expect(missingCamperPayload).toEqual({ error: "Camper not found." });
    expect(JSON.stringify(missingCamperPayload)).not.toContain("Sensitive missing camper med");
    expect(JSON.stringify(missingCamperPayload)).not.toContain("Sensitive Guardian");

    const missingSchedule = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=andrew", {
      target: "groupedAdministration",
      studentId: "stu-1",
      timeWindow: "Breakfast",
      administeredBy: "Andrew",
      studentAcknowledgementInitials: "AJ",
      items: [
        { medicationRecordId: "sensitive-medication-id", scheduleItemId: "missing-schedule", status: "administered", doseGiven: "Sensitive dose" }
      ]
    }));
    const missingSchedulePayload = await missingSchedule.json();

    expect(missingSchedule.status).toBe(404);
    expect(missingSchedulePayload).toEqual({ error: "Medication schedule item not found." });
    expect(JSON.stringify(missingSchedulePayload)).not.toContain("sensitive-medication-id");
    expect(JSON.stringify(missingSchedulePayload)).not.toContain("Sensitive dose");
  });

  it("blocks Medical Command for General Leaders and Drivers (no payload)", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["general_leader", "driver"]) {
      const response = await medicalCommandGET(new Request(`http://localhost/api/camp/medical-command?role=${role}`));
      expect(response.status).toBe(403);
      expectNoRestrictedPayloadDetails(await json(response));
    }
  });

  it("does not let Jaci or Joel role query params grant restricted medication access", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["jaci", "joel"]) {
      const medCmd = await medicalCommandGET(new Request(`http://localhost/api/camp/medical-command?role=${role}`));
      expect(medCmd.status).toBe(403);
      expectNoRestrictedPayloadDetails(await json(medCmd));

      const medication = await medicationGET(new Request(`http://localhost/api/camp/medication?role=${role}`));
      expect(medication.status).toBe(403);

      const overview = await campGET(new Request(`http://localhost/api/camp?role=${role}`));
      const caps = (await overview.json() as { capabilities?: { medicalCommand?: boolean; restrictedMedical?: boolean } }).capabilities;
      expect(caps?.medicalCommand).toBe(false);
      expect(caps?.restrictedMedical).toBe(false);
    }
  });

  it("allows Andrew to access Medical Command with a medication time-block payload", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

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
      medicationRecordId: expect.any(String),
      studentId: expect.any(String),
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

  it("limits medication administration writes to Andrew and requires student acknowledgement", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["jaci", "joel", "general_leader", "driver"]) {
      const response = await medicationPOST(jsonRequest(`http://localhost/api/camp/medication?role=${role}`, {
        target: "administrationLog",
        scheduleItemId: "med-sched-1",
        loggedBy: role,
        status: "Logged",
        studentAcknowledgementInitials: "AJ"
      }));
      expect(response.status).toBe(403);
    }

    getServerSessionMock.mockResolvedValue(andrewSession());

    const missingAck = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=andrew", {
      target: "administrationLog",
      scheduleItemId: "med-sched-1",
      loggedBy: "Andrew",
      status: "Logged"
    }));
    expect(missingAck.status).toBe(400);
    expect(await missingAck.json()).toMatchObject({ error: expect.stringMatching(/acknowledgement initials are required/i) });

    const missingUnavailableReason = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=andrew", {
      target: "administrationLog",
      scheduleItemId: "med-sched-1",
      loggedBy: "Andrew",
      status: "Logged",
      studentAcknowledgementUnavailable: true
    }));
    expect(missingUnavailableReason.status).toBe(400);
    expect(await missingUnavailableReason.json()).toMatchObject({ error: expect.stringMatching(/reason is required/i) });

    const logged = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=andrew", {
      target: "administrationLog",
      scheduleItemId: "med-sched-1",
      loggedBy: "Andrew",
      status: "Logged",
      notes: "Logged after student acknowledgement.",
      studentAcknowledgementInitials: "AJ"
    }));
    expect(logged.status).toBe(200);
    const payload = await logged.json() as { log: Record<string, unknown> };
    expect(payload.log).toMatchObject({
      scheduleItemId: "med-sched-1",
      loggedBy: "Andrew",
      status: "Logged",
      studentAcknowledgementInitials: "AJ",
      studentAcknowledgementUnavailable: false
    });
  });

  it("allows Andrew to submit one grouped med pass with itemized statuses", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

    const first = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=andrew", {
      target: "intakeSession",
      studentId: "stu-3",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 4, y: 4 }, { x: 18, y: 18 }]] },
      confirmationAcknowledged: true,
      medications: [
        { medicationName: "Grouped med A", dose: "1 tablet", scheduleText: "Breakfast", parentInstructions: "Take with food.", quantityReceived: "10 tablets", containerStatus: "Original bottle" },
        { medicationName: "Grouped med B", dose: "1 capsule", scheduleText: "Breakfast", parentInstructions: "Take with water.", quantityReceived: "5 capsules", containerStatus: "Original bottle" }
      ]
    }));
    const firstPayload = await first.json() as { records: Array<{ id: string; medicationName: string }>; scheduleItems: Array<{ id: string; medicationRecordId: string; timeWindow: string }> };
    expect(first.status).toBe(201);
    const medA = firstPayload.records.find((record) => record.medicationName === "Grouped med A");
    const medB = firstPayload.records.find((record) => record.medicationName === "Grouped med B");
    const schedA = firstPayload.scheduleItems.find((item) => item.medicationRecordId === medA?.id && item.timeWindow === "Breakfast");
    const schedB = firstPayload.scheduleItems.find((item) => item.medicationRecordId === medB?.id && item.timeWindow === "Breakfast");
    expect(medA && medB && schedA && schedB).toBeTruthy();
    if (!medA || !medB || !schedA || !schedB) throw new Error("expected grouped medication records and schedules");

    const grouped = await medicationPOST(jsonRequest("http://localhost/api/camp/medication?role=andrew", {
      target: "groupedAdministration",
      studentId: "stu-3",
      timeWindow: "Breakfast",
      administeredBy: "Andrew",
      studentAcknowledgementInitials: "RB",
      items: [
        { medicationRecordId: medA.id, scheduleItemId: schedA.id, status: "administered", doseGiven: "1 tablet" },
        { medicationRecordId: medB.id, scheduleItemId: schedB.id, status: "refused", doseGiven: "1 capsule", notes: "Student refused." }
      ]
    }));
    const groupedPayload = await grouped.json() as { event: Record<string, unknown>; items: Array<Record<string, unknown>>; logs: Array<Record<string, unknown>> };

    expect(grouped.status).toBe(200);
    expect(groupedPayload.event).toMatchObject({ studentName: "Riley Brooks", itemCount: 2 });
    expect(groupedPayload.items.map((item) => item.status)).toEqual(expect.arrayContaining(["administered", "refused"]));
    expect(groupedPayload.logs).toHaveLength(2);
  });

  it("blocks grouped med-pass writes outside Andrew without leaking request details", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["jaci", "joel", "general_leader", "driver"]) {
      const response = await medicationPOST(jsonRequest(`http://localhost/api/camp/medication?role=${role}`, {
        target: "groupedAdministration",
        studentId: "stu-1",
        timeWindow: "Breakfast",
        administeredBy: role,
        studentAcknowledgementInitials: "AJ",
        notes: "Sensitive med-pass note",
        items: [
          { medicationRecordId: "med-1", scheduleItemId: "med-sched-1", status: "administered", doseGiven: "Sensitive dose" }
        ]
      }));
      const payload = await response.json();

      expect(response.status).toBe(403);
      expectNoRestrictedPayloadDetails(payload);
      expect(JSON.stringify(payload)).not.toContain("Sensitive med-pass note");
      expect(JSON.stringify(payload)).not.toContain("Sensitive dose");
    }
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

  it("forbids import preview and commit outside Camp Admin", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["jaci", "joel", "general_leader", "driver"]) {
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

  it("allows Andrew to preview and commit registration imports", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

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

  it("allows Andrew to save valid partner church rows with warnings while skipping blocked rows", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

    const previewResponse = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "preview",
      sourceType: "partnerChurch",
      sourceName: "Partner Church Upload",
      csv: [
        "Student Name,Team,Partner Church,Medication On File,Emergency Contact Name,Emergency Contact Phone",
        "Partner Minimal Camper,Silver,Grace Chapel,Yes,Private Parent,555-777-8888",
        ",Blue,Grace Chapel,No,Missing Name Parent,555-000-0000"
      ].join("\n")
    }));
    const previewPayload = await previewResponse.json() as {
      preview: {
        rows: Array<{ status: string; camper: { name: string; teamId: string; sourceChurch?: string; rosterType?: string }; restrictedMedical?: unknown; medication?: unknown }>;
        summary: { warningRows?: number; blockedRows: number };
      };
    };

    expect(previewResponse.status).toBe(200);
    expect(previewPayload.preview.summary).toMatchObject({ warningRows: 1, blockedRows: 1 });
    expect(previewPayload.preview.rows[0]).toMatchObject({
      status: "Warning",
      camper: { name: "Partner Minimal Camper", teamId: "", sourceChurch: "Grace Chapel", rosterType: "partner" }
    });
    expect(previewPayload.preview.rows[0].restrictedMedical).toBeUndefined();
    expect(JSON.stringify(previewPayload)).not.toContain("Private Parent");
    expect(JSON.stringify(previewPayload)).not.toContain("555-777-8888");

    const commitResponse = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "commit",
      preview: previewPayload.preview
    }));
    const commitPayload = await commitResponse.json() as { committed: Array<{ studentName: string }> };

    expect(commitResponse.status).toBe(200);
    expect(commitPayload.committed).toEqual([{ rowNumber: 2, studentId: expect.any(String), studentName: "Partner Minimal Camper" }]);

    const generalLeaderOverview = await campGET(new Request("http://localhost/api/camp?role=general_leader"));
    const overviewPayload = await generalLeaderOverview.json() as { students: Array<{ name: string; teamId?: string; sourceChurch?: string; rosterType?: string }> };
    expect(generalLeaderOverview.status).toBe(200);
    expect(overviewPayload.students).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Partner Minimal Camper", teamId: "", sourceChurch: "Grace Chapel", rosterType: "partner" })
    ]));
    expectNoRestrictedPayloadDetails(overviewPayload);
    expect(JSON.stringify(overviewPayload)).not.toContain("Private Parent");
    expect(JSON.stringify(overviewPayload)).not.toContain("555-777-8888");
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

  it("does not let a Jaci role query param unlock Camp EMMA", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await campEmmaPOST(jsonRequest("http://localhost/api/camp/emma?role=jaci", {
      mode: "ask_emma",
      query: "What medication dose does Avery need?",
      selectedDay: "Mon, Jun 29"
    }));

    expect(response.status).toBe(403);
    expectNoRestrictedPayloadDetails(await json(response));
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
    getServerSessionMock.mockResolvedValue(andrewSession());

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

  it("does not let a stale Medical Command flag force operational aggregate questions out of conversational EMMA", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

    const response = await campEmmaPOST(jsonRequest("http://localhost/api/camp/emma?role=andrew", {
      mode: "smart_search",
      query: "Which team has the fewest high school students",
      selectedDay: "Mon, Jun 29",
      medicalCommandActive: true
    }));
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(serialized).toContain("andrew_operations");
    expect(serialized).toContain("EMMA's conversational mode is temporarily unavailable");
    expect(serialized).not.toContain("medication blocks");
    expect(serialized).not.toContain("I couldn't find a camper matching that name");
    expectNoRestrictedPayloadDetails(payload);
  });

  it("requires Camp Admin access and confirmation for Oakwood upload preview and commit", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["jaci", "joel", "general_leader", "driver"]) {
      const denied = await uploadImportPOST(oakwoodUploadRequest(`http://localhost/api/camp/import/upload?role=${role}`, oakwoodCsvFile()));
      expect(denied.status).toBe(403);
      expectNoRestrictedPayloadDetails(await json(denied));
    }

    getServerSessionMock.mockResolvedValue(andrewSession());

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

  it("Oakwood upload preview does not save automatically", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

    const previewResponse = await uploadImportPOST(oakwoodUploadRequest("http://localhost/api/camp/import/upload?role=andrew", oakwoodCsvFile("oakwood.csv", [
      "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Quick Filter,Emergency Contact",
      "70000133,Preview Only Camper,Student,9th,Room 7,Adult Small,No Concern,"
    ].join("\n"))));
    expect(previewResponse.status).toBe(200);
    expect(JSON.stringify(await previewResponse.json())).toContain("Preview Only Camper");

    const publicOverview = await campGET(new Request("http://localhost/api/camp?role=general_leader"));
    expect(JSON.stringify(await publicOverview.json())).not.toContain("Preview Only Camper");
  });

  it("rejects invalid Oakwood upload extension and MIME combinations", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

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
    getServerSessionMock.mockResolvedValue(andrewSession());

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

  it("uses live session identity, not the role query, for Camp Admin Oakwood upload authorization", async () => {
    getServerSessionMock.mockResolvedValue(session("leader", {
      isMock: false,
      user: { id: "live_andrew", email: BOOTSTRAP_CAMP_ADMIN_EMAIL, fullName: "Andrew", role: "leader" }
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

    getServerSessionMock.mockResolvedValue(session("leader", {
      isMock: false,
      user: { id: "live_jaci", email: "jaci@example.test", fullName: "Jaci", role: "leader" }
    }));

    const denied = await uploadImportPOST(oakwoodUploadRequest("http://localhost/api/camp/import/upload?role=andrew", oakwoodCsvFile()));
    expect(denied.status).toBe(403);
  });

  it("blocks production Oakwood commit when live import approval is missing", async () => {
    getServerSessionMock.mockResolvedValue(session("leader", {
      isMock: false,
      user: { id: "live_andrew", email: BOOTSTRAP_CAMP_ADMIN_EMAIL, fullName: "Andrew", role: "leader" }
    }));

    const response = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "oakwoodCommit",
      oakwoodPreview: oakwoodCommitPreview(),
      confirmed: true
    }));
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toMatch(/live import approval is not enabled/i);
  });

  it("blocks production Oakwood commit when schema readiness cannot be verified", async () => {
    vi.stubEnv("CAMP_OAKWOOD_LIVE_IMPORT_APPROVED", "true");
    getServerSessionMock.mockResolvedValue(session("leader", {
      isMock: false,
      user: { id: "live_andrew", email: BOOTSTRAP_CAMP_ADMIN_EMAIL, fullName: "Andrew", role: "leader" }
    }));

    const response = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "oakwoodCommit",
      oakwoodPreview: oakwoodCommitPreview(),
      confirmed: true
    }));
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toMatch(/schema readiness/i);
    expect(payload.error).toMatch(/Supabase/i);
  });

  it("keeps live Oakwood ambiguous and invalid row blocking ahead of readiness gates", async () => {
    getServerSessionMock.mockResolvedValue(session("leader", {
      isMock: false,
      user: { id: "live_andrew", email: BOOTSTRAP_CAMP_ADMIN_EMAIL, fullName: "Andrew", role: "leader" }
    }));

    const ambiguous = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "oakwoodCommit",
      oakwoodPreview: oakwoodCommitPreview({ ambiguousCount: 1 }),
      confirmed: true
    }));
    const invalid = await importPOST(jsonRequest("http://localhost/api/camp/import?role=andrew", {
      action: "oakwoodCommit",
      oakwoodPreview: oakwoodCommitPreview({ invalidCount: 1 }),
      confirmed: true
    }));

    expect(ambiguous.status).toBe(409);
    expect(await ambiguous.json()).toMatchObject({ error: expect.stringMatching(/ambiguous or invalid/i) });
    expect(invalid.status).toBe(409);
    expect(await invalid.json()).toMatchObject({ error: expect.stringMatching(/ambiguous or invalid/i) });
  });

  it("rejects ambiguous Oakwood commits instead of overwriting automatically", async () => {
    getServerSessionMock.mockResolvedValue(andrewSession());

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
