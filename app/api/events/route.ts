import { NextResponse } from "next/server";
import { createEvent, listActivity, listEvents, listExpenses, listTasks, listUsers } from "@/lib/store";
import type { EventType } from "@/lib/types";

export async function GET() {
  return NextResponse.json({
    events: listEvents(),
    tasks: listTasks(),
    users: listUsers(),
    expenses: listExpenses(),
    activity: listActivity()
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    type?: EventType;
    startTime?: string;
    endTime?: string;
    location?: string;
    budgetTarget?: number;
    contactOwnerId?: string;
  };

  if (!body.title || !body.type || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: "title, type, startTime, and endTime are required" }, { status: 400 });
  }

  const workspace = createEvent({
    title: body.title,
    description: body.description ?? "",
    type: body.type,
    startTime: body.startTime,
    endTime: body.endTime,
    location: body.location,
    budgetTarget: body.budgetTarget,
    contactOwnerId: body.contactOwnerId
  });

  return NextResponse.json(workspace, { status: 201 });
}
