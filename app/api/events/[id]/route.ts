import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess, requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
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
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  try {
    const rawBody = await request.text();
    const body = rawBody ? JSON.parse(rawBody) : {};
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
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;
  if (!access.session.isGuest && access.session.user.role.trim().toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Only administrators can delete archived events." }, { status: 403 });
  }

  const deleted = await deleteMinistryEvent(access.session, params.id);
  if (!deleted) return NextResponse.json({ error: "Archived event not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
