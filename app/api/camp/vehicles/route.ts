import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import { archiveCampVehicle, upsertCampVehicle } from "@/lib/camp/repository";
import type { CampVehicleInput } from "@/lib/camp/types";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));
  const body = (await request.json()) as CampVehicleInput;
  if (!body.name?.trim()) return NextResponse.json({ error: "Vehicle name is required." }, { status: 400 });

  try {
    const payload = await upsertCampVehicle(session, context, body);
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ vehicle: payload.vehicle }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save vehicle." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));
  const body = (await request.json()) as Partial<CampVehicleInput> & { action?: "archive"; id?: string };
  if (!body.id) return NextResponse.json({ error: "Vehicle id is required." }, { status: 400 });

  try {
    if (body.action === "archive") {
      const payload = await archiveCampVehicle(session, context, { id: body.id });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ vehicle: payload.vehicle }, { status: payload.status });
    }

    const payload = await upsertCampVehicle(session, context, body as CampVehicleInput);
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ vehicle: payload.vehicle }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update vehicle." }, { status: 400 });
  }
}
