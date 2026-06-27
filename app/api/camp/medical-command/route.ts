import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { buildMedicalCommandBlocks } from "@/lib/camp/emma";
import { assertCampMedicalCommandAccess } from "@/lib/camp/permissions";
import { requireCampAccessForRequest } from "@/lib/camp/api-guard";
import { getRestrictedCampMedicationPayload } from "@/lib/camp/repository";

// Andrew-only Medical Command feed. Enforcement is server-side and identity-based.
// Jaci, Joel, General Leaders, and Drivers receive a 403 with no medication
// payload regardless of query params or client-side state.
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const campAccess = await requireCampAccessForRequest(session, request);
  if (!campAccess.allowed) return campAccess.response;
  const context = campAccess.context;
  const selectedDay = searchParams.get("day") ?? undefined;

  const access = assertCampMedicalCommandAccess(context);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const payload = await getRestrictedCampMedicationPayload(session, context);
  if (!payload.allowed) {
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }

  const intakeRecordIds = new Set(payload.intakeHistory.map((item) => item.medicationRecordId).filter(isString));
  const loggedScheduleIds = new Set(
    payload.administrationLog
      .filter((log) => log.status === "Logged")
      .map((log) => log.scheduleItemId)
      .filter(isString)
  );

  // Time blocks are derived from the existing medication schedule rows, but the
  // overview deliberately returns only operational metadata. It omits medication
  // names, instructions, dosage, signatures, photos, insurance, audit history,
  // and all parent-provided notes.
  return NextResponse.json({
    timeBlocks: buildMedicalCommandBlocks({
      schedule: payload.schedule,
      loggedScheduleIds,
      intakeRecordIds,
      selectedDay
    })
  });
}

function isString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
