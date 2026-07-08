import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { KnowledgeControlRoomError, updateKnowledgeSourceVisibility } from "@/lib/scripture/knowledge-control-room";
import { resolveStudentHubAccess } from "@/lib/student/access";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) return unauthorizedResponse();
  if (access.role === "student") {
    return NextResponse.json({ error: "Only leaders can manage knowledge sources." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { visibility?: unknown } | null;
  if (!body || typeof body.visibility !== "string") {
    return NextResponse.json({ error: "Visibility is required." }, { status: 400 });
  }

  try {
    const source = await updateKnowledgeSourceVisibility(access.session, params.id, body.visibility);
    return NextResponse.json({ ok: true, source });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}

function knowledgeErrorResponse(error: unknown) {
  if (error instanceof KnowledgeControlRoomError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  return NextResponse.json({ error: "Knowledge source request could not be completed." }, { status: 500 });
}
