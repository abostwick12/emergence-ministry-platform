import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { assertCampRestrictedAccess, resolveCampAccessContext } from "@/lib/camp/permissions";
import { parseCampRegistrationImport } from "@/lib/camp/import";
import {
  getCampOverview,
  upsertCampStudent,
  upsertMedicationRecord,
  upsertMedicationScheduleItem,
  upsertRestrictedMedicalRecord
} from "@/lib/camp/repository";
import type { CampRegistrationImportPreview } from "@/lib/camp/types";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = resolveCampAccessContext(session, searchParams.get("role"));
  const restrictedAccess = assertCampRestrictedAccess(context);
  if (!restrictedAccess.allowed) {
    return NextResponse.json({ error: restrictedAccess.error }, { status: restrictedAccess.status });
  }

  const body = (await request.json()) as {
    action?: "preview" | "commit";
    csv?: string;
    preview?: CampRegistrationImportPreview;
  };
  const overview = await getCampOverview(session, context);

  if (body.action === "commit") {
    if (!body.preview) return NextResponse.json({ error: "Import preview is required before commit." }, { status: 400 });
    const committed = [];

    for (const row of body.preview.rows) {
      if (row.status === "Blocked") continue;
      const studentPayload = await upsertCampStudent(session, context, row.camper);
      if (!studentPayload.allowed) return NextResponse.json({ error: studentPayload.error }, { status: studentPayload.status });

      const student = studentPayload.student;
      if (row.restrictedMedical) {
        const medicalPayload = await upsertRestrictedMedicalRecord(session, context, {
          ...row.restrictedMedical,
          studentId: student.id,
          studentName: student.name
        });
        if (!medicalPayload.allowed) return NextResponse.json({ error: medicalPayload.error }, { status: medicalPayload.status });
      }

      if (row.medication) {
        const medicationPayload = await upsertMedicationRecord(session, context, {
          studentId: student.id,
          medicationName: row.medication.medicationName,
          medicinePhotoStatus: row.medication.medicinePhotoStatus,
          parentProvidedInstructions: row.medication.parentProvidedInstructions,
          checkInStatus: row.medication.checkInStatus,
          clarificationStatus: row.medication.clarificationStatus,
          receivedBy: restrictedAccess.actor
        });
        if (!medicationPayload.allowed) return NextResponse.json({ error: medicationPayload.error }, { status: medicationPayload.status });

        if (row.medication.scheduleTimeWindow) {
          const schedulePayload = await upsertMedicationScheduleItem(session, context, {
            medicationRecordId: medicationPayload.record.id,
            timeWindow: row.medication.scheduleTimeWindow,
            parentProvidedInstructions: row.medication.parentProvidedInstructions,
            status: row.medication.clarificationStatus === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Pending"
          });
          if (!schedulePayload.allowed) return NextResponse.json({ error: schedulePayload.error }, { status: schedulePayload.status });
        }
      }

      committed.push({ rowNumber: row.rowNumber, studentId: student.id, studentName: student.name });
    }

    return NextResponse.json({ committed });
  }

  const preview = parseCampRegistrationImport(body.csv ?? "", {
    teams: overview.teams,
    vehicles: overview.vehicles
  });
  return NextResponse.json({ preview });
}
