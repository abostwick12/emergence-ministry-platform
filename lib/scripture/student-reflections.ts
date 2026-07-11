import { isSupabaseConfigured } from "@/lib/auth/config";
import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import {
  getLocalStudentQuestionReflections,
  saveLocalStudentQuestionReflection,
  shouldUseLocalStudentState
} from "@/lib/scripture/student-local-state";

const MAX_PRIVATE_NOTE_LENGTH = 1200;

export type StudentQuestionReflection = {
  promptId: string;
  reflectedAt?: string;
  privateNote: string;
  updatedAt: string;
};

type StudentQuestionReflectionRow = {
  prompt_id: string;
  reflected_at: string | null;
  private_note: string | null;
  updated_at: string;
};

export type SaveStudentQuestionReflectionInput = {
  promptId: string;
  reflected: boolean;
  privateNote?: string;
};

export async function getStudentQuestionReflections(
  session: AuthSession,
  promptIds: string[]
): Promise<Record<string, StudentQuestionReflection>> {
  if (shouldUseLocalStudentState(session)) return getLocalStudentQuestionReflections(session, promptIds);
  if (!session.accessToken || !isSupabaseConfigured() || promptIds.length === 0) return {};

  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    const result = await supabase
      .from("student_question_reflections")
      .select("prompt_id,reflected_at,private_note,updated_at")
      .eq("student_user_id", session.user.id)
      .in("prompt_id", promptIds)
      .returns<StudentQuestionReflectionRow[]>();

    if (result.error) {
      console.warn("[scripture] student reflection query failed", { message: result.error.message });
      return {};
    }

    return Object.fromEntries((result.data ?? []).map((row) => [row.prompt_id, toReflection(row)]));
  } catch (error) {
    console.warn("[scripture] student reflection query unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return {};
  }
}

export async function saveStudentQuestionReflection(session: AuthSession, input: SaveStudentQuestionReflectionInput) {
  const promptId = normalizeId(input.promptId);
  const privateNote = normalizePrivateNote(input.privateNote ?? "");

  if (shouldUseLocalStudentState(session)) {
    return saveLocalStudentQuestionReflection(session, {
      promptId,
      reflected: input.reflected,
      privateNote
    });
  }

  if (!session.accessToken || !isSupabaseConfigured()) {
    throw new StudentQuestionReflectionError("Live student reflection storage is not available.", 503, "live_storage_not_configured");
  }

  const ministryId = await resolveMinistryScope(session);
  const now = new Date().toISOString();
  const reflectedAt = input.reflected ? now : null;
  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase
    .from("student_question_reflections")
    .upsert(
      {
        ...(ministryId ? { ministry_id: ministryId } : {}),
        prompt_id: promptId,
        student_user_id: session.user.id,
        reflected_at: reflectedAt,
        private_note: privateNote
      },
      { onConflict: "prompt_id,student_user_id" }
    )
    .select("prompt_id,reflected_at,private_note,updated_at")
    .single<StudentQuestionReflectionRow>();

  if (result.error) {
    throw new StudentQuestionReflectionError("Student reflection could not be saved.", 500, "save_failed");
  }
  if (!result.data) throw new StudentQuestionReflectionError("Student reflection was not returned.", 500, "missing_reflection");

  if (input.reflected) {
    await logReflectionEvent(session, promptId, now);
  }

  return toReflection(result.data);
}

async function logReflectionEvent(session: AuthSession, promptId: string, reflectedAt: string) {
  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    const ministryId = await resolveMinistryScope(session);
    await supabase.from("student_discussion_prompt_events").insert({
      ...(ministryId ? { ministry_id: ministryId } : {}),
      prompt_id: promptId,
      actor_user_id: session.user.id,
      action: "student_reflected",
      details: { reflectedAt }
    });
  } catch (error) {
    console.warn("[scripture] student reflection event log unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}

function toReflection(row: StudentQuestionReflectionRow): StudentQuestionReflection {
  return {
    promptId: row.prompt_id,
    reflectedAt: row.reflected_at ?? undefined,
    privateNote: row.private_note ?? "",
    updatedAt: row.updated_at
  };
}

function normalizeId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new StudentQuestionReflectionError("Question is required.", 400, "missing_prompt");
  return trimmed;
}

function normalizePrivateNote(value: string) {
  const trimmed = value.trim();
  if (trimmed.length > MAX_PRIVATE_NOTE_LENGTH) {
    throw new StudentQuestionReflectionError("Private note must be 1200 characters or fewer.", 400, "note_too_long");
  }
  return trimmed;
}

export class StudentQuestionReflectionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}
