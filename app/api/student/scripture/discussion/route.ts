import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse, type AuthSession } from "@/lib/auth/server";
import { isGuestAiGenerationEnabled, isGuestSandboxWritesEnabled } from "@/lib/competition/guest-runtime";
import {
  createStudentDiscussionPrompt,
  DiscussionWorkflowError,
  getStudentDiscussionWorkflowState
} from "@/lib/scripture/discussion-workflow";
import { listStudentCuratedResources } from "@/lib/scripture/curated-resources";
import { getStudentKnowledgeMatches, saveStudentQuestionRecommendations } from "@/lib/scripture/knowledge";
import { generateMeridianDiscussionDraft } from "@/lib/scripture/meridian-ai";
import { buildQuestionNextStep } from "@/lib/scripture/student-home";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";
import { resolveStudentHubAccess } from "@/lib/student/access";

type CreateDiscussionRequestBody = {
  question?: unknown;
  scriptureReference?: unknown;
};

export async function GET() {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) {
    if (access.reason === "unauthenticated") return unauthorizedResponse();
    return NextResponse.json({ ok: false, error: "Student Scripture Hub access is not available for this account." }, { status: 403 });
  }

  try {
    if (access.session.isGuest && !isGuestSandboxWritesEnabled()) {
      return NextResponse.json({
        ok: true,
        prompts: [],
        resources: [],
        nextSteps: [],
        guest: true,
        message: isGuestAiGenerationEnabled()
          ? "Guest mode can generate a live Meridian preview. Drafts are not saved because guest sandbox writes are disabled."
          : "Guest mode uses stock Meridian discussion examples only."
      });
    }
    const state = await getStudentDiscussionWorkflowState(access.session);
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    return discussionErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) {
    if (access.reason === "unauthenticated") return unauthorizedResponse();
    return NextResponse.json({ ok: false, error: "Student Scripture Hub access is not available for this account." }, { status: 403 });
  }

  let body: CreateDiscussionRequestBody;
  try {
    body = (await request.json()) as CreateDiscussionRequestBody;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json", error: "Valid JSON body is required." }, { status: 400 });
  }

  if (typeof body.question !== "string") {
    return NextResponse.json({ ok: false, code: "invalid_request", error: "Question is required." }, { status: 400 });
  }

  if (body.scriptureReference !== undefined && typeof body.scriptureReference !== "string") {
    return NextResponse.json({ ok: false, code: "invalid_reference", error: "Scripture reference must be text." }, { status: 400 });
  }

  if (!body.question.trim()) {
    return NextResponse.json({ ok: false, code: "invalid_request", error: "Question is required." }, { status: 400 });
  }

  if (access.session.isGuest) {
    if (isGuestSandboxWritesEnabled()) {
      try {
        const prompt = await createStudentDiscussionPrompt(access.session, {
          question: body.question,
          scriptureReference: body.scriptureReference
        });
        const nextStep = buildQuestionNextStep(prompt, [], { curatedResources: [] });
        return NextResponse.json({ ok: true, prompt, nextStep, persistence: "guest_session" }, { status: 201 });
      } catch (error) {
        return discussionErrorResponse(error);
      }
    }

    return createGuestDiscussionPreview(access.session, {
      question: body.question,
      scriptureReference: body.scriptureReference
    });
  }

  try {
    const prompt = await createStudentDiscussionPrompt(access.session, {
      question: body.question,
      scriptureReference: body.scriptureReference
    });
    const nextStep = await buildResilientQuestionNextStep(access.session, prompt);
    return NextResponse.json({ ok: true, prompt, nextStep, persistence: "ministry" }, { status: 201 });
  } catch (error) {
    return discussionErrorResponse(error);
  }
}

async function createGuestDiscussionPreview(session: AuthSession, body: { question: string; scriptureReference?: string }) {
  const question = body.question.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 1200);
  const scriptureReference = body.scriptureReference?.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 160) ?? "";
  const now = new Date().toISOString();
  const liveDraft = isGuestAiGenerationEnabled()
    ? await generateMeridianDiscussionDraft({ question, scriptureReference })
    : undefined;

  if (liveDraft && !liveDraft.ok) {
    return NextResponse.json({
      ok: false,
      code: liveDraft.code,
      error: liveDraft.message,
      attemptedProviders: liveDraft.attemptedProviders
    }, { status: liveDraft.code === "not_configured" ? 503 : 502 });
  }

  const prompt: StudentDiscussionPrompt = {
    id: `guest-discussion-${Date.now()}`,
    submittedByUserId: session.user.id,
    submittedByName: session.user.fullName,
    submittedByEmail: session.user.email,
    question,
    scriptureReference,
    aiProvider: liveDraft?.provider ?? "guest-stock-responses",
    aiStatus: liveDraft ? "generated" : "not_configured",
    aiModel: liveDraft?.model ?? "guest-stock-responses",
    aiModelTier: liveDraft?.modelTier ?? "default",
    aiModelReason: liveDraft?.modelReason ?? "Guest mode used a curated stock response because live guest AI is disabled.",
    aiConfidence: liveDraft?.confidence ?? null,
    topicTags: liveDraft?.topicTags ?? [],
    escalationReason: liveDraft?.escalationReason ?? "",
    safetyLabel: liveDraft?.safetyLabel ?? "safe",
    safetyNotes: liveDraft?.safetyNotes ?? "Guest stock response. No question, recommendation, or AI audit was saved.",
    discussionPrompt: liveDraft?.discussionPrompt ?? "Where does this passage invite honest attention, patient trust, and a next step with Jesus in community?",
    leaderNotes: "",
    status: "pending_review",
    knowledgeContext: [],
    deliveryStatus: "not_requested",
    deliveryMessage: "",
    createdAt: now,
    updatedAt: now
  };
  const nextStep = buildQuestionNextStep(prompt, [], { curatedResources: [] });
  return NextResponse.json({ ok: true, prompt, nextStep, persistence: "none" }, { status: 201 });
}

async function buildResilientQuestionNextStep(session: AuthSession, prompt: StudentDiscussionPrompt) {
  let knowledgeMatches = prompt.knowledgeContext ?? [];
  if (!knowledgeMatches.length) {
    try {
      knowledgeMatches = await getStudentKnowledgeMatches(session, prompt);
    } catch (error) {
      console.warn("[student-discussion] knowledge matching unavailable after prompt save", {
        promptId: prompt.id,
        reason: error instanceof Error ? error.message : "unknown"
      });
      knowledgeMatches = [];
    }
  }

  const curatedResources = await listStudentCuratedResources(session);
  const nextStep = buildQuestionNextStep(prompt, knowledgeMatches, { curatedResources });
  try {
    await saveStudentQuestionRecommendations(session, prompt.id, nextStep, knowledgeMatches);
  } catch (error) {
    console.warn("[student-discussion] recommendation save unavailable after prompt save", {
      promptId: prompt.id,
      reason: error instanceof Error ? error.message : "unknown"
    });
  }

  return nextStep;
}

function discussionErrorResponse(error: unknown) {
  if (error instanceof DiscussionWorkflowError) {
    return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
  }

  console.error("[student-discussion] workflow unavailable", {
    reason: error instanceof Error ? error.message : "unknown"
  });
  return NextResponse.json({ ok: false, code: "workflow_error", error: "Student discussion workflow is unavailable." }, { status: 500 });
}
