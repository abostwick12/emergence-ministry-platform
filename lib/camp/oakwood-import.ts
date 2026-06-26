import type {
  CampImportMatchStatus,
  CampOakwoodImportPreview,
  CampOakwoodImportRow,
  CampOakwoodImportSummary,
  CampOakwoodRestrictedPayload,
  CampOakwoodSafeIndicators
} from "@/lib/camp/types";
export { oakwoodExpectedCsvHeaders, oakwoodOptionalCsvHeaders, oakwoodRecommendedCsvHeaders, oakwoodRequiredCsvHeaders, oakwoodSampleHeaderRow } from "@/lib/camp/oakwood-source-format";

// Camp Oakwood "Quick View" workbook import engine.
//
// Pure, deterministic, server-side-only mapping from the registration workbook to
// (a) SAFE operational person fields, (b) RESTRICTED contact/medical payloads, and
// (c) the three SAFE leader-facing indicators. It is the single place that decides
// what is safe vs restricted, and it guarantees:
//   * blank source Team / Vehicle / Room values stay blank — NEVER fabricated;
//   * Registration ID is treated as a HOUSEHOLD id (never a unique person key);
//   * matching uses (Registration ID + name) or unique name, and any ambiguity is
//     flagged and excluded from auto-commit — never silently overwritten;
//   * the three safe indicators come ONLY from the explicit Quick Filter category
//     and whether a restricted note is present — never from parsing free text.

export type OakwoodSourceRow = Record<string, string>;

export type OakwoodExistingPerson = {
  id: string;
  name: string;
  registrationExternalId?: string;
};

export type OakwoodImportOptions = {
  sourceFile?: string;
  sourceKind?: CampOakwoodImportPreview["sourceKind"];
  importScope?: CampOakwoodImportPreview["importScope"];
  existingCampers?: OakwoodExistingPerson[];
  existingStaff?: OakwoodExistingPerson[];
};

const NA_VALUES = new Set(["", "n/a", "na", "none", "no", "-", "n.a", "tbd", "."]);

export function parseDelimited(content: string): OakwoodSourceRow[] {
  const records = parseRecords(content).filter((record) => record.some((cell) => cell.trim()));
  if (!records.length) return [];
  const headers = records[0].map(normalizeHeader);
  return records.slice(1).map((record) => {
    const row: OakwoodSourceRow = {};
    headers.forEach((header, index) => {
      // First non-empty wins for duplicated headers (e.g. "Emergency Contact").
      if (row[header] === undefined || row[header] === "") row[header] = (record[index] ?? "").trim();
    });
    return row;
  });
}

export function buildOakwoodImportPreviewFromCsv(csv: string, options: OakwoodImportOptions = {}): CampOakwoodImportPreview {
  return buildOakwoodImportPreview(parseDelimited(csv), options);
}

export function buildOakwoodImportPreview(rows: OakwoodSourceRow[], options: OakwoodImportOptions = {}): CampOakwoodImportPreview {
  const existingCampers = options.existingCampers ?? [];
  const existingStaff = options.existingStaff ?? [];
  const totalSourceRows = rows.length;

  const importRows: CampOakwoodImportRow[] = rows.map((row, index) =>
    // Students match against existing campers; adults against existing staff.
    normalizePersonRow(row, index + 2, existingCampers, existingStaff, options.importScope ?? "full_roster")
  );

  return {
    sourceFile: options.sourceFile ?? "Camp_Quick_View",
    sourceKind: options.sourceKind ?? "csv",
    importScope: options.importScope ?? "full_roster",
    rows: importRows,
    summary: summarizeOakwoodRows(importRows, totalSourceRows)
  };
}

// Combine separate upload previews (for example camper-only + staff-only) into
// one full-roster preview, recomputing the summary from the merged rows so counts
// never double up.
export function mergeOakwoodImportPreviews(
  parts: CampOakwoodImportPreview[],
  meta: {
    sourceFile: string;
    sourceKind?: CampOakwoodImportPreview["sourceKind"];
    uploadSources?: CampOakwoodImportPreview["uploadSources"];
    importScope?: CampOakwoodImportPreview["importScope"];
  }
): CampOakwoodImportPreview {
  const rows = parts.flatMap((part) => part.rows);
  const totalSourceRows = parts.reduce((total, part) => total + part.summary.totalSourceRows, 0);
  return {
    sourceFile: meta.sourceFile,
    sourceKind: meta.sourceKind ?? "upload",
    uploadSources: meta.uploadSources,
    importScope: meta.importScope ?? "full_roster",
    rows,
    summary: summarizeOakwoodRows(rows, totalSourceRows)
  };
}

