import { describe, expect, it } from "vitest";

import { isCampMedicationScanEnabled } from "@/lib/camp/medication-scan-config";

describe("Camp medication scan feature flag", () => {
  it("defaults disabled when CAMP_MEDICATION_SCAN_ENABLED is missing", () => {
    expect(isCampMedicationScanEnabled({})).toBe(false);
  });

  it("stays disabled when CAMP_MEDICATION_SCAN_ENABLED is false", () => {
    expect(isCampMedicationScanEnabled({ CAMP_MEDICATION_SCAN_ENABLED: "false" })).toBe(false);
  });

  it("enables scanning only for the exact true value", () => {
    expect(isCampMedicationScanEnabled({ CAMP_MEDICATION_SCAN_ENABLED: "true" })).toBe(true);
    expect(isCampMedicationScanEnabled({ CAMP_MEDICATION_SCAN_ENABLED: "TRUE" })).toBe(false);
  });
});
