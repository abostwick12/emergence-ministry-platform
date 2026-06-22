// Camp EMMA room-change command slice — Andrew-only operational write path.
//
// Flow: natural language → (restricted-topic gate) → Azure model classifies
// intent + extracts entities → server matches student + validates everything
// → returns a proposal/clarification/blocked/unavailable/error result. The
// model NEVER writes to the database; a write only happens later, in a
// separate, explicitly-confirmed step (see confirmCampEmmaRoomChange in
// lib/camp/repository.ts), after the server re-validates again.
import { z } from "zod";
import { restrictedNeedles } from "@/lib/camp/emma";
import { callCampEmmaAzureModel, readCampEmmaAzureConfig, type CampEmmaAzureCallResult } from "@/lib/camp/emma-azure-provider";
import type { CampEmmaCommandResult, CampEmmaCommandIntent, CampVisibleStudent } from "@/lib/camp/types";

const MAX_COMMAND_LENGTH = 400;

const modelOutputSchema = z.object({
  intent: z.enum(["update_room", "restricted_or_unsupported", "unsupported"]),
  studentNameQuery: z.string().trim().max(200).optional(),
  proposedRoom: z.string().trim().max(80).optional()
});

const SYSTEM_PROMPT = `You are a strict command classifier for a summer camp roster tool.
You will be given one natural-language staff request. Your ONLY job is to classify it and extract entities into JSON. You do not have roster data and you must not invent names or rooms.

Return JSON matching exactly this shape:
{"intent": "update_room" | "restricted_or_unsupported" | "unsupported", "studentNameQuery": string (optional), "proposedRoom": string (optional)}

Rules:
- "update_room" is ONLY for requests to change a camper's room/cabin assignment (e.g. "Change John West to room 508", "Move Avery to cabin 12"). Extract the camper's name into studentNameQuery and the new room/cabin value into proposedRoom, exactly as written.
- "restricted_or_unsupported" is for ANY request touching medical info, medication, dosage, allergies, insurance, parent or guardian contact info, emergency contacts, or any other sensitive/medical topic, even if it also mentions a room.
- "unsupported" is for anything else (team changes, vehicle changes, schedule changes, questions, anything not a room/cabin change).
- Output ONLY the JSON object. No prose, no markdown.`;

export type CampEmmaInterpretInput = {
  rawText: string;
  students: CampVisibleStudent[];
  fetchImpl?: typeof fetch;
};

export type CampEmmaInterpretLog = {
  durationMs: number;
  success: boolean;
  outcomeKind: CampEmmaCommandResult["kind"];
};

export type CampEmmaInterpretOutput = {
  result: CampEmmaCommandResult;
  log: CampEmmaInterpretLog;
};

/**
 * Interprets a natural-language Camp EMMA command. Always resolves (never
 * throws) so callers can render a safe result in every case, including when
 * Azure env vars are missing or the provider call fails.
 */
export async function interpretCampEmmaCommand(input: CampEmmaInterpretInput): Promise<CampEmmaInterpretOutput> {
  const startedAt = Date.now();
  const rawText = input.rawText.trim().slice(0, MAX_COMMAND_LENGTH);

  if (!rawText) {
    return finish(startedAt, { kind: "error", message: "Type a command for EMMA, like \"Change John West to room 508.\"" });
  }

  // Deterministic, server-side restricted-topic gate. This runs BEFORE any
  // model call and cannot be bypassed by a model misclassification — it is
  // the same needle list the read-only Camp EMMA Q&A path already uses.
  const normalized = rawText.toLowerCase();
  if (restrictedNeedles.some((needle) => normalized.includes(needle))) {
    return finish(startedAt, {
      kind: "blocked",
      reason: "restricted_topic",
      message: "EMMA can't make medical, medication, insurance, or contact-related changes yet. Please update those records directly."
    });
  }

  if (!readCampEmmaAzureConfig()) {
    return finish(startedAt, { kind: "unavailable", message: "EMMA isn't connected to an AI model right now. Room changes can still be made directly from the roster." });
  }

  const callResult = await callCampEmmaAzureModel({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: rawText,
    fetchImpl: input.fetchImpl
  });

  if (!callResult.ok) {
    return finish(startedAt, unavailableOrErrorFromCallResult(callResult));
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(callResult.text);
  } catch {
    return finish(startedAt, { kind: "error", message: "EMMA couldn't understand that command. Try rephrasing, e.g. \"Change John West to room 508.\"" });
  }

  const parsed = modelOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return finish(startedAt, { kind: "error", message: "EMMA couldn't understand that command. Try rephrasing, e.g. \"Change John West to room 508.\"" });
  }

  return finish(startedAt, buildResultFromIntent(parsed.data, rawText, input.students, callResult.model, callResult.deployment));
}

