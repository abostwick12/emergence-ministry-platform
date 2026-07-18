import { isSupabaseConfigured } from "@/lib/auth/config";
import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import {
  getLocalStudentJourneyEntries,
  saveLocalStudentJourneyEntry,
  shouldUseLocalStudentState
} from "@/lib/scripture/student-local-state";
import type {
  SaveStudentJourneyEntryInput,
  StudentJourneyEntry,
  StudentJourneyKind,
  StudentJourneyPractice,
  StudentJourneyStudyPath
} from "@/lib/scripture/student-journey-entry-shared";

export type { SaveStudentJourneyEntryInput, StudentJourneyEntry } from "@/lib/scripture/student-journey-entry-shared";

const MAX_JOURNEY_ID_LENGTH = 160;
const MAX_REFLECTION_LENGTH = 4000;
const MAX_READING_ID_LENGTH = 200;
const MAX_ENTRY_SEQUENCE = 100;
const MISSING_STUDENT_PROFILE_MESSAGE =
  "Your student profile is not connected to a ministry yet. Join through your group invite again, or ask your leader for a fresh invite.";

type StudentJourneyEntryRow = {
  journey_id: string;
  journey_kind: StudentJourneyKind;
  prompt_id: string | null;
  entry_sequence: number;
  scripture_reflection: string;
  question_reflection: string;
  practice_reflection: string;
  living_reflection: string;
  fruit_reflection: string;
  selected_practice: StudentJourneyPractice;
  study_path: StudentJourneyStudyPath;
  selected_reading_id: string;
  saved_at: string;
  updated_at: string;
};

const journeyEntryColumns = [
  "journey_id",
  "journey_kind",
  "prompt_id",
  "entry_sequence",
  "scripture_reflection",
  "question_reflection",
  "practice_reflection",
  "living_reflection",
  "fruit_reflection",
  "selected_practice",
  "study_path",
  "selected_reading_id",
  "saved_at",
  "updated_at"
].join(",");

export async function getStudentJourneyEntries(session: AuthSession): Promise<StudentJourneyEntry[]> {
  if (shouldUseLocalStudentState(session)) return getLocalStudentJourneyEntries(session);
  if (!session.accessToken || !isSupabaseConfigured()) return [];

  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    const result = await supabase
      .from("student_journey_entries")
      .select(journeyEntryColumns)
      .eq("student_user_id", session.user.id)
      .order("updated_at", { ascending: false })
      .returns<StudentJourneyEntryRow[]>();

    if (result.error) {
      console.warn("[scripture] student journey entry query failed", { message: result.error.message });
      return [];
    }

    return (result.data ?? []).map(toJourneyEntry);
  } catch (error) {
    console.warn("[scripture] student journey entry query unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return [];
  }
}

export async function saveStudentJourneyEntry(session: AuthSession, rawInput: SaveStudentJourneyEntryInput) {
  const input = normalizeJourneyEntryInput(rawInput);

  if (shouldUseLocalStudentState(session)) return saveLocalStudentJourneyEntry(session, input);
  if (!session.accessToken || !isSupabaseConfigured()) {
    throw new StudentJourneyEntryError("Journey account storage is not available.", 503, "live_storage_not_configured");
  }

  const ministryId = await requireStudentMinistryScope(session);
  const now = new Date().toISOString();
  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase
    .from("student_journey_entries")
    .upsert(
      {
        ...(ministryId ? { ministry_id: ministryId } : {}),
        student_user_id: session.user.id,
        journey_id: input.journeyId,
        journey_kind: input.journeyKind,
        prompt_id: input.promptId ?? null,
        entry_sequence: input.entrySequence,
        scripture_reflection: input.scriptureReflection,
        question_reflection: input.questionReflection,
        practice_reflection: input.practiceReflection,
        living_reflection: input.livingReflection,
        fruit_reflection: input.fruitReflection,
        selected_practice: input.selectedPractice,
        study_path: input.studyPath,
        selected_reading_id: input.selectedReadingId,
        saved_at: now
      },
      { onConflict: "student_user_id,journey_id,entry_sequence" }
    )
    .select(journeyEntryColumns)
    .single<StudentJourneyEntryRow>();

  if (result.error) {
    throw new StudentJourneyEntryError("Journey entry could not be saved.", 500, "save_failed");
  }
  if (!result.data) throw new StudentJourneyEntryError("Saved journey entry was not returned.", 500, "missing_entry");

  return toJourneyEntry(result.data);
}

