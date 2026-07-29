import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { completeResourceAttachmentUpload, resourceAttachmentErrorResponse } from "@/lib/resources/repository";

export async function POST(request: Request, { params }: { params: { parentType: string; parentId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const resource = await completeResourceAttachmentUpload(session, {
      attachmentId: typeof body.attachmentId === "string" ? body.attachmentId : "",
      description: typeof body.description === "string" ? body.description : undefined,
      filename: typeof body.filename === "string" ? body.filename : "",
      isDownloadable: typeof body.isDownloadable === "boolean" ? body.isDownloadable : undefined,
      isFeatured: typeof body.isFeatured === "boolean" ? body.isFeatured : undefined,
      notificationIntent: typeof body.notificationIntent === "string" ? body.notificationIntent : undefined,
      opensInNewTab: typeof body.opensInNewTab === "boolean" ? body.opensInNewTab : undefined,
      parentId: params.parentId,
      parentType: params.parentType,
      title: typeof body.title === "string" ? body.title : undefined,
      visibility: typeof body.visibility === "string" ? body.visibility : undefined
    });
    return NextResponse.json({ ok: true, resource }, { status: 201 });
  } catch (error) {
    const payload = resourceAttachmentErrorResponse(error);
    return NextResponse.json({ error: payload.error, code: payload.code }, { status: payload.status });
  }
}
