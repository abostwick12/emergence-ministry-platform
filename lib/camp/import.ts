import type {
  CampRegistrationImportPreview,
  CampRegistrationImportPreviewRow,
  CampRestrictedMedicalRecord,
  CampTeam,
  CampVehicle
} from "@/lib/camp/types";

type ImportOptions = {
  teams: CampTeam[];
  vehicles: CampVehicle[];
};

type CsvRow = Record<string, string>;

const clarificationText = "Needs Parent Clarification.";

export function parseCampRegistrationImport(csv: string, options: ImportOptions): CampRegistrationImportPreview {
  const parsed = parseCsv(csv);
  const rows = parsed.rows.map((row, index) => normalizeRegistrationRow(row, index + 2, options));

  return {
    rows,
    summary: {
      totalRows: rows.length,
      readyRows: rows.filter((row) => row.status === "Ready").length,
      clarificationRows: rows.filter((row) => row.status === "Needs Parent Clarification").length,
      blockedRows: rows.filter((row) => row.status === "Blocked").length
    }
  };
}

function normalizeRegistrationRow(row: CsvRow, rowNumber: number, options: ImportOptions): CampRegistrationImportPreviewRow {
  const warnings: string[] = [];
  const name = pick(row, ["student name", "camper name", "name", "student"]);
  const team = findByName(options.teams, pick(row, ["team", "team name"]));
  const vehicle = findVehicle(options.vehicles, pick(row, ["vehicle", "car", "van", "transportation"]));
  const safetyFlags = splitFlags(pick(row, ["limited safety flags", "safety flags", "public flags"]));

  if (!name) warnings.push("Missing camper name.");
  if (!team) warnings.push("Team missing or unmatched; first team will be used for preview.");
  if (!vehicle) warnings.push("Vehicle missing or unmatched; first vehicle will be used for preview.");

  const medicationName = pick(row, ["medication", "medication name", "medication label", "medicine"]);
  const medicationInstructions = pick(row, ["medication instructions", "parent instructions", "parent-provided instructions", "dosage instructions"]);
  const medicationTime = pick(row, ["medication time", "time window", "schedule", "medication schedule"]);
  const hasMedicationData = Boolean(medicationName || medicationInstructions || medicationTime);
  const medicationNeedsClarification = hasMedicationData && (!medicationName || !medicationInstructions || needsClarification(medicationInstructions));

  if (hasMedicationData && !medicationName) warnings.push("Medication label missing; marked Needs Parent Clarification.");
  if (hasMedicationData && !medicationInstructions) warnings.push("Medication instructions missing; marked Needs Parent Clarification.");
  if (hasMedicationData && needsClarification(medicationInstructions)) warnings.push("Medication instructions unclear; marked Needs Parent Clarification.");

  const restrictedNotes = pick(row, ["restricted notes", "medical notes", "diagnosis notes"]);
  const allergyNotes = pick(row, ["allergy notes", "allergies"]);
  const insuranceStatus = pick(row, ["insurance", "insurance status"]);
  const parentMedicalNotes = pick(row, ["parent medical notes", "parent notes"]);
  const hasMedicalData = Boolean(restrictedNotes || allergyNotes || insuranceStatus || parentMedicalNotes);
  const medicalNeedsClarification = hasMedicalData && needsClarification(`${restrictedNotes} ${allergyNotes} ${parentMedicalNotes}`);
  if (medicalNeedsClarification) warnings.push("Medical notes require parent clarification.");

  const blocked = !name;
  const needsParentClarification = medicationNeedsClarification || medicalNeedsClarification;
  const studentName = name || `Import row ${rowNumber}`;

  return {
    rowNumber,
    status: blocked ? "Blocked" : needsParentClarification ? "Needs Parent Clarification" : "Ready",
    warnings,
    camper: {
      name: studentName,
      grade: pick(row, ["grade", "student grade"]) || "",
      teamId: team?.id ?? options.teams[0]?.id ?? "",
      vehicleId: vehicle?.id ?? options.vehicles[0]?.id ?? "",
      cabin: pick(row, ["cabin", "room"]) || "",
      limitedSafetyFlags: safetyFlags
    },
    restrictedMedical: hasMedicalData ? toRestrictedMedical(studentName, restrictedNotes, allergyNotes, insuranceStatus, parentMedicalNotes, medicalNeedsClarification) : undefined,
    medication: hasMedicationData
      ? {
          medicationName: medicationName || "Parent-labeled medication",
          medicinePhotoStatus: "Photo Needed",
          parentProvidedInstructions: medicationInstructions || clarificationText,
          checkInStatus: medicationNeedsClarification ? "Needs Parent Clarification" : "Not Checked In",
          clarificationStatus: medicationNeedsClarification ? "Needs Parent Clarification" : "Clear",
          scheduleTimeWindow: medicationTime || undefined
        }
      : undefined
  };
}

function toRestrictedMedical(
  studentName: string,
  restrictedNotes: string,
  allergyNotes: string,
  insuranceStatus: string,
  parentMedicalNotes: string,
  needsParentClarification: boolean
): CampRestrictedMedicalRecord {
  return {
    studentId: "",
    studentName,
    medicalFormStatus: needsParentClarification ? "Needs Parent Clarification" : "Received",
    restrictedNotes,
    allergyNotes,
    insuranceStatus,
    parentMedicalNotes
  };
}

function parseCsv(input: string): { headers: string[]; rows: CsvRow[] } {
  const records = parseRecords(input).filter((record) => record.some((cell) => cell.trim()));
  const headers = (records[0] ?? []).map(normalizeHeader);
  const rows = records.slice(1).map((record) => {
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = record[index]?.trim() ?? "";
    });
    return row;
  });
  return { headers, rows };
}

function parseRecords(input: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === "\"" && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }

  row.push(current);
  rows.push(row);
  return rows;
}

function pick(row: CsvRow, names: string[]): string {
  for (const name of names) {
    const value = row[normalizeHeader(name)]?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findByName<T extends { name: string }>(items: T[], name: string): T | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  return items.find((item) => item.name.toLowerCase() === normalized);
}

function findVehicle(vehicles: CampVehicle[], name: string): CampVehicle | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  return vehicles.find((vehicle) => vehicle.name.toLowerCase() === normalized || vehicle.driver.toLowerCase() === normalized);
}

function splitFlags(value: string): string[] {
  return value.split(/[;,]/).map((flag) => flag.trim()).filter(Boolean);
}

function needsClarification(value: string): boolean {
  if (!value.trim()) return true;
  return /needs parent clarification|unclear|clarify|conflict|unknown|tbd/i.test(value);
}
