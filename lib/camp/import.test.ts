import { describe, expect, it } from "vitest";
import { parseCampRegistrationImport } from "@/lib/camp/import";
import { campTeams, campVehicles } from "@/lib/camp/public-data";
import type { CampTeam, CampVehicle } from "@/lib/camp/types";

const teams: CampTeam[] = [
  { id: "team-blue", name: "Blue", color: "Blue", leader: "" },
  { id: "team-red", name: "Red", color: "Red", leader: "" }
];

const vehicles: CampVehicle[] = [
  { id: "van-1", name: "Van 1", driver: "Marcus Lee", departureWindow: "", capacity: 7 }
];

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

describe("partner church roster import preview", () => {
  it("marks add, update, and skipped rows while mapping only safe public indicators", () => {
    const csv = [
      "Student Name,Grade,Partner Church,Room/Cabin,Team,Vehicle,Shirt Size,Safe Operational Notes,Food Allergy Indicator,Medical Concern Indicator,Medication On File,Emergency Contact Name,Emergency Contact Phone",
      "New Partner Camper,8th,Grace Chapel,Cabin D,Blue,Van 1,Adult Small,Keep with youth group,Yes,No,Yes,Parent Name,555-111-2222",
      "Existing Camper,9th,Hope Church,Cabin E,Red,Van 1,Adult Medium,,No,Yes,No,,",
      "Missing Source,7th,,Cabin F,Blue,Van 1,Adult Large,,No,No,No,,"
    ].join("\n");

    const preview = parseCampRegistrationImport(csv, {
      teams,
      vehicles,
      existingStudents: [{ id: "stu-existing", name: "Existing Camper" }],
      mode: "partnerChurch",
      sourceName: "Partner Church Upload"
    });

    expect(preview.summary).toMatchObject({
      totalRows: 3,
      addRows: 1,
      updateRows: 1,
      blockedRows: 1,
      skippedRows: 1
    });
    expect(preview.rows[0]).toMatchObject({
      importAction: "add",
      sourceChurch: "Grace Chapel",
      camper: {
        name: "New Partner Camper",
        shirtSize: "Adult Small",
        cabin: "Cabin D",
        emergencyContactOnFile: true,
        hasDietaryAlert: true,
        hasMedicalAlert: false
      }
    });
    expect(preview.rows[0].camper.limitedSafetyFlags).toContain("Partner church: Grace Chapel");
    expect(preview.rows[0].medication).toMatchObject({
      medicationName: "Medication on file",
      clarificationStatus: "Needs Parent Clarification"
    });
    expect(preview.rows[0].restrictedMedical).toMatchObject({
      emergencyContactName: "Parent Name",
      emergencyContactPhone: "555-111-2222"
    });
    expect(preview.rows[1].camper.id).toBe("stu-existing");
    expect(preview.rows[2]).toMatchObject({
      status: "Blocked",
      importAction: "skip"
    });
    expect(preview.rows[2].warnings.join(" ")).toMatch(/partner church/i);
  });
});
