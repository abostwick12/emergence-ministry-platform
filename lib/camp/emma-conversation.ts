// Server-only conversational answer path for Camp EMMA.
//
// This is what makes EMMA feel like an AI assistant for Andrew and Jaci rather
// than a keyword finder: it grounds the configured Azure OpenAI model in the
// caller's already-permission-scoped Camp overview and lets it answer free-form
// operational questions.
//
// Safety:
// - OPERATIONAL DATA ONLY. Every medical / safety / restricted field is stripped
//   before serialization (see toOperationalSnapshot). Medical questions are never
//   answered here — they stay on the existing in-app medical view.
// - The model only ANSWERS. It never writes, never resolves IDs, and is never
//   trusted to authorize anything. Writes continue to flow through the audited
//   confirm-before-save action path.
// - Returns null (not a thrown error) when the provider is unavailable or returns
//   unusable output, so callers can fall back to the deterministic finder and
//   EMMA never goes dead.

import { z } from "zod";
import { callCampEmmaAzureModel, readCampEmmaAzureConfig } from "@/lib/camp/emma-azure-provider";
import type { CampEmmaAccess, CampEmmaAnswer } from "@/lib/camp/emma";
import type { CampOverviewPayload } from "@/lib/camp/types";

const CONVERSATION_TIMEOUT_MS = 12000;
const CONVERSATION_MAX_TOKENS = 700;
// Keep the grounding context bounded so a large roster cannot blow up token use.
const MAX_STUDENTS = 320;
const MAX_STAFF = 120;

const conversationalAccess: ReadonlySet<CampEmmaAccess> = new Set<CampEmmaAccess>([
  "jaci",
  "andrew_operations",
  "andrew_medical"
]);

export function isCampEmmaConversationalAccess(access: CampEmmaAccess): boolean {
  return conversationalAccess.has(access);
}

const answerSchema = z.object({
  answer: z.string().trim().min(1).max(1500),
  details: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  uncertainty: z.string().trim().min(1).max(400).optional()
});

const SYSTEM_PROMPT = `You are EMMA, the Emerge Ministry Management Agent, helping a camp admin or medical coordinator during a live camp.

You are given a JSON snapshot of the CURRENT camp's OPERATIONAL data: teams, campers, leaders/staff, vehicles, and schedule. Answer the user's question using ONLY this snapshot.

Hard rules:
- Use ONLY facts present in the provided snapshot. Never invent campers, teams, rooms, times, or numbers. If the snapshot does not contain the answer, say so plainly.
- You have NO medical, medication, allergy, insurance, guardian, or emergency-contact data. If asked about any of those, say medical details are not available here and to use the in-app medical view. Do not guess.
- You cannot make changes. If the user asks you to move, assign, or edit anyone, explain that changes are made through a separate confirmed action and that you can help them find who/what to change.
- Be concise and concrete. Prefer specific names, counts, and lists over vague summaries.
- Counts must be derived from the snapshot, not estimated.

Return ONLY valid JSON of this shape:
{"answer":"<plain-language answer>","details":["<supporting fact>","..."],"uncertainty":"<optional caveat if data may be incomplete>"}
The "details" array is optional; include short supporting facts (e.g. specific names or counts) when helpful. Omit "uncertainty" unless something is genuinely ambiguous or missing.`;

export async function answerCampEmmaConversation(input: {
  question: string;
  overview: CampOverviewPayload;
  access: CampEmmaAccess;
  selectedDay?: string;
  fetchImpl?: typeof fetch;
}): Promise<CampEmmaAnswer | null> {
  const question = input.question.trim().slice(0, 600);
  if (!question) return null;
  if (!isCampEmmaConversationalAccess(input.access)) return null;

  const config = readCampEmmaAzureConfig();
  if (!config) return null;

  const snapshot = toOperationalSnapshot(input.overview);
  const userPrompt = JSON.stringify({
    question,
    selectedDay: input.selectedDay ?? null,
    camp: snapshot
  });

  const result = await callCampEmmaAzureModel({
    config,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    fetchImpl: input.fetchImpl,
    timeoutMs: CONVERSATION_TIMEOUT_MS,
    maxTokens: CONVERSATION_MAX_TOKENS
  });

  if (!result.ok) {
    logConversationFallback(result.reason);
    return null;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(result.text);
  } catch {
    logConversationFallback("invalid_json");
    return null;
  }

  const parsed = answerSchema.safeParse(parsedJson);
  if (!parsed.success) {
    logConversationFallback("unsupported_output");
    return null;
  }

  return {
    answer: parsed.data.answer,
    details: parsed.data.details ?? [],
    actions: [{ label: "Open roster", href: "/camp/roster" }],
    ...(parsed.data.uncertainty ? { uncertainty: parsed.data.uncertainty } : {})
  };
}

// Build the operational-only snapshot sent to the model. Medical, safety, and
// restricted flags are intentionally NOT copied here — this is the data boundary
// that keeps protected information out of the model context.
function toOperationalSnapshot(overview: CampOverviewPayload) {
  return {
    campName: overview.campName,
    campStartsOn: overview.campStartsOn,
    teams: overview.teams
      .filter((team) => !team.archivedAt)
      .map((team) => ({
        name: team.name,
        color: team.color,
        lead: team.leader || null,
        coLead: team.coLeader || null,
        room: team.room || null
      })),
    vehicles: overview.vehicles
      .filter((vehicle) => !vehicle.archivedAt)
      .map((vehicle) => ({
        name: vehicle.name,
        driver: vehicle.driver || null,
        departureWindow: vehicle.departureWindow || null,
        departureLocation: vehicle.departureLocation || null,
        capacity: vehicle.capacity
      })),
    schedule: overview.schedule
      .filter((block) => block.audience !== "Medical Team" && block.visibility !== "Medical Only")
      .map((block) => ({
        day: block.day,
        time: block.time,
        title: block.title,
        location: block.location,
        owner: block.owner || null,
        audience: block.audience
      })),
    leaders: overview.staff
      .filter((staff) => !staff.archivedAt)
      .slice(0, MAX_STAFF)
      .map((staff) => ({
        name: staff.name,
        role: staff.role,
        team: staff.teamName || null
      })),
    campers: overview.students
      .filter((student) => !student.archivedAt)
      .slice(0, MAX_STUDENTS)
      .map((student) => ({
        name: student.name,
        grade: student.grade || null,
        team: student.teamName || null,
        room: student.cabin || null,
        vehicle: student.vehicleName || null,
        shirtSize: student.shirtSize || null
      })),
    counts: {
      campers: overview.students.filter((student) => !student.archivedAt).length,
      leaders: overview.staff.filter((staff) => !staff.archivedAt).length,
      teams: overview.teams.filter((team) => !team.archivedAt).length
    }
  };
}

function logConversationFallback(reason: string) {
  console.warn("[camp-emma-conversation] falling back to deterministic finder", {
    timestamp: new Date().toISOString(),
    route: "/api/camp/emma",
    reason
  });
}
