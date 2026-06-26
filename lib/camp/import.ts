import type {
  CampRegistrationImportPreview,
  CampRegistrationImportPreviewRow,
  CampRestrictedMedicalRecord,
  CampTeam,
  CampVisibleStudent,
  CampVehicle
} from "@/lib/camp/types";

type ImportOptions = {
  teams: CampTeam[];
  vehicles: CampVehicle[];
  existingStudents?: Array<Pick<CampVisibleStudent, "id" | "name">>;
  mode?: "registration" | "partnerChurch";
  sourceName?: string;
  sourceKind?: CampRegistrationImportPreview["sourceKind"];
  uploadSources?: CampRegistrationImportPreview["uploadSources"];
};

type CsvRow = Record<string, string>;

const clarificationText = "Needs Parent Clarification.";

export function parseCampRegistrationImport(csv: string, options: ImportOptions): CampRegistrationImportPreview {
  const parsed = parseCsv(csv);
  const rows = parsed.rows.map((row, index) => normalizeRegistrationRow(row, index + 2, options));

  return {
    sourceName: options.sourceName,
    sourceKind: options.sourceKind ?? "csv",
    uploadSources: options.uploadSources,
    rows,
    summary: summarizeRows(rows)
  };
}

export function mergeCampRegistrationImportPreviews(
  previews: CampRegistrationImportPreview[],
  meta: Pick<CampRegistrationImportPreview, "sourceName" | "sourceKind" | "uploadSources"> = {}
): CampRegistrationImportPreview {
  const rows = previews.flatMap((preview) => preview.rows);
  return {
    ...meta,
    rows,
    summary: summarizeRows(rows)
  };
}

function summarizeRows(rows: CampRegistrationImportPreviewRow[]): CampRegistrationImportPreview["summary"] {
  return {
    totalRows: rows.length,
    readyRows: rows.filter((row) => row.status === "Ready").length,
    warningRows: rows.filter((row) => row.status === "Warning").length,
    clarificationRows: rows.filter((row) => row.status === "Needs Parent Clarification").length,
    blockedRows: rows.filter((row) => row.status === "Blocked").length,
    addRows: rows.filter((row) => row.importAction === "add").length,
    updateRows: rows.filter((row) => row.importAction === "update").length,
    skippedRows: rows.filter((row) => row.importAction === "skip").length
  };
}

