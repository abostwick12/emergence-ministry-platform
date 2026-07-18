import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { KnowledgeTestBenchError, runKnowledgeTestBench } from "@/lib/scripture/knowledge-test-bench";
import { resolveStudentHubAccess } from "@/lib/student/access";

type KnowledgeTestRequestBody = {
  question?: unknown;
  scriptureReference?: unknown;
};

export async function POST(request: Request) {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) return unauthorizedResponse();
  if (access.session.isGuest) {
    return NextResponse.json({
      ok: true,
      result: {
        provider: "guest-stock-responses",
        discussionPrompt: "What does this question reveal about what students are trying to understand, and how could a leader guide the group toward Scripture with patience?",
        safetyLabel: "safe",
        safetyNotes: "Guest simulation only. No knowledge search, save, or AI provider call ran.",
        matches: []
      }
    });
  }
  if (access.role === "student") {
    return NextResponse.json({ error: "Only leaders can test the Meridian." }, { status: 403 });
  }

  let body: KnowledgeTestRequestBody;
  try {
    body = (await request.json()) as KnowledgeTestRequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON.", code: "invalid_json" }, { status: 400 });
  }

  if (typeof body.question !== "string") {
    return NextResponse.json({ error: "Question is required.", code: "invalid_request" }, { status: 400 });
  }

  if (body.scriptureReference !== undefined && typeof body.scriptureReference !== "string") {
    return NextResponse.json({ error: "Scripture reference must be text.", code: "invalid_reference" }, { status: 400 });
  }

  try {
    const result = await runKnowledgeTestBench(access.session, {
      question: body.question,
      scriptureReference: body.scriptureReference
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return knowledgeTestErrorResponse(error);
  }
}

function knowledgeTestErrorResponse(error: unknown) {
  if (error instanceof KnowledgeTestBenchError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  return NextResponse.json({ error: "Meridian preview could not be completed.", code: "preview_error" }, { status: 500 });
}
