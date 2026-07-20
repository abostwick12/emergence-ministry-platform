import { describe, expect, it } from "vitest";

import { sanitizeFilename, validateResourceFile } from "@/lib/resources/file-validation";

describe("resource attachment file validation", () => {
  it("accepts PDFs by file signature", () => {
    const file = validateResourceFile({
      bytes: Buffer.from("%PDF-1.7\nhello"),
      declaredMimeType: "application/octet-stream",
      filename: "Leader Guide.pdf"
    });

    expect(file.mimeType).toBe("application/pdf");
    expect(file.resourceType).toBe("pdf");
    expect(file.safeFilename).toBe("Leader-Guide.pdf");
  });

  it("maps Office files only when the bytes are zip content", () => {
    const file = validateResourceFile({
      bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
      filename: "slides.pptx"
    });

    expect(file.mimeType).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    expect(file.resourceType).toBe("slides");
  });

  it("rejects executables even with a harmless extension", () => {
    expect(() =>
      validateResourceFile({
        bytes: Buffer.from("MZ executable"),
        filename: "notes.txt"
      })
    ).toThrow("Executable files cannot be uploaded.");
  });

  it("rejects script-like filenames", () => {
    expect(() =>
      validateResourceFile({
        bytes: Buffer.from("console.log('hi')"),
        filename: "weekly-prep.js"
      })
    ).toThrow("Executable and script files cannot be uploaded.");
  });

  it("sanitizes unsafe filenames", () => {
    expect(sanitizeFilename("../Parent Packing List!!.pdf")).toBe("Parent-Packing-List.pdf");
  });
});
