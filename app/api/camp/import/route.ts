import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { assertCampAdminAccess } from "@/lib/camp/permissions";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import { parseCampRegistrationImport } from "@/lib/camp/import";
import {
  commitOakwoodImport,
  getCampOverview,
  getOakwoodImportPreview,
  upsertCampStudent,
  upsertMedicationRecord,
  upsertMedicationScheduleItem,
  upsertRestrictedMedicalRecord
} from "@/lib/camp/repository";
import type { CampOakwoodImportPreview, CampRegistrationImportPreview } from "@/lib/camp/types";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  // The role query parameter is only honored in dev/test (preview). Live sessions
  // are authorized from the authenticated server identity via the durable store.
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));
  const adminAccess = assertCampAdminAccess(context);
  if (!adminAccess.allowed) {
    return NextResponse.json({ error: adminAccess.error }, { status: adminAccess.status });
  }

  const body = (await request.json()) as {
    action?: "preview" | "commit" | "oakwoodPreview" | "oakwoodCommit";
    csv?: string;
    sourceFile?: string;
    preview?: CampRegistrationImportPreview;
    oakwoodPreview?: CampOakwoodImportPreview;
    confirmed?: boolean;
  };

  if (body.action === "oakwoodPreview") {
    const payload = await getOakwoodImportPreview(session, context, {
      csv: body.csv ?? "",
      sourceFile: body.sourceFile
    });
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ preview: payload.preview });
  }

  if (body.action === "oakwoodCommit") {
    if (!body.oakwoodPreview) return NextResponse.json({ error: "Oakwood import preview is required before commit." }, { status: 400 });
    const payload = await commitOakwoodImport(session, context, {
      preview: body.oakwoodPreview,
      confirmed: body.confirmed
    });
    if (!payload.allowed || "error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ result: payload.result });
  }

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
          receivedBy: adminAccess.actor
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
