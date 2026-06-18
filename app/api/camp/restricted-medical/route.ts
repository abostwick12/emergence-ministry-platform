import { NextResponse } from "next/server";
import { parseCampAccessRole } from "@/lib/camp/access";
import { getRestrictedCampMedicalPayload, upsertRestrictedMedicalRecord } from "@/lib/camp/store";
import type { CampRestrictedMedicalRecord } from "@/lib/camp/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = parseCampAccessRole(searchParams.get("role"));

  if (!role) {
    return NextResponse.json({ error: "A valid camp access role is required." }, { status: 400 });
  }

  const payload = getRestrictedCampMedicalPayload(role);
  if (!payload.allowed) {
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }

  return NextResponse.json({ records: payload.records });
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = parseCampAccessRole(searchParams.get("role"));

  if (!role) {
    return NextResponse.json({ error: "A valid camp access role is required." }, { status: 400 });
  }

  const body = (await request.json()) as CampRestrictedMedicalRecord;
  if (!body.studentId) {
    return NextResponse.json({ error: "studentId is required." }, { status: 400 });
  }

  try {
    const payload = upsertRestrictedMedicalRecord(role, body);
    if (!payload.allowed) {
      return NextResponse.json({ error: payload.error }, { status: payload.status });
    }
    return NextResponse.json({ record: payload.record }, { status: payload.status });
  } catch {
    return NextResponse.json({ error: "Unable to update restricted medical record safely." }, { status: 400 });
  }
}
