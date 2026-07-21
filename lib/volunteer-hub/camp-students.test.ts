import { describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import type { VolunteerHubIntegrationStatus } from "@/lib/volunteer-hub/types";

const getCampOverview = vi.fn();

vi.mock("@/lib/camp/repository", () => ({
  getCampOverview: (...args: unknown[]) => getCampOverview(...args)
}));

import { getVolunteerHubPayload } from "@/lib/volunteer-hub/data";

const session: AuthSession = {
  isMock: false,
  user: { id: "real-user-1", email: "real@example.com", fullName: "Real Leader", role: "leader" }
};

const integrations: VolunteerHubIntegrationStatus = {
  planningCenter: { displayStatus: "connected", peopleCount: 0, attendanceCount: 0 },
  groupMe: { configured: true, displayStatus: "disconnected", connectedGroupCount: 0, message: "Not connected." }
};

describe("Volunteer Hub Camp CLC students", () => {
  it("includes CLC/Emerge campers and excludes partner/source-church campers", async () => {
    getCampOverview.mockResolvedValue({
      campName: "Camp Oakwood",
      campStartsOn: "2026-06-29",
      teams: [{ id: "team-blue", name: "Blue", color: "Blue", leader: "" }],
      vehicles: [{ id: "van-1", name: "Van 1", driver: "", departureWindow: "", capacity: 7 }],
      schedule: [],
      documents: [],
      staff: [],
      students: [
        { id: "clc", name: "CLC Camper", photoInitials: "CC", grade: "8th", teamId: "team-blue", vehicleId: "van-1", cabin: "Cabin A", rosterType: "emerge", limitedSafetyFlags: [], hasRestrictedMedicalInfo: false, hasMedicationPlan: false, needsParentClarification: false },
        { id: "partner", name: "Partner Camper", photoInitials: "PC", grade: "8th", teamId: "team-blue", vehicleId: "", cabin: "", rosterType: "partner", sourceChurch: "Grace Chapel", limitedSafetyFlags: [], hasRestrictedMedicalInfo: false, hasMedicationPlan: false, needsParentClarification: false },
        { id: "source-only", name: "Source Only Camper", photoInitials: "SO", grade: "8th", teamId: "team-blue", vehicleId: "", cabin: "", sourceChurch: "Partner Church", limitedSafetyFlags: [], hasRestrictedMedicalInfo: false, hasMedicationPlan: false, needsParentClarification: false }
      ]
    });

    const payload = await getVolunteerHubPayload(session, integrations, { effectiveRole: "general_leader" } as never);

    expect(payload.studentRosterSource.campClcCount).toBe(1);
    expect(payload.studentRoster.map((student) => student.fullName)).toEqual(["CLC Camper"]);
    expect(payload.studentRoster[0]).toMatchObject({ source: "camp_clc", teamName: "Blue", vehicleName: "Van 1" });
  });
});
