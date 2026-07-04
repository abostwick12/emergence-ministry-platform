import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { deletePersonalTask, updatePersonalTask } from "@/lib/command-center/repository";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const body = await request.json();
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
