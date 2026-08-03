import type { AuthSession } from "@/lib/auth/server";
import { generateGlooDiscussionDraft, isGlooConfigured, type GlooDiscussionPreview } from "@/lib/scripture/gloo";
import {
  formatStudentKnowledgeContextForGloo,
  getApprovedMeridianGrounding,
  getStudentKnowledgeMatches,
  type ApprovedMeridianGrounding
} from "@/lib/scripture/knowledge";
import { buildQuestionNextStep, type StudentQuestionNextStep } from "@/lib/scripture/student-home";
import type { StudentKnowledgeMatch } from "@/lib/scripture/knowledge";
import { evaluateMeridianShadowOutput } from "@/lib/meridian/knowledge/evidence-map";
import type { MeridianShadowEvaluation } from "@/lib/meridian/knowledge/types";

export type KnowledgeTestBenchInput = {
  question: string;
  scriptureReference?: string;
};

export type KnowledgeTestBenchResult = {
  question: string;
  scriptureReference: string;
  matches: StudentKnowledgeMatch[];
  grounding: Omit<ApprovedMeridianGrounding, "providerContext" | "evidenceMap"> & { studentResourceMatchCount: number };
  shadowEvaluation: MeridianShadowEvaluation;
  nextStep: StudentQuestionNextStep;
  aiDraft: GlooDiscussionPreview;
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
  const approvedGrounding = await getApprovedMeridianGrounding(session, prompt);
  const { providerContext: _providerContext, evidenceMap: _evidenceMap, ...groundingSummary } = approvedGrounding;
  const grounding = { ...groundingSummary, studentResourceMatchCount: matches.length };
  const nextStep = buildQuestionNextStep(prompt, matches);
  const aiDraft = await previewGlooDraft({
    question,
    scriptureReference,
    matches,
    grounding: approvedGrounding
  });
  const shadowEvaluation = evaluateMeridianShadowOutput(
    approvedGrounding.evidenceMap,
    aiDraft.ok ? {
      structuredAnswer: Boolean(aiDraft.answerDraft),
      scriptureReferences: [aiDraft.scriptureReference, ...(aiDraft.answerDraft?.scriptureReferences ?? [])]
        .filter((reference): reference is string => Boolean(reference)),
      pastoralCareCount: aiDraft.answerDraft?.pastoralCare.length ?? 0,
      uncertaintyCount: aiDraft.answerDraft?.uncertainty.length ?? 0,
      requiresHumanReview: aiDraft.answerDraft?.requiresHumanReview === true
    } : undefined
  );

  return {
    question,
    scriptureReference,
    matches,
    grounding,
    shadowEvaluation,
    nextStep,
    aiDraft,
    visibilityNote:
      "Preview only. Nothing is saved, posted, or shown to students until a real question is submitted and a leader approves the group prompt."
  };
}

async function previewGlooDraft(
  input: {
    question: string;
    scriptureReference: string;
    matches: StudentKnowledgeMatch[];
    grounding: ApprovedMeridianGrounding;
  }
): Promise<GlooDiscussionPreview> {
  if (!isGlooConfigured()) {
    return {
      ok: false,
      configured: false,
      code: "not_configured",
      message: "Gloo AI Studio is not configured. The Meridian preview is using local knowledge-guided next steps only."
    };
  }

  let draft: Awaited<ReturnType<typeof generateGlooDiscussionDraft>>;
  try {
    draft = await generateGlooDiscussionDraft({
      question: input.question,
      scriptureReference: input.scriptureReference,
      studentJourneyContext: formatStudentKnowledgeContextForGloo(input.matches),
      approvedEvidenceContext: input.grounding.providerContext,
      groundingStatus: input.grounding.status,
      requireStructuredAnswer: true
    });
  } catch (error) {
    return {
      ok: false,
      configured: true,
      code: "provider_error",
      message: error instanceof Error ? error.message : "The Meridian Gloo preview could not run."
    };
  }

  if (!draft.ok) {
    return {
      ok: false,
      configured: true,
      code: draft.code,
      message: draft.message
    };
  }

  return {
    ok: true,
    provider: "gloo",
    model: draft.model,
    modelTier: draft.modelTier,
    confidence: draft.confidence,
    discussionPrompt: draft.discussionPrompt,
    ...(draft.answerDraft ? { answerDraft: draft.answerDraft } : {}),
    ...(draft.scriptureReference ? { scriptureReference: draft.scriptureReference } : {}),
    safetyLabel: draft.safetyLabel,
    safetyNotes: draft.safetyNotes,
    message: "Gloo AI Studio returned a leader-review draft. This preview was not saved or shown to students."
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