function normalizeRegistrationRow(row: CsvRow, rowNumber: number, options: ImportOptions): CampRegistrationImportPreviewRow {
  const warnings: string[] = [];
  const name = pick(row, ["student name", "camper name", "name", "student"]);
  const partnerChurch = pick(row, ["partner church", "source church", "church/source", "church", "home church", "sending church", "source"]);
  const profilePhotoUrl = sanitizeProfilePhotoUrl(pick(row, ["photo", "photo url", "profile photo", "student photo", "image"]));
  const teamName = pick(row, ["team", "team name", "team color", "color", "team assignment"]);
  const vehicleName = pick(row, ["vehicle", "car", "van", "transportation"]);
  const team = findTeam(options.teams, teamName);
  const vehicle = findVehicle(options.vehicles, vehicleName);
  const safetyFlags = splitFlags(pick(row, ["limited safety flags", "safety flags", "public flags", "safe operational notes", "leader-safe notes", "operational notes"]));
  if (partnerChurch) safetyFlags.unshift(`Partner church: ${partnerChurch}`);

  if (!name) warnings.push("Missing camper name.");
  if (options.mode === "partnerChurch") {
    if (teamName && !team) warnings.push("Team not matched; camper will import without assigned team.");
    if (vehicleName && !vehicle) warnings.push("Vehicle not matched; camper will import without assigned vehicle.");
  } else {
    if (!team) warnings.push("Team missing or unmatched; first team will be used for preview.");
    if (!vehicle) warnings.push("Vehicle missing or unmatched; first vehicle will be used for preview.");
  }

  const medicationName = pick(row, ["medication", "medication name", "medication label", "medicine"]);
  const medicationInstructions = pick(row, ["medication instructions", "parent instructions", "parent-provided instructions", "dosage instructions"]);
  const medicationTime = pick(row, ["medication time", "time window", "schedule", "medication schedule"]);
  const medicationOnFileIndicator = boolish(pick(row, ["medication on file", "medication-on-file", "medication indicator", "medication plan on file"]));
  const hasMedicationData = options.mode !== "partnerChurch" && Boolean(medicationName || medicationInstructions || medicationTime);
  const medicationNeedsClarification = hasMedicationData && (!medicationName || !medicationInstructions || needsClarification(medicationInstructions));

  if (hasMedicationData && !medicationName) warnings.push("Medication label missing; marked Needs Parent Clarification.");
  if (hasMedicationData && !medicationInstructions) warnings.push("Medication instructions missing; marked Needs Parent Clarification.");
  if (hasMedicationData && needsClarification(medicationInstructions)) warnings.push("Medication instructions unclear; marked Needs Parent Clarification.");
  if (medicationOnFileIndicator && !hasMedicationData) warnings.push("Medication on file indicator imported without medication details; routed to restricted intake follow-up.");

  const restrictedNotes = pick(row, ["restricted notes", "medical notes", "diagnosis notes", "medical details", "medical concern details"]);
  const allergyNotes = pick(row, ["allergy notes", "allergies", "food allergy details", "dietary details"]);
  const insuranceStatus = pick(row, ["insurance", "insurance status"]);
  const parentMedicalNotes = pick(row, ["parent medical notes", "parent notes"]);
  const emergencyContactName = pick(row, ["emergency contact name", "emergency contact", "parent/guardian name"]);
  const emergencyContactPhone = pick(row, ["emergency contact phone", "emergency phone", "parent/guardian phone", "phone"]);
  const hasMedicalData = options.mode !== "partnerChurch" && Boolean(restrictedNotes || allergyNotes || insuranceStatus || parentMedicalNotes || emergencyContactName || emergencyContactPhone);
  const medicalNeedsClarification = hasMedicalData && needsClarification(`${restrictedNotes} ${allergyNotes} ${parentMedicalNotes}`);
  if (medicalNeedsClarification) warnings.push("Medical notes require parent clarification.");

  const foodAllergyIndicator = boolish(pick(row, ["food allergy indicator", "food allergy", "dietary plan on file", "food allergy on file", "dietary alert"])) || Boolean(allergyNotes);
  const medicalConcernIndicator = boolish(pick(row, ["medical concern indicator", "medical concern", "care plan on file", "medical alert"])) || Boolean(restrictedNotes || parentMedicalNotes);
  const emergencyContactOnFile = boolish(pick(row, ["emergency contact on file", "emergency contact indicator"])) || Boolean(emergencyContactName || emergencyContactPhone);
  const match: { action: "add" | "update" | "skip"; id?: string; warning?: string } =
    options.mode === "partnerChurch" ? resolveStudentImportMatch(name, options.existingStudents ?? []) : { action: "add" };
  if (match.warning) warnings.push(match.warning);

  const blocked = !name || match.action === "skip";
  const needsParentClarification = medicationNeedsClarification || medicalNeedsClarification || medicationOnFileIndicator;
  const status: CampRegistrationImportPreviewRow["status"] = blocked
    ? "Blocked"
    : options.mode === "partnerChurch" && (warnings.length > 0 || needsParentClarification)
      ? "Warning"
      : needsParentClarification
        ? "Needs Parent Clarification"
        : "Ready";
  const studentName = name || `Import row ${rowNumber}`;
  const medication = hasMedicationData
    ? {
        medicationName: medicationName || "Parent-labeled medication",
        medicinePhotoStatus: "Photo Needed" as const,
        parentProvidedInstructions: medicationInstructions || clarificationText,
        checkInStatus: medicationNeedsClarification ? "Needs Parent Clarification" as const : "Not Checked In" as const,
        clarificationStatus: medicationNeedsClarification ? "Needs Parent Clarification" as const : "Clear" as const,
        scheduleTimeWindow: medicationTime || undefined
      }
    : medicationOnFileIndicator
      ? {
          medicationName: "Medication on file",
          medicinePhotoStatus: "Photo Needed" as const,
          parentProvidedInstructions: clarificationText,
          checkInStatus: "Needs Parent Clarification" as const,
          clarificationStatus: "Needs Parent Clarification" as const
        }
      : undefined;

  return {
    rowNumber,
    status,
    importAction: blocked ? "skip" : match.action,
    sourceChurch: partnerChurch,
    warnings,
    camper: {
      id: match.id,
      name: studentName,
      profilePhotoUrl,
      grade: pick(row, ["grade", "student grade"]) || "",
      teamId: team?.id ?? (options.mode === "partnerChurch" ? "" : options.teams[0]?.id ?? ""),
      vehicleId: vehicle?.id ?? (options.mode === "partnerChurch" ? "" : options.vehicles[0]?.id ?? ""),
      cabin: pick(row, ["cabin", "room", "room/cabin"]) || "",
      shirtSize: pick(row, ["shirt size", "t-shirt size", "t shirt size"]) || "",
      sourceChurch: partnerChurch,
      rosterType: options.mode === "partnerChurch" ? "partner" : "emerge",
      emergencyContactOnFile,
      hasMedicalAlert: medicalConcernIndicator,
      hasDietaryAlert: foodAllergyIndicator,
      limitedSafetyFlags: safetyFlags
    },
    restrictedMedical: hasMedicalData
      ? toRestrictedMedical(studentName, restrictedNotes, allergyNotes, insuranceStatus, parentMedicalNotes, medicalNeedsClarification, emergencyContactName, emergencyContactPhone)
      : undefined,
    medication
  };
}