function summarizeOakwoodRows(importRows: CampOakwoodImportRow[], totalSourceRows: number): CampOakwoodImportSummary {
  const personRows = importRows.filter((r) => r.matchStatus !== "skipped");
  const students = personRows.filter((r) => r.personType === "student");
  const adults = personRows.filter((r) => r.personType === "adult");
  const byStatus = (status: CampImportMatchStatus) => importRows.filter((r) => r.matchStatus === status).length;
  const committable = (r: CampOakwoodImportRow) => r.matchStatus === "new" || r.matchStatus === "matched";
  return {
    totalSourceRows,
    personRows: personRows.length,
    students: students.length,
    adults: adults.length,
    newCount: byStatus("new"),
    matchedCount: byStatus("matched"),
    ambiguousCount: byStatus("ambiguous"),
    skippedCount: byStatus("skipped"),
    invalidCount: byStatus("invalid"),
    safeFieldRows: importRows.filter(committable).length,
    restrictedRecordRows: importRows.filter((r) => r.restricted && committable(r)).length,
    staffRows: adults.filter(committable).length
  };
}

function normalizePersonRow(
  row: OakwoodSourceRow,
  rowNumber: number,
  existingCampers: OakwoodExistingPerson[],
  existingStaff: OakwoodExistingPerson[],
  importScope: CampOakwoodImportPreview["importScope"]
): CampOakwoodImportRow {
  const warnings: string[] = [];
  const name = pick(row, ["leader name", "name", "full name"]) || joinName(pick(row, ["first name"]), pick(row, ["last name"]));
  const personType = resolvePersonType(row, importScope);
  const registrationExternalId = pick(row, ["registration id"]);
  const grade = pick(row, ["grade", "student grade"]);
  // Blank source Room stays blank - no fabrication.
  const cabin = pick(row, ["room number", "cabin", "room"]);
  const shirtSize = pick(row, ["t-shirt size", "t shirt size", "shirt size"]);
  const profilePhotoUrl = sanitizeProfilePhotoUrl(pick(row, ["photo", "photo url", "profile photo", "student photo", "leader photo", "staff photo", "image"]));
  const sourceChurch = pick(row, ["partner church", "source church", "church/source", "church", "home church", "sending church", "source"]);
  const teamName = pick(row, ["team", "team name", "team color", "color", "team assignment"]);
  const vehicleName = pick(row, ["vehicle", "vehicle name", "transportation", "van"]);

  if (isHeaderLikePersonRow(row, name, importScope)) {
    return {
      rowNumber,
      matchStatus: "skipped",
      personType,
      warnings: ["Header-like leader row skipped."],
      person: { name, profilePhotoUrl, grade, cabin, shirtSize, registrationExternalId, sourceChurch, teamName, vehicleName },
      safeIndicators: { emergencyContactOnFile: false, hasMedicalAlert: false, hasDietaryAlert: false }
    };
  }

  if (!/^\d{5,}$/.test(registrationExternalId)) {
    if (importScope === "staff_only" && name.trim()) {
      const safeIndicators = { emergencyContactOnFile: false, hasMedicalAlert: false, hasDietaryAlert: false };
      const warnings = [
        ...(!cabin ? ["Room blank in source - left unassigned."] : []),
        ...(!teamName ? ["Team blank in source - left unassigned."] : []),
        ...(!registrationExternalId ? ["Registration ID blank for leader - imported as staff without app login access."] : ["Registration ID non-numeric for leader - imported as staff without app login access."])
      ];
      const match = resolveMatch(name, registrationExternalId, existingStaff);
      if (match.status === "ambiguous") warnings.push(match.reason);
      return {
        rowNumber,
        matchStatus: match.status,
        personType: "adult",
        matchedExistingId: match.matchedId,
        matchCandidateCount: match.candidateCount,
        warnings,
        person: { name, profilePhotoUrl, grade, cabin, shirtSize, registrationExternalId, sourceChurch, teamName, vehicleName },
        safeIndicators
      };
    }
    return {
      rowNumber,
      matchStatus: "skipped",
      personType,
      warnings: ["No numeric Registration ID - skipped as a non-person workbook row."],
      person: { name, profilePhotoUrl, grade, cabin, shirtSize, registrationExternalId, sourceChurch, teamName, vehicleName },
      safeIndicators: { emergencyContactOnFile: false, hasMedicalAlert: false, hasDietaryAlert: false }
    };
  }

  if (importScope === "staff_only" && personType === "student") {
    return {
      rowNumber,
      matchStatus: "skipped",
      personType,
      warnings: ["Student row skipped on the staff tab; campers are imported from the approved camper tab."],
      person: { name, profilePhotoUrl, grade, cabin, shirtSize, registrationExternalId, sourceChurch, teamName, vehicleName },
      safeIndicators: { emergencyContactOnFile: false, hasMedicalAlert: false, hasDietaryAlert: false }
    };
  }

  if (importScope === "camper_only" && personType === "adult") {
    return {
      rowNumber,
      matchStatus: "skipped",
      personType,
      warnings: ["Adult/staff row skipped on the camper tab; staff are imported from the approved staff tab."],
      person: { name, profilePhotoUrl, grade, cabin, shirtSize, registrationExternalId, sourceChurch, teamName, vehicleName },
      safeIndicators: { emergencyContactOnFile: false, hasMedicalAlert: false, hasDietaryAlert: false }
    };
  }

  if (personType === "student" && !grade) warnings.push("Grade missing from source.");
  if (!cabin) warnings.push("Room blank in source - left unassigned.");
  if (!teamName) warnings.push("Team blank in source - left unassigned.");
  if (!vehicleName) warnings.push("Vehicle blank in source - left unassigned.");

  const safeIndicators = deriveSafeIndicators(row);
  if (!safeIndicators.emergencyContactOnFile) warnings.push("No emergency contact in source.");

  const restricted = personType === "student" ? buildRestrictedPayload(row, safeIndicators) : undefined;

  const base: Omit<CampOakwoodImportRow, "matchStatus" | "matchedExistingId" | "matchCandidateCount"> = {
    rowNumber,
    personType,
    warnings,
    person: { name, profilePhotoUrl, grade, cabin, shirtSize, registrationExternalId, sourceChurch, teamName, vehicleName },
    safeIndicators,
    restricted
  };

  if (!name) {
    return { ...base, matchStatus: "invalid", warnings: [...warnings, "Missing name — cannot import."] };
  }

  const match = resolveMatch(name, registrationExternalId, personType === "adult" ? existingStaff : existingCampers);
  if (match.status === "ambiguous") warnings.push(match.reason);

  return {
    ...base,
    warnings,
    matchStatus: match.status,
    matchedExistingId: match.matchedId,
    matchCandidateCount: match.candidateCount
  };
}