export function normalizeJourneyEntryInput(input: SaveStudentJourneyEntryInput): SaveStudentJourneyEntryInput {
  const journeyId = normalizeRequiredText(input.journeyId, MAX_JOURNEY_ID_LENGTH, "Choose a valid journey.", "invalid_journey");
  const journeyKind = input.journeyKind === "formation" || input.journeyKind === "question" ? input.journeyKind : undefined;
  if (!journeyKind) throw new StudentJourneyEntryError("Choose a valid journey type.", 400, "invalid_journey_kind");

  const promptId = normalizeOptionalText(input.promptId, MAX_JOURNEY_ID_LENGTH, "Question reference is invalid.", "invalid_prompt");
  if (journeyKind === "question" && (!promptId || journeyId !== promptId)) {
    throw new StudentJourneyEntryError("Question journeys must match a submitted question.", 400, "invalid_prompt");
  }
  if (journeyKind === "formation" && promptId) {
    throw new StudentJourneyEntryError("Formation journeys cannot use a question reference.", 400, "invalid_prompt");
  }

  if (!Number.isInteger(input.entrySequence) || input.entrySequence < 1 || input.entrySequence > MAX_ENTRY_SEQUENCE) {
    throw new StudentJourneyEntryError("Choose a valid journey day or entry.", 400, "invalid_entry_sequence");
  }

  const selectedPractice = input.selectedPractice === "guided" ? "guided" : input.selectedPractice === "embodied" ? "embodied" : undefined;
  if (!selectedPractice) throw new StudentJourneyEntryError("Choose a valid spiritual practice.", 400, "invalid_practice");
  const studyPath = input.studyPath === "inductive" ? "inductive" : input.studyPath === "word" ? "word" : undefined;
  if (!studyPath) throw new StudentJourneyEntryError("Choose a valid study path.", 400, "invalid_study_path");

  return {
    journeyId,
    journeyKind,
    ...(promptId ? { promptId } : {}),
    entrySequence: input.entrySequence,
    scriptureReflection: normalizeReflection(input.scriptureReflection),
    questionReflection: normalizeReflection(input.questionReflection),
    practiceReflection: normalizeReflection(input.practiceReflection),
    livingReflection: normalizeReflection(input.livingReflection),
    fruitReflection: normalizeReflection(input.fruitReflection),
    selectedPractice,
    studyPath,
    selectedReadingId: normalizeOptionalText(
      input.selectedReadingId,
      MAX_READING_ID_LENGTH,
      "Selected reading is invalid.",
      "invalid_reading"
    ) ?? ""
  };
}

function toJourneyEntry(row: StudentJourneyEntryRow): StudentJourneyEntry {
  return {
    journeyId: row.journey_id,
    journeyKind: row.journey_kind,
    ...(row.prompt_id ? { promptId: row.prompt_id } : {}),
    entrySequence: row.entry_sequence,
    scriptureReflection: row.scripture_reflection,
    questionReflection: row.question_reflection,
    practiceReflection: row.practice_reflection,
    livingReflection: row.living_reflection,
    fruitReflection: row.fruit_reflection,
    selectedPractice: row.selected_practice,
    studyPath: row.study_path,
    selectedReadingId: row.selected_reading_id,
    savedAt: row.saved_at,
    updatedAt: row.updated_at
  };
}

function normalizeReflection(value: string) {
  return normalizeOptionalText(value, MAX_REFLECTION_LENGTH, "Each reflection must be 4000 characters or fewer.", "reflection_too_long") ?? "";
}

function normalizeRequiredText(value: string, maxLength: number, message: string, code: string) {
  const normalized = normalizeOptionalText(value, maxLength, message, code);
  if (!normalized) throw new StudentJourneyEntryError(message, 400, code);
  return normalized;
}

function normalizeOptionalText(value: string | undefined, maxLength: number, message: string, code: string) {
  const normalized = (value ?? "").normalize("NFKC").trim();
  if (normalized.length > maxLength) throw new StudentJourneyEntryError(message, 400, code);
  return normalized || undefined;
}

async function requireStudentMinistryScope(session: AuthSession) {
  const ministryId = await resolveMinistryScope(session);
  if (!ministryId && session.user.role.trim().toLowerCase() === "student") {
    throw new StudentJourneyEntryError(MISSING_STUDENT_PROFILE_MESSAGE, 409, "missing_student_profile");
  }
  return ministryId;
}

export class StudentJourneyEntryError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}
