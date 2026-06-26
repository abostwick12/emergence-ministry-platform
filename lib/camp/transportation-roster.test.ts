import { describe, expect, it } from "vitest";
import { getEmergencyRosterStudents, isVehicleAssignableCamper } from "@/lib/camp/transportation-roster";

describe("Camp transportation roster boundaries", () => {
  it("includes CLC/emergency roster campers", () => {
    expect(isVehicleAssignableCamper({ rosterType: "emerge", sourceChurch: "" })).toBe(true);
  });

  it("excludes explicit partner church campers", () => {
    expect(isVehicleAssignableCamper({ rosterType: "partner", sourceChurch: "Grace Chapel" })).toBe(false);
  });

  it("excludes source-church-only campers when roster type is unknown", () => {
    expect(isVehicleAssignableCamper({ sourceChurch: "Grace Chapel" })).toBe(false);
  });

  it("excludes campers marked by partner metadata flags", () => {
    expect(isVehicleAssignableCamper({ limitedSafetyFlags: ["Roster type: partner", "Partner church: Grace Chapel"] })).toBe(false);
  });

  it("filters a mixed list down to emergency transportation roster students", () => {
    const students = [
      { id: "clc", rosterType: "emerge" as const },
      { id: "partner", rosterType: "partner" as const, sourceChurch: "Grace Chapel" },
      { id: "source-only", sourceChurch: "Partner Only Church" }
    ];

    expect(getEmergencyRosterStudents(students).map((student) => student.id)).toEqual(["clc"]);
  });
});
