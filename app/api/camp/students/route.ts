import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { resolveCampAccessContext } from "@/lib/camp/permissions";
import { assignCampStudent, upsertCampStudent } from "@/lib/camp/repository";
import type { CampStudentInput } from "@/lib/camp/types";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = resolveCampAccessContext(session, searchParams.get("role"));
  if (context.effectiveRole === "driver") {
    return NextResponse.json({ error: "Camp roster editing is not available for this role." }, { status: 403 });
  }

  const body = (await request.json()) as CampStudentInput;
  if (!body.name?.trim() || !body.teamId || !body.vehicleId) {
    return NextResponse.json({ error: "Name, team, and vehicle are required." }, { status: 400 });
  }

  try {
    const payload = await upsertCampStudent(session, context, body);
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ student: payload.student }, { status: payload.status });
  } catch {
    return NextResponse.json({ error: "Unable to save camper safely." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = resolveCampAccessContext(session, searchParams.get("role"));
  if (context.effectiveRole === "driver") {
    return NextResponse.json({ error: "Camp roster editing is not available for this role." }, { status: 403 });
  }

  const body = (await request.json()) as Partial<CampStudentInput> & {
    assignmentOnly?: boolean;
    studentId?: string;
  };
  const id = body.id ?? body.studentId;
  if (!id) return NextResponse.json({ error: "Student id is required." }, { status: 400 });

  try {
    if (body.assignmentOnly) {
      const payload = await assignCampStudent(session, context, {
        studentId: id,
        teamId: body.teamId,
        vehicleId: body.vehicleId,
        cabin: body.cabin
      });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ student: payload.student }, { status: payload.status });
    }

    const payload = await upsertCampStudent(session, context, {
      id,
      name: body.name ?? "",
      grade: body.grade ?? "",
      teamId: body.teamId ?? "",
      vehicleId: body.vehicleId ?? "",
      cabin: body.cabin ?? "",
      limitedSafetyFlags: body.limitedSafetyFlags
    });
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ student: payload.student }, { status: payload.status });
  } catch {
    return NextResponse.json({ error: "Unable to update camper safely." }, { status: 400 });
  }
}
