import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { KnowledgeControlRoomError, updateKnowledgeSourceDetails, updateKnowledgeSourceVisibility } from "@/lib/scripture/knowledge-control-room";
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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const source =
      typeof body.visibility === "string"
        ? await updateKnowledgeSourceVisibility(access.session, params.id, body.visibility)
        : await updateKnowledgeSourceDetails(access.session, params.id, {
            title: stringValue(body.title),
            summary: stringValue(body.summary),
            tags: optionalList(body.tags),
            scriptureReferences: optionalList(body.scriptureReferences),
            citation: optionalString(body.citation),
            sourceUri: optionalString(body.sourceUri)
          });
    return NextResponse.json({ ok: true, source });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function optionalList(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return value;
  return undefined;
}

function knowledgeErrorResponse(error: unknown) {
  if (error instanceof KnowledgeControlRoomError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  return NextResponse.json({ error: "Knowledge source request could not be completed." }, { status: 500 });
}
