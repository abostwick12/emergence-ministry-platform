import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { getEventWorkspace, updateMinistryEvent } from "@/lib/data/ministry-repository";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const workspace = await getEventWorkspace(session, params.id);

  if (!workspace) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(workspace);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const body = await request.json();
  const workspace = await updateMinistryEvent(session, params.id, body);

  if (!workspace) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(workspace);
}
