import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import {
  archiveResourceAttachment,
  permanentlyDeleteResourceAttachment,
  resourceAttachmentErrorResponse,
  updateResourceAttachment
} from "@/lib/resources/repository";

export async function PATCH(request: Request, { params }: { params: { attachmentId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.action === "archive") {
      const resource = await archiveResourceAttachment(session, params.attachmentId, false);
      return NextResponse.json({ ok: true, resource });
    }
    if (body.action === "restore") {
      const resource = await archiveResourceAttachment(session, params.attachmentId, true);
      return NextResponse.json({ ok: true, resource });
    }

    const resource = await updateResourceAttachment(session, params.attachmentId, {
      description: stringValue(body.description),
      displayOrder: numberValue(body.displayOrder),
      isDownloadable: booleanValue(body.isDownloadable),
      isFeatured: booleanValue(body.isFeatured),
      opensInNewTab: booleanValue(body.opensInNewTab),
      title: stringValue(body.title),
      visibility: stringValue(body.visibility)
    });
    return NextResponse.json({ ok: true, resource });
  } catch (error) {
    return resourceErrorResponse(error);
  }
}
export async function DELETE(_: Request, { params }: { params: { attachmentId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    return NextResponse.json(await permanentlyDeleteResourceAttachment(session, params.attachmentId));
  } catch (error) {
    return resourceErrorResponse(error);
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function resourceErrorResponse(error: unknown) {
  const payload = resourceAttachmentErrorResponse(error);
  return NextResponse.json({ error: payload.error, code: payload.code }, { status: payload.status });
}
