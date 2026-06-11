import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { createMinistryEvent, getOverview } from "@/lib/data/ministry-repository";
import type { EventType } from "@/lib/types";

export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  return NextResponse.json(await getOverview(session));
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    type?: EventType;
    startTime?: string;
    endTime?: string;
    location?: string;
    targetGroup?: string;
    budgetTarget?: number;
    budgetActual?: number;
    volunteersNeeded?: number;
    priority?: string;
    contactOwnerId?: string;
  };

  if (!body.title || !body.type || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: "title, type, startTime, and endTime are required" }, { status: 400 });
  }

  const workspace = await createMinistryEvent(session, {
    title: body.title,
    description: body.description ?? "",
    type: body.type,
    startTime: body.startTime,
    endTime: body.endTime,
    location: body.location,
    targetGroup: body.targetGroup,
    budgetTarget: body.budgetTarget,
    budgetActual: body.budgetActual,
    volunteersNeeded: body.volunteersNeeded,
    priority: body.priority,
    contactOwnerId: body.contactOwnerId
  });

  return NextResponse.json(workspace, { status: 201 });
}
