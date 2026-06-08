import { NextResponse } from "next/server";
import { getWorkspace, updateEvent } from "@/lib/store";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const workspace = getWorkspace(params.id);

  if (!workspace) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(workspace);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const workspace = updateEvent(params.id, body);

  if (!workspace) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(workspace);
}
