import { NextResponse } from "next/server";
import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { generateMinistryCommunicationPreviews } from "@/lib/data/ministry-repository";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  const previews = await generateMinistryCommunicationPreviews(access.session, params.id);

  if (!previews) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ previews }, { status: 201 });
}
