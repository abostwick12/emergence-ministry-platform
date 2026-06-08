import { NextResponse } from "next/server";
import { generateCommunicationPreview } from "@/lib/store";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const preview = generateCommunicationPreview(params.id);

  if (!preview) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(preview, { status: 201 });
}
