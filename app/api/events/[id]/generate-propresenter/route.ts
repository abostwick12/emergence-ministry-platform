import { NextResponse } from "next/server";
import { runIntegrationStub } from "@/lib/store";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const log = runIntegrationStub(params.id, "propresenter");

  if (!log) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(log, { status: 201 });
}
