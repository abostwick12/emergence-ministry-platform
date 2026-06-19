import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { resolveCampAccessContext } from "@/lib/camp/permissions";
import {
  getRestrictedCampMedicationPayload,
  logMedicationAdministration,
  saveMedicationIntake,
  updateMedicationReturnItem,
  upsertMedicationRecord,
  upsertMedicationScheduleItem
} from "@/lib/camp/repository";
import type { CampMedicationAdministrationLog, CampMedicationIntakeInput, CampMedicationRecord, CampMedicationReturnItem, CampMedicationScheduleItem } from "@/lib/camp/types";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = resolveCampAccessContext(session, searchParams.get("role"));

  const payload = await getRestrictedCampMedicationPayload(session, context);
  if (!payload.allowed) {
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }

  return NextResponse.json({
    checkIn: payload.checkIn,
    schedule: payload.schedule,
    administrationLog: payload.administrationLog,
    returnChecklist: payload.returnChecklist,
    intakeHistory: payload.intakeHistory
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = resolveCampAccessContext(session, searchParams.get("role"));

  const body = (await request.json()) as { target?: string } & Partial<CampMedicationRecord> & Partial<CampMedicationScheduleItem> & Partial<CampMedicationAdministrationLog> & Partial<CampMedicationIntakeInput>;

  try {
    if (body.target === "intake") {
      const payload = await saveMedicationIntake(session, context, {
        medicationRecordId: body.medicationRecordId,
        studentId: body.studentId ?? "",
        medicationName: body.medicationName ?? "",
        dose: body.dose ?? "",
        scheduleText: body.scheduleText ?? "",
        parentInstructions: body.parentInstructions ?? body.parentProvidedInstructions ?? "",
        staffNotes: body.staffNotes ?? "",
        quantityReceived: body.quantityReceived ?? "",
        containerStatus: body.containerStatus ?? "",
        receivedByName: body.receivedByName ?? body.receivedBy ?? "",
        receivedAt: body.receivedAt,
        guardianName: body.guardianName ?? "",
        guardianRelationship: body.guardianRelationship ?? "",
        guardianSignatureData: body.guardianSignatureData ?? { width: 0, height: 0, strokes: [] },
        clarificationStatus: body.clarificationStatus as CampMedicationIntakeInput["clarificationStatus"] | undefined,
        confirmationAcknowledged: Boolean(body.confirmationAcknowledged),
        supersedesIntakeId: body.supersedesIntakeId,
        correctionNote: body.correctionNote
      });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ intake: payload.intake, record: payload.record }, { status: payload.status });
    }

    if (body.target === "schedule") {
      const payload = await upsertMedicationScheduleItem(session, context, {
        medicationRecordId: body.medicationRecordId ?? "",
        timeWindow: body.timeWindow ?? "",
        parentProvidedInstructions: body.parentProvidedInstructions,
        status: body.status as CampMedicationScheduleItem["status"] | undefined
      });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ item: payload.item }, { status: payload.status });
    }

    if (body.target === "administrationLog") {
      const payload = await logMedicationAdministration(session, context, {
        scheduleItemId: body.scheduleItemId ?? "",
        loggedBy: body.loggedBy ?? "",
        status: (body.status as CampMedicationAdministrationLog["status"] | undefined) ?? "Logged",
        notes: body.notes
      });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ log: payload.log }, { status: payload.status });
    }

    const payload = await upsertMedicationRecord(session, context, {
      studentId: body.studentId ?? "",
      medicationName: body.medicationName,
      medicinePhotoStatus: body.medicinePhotoStatus,
      parentProvidedInstructions: body.parentProvidedInstructions,
      checkInStatus: body.checkInStatus,
      receivedBy: body.receivedBy,
      clarificationStatus: body.clarificationStatus
    });
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ record: payload.record }, { status: payload.status });
  } catch {
    return NextResponse.json({ error: "Unable to update medication workflow safely." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = resolveCampAccessContext(session, searchParams.get("role"));

  const body = (await request.json()) as { target?: string; id?: string } & Partial<CampMedicationRecord> & Partial<CampMedicationReturnItem> & Partial<CampMedicationScheduleItem>;

  try {
    if (body.target === "return") {
      const payload = await updateMedicationReturnItem(session, context, {
        id: body.id ?? "",
        returnStatus: (body.returnStatus as CampMedicationReturnItem["returnStatus"] | undefined) ?? "Pending Return",
        returnedBy: body.returnedBy
      });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ item: payload.item }, { status: payload.status });
    }

    if (body.target === "schedule") {
      const payload = await upsertMedicationScheduleItem(session, context, {
        id: body.id,
        medicationRecordId: body.medicationRecordId ?? "",
        timeWindow: body.timeWindow ?? "",
        parentProvidedInstructions: body.parentProvidedInstructions,
        status: body.status as CampMedicationScheduleItem["status"] | undefined
      });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ item: payload.item }, { status: payload.status });
    }

    const payload = await upsertMedicationRecord(session, context, {
      id: body.id,
      studentId: body.studentId ?? "",
      medicationName: body.medicationName,
      medicinePhotoStatus: body.medicinePhotoStatus,
      parentProvidedInstructions: body.parentProvidedInstructions,
      checkInStatus: body.checkInStatus,
      receivedBy: body.receivedBy,
      clarificationStatus: body.clarificationStatus
    });
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ record: payload.record }, { status: payload.status });
  } catch {
    return NextResponse.json({ error: "Unable to update medication workflow safely." }, { status: 400 });
  }
}