// Safe indicators: explicit Quick Filter category OR presence of a restricted
// note. NEVER derived by interpreting medical/dietary free-text content.
function deriveSafeIndicators(row: OakwoodSourceRow): CampOakwoodSafeIndicators {
  const quickFilter = pick(row, ["quick filter"]).toLowerCase();
  const medicalNotePresent = isMeaningful(pick(row, ["medical notes"]));
  const dietaryNotePresent = isMeaningful(pick(row, ["dietary requirements"]));
  const emergencyPresent = isNonBlank(pick(row, ["emergency contact"]));

  return {
    emergencyContactOnFile: emergencyPresent,
    hasMedicalAlert: quickFilter.includes("medical") || medicalNotePresent,
    hasDietaryAlert: quickFilter.includes("food/diet") || quickFilter.includes("food / diet") || quickFilter.includes("diet") || dietaryNotePresent
  };
}

function resolvePersonType(row: OakwoodSourceRow, importScope: CampOakwoodImportPreview["importScope"]): CampOakwoodImportRow["personType"] {
  if (importScope === "staff_only") return "adult";
  if (importScope === "camper_only") return "student";
  return /adult|leader|staff|volunteer/i.test(pick(row, ["selection", "record type", "person type", "role"])) ? "adult" : "student";
}

