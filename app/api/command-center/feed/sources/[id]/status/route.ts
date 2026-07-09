import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateKnowledgeSourceStatus } from "@/lib/command-center/repository";
import type { KnowledgeSourceStatus } from "@/lib/command-center/types";

const ALLOWED_STATUSES: KnowledgeSourceStatus[] = ["new", "included", "skipped", "archived"];

type StatusBody = { status?: unknown };

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const payload = (await request.json().catch(() => null)) as StatusBody | null;
  if (!payload || typeof payload.status !== "string" || !ALLOWED_STATUSES.includes(payload.status as KnowledgeSourceStatus)) {
    return NextResponse.json({ error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` }, { status: 400 });
  }

  const source = await updateKnowledgeSourceStatus(access.session, params.id, payload.status as KnowledgeSourceStatus);
  if (!source) return NextResponse.json({ error: "Source not found." }, { status: 404 });
  return NextResponse.json({ source });
}
