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
import { GET as medicationGET, POST as medicationPOST } from "@/app/api/camp/medication/route";
import { GET as medicalGET, POST as medicalPOST } from "@/app/api/camp/restricted-medical/route";

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
  "administrationLog",
  "returnChecklist"
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

    expect(getResponse.status).toBe(403);
    expect(postResponse.status).toBe(403);
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

  it("forbids import preview and commit for General Leaders and Drivers", async () => {
    getServerSessionMock.mockResolvedValue(session());

    for (const role of ["general_leader", "driver"]) {
      const previewResponse = await importPOST(jsonRequest(`http://localhost/api/camp/import?role=${role}`, {
        action: "preview",
        csv: "Student Name,Team,Vehicle\nCamper,Cypress,Van 1"
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
        "Import Camper,8th,Cypress,Van 1,Parent-labeled medication,Follow signed parent instructions,Breakfast,Restricted parent note"
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
