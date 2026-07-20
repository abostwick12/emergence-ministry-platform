import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { replaceResourceAttachmentFile, resourceAttachmentErrorResponse } from "@/lib/resources/repository";

export async function POST(request: Request, { params }: { params: { attachmentId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Replacement file is required." }, { status: 400 });
    }

    const resource = await replaceResourceAttachmentFile(session, params.attachmentId, file);
    return NextResponse.json({ ok: true, resource });
  } catch (error) {
    const payload = resourceAttachmentErrorResponse(error);
    return NextResponse.json({ error: payload.error, code: payload.code }, { status: payload.status });
  }
}
