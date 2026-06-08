import { NextResponse } from "next/server";
import { getWorkspace } from "@/lib/store";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const workspace = getWorkspace(params.id);

  if (!workspace) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(workspace);
}
