import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { deleteMinistryEvent, getEventWorkspace, updateMinistryEvent } from "@/lib/data/ministry-repository";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  const workspace = await getEventWorkspace(access.session, params.id);

  if (!workspace) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(workspace);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  const body = await request.json();

  try {
    const workspace = await updateMinistryEvent(access.session, params.id, body);

    if (!workspace) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(workspace);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;
  if (!access.session.isGuest) {
    return NextResponse.json({ error: "Event deletion is available only in guest sandbox mode." }, { status: 403 });
  }

  const deleted = await deleteMinistryEvent(access.session, params.id);
  if (!deleted) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
