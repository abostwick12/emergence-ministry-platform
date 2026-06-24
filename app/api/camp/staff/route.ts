import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import { getCampStaffManagementPayload, updateCampStaffMember } from "@/lib/camp/repository";
import type { CampStaffInput } from "@/lib/camp/types";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));
  const payload = await getCampStaffManagementPayload(session, context);
  if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
  return NextResponse.json({ staff: payload.staff, teams: payload.teams }, { status: payload.status });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));
  const body = (await request.json()) as Partial<CampStaffInput> & { id?: string };
  if (!body.id) return NextResponse.json({ error: "Staff id is required." }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: "Staff display name is required." }, { status: 400 });

  try {
    const payload = await updateCampStaffMember(session, context, {
      id: body.id,
      name: body.name,
      role: body.role,
      shirtSize: body.shirtSize,
      teamId: body.teamId
    });
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ staff: payload.staff }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update Camp staff details." }, { status: 400 });
  }
}
