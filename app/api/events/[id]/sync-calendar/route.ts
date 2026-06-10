import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { runMinistryIntegrationStub } from "@/lib/data/ministry-repository";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const log = await runMinistryIntegrationStub(session, params.id, "google_calendar");

  if (!log) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(log, { status: 201 });
}
