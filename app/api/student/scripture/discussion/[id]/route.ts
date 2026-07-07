import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import {
  decideStudentDiscussionPrompt,
  DiscussionWorkflowError,
  type DecideStudentDiscussionInput
} from "@/lib/scripture/discussion-workflow";
import { resolveStudentHubAccess } from "@/lib/student/access";

type DecisionRequestBody = {
  action?: unknown;
  leaderNotes?: unknown;
};

const validActions = new Set(["approve", "request_changes", "archive", "post"]);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) {
    if (access.reason === "unauthenticated") return unauthorizedResponse();
    return NextResponse.json({ ok: false, error: "Student Scripture Hub access is not available for this account." }, { status: 403 });
  }

  let body: DecisionRequestBody;
  try {
    body = (await request.json()) as DecisionRequestBody;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json", error: "Valid JSON body is required." }, { status: 400 });
  }

  if (typeof body.action !== "string" || !validActions.has(body.action)) {
    return NextResponse.json({ ok: false, code: "invalid_action", error: "Choose a valid review action." }, { status: 400 });
  }

  if (body.leaderNotes !== undefined && typeof body.leaderNotes !== "string") {
    return NextResponse.json({ ok: false, code: "invalid_notes", error: "Leader notes must be text." }, { status: 400 });
  }

  try {
    const prompt = await decideStudentDiscussionPrompt(access.session, params.id, {
      action: body.action as DecideStudentDiscussionInput["action"],
      leaderNotes: body.leaderNotes
    });
    return NextResponse.json({ ok: true, prompt });
  } catch (error) {
    if (error instanceof DiscussionWorkflowError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }

    return NextResponse.json({ ok: false, code: "workflow_error", error: "Student discussion workflow is unavailable." }, { status: 500 });
  }
}