function buildResultFromIntent(
  intent: CampEmmaCommandIntent,
  rawText: string,
  students: CampVisibleStudent[],
  model: string,
  deployment: string
): CampEmmaCommandResult {
  if (intent.intent === "restricted_or_unsupported") {
    return {
      kind: "blocked",
      reason: "restricted_topic",
      message: "EMMA can't make medical, medication, insurance, or contact-related changes yet. Please update those records directly."
    };
  }

  if (intent.intent === "unsupported" || !intent.studentNameQuery) {
    return {
      kind: "blocked",
      reason: "unsupported_action",
      message: "EMMA can only change a camper's room assignment in this first version. Try something like \"Change John West to room 508.\""
    };
  }

  const proposedRoom = intent.proposedRoom?.trim();
  if (!proposedRoom) {
    return {
      kind: "blocked",
      reason: "unsupported_action",
      message: "EMMA found a camper but no room or cabin value to assign. Try including the new room, e.g. \"Change John West to room 508.\""
    };
  }

  const matches = matchStudentsByName(students, intent.studentNameQuery);

  if (matches.length === 0) {
    return {
      kind: "blocked",
      reason: "no_match",
      message: `I couldn't find a student named "${intent.studentNameQuery}" on the active roster.`
    };
  }

  if (matches.length > 1) {
    return {
      kind: "clarification",
      message: `I found ${matches.length} students named "${intent.studentNameQuery}". Which one do you mean?`,
      candidates: matches.map((student) => ({ studentId: student.id, studentName: student.name, currentRoom: student.cabin ?? "" })),
      proposedRoom,
      originalRequest: rawText,
      model,
      deployment
    };
  }

  const student = matches[0];
  return {
    kind: "proposal",
    studentId: student.id,
    studentName: student.name,
    currentRoom: student.cabin ?? "",
    proposedRoom,
    originalRequest: rawText,
    model,
    deployment
  };
}

/**
 * Matches active students by name. Tries an exact case-insensitive full-name
 * match first (so "John West" with two campers named exactly that surfaces
 * both, per the required clarification behavior); falls back to a
 * substring match in either direction for partial names/minor typos.
 */
export function matchStudentsByName(students: CampVisibleStudent[], query: string): CampVisibleStudent[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const exact = students.filter((student) => student.name.trim().toLowerCase() === normalizedQuery);
  if (exact.length > 0) return exact;

  return students.filter((student) => {
    const name = student.name.trim().toLowerCase();
    return name.includes(normalizedQuery) || normalizedQuery.includes(name);
  });
}

function unavailableOrErrorFromCallResult(callResult: Exclude<CampEmmaAzureCallResult, { ok: true }>): CampEmmaCommandResult {
  if (callResult.reason === "unavailable") {
    return { kind: "unavailable", message: "EMMA isn't connected to an AI model right now. Room changes can still be made directly from the roster." };
  }
  if (callResult.reason === "timeout") {
    return { kind: "error", message: "EMMA took too long to respond. Please try again." };
  }
  return { kind: "error", message: "EMMA couldn't process that command safely. Please try again or make the change directly from the roster." };
}

function finish(startedAt: number, result: CampEmmaCommandResult): CampEmmaInterpretOutput {
  const durationMs = Date.now() - startedAt;
  const success = result.kind === "proposal" || result.kind === "clarification";
  return {
    result,
    log: { durationMs, success, outcomeKind: result.kind }
  };
}
