import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { detectOakwoodWorkbook, extractOakwoodCsv } from "@/lib/camp/oakwood-upload-source";

async function workbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  const summary = workbook.addWorksheet("Summary");
  summary.addRow(["Not", "Import"]);
  summary.addRow(["Total", "12"]);

  const quickView = workbook.addWorksheet("Quick View");
  quickView.addRow(["Registration ID", "Name", "Selection", "Grade"]);
  quickView.addRow(["70000999", "XLSX Camper", "Student", "9th"]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("oakwood-upload-source", () => {
  it("discovers xlsx worksheets and extracts only the selected sheet", async () => {
    const buffer = await workbookBuffer();

    const detected = await detectOakwoodWorkbook({ fileName: "oakwood.xlsx", buffer });
    expect(detected).toEqual({ ok: true, kind: "xlsx", sheetNames: ["Summary", "Quick View"] });

    const missingSheet = await extractOakwoodCsv({ fileName: "oakwood.xlsx", buffer });
    expect(missingSheet).toMatchObject({ ok: false, status: 422 });

    const extracted = await extractOakwoodCsv({ fileName: "oakwood.xlsx", buffer }, { sheetName: "Quick View" });
    expect(extracted).toMatchObject({ ok: true, sheetName: "Quick View", rowCount: 2 });
    expect(extracted.ok && extracted.csv).toContain("XLSX Camper");
    expect(extracted.ok && extracted.csv).not.toContain("Total");
  });

  it("parses csv directly without worksheet metadata", async () => {
    const csv = "Registration ID,Name,Selection\n70000888,CSV Camper,Student";
    const detected = await detectOakwoodWorkbook({ fileName: "oakwood.csv", buffer: Buffer.from(csv) });
    const extracted = await extractOakwoodCsv({ fileName: "oakwood.csv", buffer: Buffer.from(csv) });

    expect(detected).toEqual({ ok: true, kind: "csv", sheetNames: [] });
    expect(extracted).toMatchObject({ ok: true, rowCount: 2 });
    expect(extracted.ok && extracted.csv).toBe(csv);
  });
});
