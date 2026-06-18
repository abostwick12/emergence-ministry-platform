import { NextResponse } from "next/server";
import { parseCampAccessRole } from "@/lib/camp/access";
import { assignCampStudent, upsertCampStudent } from "@/lib/camp/store";
import type { CampStudentInput } from "@/lib/camp/types";

function canEditCampRoster(role: string | null) {
  const parsed = parseCampAccessRole(role);
  return parsed !== null && parsed !== "driver";
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (!canEditCampRoster(searchParams.get("role"))) {
    return NextResponse.json({ error: "Camp roster editing is not available for this role." }, { status: 403 });
  }

  const body = (await request.json()) as CampStudentInput;
  if (!body.name?.trim() || !body.teamId || !body.vehicleId) {
    return NextResponse.json({ error: "Name, team, and vehicle are required." }, { status: 400 });
  }

  try {
    return NextResponse.json({ student: upsertCampStudent(body) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to save camper safely." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  if (!canEditCampRoster(searchParams.get("role"))) {
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
      return NextResponse.json({
        student: assignCampStudent({
          studentId: id,
          teamId: body.teamId,
          vehicleId: body.vehicleId,
          cabin: body.cabin
        })
      });
    }

    return NextResponse.json({
      student: upsertCampStudent({
        id,
        name: body.name ?? "",
        grade: body.grade ?? "",
        teamId: body.teamId ?? "",
        vehicleId: body.vehicleId ?? "",
        cabin: body.cabin ?? "",
        limitedSafetyFlags: body.limitedSafetyFlags
      })
    });
  } catch {
    return NextResponse.json({ error: "Unable to update camper safely." }, { status: 400 });
  }
}
