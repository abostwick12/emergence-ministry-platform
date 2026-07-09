import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { deleteSageMemory } from "@/lib/command-center/repository";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  await deleteSageMemory(access.session, params.id);
  return NextResponse.json({ ok: true });
}