function buildRestrictedPayload(row: OakwoodSourceRow, indicators: CampOakwoodSafeIndicators): CampOakwoodRestrictedPayload {
  const emergency = splitContact(pick(row, ["emergency contact"]));
  const guardianName = joinName(pick(row, ["registration contact first name"]), pick(row, ["registration contact last name"]));
  const guardianPhone = pick(row, ["registration contact phone number"]);
  const insuranceStatus = cleanNote(pick(row, ["insurance", "insurance status"]));
  const restrictedNotes = cleanNote(pick(row, ["medical notes"]));
  const dietary = cleanNote(pick(row, ["dietary requirements"]));
  const otherInfo = cleanNote(pick(row, ["any other important information you would like us to know about your child?", "other important information", "notes"]));

  return {
    medicalFormStatus: "Received",
    emergencyContactName: emergency.name,
    emergencyContactPhone: emergency.phone,
    emergencyContactRelationship: "",
    guardianName,
    guardianPhone,
    insuranceStatus,
    restrictedNotes: indicators.hasMedicalAlert ? restrictedNotes : "",
    dietaryRequirements: indicators.hasDietaryAlert ? dietary : "",
    parentMedicalNotes: otherInfo
  };
}

type MatchResult = { status: CampImportMatchStatus; matchedId?: string; candidateCount?: number; reason: string };

function resolveMatch(name: string, externalId: string, existing: OakwoodExistingPerson[]): MatchResult {
  const target = normalizeName(name);
  // Composite candidates: same name AND same household/registration id.
  const composite = existing.filter((e) => normalizeName(e.name) === target && (e.registrationExternalId ?? "") === externalId && externalId !== "");
  if (composite.length === 1) return { status: "matched", matchedId: composite[0].id, candidateCount: 1, reason: "" };
  if (composite.length > 1) {
    return { status: "ambiguous", candidateCount: composite.length, reason: "Multiple existing records share this Registration ID and name — manual resolution required." };
  }

  // Fall back to unique name match (Registration ID alone is a household id and is
  // never used on its own).
  const nameMatches = existing.filter((e) => normalizeName(e.name) === target);
  if (nameMatches.length === 1) {
    return {
      status: "ambiguous",
      matchedId: nameMatches[0].id,
      candidateCount: 1,
      reason: "Name matches an existing record with a different/absent Registration ID — confirm before overwriting."
    };
  }
  if (nameMatches.length > 1) {
    return { status: "ambiguous", candidateCount: nameMatches.length, reason: "Name matches multiple existing records — manual resolution required." };
  }

  return { status: "new", candidateCount: 0, reason: "" };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function pick(row: OakwoodSourceRow, names: string[]): string {
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

function joinName(first: string, last: string): string {
  return [first, last].map((p) => p.trim()).filter(Boolean).join(" ");
}

function isNonBlank(value: string): boolean {
  return value.trim() !== "";
}

function isMeaningful(value: string): boolean {
  return !NA_VALUES.has(value.trim().toLowerCase());
}

function cleanNote(value: string): string {
  const trimmed = value.trim();
  return NA_VALUES.has(trimmed.toLowerCase()) ? "" : trimmed;
}

function isHeaderLikePersonRow(row: OakwoodSourceRow, name: string, importScope: CampOakwoodImportPreview["importScope"]): boolean {
  if (importScope !== "staff_only") return false;
  const normalizedName = normalizeHeader(name);
  if (["leader name", "name", "full name", "first name last name"].includes(normalizedName)) return true;
  const first = normalizeHeader(pick(row, ["first name"]));
  const last = normalizeHeader(pick(row, ["last name"]));
  if (first === "first name" && last === "last name") return true;
  const team = normalizeHeader(pick(row, ["team", "team name", "team color", "color", "team assignment"]));
  return Boolean(normalizedName && team === "team");
}

function sanitizeProfilePhotoUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || NA_VALUES.has(trimmed.toLowerCase())) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

// Storage-only parse of "Name - (phone)" into restricted fields. This is data
// storage, not indicator derivation.
function splitContact(value: string): { name: string; phone: string } {
  const trimmed = value.trim();
  if (!trimmed) return { name: "", phone: "" };
  const phoneMatch = trimmed.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  if (!phoneMatch) return { name: trimmed, phone: "" };
  const phone = phoneMatch[0].trim();
  const name = trimmed.slice(0, phoneMatch.index).replace(/[-–—\s]+$/, "").trim();
  return { name: name || trimmed, phone };
}

function parseRecords(input: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
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
