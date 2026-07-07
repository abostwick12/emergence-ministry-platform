import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { lookupYouVersionPassage } from "@/lib/scripture/youversion";
import { resolveStudentHubAccess } from "@/lib/student/access";

type LookupRequestBody = {
  reference?: unknown;
};

export async function POST(request: Request) {
  const access = resolveStudentHubAccess(await getServerSession());

  if (!access.allowed) {
    if (access.reason === "unauthenticated") return unauthorizedResponse();
    return NextResponse.json({ ok: false, error: "Student Scripture Hub access is not available for this account." }, { status: 403 });
  }

  let body: LookupRequestBody;
  try {
    body = await request.json() as LookupRequestBody;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json", error: "Valid JSON body is required." }, { status: 400 });
  }

  const result = await lookupYouVersionPassage({ reference: body.reference, signal: request.signal });
  if (!result.ok) {
    return NextResponse.json({ ok: false, code: result.code, error: result.message }, { status: result.status });
  }

  return NextResponse.json({ ok: true, passage: result.passage, passageId: result.passageId });
}
