import { describe, expect, it } from "vitest";
import { parseCampRegistrationImport } from "@/lib/camp/import";
import { campTeams, campVehicles } from "@/lib/camp/public-data";

describe("camp registration import parsing", () => {
  it("previews CSV rows without saving and maps public fields", () => {
    const preview = parseCampRegistrationImport(
      [
        "Student Name,Grade,Team,Vehicle,Cabin,Limited Safety Flags",
        "Avery Test,8th,Blue,Van 1,Cabin A,Hydration reminder"
      ].join("\n"),
      { teams: campTeams, vehicles: campVehicles }
    );

    expect(preview.summary).toMatchObject({ totalRows: 1, readyRows: 1, blockedRows: 0 });
    expect(preview.rows[0]?.camper).toMatchObject({
      name: "Avery Test",
      teamId: "team-blue",
      vehicleId: "van-1",
      limitedSafetyFlags: ["Hydration reminder"]
    });
    expect(preview.rows[0]?.restrictedMedical).toBeUndefined();
    expect(preview.rows[0]?.medication).toBeUndefined();
  });

  it("marks missing or unclear medication data as Needs Parent Clarification", () => {
    const preview = parseCampRegistrationImport(
      [
        "Student Name,Team,Vehicle,Medication Name,Medication Instructions,Medication Time",
        "Jordan Test,Red,Van 2,,Unclear instruction from parent,Breakfast"
      ].join("\n"),
      { teams: campTeams, vehicles: campVehicles }
    );

    expect(preview.summary.clarificationRows).toBe(1);
    expect(preview.rows[0]?.status).toBe("Needs Parent Clarification");
    expect(preview.rows[0]?.medication).toMatchObject({
      medicationName: "Parent-labeled medication",
      clarificationStatus: "Needs Parent Clarification",
      checkInStatus: "Needs Parent Clarification",
      scheduleTimeWindow: "Breakfast"
    });
  });

  it("supports quoted spreadsheet cells and blocks rows without camper names", () => {
    const preview = parseCampRegistrationImport(
      [
        "Student Name,Team,Vehicle,Parent Medical Notes",
        "\"Taylor, Test\",Yellow,Van 3,\"Parent note, no interpretation needed\"",
        ",Yellow,Van 3,Missing name"
      ].join("\n"),
      { teams: campTeams, vehicles: campVehicles }
    );

    expect(preview.rows[0]?.camper.name).toBe("Taylor, Test");
    expect(preview.rows[0]?.restrictedMedical?.parentMedicalNotes).toBe("Parent note, no interpretation needed");
    expect(preview.rows[1]?.status).toBe("Blocked");
    expect(preview.summary.blockedRows).toBe(1);
  });
});
