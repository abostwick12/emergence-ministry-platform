import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { createMinistryTask, listMinistryTasks } from "@/lib/data/ministry-repository";
import type { TaskStatus } from "@/lib/types";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  return NextResponse.json({ tasks: await listMinistryTasks(access.session) });
}

export async function POST(request: Request) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

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

  const task = await createMinistryTask(access.session, {
    eventId: body.eventId,
    taskTitle: body.taskTitle,
    dueDate: body.dueDate,
    assignedUserId: body.assignedUserId,
    status: body.status as TaskStatus | undefined
  });

  return NextResponse.json(task, { status: 201 });
}
