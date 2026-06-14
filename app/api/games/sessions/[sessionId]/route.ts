import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { getSnapshot, updateSession } from "@/lib/games/store";

export async function GET(_request: Request, { params }: { params: { sessionId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    return NextResponse.json({ snapshot: getSnapshot(params.sessionId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Session not found." }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: { params: { sessionId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as { action?: string; [key: string]: unknown };
  if (!body.action) return NextResponse.json({ error: "Missing action." }, { status: 400 });

  try {
    return NextResponse.json({ snapshot: updateSession(params.sessionId, body.action, body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update session." }, { status: 400 });
  }
}
