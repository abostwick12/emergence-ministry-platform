import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { getResourceAttachmentOpenUrl, resourceAttachmentErrorResponse } from "@/lib/resources/repository";

export async function GET(request: Request, { params }: { params: { attachmentId: string } }) {
  const session = await getServerSession();
  const url = new URL(request.url);

  try {
    return NextResponse.json(await getResourceAttachmentOpenUrl(session, params.attachmentId, {
      download: url.searchParams.get("download") === "true"
    }));
  } catch (error) {
    const payload = resourceAttachmentErrorResponse(error);
    return NextResponse.json({ error: payload.error, code: payload.code }, { status: payload.status });
  }
}
