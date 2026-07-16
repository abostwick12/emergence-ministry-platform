import type { AuthSession } from "@/lib/auth/server";
import { getStudentKnowledgeMatches } from "@/lib/scripture/knowledge";
import { buildQuestionNextStep, type StudentQuestionNextStep } from "@/lib/scripture/student-home";
import type { StudentKnowledgeMatch } from "@/lib/scripture/knowledge";

export type KnowledgeTestBenchInput = {
  question: string;
  scriptureReference?: string;
};

export type KnowledgeTestBenchResult = {
  question: string;
  scriptureReference: string;
  matches: StudentKnowledgeMatch[];
  nextStep: StudentQuestionNextStep;
  visibilityNote: string;
};

const MAX_QUESTION_LENGTH = 1000;
const MAX_REFERENCE_LENGTH = 120;
const LEADER_ROLES = new Set(["admin", "leader", "staff"]);

export async function runKnowledgeTestBench(
  session: AuthSession,
  input: KnowledgeTestBenchInput
): Promise<KnowledgeTestBenchResult> {
  assertKnowledgeTestLeader(session);
  const question = normalizeRequiredText(input.question, "Question", MAX_QUESTION_LENGTH);
  const scriptureReference = normalizeOptionalText(input.scriptureReference, MAX_REFERENCE_LENGTH);
  const prompt = {
    id: "knowledge-test-bench",
    question,
    scriptureReference
  };
  const matches = await getStudentKnowledgeMatches(session, prompt);
  const nextStep = buildQuestionNextStep(prompt, matches);

  return {
    question,
    scriptureReference,
    matches,
    nextStep,
    visibilityNote:
      "Preview only. Nothing is saved, posted, or shown to students until a real question is submitted and a leader approves the group prompt."
  };
}

function assertKnowledgeTestLeader(session: AuthSession) {
  if (!LEADER_ROLES.has(session.user.role.trim().toLowerCase())) {
    throw new KnowledgeTestBenchError("Only leaders can test the Meridian.", 403, "forbidden");
  }
}

function normalizeRequiredText(value: string, label: string, maxLength: number) {
  const normalized = value.normalize("NFKC").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) throw new KnowledgeTestBenchError(`${label} is required.`, 400, "required");
  if (normalized.length > maxLength) throw new KnowledgeTestBenchError(`${label} is too long.`, 400, "too_long");
  return normalized;
}

function normalizeOptionalText(value: string | undefined, maxLength: number) {
  if (!value) return "";
  const normalized = value.normalize("NFKC").replace(/[ \t]+/g, " ").trim();
  if (normalized.length > maxLength) throw new KnowledgeTestBenchError("Scripture reference is too long.", 400, "too_long");
  return normalized;
}

export class KnowledgeTestBenchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}
