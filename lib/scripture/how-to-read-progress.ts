import { isSupabaseConfigured } from "@/lib/auth/config";
import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { howToReadModules } from "@/lib/scripture/how-to-read";
import {
  getLocalStudentHowToReadProgress,
  saveLocalStudentHowToReadProgress,
  shouldUseLocalStudentState
} from "@/lib/scripture/student-local-state";

const validModuleIds = new Set(howToReadModules.map((module) => module.id));
const MISSING_STUDENT_PROFILE_MESSAGE =
  "Your student profile is not connected to a ministry yet. Join through your group invite again, or ask your leader for a fresh invite.";

export type StudentHowToReadProgress = {
  completedModuleIds: string[];
  shareWithGroup: boolean;
  updatedAt?: string;
  storage: "server" | "local" | "unavailable";
};

type StudentHowToReadProgressRow = {
  module_id: string;
  completed_at: string | null;
  share_with_group: boolean | null;
  updated_at: string;
};

export type SaveStudentHowToReadProgressInput = {
  moduleId: string;
  completed: boolean;
  shareWithGroup?: boolean;
};

export async function getStudentHowToReadProgress(session: AuthSession): Promise<StudentHowToReadProgress> {
  if (shouldUseLocalStudentState(session)) return getLocalStudentHowToReadProgress(session);

  if (!session.accessToken || !isSupabaseConfigured()) {
    return emptyProgress("unavailable");
  }

  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    const result = await supabase
      .from("student_how_to_read_progress")
      .select("module_id,completed_at,share_with_group,updated_at")
      .eq("student_user_id", session.user.id)
      .order("updated_at", { ascending: false })
      .returns<StudentHowToReadProgressRow[]>();

    if (result.error) {
      console.warn("[scripture] how to read progress query failed", { message: result.error.message });
      return emptyProgress("unavailable");
    }

    return toProgress(result.data ?? [], "server");
  } catch (error) {
    console.warn("[scripture] how to read progress query unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return emptyProgress("unavailable");
  }
}

export async function saveStudentHowToReadProgress(session: AuthSession, input: SaveStudentHowToReadProgressInput) {
  const moduleId = normalizeModuleId(input.moduleId);

  if (shouldUseLocalStudentState(session)) {
    return saveLocalStudentHowToReadProgress(session, {
      moduleId,
      completed: input.completed,
      shareWithGroup: input.shareWithGroup
    });
  }

  if (!session.accessToken || !isSupabaseConfigured()) {
    throw new StudentHowToReadProgressError("Saved progress is not configured yet.", 503, "live_storage_not_configured");
  }

  const ministryId = await requireStudentMinistryScope(session);
  const completedAt = input.completed ? new Date().toISOString() : null;
  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase
    .from("student_how_to_read_progress")
    .upsert(
      {
        ...(ministryId ? { ministry_id: ministryId } : {}),
        student_user_id: session.user.id,
        module_id: moduleId,
        completed_at: completedAt,
        ...(input.shareWithGroup === undefined ? {} : { share_with_group: input.shareWithGroup })
      },
      { onConflict: "student_user_id,module_id" }
    )
    .select("module_id,completed_at,share_with_group,updated_at")
    .single<StudentHowToReadProgressRow>();

  if (result.error) {
    throw new StudentHowToReadProgressError("Progress could not be saved.", 500, "save_failed");
  }
  if (!result.data) throw new StudentHowToReadProgressError("Saved progress was not returned.", 500, "missing_progress");

  return getStudentHowToReadProgress(session);
}

function toProgress(rows: StudentHowToReadProgressRow[], storage: StudentHowToReadProgress["storage"]): StudentHowToReadProgress {
  const validRows = rows.filter((row) => validModuleIds.has(row.module_id));
  return {
    completedModuleIds: validRows.filter((row) => Boolean(row.completed_at)).map((row) => row.module_id),
    shareWithGroup: validRows.some((row) => row.share_with_group === true),
    updatedAt: validRows[0]?.updated_at,
    storage
  };
}

function emptyProgress(storage: StudentHowToReadProgress["storage"]): StudentHowToReadProgress {
  return {
    completedModuleIds: [],
    shareWithGroup: false,
    storage
  };
}

async function requireStudentMinistryScope(session: AuthSession) {
  const ministryId = await resolveMinistryScope(session);
  if (!ministryId && session.user.role.trim().toLowerCase() === "student") {
    throw new StudentHowToReadProgressError(MISSING_STUDENT_PROFILE_MESSAGE, 409, "missing_student_profile");
  }
  return ministryId;
}

function normalizeModuleId(value: string) {
  const trimmed = value.trim();
  if (!validModuleIds.has(trimmed)) {
    throw new StudentHowToReadProgressError("Choose a valid guide.", 400, "invalid_module");
  }
  return trimmed;
}

export class StudentHowToReadProgressError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}
