import { NextResponse } from "next/server";
import { parseCampAccessRole } from "@/lib/camp/access";
import {
  getRestrictedCampMedicationPayload,
  logMedicationAdministration,
  updateMedicationReturnItem,
  upsertMedicationRecord,
  upsertMedicationScheduleItem
} from "@/lib/camp/store";
import type { CampMedicationAdministrationLog, CampMedicationRecord, CampMedicationReturnItem, CampMedicationScheduleItem } from "@/lib/camp/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = parseCampAccessRole(searchParams.get("role"));

  if (!role) {
    return NextResponse.json({ error: "A valid camp access role is required." }, { status: 400 });
  }

  const payload = getRestrictedCampMedicationPayload(role);
  if (!payload.allowed) {
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }

  return NextResponse.json({
    checkIn: payload.checkIn,
    schedule: payload.schedule,
    administrationLog: payload.administrationLog,
    returnChecklist: payload.returnChecklist
  });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = parseCampAccessRole(searchParams.get("role"));
  if (!role) return NextResponse.json({ error: "A valid camp access role is required." }, { status: 400 });

  const body = (await request.json()) as { target?: string } & Partial<CampMedicationRecord> & Partial<CampMedicationScheduleItem> & Partial<CampMedicationAdministrationLog>;

  try {
    if (body.target === "schedule") {
      const payload = upsertMedicationScheduleItem(role, {
        medicationRecordId: body.medicationRecordId ?? "",
        timeWindow: body.timeWindow ?? "",
        parentProvidedInstructions: body.parentProvidedInstructions,
        status: body.status as CampMedicationScheduleItem["status"] | undefined
      });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ item: payload.item }, { status: payload.status });
    }

    if (body.target === "administrationLog") {
      const payload = logMedicationAdministration(role, {
        scheduleItemId: body.scheduleItemId ?? "",
        loggedBy: body.loggedBy ?? "",
        status: (body.status as CampMedicationAdministrationLog["status"] | undefined) ?? "Logged",
        notes: body.notes
      });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ log: payload.log }, { status: payload.status });
    }

    const payload = upsertMedicationRecord(role, {
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
  const { searchParams } = new URL(request.url);
  const role = parseCampAccessRole(searchParams.get("role"));
  if (!role) return NextResponse.json({ error: "A valid camp access role is required." }, { status: 400 });

  const body = (await request.json()) as { target?: string; id?: string } & Partial<CampMedicationRecord> & Partial<CampMedicationReturnItem> & Partial<CampMedicationScheduleItem>;

  try {
    if (body.target === "return") {
      const payload = updateMedicationReturnItem(role, {
        id: body.id ?? "",
        returnStatus: (body.returnStatus as CampMedicationReturnItem["returnStatus"] | undefined) ?? "Pending Return",
        returnedBy: body.returnedBy
      });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ item: payload.item }, { status: payload.status });
    }

    if (body.target === "schedule") {
      const payload = upsertMedicationScheduleItem(role, {
        id: body.id,
        medicationRecordId: body.medicationRecordId ?? "",
        timeWindow: body.timeWindow ?? "",
        parentProvidedInstructions: body.parentProvidedInstructions,
        status: body.status as CampMedicationScheduleItem["status"] | undefined
      });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ item: payload.item }, { status: payload.status });
    }

    const payload = upsertMedicationRecord(role, {
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
