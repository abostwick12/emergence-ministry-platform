import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { prepareResourceAttachmentUpload, resourceAttachmentErrorResponse } from "@/lib/resources/repository";

export async function POST(request: Request, { params }: { params: { parentType: string; parentId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const upload = await prepareResourceAttachmentUpload(session, {
      fileSizeBytes: typeof body.fileSizeBytes === "number" ? body.fileSizeBytes : undefined,
      filename: typeof body.filename === "string" ? body.filename : "",
      parentId: params.parentId,
      parentType: params.parentType
    });
    return NextResponse.json({ upload });
  } catch (error) {
    const payload = resourceAttachmentErrorResponse(error);
    return NextResponse.json({ error: payload.error, code: payload.code }, { status: payload.status });
  }
}
