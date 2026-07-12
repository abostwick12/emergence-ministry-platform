import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import {
  createStudentCuratedResource,
  getStudentCuratedResourceState,
  StudentCuratedResourceError
} from "@/lib/scripture/curated-resources";
import { resolveStudentHubAccess } from "@/lib/student/access";

export async function GET() {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) return unauthorizedResponse();

  try {
    const state = await getStudentCuratedResourceState(access.session, { includeInactive: access.role !== "student" });
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    return curatedResourceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) return unauthorizedResponse();
  if (access.role === "student") {
    return NextResponse.json({ error: "Only leaders can manage student resources." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const resource = await createStudentCuratedResource(access.session, {
      kind: stringValue(body.kind),
      journeyStage: stringValue(body.journeyStage),
      title: stringValue(body.title),
      summary: stringValue(body.summary),
      body: stringValue(body.body),
      scriptureReferences: listValue(body.scriptureReferences),
      themes: listValue(body.themes),
      questionPatterns: listValue(body.questionPatterns),
      practicePrompt: stringValue(body.practicePrompt),
      href: stringValue(body.href),
      sortOrder: stringValue(body.sortOrder),
      isActive: booleanOrStringValue(body.isActive)
    });
    return NextResponse.json({ ok: true, resource }, { status: 201 });
  } catch (error) {
    return curatedResourceErrorResponse(error);
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function booleanOrStringValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  return undefined;
}

function listValue(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return value;
  return "";
}

function curatedResourceErrorResponse(error: unknown) {
  if (error instanceof StudentCuratedResourceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  return NextResponse.json({ error: "Student resource request could not be completed." }, { status: 500 });
}
