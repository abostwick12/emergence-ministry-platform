import { NextResponse } from "next/server";
import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { runMinistryIntegrationStub } from "@/lib/data/ministry-repository";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  const log = await runMinistryIntegrationStub(access.session, params.id, "google_calendar");

  if (!log) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(log, { status: 201 });
}
