import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { createStudentGroupInvite, getStudentGroupLeaderState, StudentGroupError } from "@/lib/student/groups";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const origin = new URL(request.url).origin;
  const state = await getStudentGroupLeaderState(session, origin);
  if (state.liveStorage && state.message === "Only leaders can manage student invite links.") {
    return NextResponse.json({ error: state.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true, state });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  let body: {
    groupId?: string;
    groupName?: string;
    label?: string;
    maxUses?: number | null;
    expiresAt?: string | null;
  } = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const origin = new URL(request.url).origin;
    const state = await createStudentGroupInvite(session, body, origin);
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    if (error instanceof StudentGroupError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Student invite could not be created." }, { status: 500 });
  }
}
