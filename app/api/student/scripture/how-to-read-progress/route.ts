import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import {
  getStudentHowToReadProgress,
  saveStudentHowToReadProgress,
  StudentHowToReadProgressError
} from "@/lib/scripture/how-to-read-progress";
import { resolveStudentHubAccess } from "@/lib/student/access";

type ProgressRequestBody = {
  moduleId?: unknown;
  completed?: unknown;
  shareWithGroup?: unknown;
};

export async function GET() {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) {
    if (access.reason === "unauthenticated") return unauthorizedResponse();
    return NextResponse.json({ ok: false, error: "Student Scripture Hub access is not available for this account." }, { status: 403 });
  }

  const progress = await getStudentHowToReadProgress(access.session);
  return NextResponse.json({ ok: true, progress });
}

export async function PATCH(request: Request) {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) {
    if (access.reason === "unauthenticated") return unauthorizedResponse();
    return NextResponse.json({ ok: false, error: "Student Scripture Hub access is not available for this account." }, { status: 403 });
  }

  let body: ProgressRequestBody;
  try {
    body = (await request.json()) as ProgressRequestBody;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json", error: "Valid JSON body is required." }, { status: 400 });
  }

  if (typeof body.moduleId !== "string") {
    return NextResponse.json({ ok: false, code: "invalid_module", error: "Guide is required." }, { status: 400 });
  }

  if (typeof body.completed !== "boolean") {
    return NextResponse.json({ ok: false, code: "invalid_completion", error: "Completion status is required." }, { status: 400 });
  }

  if (body.shareWithGroup !== undefined && typeof body.shareWithGroup !== "boolean") {
    return NextResponse.json({ ok: false, code: "invalid_sharing", error: "Sharing choice must be true or false." }, { status: 400 });
  }

  try {
    const progress = await saveStudentHowToReadProgress(access.session, {
      moduleId: body.moduleId,
      completed: body.completed,
      shareWithGroup: body.shareWithGroup
    });
    return NextResponse.json({ ok: true, progress });
  } catch (error) {
    if (error instanceof StudentHowToReadProgressError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }

    return NextResponse.json({ ok: false, code: "progress_error", error: "Progress could not be saved." }, { status: 500 });
  }
}
