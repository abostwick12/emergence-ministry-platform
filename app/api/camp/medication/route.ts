import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import {
  getRestrictedCampMedicationPayload,
  logMedicationAdministration,
  saveMedicationIntake,
  updateMedicationReturnItem,
  upsertMedicationRecord,
  upsertMedicationScheduleItem,
  voidMedicationWorkflowItem
} from "@/lib/camp/repository";
import type { CampMedicationAdministrationLog, CampMedicationIntakeInput, CampMedicationRecord, CampMedicationReturnItem, CampMedicationScheduleItem, CampMedicationVoidInput } from "@/lib/camp/types";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));

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
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));

  const body = (await request.json()) as { target?: string; voidTarget?: CampMedicationVoidInput["target"]; voidReason?: string; voidedByName?: string; id?: string } & Partial<CampMedicationRecord> & Partial<CampMedicationScheduleItem> & Partial<CampMedicationAdministrationLog> & Partial<CampMedicationIntakeInput> & Partial<CampMedicationReturnItem>;

  try {
    if (body.target === "void") {
      const payload = await voidMedicationWorkflowItem(session, context, {
        target: body.voidTarget ?? "medication",
        id: body.id ?? "",
        voidReason: body.voidReason ?? "",
        voidedByName: body.voidedByName
      });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ item: payload.item }, { status: payload.status });
    }

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
        status: body.status as CampMedicationScheduleItem["status"] | undefined,
        supersedesScheduleItemId: body.supersedesScheduleItemId,
        correctionNote: body.correctionNote
      });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ item: payload.item }, { status: payload.status });
    }

    if (body.target === "administrationLog") {
      const payload = await logMedicationAdministration(session, context, {
        scheduleItemId: body.scheduleItemId ?? "",
        loggedBy: body.loggedBy ?? "",
        status: (body.status as CampMedicationAdministrationLog["status"] | undefined) ?? "Logged",
        notes: body.notes,
        studentAcknowledgementInitials: body.studentAcknowledgementInitials,
        studentAcknowledgementUnavailable: body.studentAcknowledgementUnavailable,
        studentAcknowledgementUnavailableReason: body.studentAcknowledgementUnavailableReason,
        supersedesAdministrationLogId: body.supersedesAdministrationLogId,
        correctionNote: body.correctionNote
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
      clarificationStatus: body.clarificationStatus,
      supersedesMedicationRecordId: body.supersedesMedicationRecordId,
      correctionNote: body.correctionNote
    });
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ record: payload.record }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update medication workflow safely." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));

  const body = (await request.json()) as { target?: string; id?: string } & Partial<CampMedicationRecord> & Partial<CampMedicationReturnItem> & Partial<CampMedicationScheduleItem>;

  try {
    if (body.target === "return") {
      const payload = await updateMedicationReturnItem(session, context, {
        id: body.id ?? "",
        returnStatus: (body.returnStatus as CampMedicationReturnItem["returnStatus"] | undefined) ?? "Pending Return",
        returnedBy: body.returnedBy,
        returnedAt: body.returnedAt,
        recipientName: body.recipientName,
        recipientRelationship: body.recipientRelationship,
        returnNotes: body.returnNotes,
        supersedesReturnItemId: body.supersedesReturnItemId,
        correctionNote: body.correctionNote
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
        status: body.status as CampMedicationScheduleItem["status"] | undefined,
        supersedesScheduleItemId: body.supersedesScheduleItemId,
        correctionNote: body.correctionNote
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
      clarificationStatus: body.clarificationStatus,
      supersedesMedicationRecordId: body.supersedesMedicationRecordId,
      correctionNote: body.correctionNote
    });
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ record: payload.record }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update medication workflow safely." }, { status: 400 });
  }
}
