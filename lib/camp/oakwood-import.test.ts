import { describe, expect, it } from "vitest";

import { buildOakwoodImportPreview, buildOakwoodImportPreviewFromCsv, type OakwoodSourceRow } from "@/lib/camp/oakwood-import";

// Minimal normalized source rows (keys = normalized headers). Helpers below keep
// the tests readable while mirroring the real Quick View columns.
function student(overrides: Partial<Record<string, string>> = {}): OakwoodSourceRow {
  return {
    "registration id": "70000001",
    name: "Test Student",
    selection: "Student",
    grade: "8th",
    "room number": "Room 1",
    "t-shirt size": "Adult Medium",
    "quick filter": "No Concern",
    "emergency contact": "Pat Parent - (555) 123-4567",
    "registration contact first name": "Pat",
    "registration contact last name": "Parent",
    "registration contact phone number": "(555) 123-4567",
    "medical notes": "",
    "dietary requirements": "",
    ...overrides
  } as OakwoodSourceRow;
}

describe("oakwood-import engine", () => {
  it("never fabricates team or vehicle and keeps blank rooms blank", () => {
    const preview = buildOakwoodImportPreview([student({ "room number": "" })]);
    const row = preview.rows[0];
    expect(row.person.cabin).toBe("");
    expect(row.person.teamName).toBe("");
    expect(row.person.vehicleName).toBe("");
  });

  it("imports safe operational fields where present", () => {
    const preview = buildOakwoodImportPreview([student({ grade: "10th", "room number": "Room 4", "t-shirt size": "Youth Large" })]);
    expect(preview.rows[0].person).toMatchObject({ grade: "10th", cabin: "Room 4", shirtSize: "Youth Large" });
  });

  it("derives indicators ONLY from Quick Filter category + restricted-note presence", () => {
    const medical = buildOakwoodImportPreview([student({ "quick filter": "Medical" })]).rows[0];
    expect(medical.safeIndicators).toMatchObject({ hasMedicalAlert: true, hasDietaryAlert: false });

    const diet = buildOakwoodImportPreview([student({ "quick filter": "Medical + Food/Diet" })]).rows[0];
    expect(diet.safeIndicators).toMatchObject({ hasMedicalAlert: true, hasDietaryAlert: true });

    // A medical note present but Quick Filter "No Concern" still flags medical via
    // note PRESENCE (not by reading the note's words).
    const notePresent = buildOakwoodImportPreview([student({ "quick filter": "No Concern", "medical notes": "private detail" })]).rows[0];
    expect(notePresent.safeIndicators.hasMedicalAlert).toBe(true);

    // "No Concern" with no notes => no alerts.
    const clean = buildOakwoodImportPreview([student({ "quick filter": "No Concern" })]).rows[0];
    expect(clean.safeIndicators).toMatchObject({ hasMedicalAlert: false, hasDietaryAlert: false });
  });

  it("flags emergency contact availability without exposing the contact in safe indicators", () => {
    const withEc = buildOakwoodImportPreview([student()]).rows[0];
    expect(withEc.safeIndicators.emergencyContactOnFile).toBe(true);
    // Safe indicators are booleans only — no names/phones.
    expect(JSON.stringify(withEc.safeIndicators)).not.toMatch(/parent|555|\d{3}/i);

    const noEc = buildOakwoodImportPreview([student({ "emergency contact": "" })]).rows[0];
    expect(noEc.safeIndicators.emergencyContactOnFile).toBe(false);
  });

  it("routes contact/medical/dietary detail into the restricted payload only", () => {
    const row = buildOakwoodImportPreview([
      student({ "quick filter": "Medical + Food/Diet", "medical notes": "Asthma", "dietary requirements": "Gluten-free" })
    ]).rows[0];
    expect(row.restricted).toMatchObject({
      emergencyContactName: "Pat Parent",
      emergencyContactPhone: "(555) 123-4567",
      guardianName: "Pat Parent",
      restrictedNotes: "Asthma",
      dietaryRequirements: "Gluten-free"
    });
  });

  it("treats Registration ID as a household id: same id + different names are distinct people, not a match", () => {
    const existing = [{ id: "c1", name: "Sibling One", registrationExternalId: "70000009" }];
    const row = buildOakwoodImportPreview([student({ name: "Sibling Two", "registration id": "70000009" })], { existingCampers: existing }).rows[0];
    expect(row.matchStatus).toBe("new");
    expect(row.matchedExistingId).toBeUndefined();
  });

  it("matches on Registration ID + name and updates that record", () => {
    const existing = [{ id: "c5", name: "Test Student", registrationExternalId: "70000001" }];
    const row = buildOakwoodImportPreview([student()], { existingCampers: existing }).rows[0];
    expect(row.matchStatus).toBe("matched");
    expect(row.matchedExistingId).toBe("c5");
  });

  it("blocks ambiguous name-only matches from auto-commit", () => {
    const existing = [{ id: "c7", name: "Test Student", registrationExternalId: "99999999" }];
    const row = buildOakwoodImportPreview([student({ "registration id": "70000001" })], { existingCampers: existing }).rows[0];
    expect(row.matchStatus).toBe("ambiguous");
    expect(row.warnings.join(" ")).toMatch(/confirm before overwriting/i);
  });

  it("classifies adults as staff with no restricted payload", () => {
    const row = buildOakwoodImportPreview([student({ name: "Adult Helper", selection: "Adult Volunteer", grade: "" })]).rows[0];
    expect(row.personType).toBe("adult");
    expect(row.restricted).toBeUndefined();
  });

  it("skips non-person section rows (no numeric Registration ID)", () => {
    const rows: OakwoodSourceRow[] = [
      student(),
      { "quick filter": "Suite 1", name: "" } as OakwoodSourceRow,
      { "registration id": "Metric", name: "Total people" } as OakwoodSourceRow
    ];
    const preview = buildOakwoodImportPreview(rows);
    expect(preview.summary.personRows).toBe(1);
    expect(preview.summary.totalSourceRows).toBe(3);
    expect(preview.summary.skippedCount).toBe(2);
    expect(preview.rows.filter((row) => row.matchStatus === "skipped")).toHaveLength(2);
  });

  it("produces accurate summary counts for a mixed batch", () => {
    const existing = [{ id: "c5", name: "Test Student", registrationExternalId: "70000001" }];
    const preview = buildOakwoodImportPreview(
      [
        student(),
        student({ name: "New Student", "registration id": "70000002" }),
        student({ name: "Adult Helper", selection: "Adult Volunteer", "registration id": "70000003", grade: "" })
      ],
      { existingCampers: existing }
    );
    expect(preview.summary).toMatchObject({ personRows: 3, students: 2, adults: 1, matchedCount: 1, newCount: 2, ambiguousCount: 0 });
    expect(preview.summary.restrictedRecordRows).toBe(2); // two students
    expect(preview.summary.staffRows).toBe(1);
  });

  it("parses a delimited workbook export end-to-end", () => {
    const csv = [
      "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Quick Filter,Emergency Contact,Medical Notes,Dietary Requirements",
      "70000010,CSV Student,Student,9th,Room 2,Adult Small,Food/Diet,Sam Parent - (555) 222-3333,,Peanut-free"
    ].join("\n");
    const preview = buildOakwoodImportPreviewFromCsv(csv, { sourceFile: "Camp_Quick_View_2.csv" });
    expect(preview.sourceFile).toBe("Camp_Quick_View_2.csv");
    expect(preview.rows[0]).toMatchObject({ matchStatus: "new", personType: "student" });
    expect(preview.rows[0].safeIndicators.hasDietaryAlert).toBe(true);
    expect(preview.rows[0].restricted?.dietaryRequirements).toBe("Peanut-free");
  });
});
