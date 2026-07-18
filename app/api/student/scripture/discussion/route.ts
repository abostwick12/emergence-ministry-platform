import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse, type AuthSession } from "@/lib/auth/server";
import {
  createStudentDiscussionPrompt,
  DiscussionWorkflowError,
  getStudentDiscussionWorkflowState
} from "@/lib/scripture/discussion-workflow";
import { listStudentCuratedResources } from "@/lib/scripture/curated-resources";
import { getStudentKnowledgeMatches, saveStudentQuestionRecommendations } from "@/lib/scripture/knowledge";
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
    if (access.session.isGuest) {
      return NextResponse.json({
        ok: true,
        prompts: [],
        resources: [],
        nextSteps: [],
        guest: true,
        message: "Guest mode uses stock Meridian discussion examples only."
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

  if (access.session.isGuest) {
    const now = new Date().toISOString();
    const prompt = {
      id: `guest-discussion-${Date.now()}`,
      question: body.question.trim(),
      scriptureReference: body.scriptureReference?.trim() ?? "",
      status: "submitted",
      safetyLabel: "safe",
      safetyNotes: "Guest stock response. No question, recommendation, or AI audit was saved.",
      aiProvider: "guest-stock-responses",
      discussionPrompt: "Where does this passage invite honest attention, patient trust, and a next step with Jesus in community?",
      createdAt: now,
      updatedAt: now
    };
    return NextResponse.json({
      ok: true,
      prompt,
      nextStep: {
        label: "Guest Meridian preview",
        message: "A leader would see recommended Scripture-grounded discussion next steps here. This sandbox does not save anything.",
        resources: []
      }
    }, { status: 201 });
  }

  try {
    const prompt = await createStudentDiscussionPrompt(access.session, {
      question: body.question,
      scriptureReference: body.scriptureReference
    });
    const nextStep = await buildResilientQuestionNextStep(access.session, prompt);
    return NextResponse.json({ ok: true, prompt, nextStep }, { status: 201 });
  } catch (error) {
    return discussionErrorResponse(error);
  }
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
