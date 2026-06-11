import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { createMinistryTask, listMinistryTasks } from "@/lib/data/ministry-repository";
import type { TaskStatus } from "@/lib/types";

export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  return NextResponse.json({ tasks: await listMinistryTasks(session) });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as {
    eventId?: string;
    taskTitle?: string;
    dueDate?: string;
    assignedUserId?: string;
    status?: string;
  };

  if (!body.eventId || !body.taskTitle || !body.dueDate || !body.assignedUserId) {
    return NextResponse.json({ error: "eventId, taskTitle, dueDate, and assignedUserId are required" }, { status: 400 });
  }

  const task = await createMinistryTask(session, {
    eventId: body.eventId,
    taskTitle: body.taskTitle,
    dueDate: body.dueDate,
    assignedUserId: body.assignedUserId,
    status: body.status as TaskStatus | undefined
  });

  return NextResponse.json(task, { status: 201 });
}
