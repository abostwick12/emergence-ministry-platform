import { NextResponse } from "next/server";
import { generateCommunicationPreview } from "@/lib/store";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const previews = generateCommunicationPreview(params.id);

  if (!previews) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ previews }, { status: 201 });
}
