import { NextResponse } from "next/server";
import { parseCampAccessRole } from "@/lib/camp/access";
import { getRestrictedCampMedicalPayload } from "@/lib/camp/restricted-access";

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
