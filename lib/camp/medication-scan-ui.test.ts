import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Camp medication label scan UI boundaries", () => {
  it("keeps the Scan Label control behind the restricted medication data gate", () => {
    const source = readFileSync(join(process.cwd(), "components/camp/camp-tool-pages.tsx"), "utf8");
    const pageStart = source.indexOf("export function CampMedicineIntakeToolPage()");
    const workflowStart = source.indexOf("function MedicineIntakeReturnWorkflow", pageStart);
    const workflowEnd = source.indexOf("export function CampMedicationScheduleToolPage", workflowStart);

    expect(pageStart).toBeGreaterThanOrEqual(0);
    expect(workflowStart).toBeGreaterThan(pageStart);
    expect(workflowEnd).toBeGreaterThan(workflowStart);

    const pageSource = source.slice(pageStart, workflowStart);
    const workflowSource = source.slice(workflowStart, workflowEnd);

    expect(pageSource).toContain("<MedicationDataGate>");
    expect(pageSource).toContain("<MedicineIntakeReturnWorkflow data={data} />");
    expect(workflowSource).toContain("data.scanEnabled === true");
    expect(workflowSource).toContain("disabled={!scanEnabled}");
    expect(source).toContain("Medication label scanning is disabled.");
    expect(workflowSource).toContain("MEDICATION_SCAN_DISABLED_MESSAGE");
    expect(workflowSource).toContain("Scan Label");
    expect(workflowSource).toContain("Add Medication Manually");
    expect(workflowSource).toContain("Manual medication entry remains available if scanning fails.");
    expect(workflowSource).toContain("Complete Intake saves the grouped medication record.");
    expect(source).toContain("AI/OCR may misread medication labels. Verify every field against the original bottle before saving.");
    expect(workflowSource).toContain("MEDICATION_SCAN_WARNING");
  });
});
