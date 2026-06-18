import { beforeEach, describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import { resolveCampAccessContext } from "@/lib/camp/permissions";
import {
  getCampOverview,
  getRestrictedCampMedicationPayload,
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
});
