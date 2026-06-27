import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { requireCampAccessForRequest } from "@/lib/camp/api-guard";
import { getMedicationPhotoAccess, saveMedicationPhoto } from "@/lib/camp/repository";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const access = await requireCampAccessForRequest(session, request);
  if (!access.allowed) return access.response;
  const context = access.context;
  const medicationRecordId = searchParams.get("medicationRecordId") ?? "";
  if (!medicationRecordId) return NextResponse.json({ error: "medicationRecordId is required." }, { status: 400 });

  try {
    const payload = await getMedicationPhotoAccess(session, context, medicationRecordId);
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ signedUrl: payload.signedUrl, photo: payload.photo });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load medication photo safely." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const access = await requireCampAccessForRequest(session, request);
  if (!access.allowed) return access.response;
  const context = access.context;

  try {
    const formData = await request.formData();
    const medicationRecordId = String(formData.get("medicationRecordId") ?? "");
    const intakeRecordId = String(formData.get("intakeRecordId") ?? "");
    const file = formData.get("photo");
    if (!medicationRecordId) return NextResponse.json({ error: "medicationRecordId is required." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Medication photo file is required." }, { status: 400 });

    const payload = await saveMedicationPhoto(session, context, { medicationRecordId, intakeRecordId: intakeRecordId || undefined, file });
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ photo: payload.photo, record: payload.record }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload medication photo safely." }, { status: 400 });
  }
}
