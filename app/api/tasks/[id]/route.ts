import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { deleteMinistryTask, updateMinistryTask } from "@/lib/data/ministry-repository";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  const body = await request.json();
  const task = await updateMinistryTask(access.session, params.id, body);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;
  if (!access.session.isGuest) {
    return NextResponse.json({ error: "Task deletion is available only in guest sandbox mode." }, { status: 403 });
  }

  const deleted = await deleteMinistryTask(access.session, params.id);
  if (!deleted) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
