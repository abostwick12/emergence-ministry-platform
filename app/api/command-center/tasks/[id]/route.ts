import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { deletePersonalTask, updatePersonalTask } from "@/lib/command-center/repository";
import type { PersonalDomain, PersonalTaskPriority, PersonalTaskStatus, UpdatePersonalTaskInput } from "@/lib/command-center/types";

const VALID_DOMAINS: PersonalDomain[] = ["military_transition", "sotf_fellowship", "job_search", "life"];
const VALID_STATUSES: PersonalTaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const VALID_PRIORITIES: PersonalTaskPriority[] = ["low", "medium", "high", "critical"];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  let body: UpdatePersonalTaskInput;
  try {
    body = (await request.json()) as UpdatePersonalTaskInput;
  } catch {
    return NextResponse.json({ error: "Valid JSON body is required" }, { status: 400 });
  }
  if (body.domain !== undefined && !VALID_DOMAINS.includes(body.domain)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }
  if (body.title !== undefined && !body.title.trim()) {
    return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
  }

  const task = await updatePersonalTask(access.session, params.id, body);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  return NextResponse.json(task);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  await deletePersonalTask(access.session, params.id);
  return NextResponse.json({ ok: true });
}
