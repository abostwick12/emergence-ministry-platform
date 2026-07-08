import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import {
  createStudentDiscussionPrompt,
  DiscussionWorkflowError,
  getStudentDiscussionWorkflowState
} from "@/lib/scripture/discussion-workflow";
import { buildQuestionNextStep } from "@/lib/scripture/student-home";
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

  try {
    const prompt = await createStudentDiscussionPrompt(access.session, {
      question: body.question,
      scriptureReference: body.scriptureReference
    });
    return NextResponse.json({ ok: true, prompt, nextStep: buildQuestionNextStep(prompt) }, { status: 201 });
  } catch (error) {
    return discussionErrorResponse(error);
  }
}

function discussionErrorResponse(error: unknown) {
  if (error instanceof DiscussionWorkflowError) {
    return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
  }

  return NextResponse.json({ ok: false, code: "workflow_error", error: "Student discussion workflow is unavailable." }, { status: 500 });
}
