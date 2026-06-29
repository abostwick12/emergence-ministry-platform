export const CAMP_MEDICATION_SCAN_DISABLED_MESSAGE = "Medication label scanning is disabled.";

export function isCampMedicationScanEnabled(env: Record<string, string | undefined> = process.env) {
  return env.CAMP_MEDICATION_SCAN_ENABLED === "true";
}
