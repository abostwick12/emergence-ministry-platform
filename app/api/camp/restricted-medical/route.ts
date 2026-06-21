import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import { getRestrictedCampMedicalPayload, upsertRestrictedMedicalRecord } from "@/lib/camp/repository";
import type { CampRestrictedMedicalRecord } from "@/lib/camp/types";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));

  const payload = await getRestrictedCampMedicalPayload(session, context);
  if (!payload.allowed) {
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }

  return NextResponse.json({ records: payload.records });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));

  const body = (await request.json()) as CampRestrictedMedicalRecord;
  if (!body.studentId) {
    return NextResponse.json({ error: "studentId is required." }, { status: 400 });
  }

  try {
    const payload = await upsertRestrictedMedicalRecord(session, context, body);
    if (!payload.allowed) {
      return NextResponse.json({ error: payload.error }, { status: payload.status });
    }
    return NextResponse.json({ record: payload.record }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update restricted medical record safely." }, { status: 400 });
  }
}

export const POST = PATCH;
