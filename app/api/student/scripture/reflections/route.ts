import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { saveStudentQuestionReflection, StudentQuestionReflectionError } from "@/lib/scripture/student-reflections";
import { resolveStudentHubAccess } from "@/lib/student/access";

type ReflectionRequestBody = {
  promptId?: unknown;
  reflected?: unknown;
  privateNote?: unknown;
};

export async function PATCH(request: Request) {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) {
    if (access.reason === "unauthenticated") return unauthorizedResponse();
    return NextResponse.json({ ok: false, error: "Student Scripture Hub access is not available for this account." }, { status: 403 });
  }

  let body: ReflectionRequestBody;
  try {
    body = (await request.json()) as ReflectionRequestBody;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json", error: "Valid JSON body is required." }, { status: 400 });
  }

  if (typeof body.promptId !== "string") {
    return NextResponse.json({ ok: false, code: "invalid_prompt", error: "Question is required." }, { status: 400 });
  }

  if (typeof body.reflected !== "boolean") {
    return NextResponse.json({ ok: false, code: "invalid_reflection", error: "Reflection status is required." }, { status: 400 });
  }

  if (body.privateNote !== undefined && typeof body.privateNote !== "string") {
    return NextResponse.json({ ok: false, code: "invalid_note", error: "Private note must be text." }, { status: 400 });
  }

  try {
    const reflection = await saveStudentQuestionReflection(access.session, {
      promptId: body.promptId,
      reflected: body.reflected,
      privateNote: body.privateNote
    });
    return NextResponse.json({ ok: true, reflection });
  } catch (error) {
    if (error instanceof StudentQuestionReflectionError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }

    return NextResponse.json({ ok: false, code: "reflection_error", error: "Student reflection could not be saved." }, { status: 500 });
  }
}
