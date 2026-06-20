import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { assertCampMedicalCommandAccess, resolveCampAccessContext } from "@/lib/camp/permissions";
import { getRestrictedCampMedicationPayload } from "@/lib/camp/repository";

// Andrew-only Medical Command feed. Enforcement is server-side and identity-based
// (resolveCampAccessContext -> restrictedActor). Jaci, Joel, General Leaders, and
// Drivers receive a 403 with no medication payload, regardless of ?role= or any
// client-side state. Reuses the existing restricted medication data; no new data
// contract and no schema change.
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = resolveCampAccessContext(session, searchParams.get("role"));

  const access = assertCampMedicalCommandAccess(context);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const payload = await getRestrictedCampMedicationPayload(session, context);
  if (!payload.allowed) {
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }

  const intakeRecordIds = new Set(payload.intakeHistory.map((item) => item.medicationRecordId).filter(Boolean));
  const loggedScheduleIds = new Set(
    payload.administrationLog
      .filter((log) => log.status === "Logged" && log.scheduleItemId)
      .map((log) => log.scheduleItemId)
  );

  // Time blocks are derived from the existing medication schedule rows, but the
  // overview deliberately returns only operational metadata. It omits medication
  // names, instructions, dosage, signatures, photos, insurance, audit history,
  // and all parent-provided notes.
  return NextResponse.json({
    timeBlocks: payload.schedule.map((block) => {
      const logRecorded = block.status === "Logged" || Boolean(block.lastLoggedAt) || loggedScheduleIds.has(block.id);
      const needsClarification = block.status === "Needs Parent Clarification";

      return {
        id: block.id,
        studentName: block.studentName,
        timeWindow: block.timeWindow,
        parentHandoffOnFile: block.medicationRecordId ? intakeRecordIds.has(block.medicationRecordId) : false,
        stateLabel: logRecorded ? "Log recorded" : needsClarification ? "Clarification flagged" : "Scheduled",
        tone: logRecorded ? "logged" : needsClarification ? "clarification" : "scheduled"
      };
    })
  });
}
