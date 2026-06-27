import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { requireCampAccessForRequest } from "@/lib/camp/api-guard";
import { archiveCampScheduleItem, upsertCampScheduleItem } from "@/lib/camp/repository";
import type { CampScheduleInput } from "@/lib/camp/types";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const access = await requireCampAccessForRequest(session, request);
  if (!access.allowed) return access.response;
  const context = access.context;
  const body = (await request.json()) as CampScheduleInput;
  if (!body.title?.trim() || !body.day?.trim() || !body.time?.trim()) {
    return NextResponse.json({ error: "Title, day, and time are required." }, { status: 400 });
  }

  try {
    const payload = await upsertCampScheduleItem(session, context, body);
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ item: payload.item }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save schedule item." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const access = await requireCampAccessForRequest(session, request);
  if (!access.allowed) return access.response;
  const context = access.context;
  const body = (await request.json()) as Partial<CampScheduleInput> & { action?: "archive"; id?: string };
  if (!body.id) return NextResponse.json({ error: "Schedule item id is required." }, { status: 400 });

  try {
    if (body.action === "archive") {
      const payload = await archiveCampScheduleItem(session, context, { id: body.id });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ item: payload.item }, { status: payload.status });
    }

    const payload = await upsertCampScheduleItem(session, context, body as CampScheduleInput);
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ item: payload.item }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update schedule item." }, { status: 400 });
  }
}
