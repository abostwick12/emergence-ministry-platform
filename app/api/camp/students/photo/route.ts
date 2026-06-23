import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import { removeCampCamperProfilePhoto, saveCampCamperProfilePhoto } from "@/lib/camp/repository";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));

  try {
    const formData = await request.formData();
    const studentId = String(formData.get("studentId") ?? "");
    const file = formData.get("photo");
    if (!studentId) return NextResponse.json({ error: "studentId is required." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Camper photo file is required." }, { status: 400 });

    const payload = await saveCampCamperProfilePhoto(session, context, { studentId, file });
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ photo: payload.photo, student: payload.student }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload camper photo safely." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));

  try {
    const studentId = searchParams.get("studentId") ?? "";
    if (!studentId) return NextResponse.json({ error: "studentId is required." }, { status: 400 });

    const payload = await removeCampCamperProfilePhoto(session, context, { studentId });
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ student: payload.student }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove camper photo safely." }, { status: 400 });
  }
}
