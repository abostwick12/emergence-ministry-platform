import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { generateMinistryCommunicationPreviews } from "@/lib/data/ministry-repository";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const previews = await generateMinistryCommunicationPreviews(session, params.id);

  if (!previews) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ previews }, { status: 201 });
}