function toRestrictedMedical(
  studentName: string,
  restrictedNotes: string,
  allergyNotes: string,
  insuranceStatus: string,
  parentMedicalNotes: string,
  needsParentClarification: boolean,
  emergencyContactName = "",
  emergencyContactPhone = ""
): CampRestrictedMedicalRecord {
  return {
    studentId: "",
    studentName,
    medicalFormStatus: needsParentClarification ? "Needs Parent Clarification" : "Received",
    restrictedNotes,
    allergyNotes,
    insuranceStatus,
    parentMedicalNotes,
    emergencyContactName,
    emergencyContactPhone
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

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findTeam(items: CampTeam[], name: string): CampTeam | undefined {
  if (!name) return undefined;
  const normalized = normalizeTeamName(name);
  return items.find((item) => normalizeTeamName(item.name) === normalized || normalizeTeamName(item.color) === normalized);
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

function boolish(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (/^(no|none|n\/a|na|false|0)$/i.test(normalized)) return false;
  return /^(yes|y|true|1|x|on file|filed|present|food|diet|medical|medication|care plan)$/i.test(normalized) || normalized.includes("on file");
}

function normalizeTeamName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\s+team$/, "");
}

function sanitizeProfilePhotoUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

function resolveStudentImportMatch(
  name: string,
  existingStudents: Array<Pick<CampVisibleStudent, "id" | "name">>
): { action: "add" | "update" | "skip"; id?: string; warning?: string } {
  if (!name.trim()) return { action: "skip" };
  const normalized = normalizeName(name);
  const matches = existingStudents.filter((student) => normalizeName(student.name) === normalized);
  if (matches.length === 1) return { action: "update", id: matches[0].id };
  if (matches.length > 1) return { action: "add", warning: "Multiple existing campers have this name; camper will import as a new safe roster record." };
  return { action: "add" };
}
