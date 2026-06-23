import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import { confirmCampEmmaRoomChange } from "@/lib/camp/repository";

// Confirms (writes) an EMMA-proposed room change. This is the ONLY route
// that can result in a roster write from the EMMA command flow, and it never
// calls the model — it operates strictly on the studentId + proposedRoom the
// caller already has from /api/camp/emma/command. Access is re-resolved from
// the authenticated session here (never trusted from the request body), and
// confirmCampEmmaRoomChange re-asserts the Andrew-only gate again server-side
// as defense in depth.
type CampEmmaConfirmRequestBody = {
  studentId?: string;
  proposedRoom?: string;
  originalRequest?: string;
  model?: string;
  deployment?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));

  let body: CampEmmaConfirmRequestBody = {};
  try {
    body = (await request.json()) as CampEmmaConfirmRequestBody;
  } catch {
    body = {};
  }

  if (!body.studentId || !body.proposedRoom?.trim()) {
    return NextResponse.json({ error: "studentId and proposedRoom are required." }, { status: 400 });
  }

  const startedAt = Date.now();
  const result = await confirmCampEmmaRoomChange(session, context, {
    studentId: body.studentId,
    proposedRoom: body.proposedRoom,
    originalRequest: body.originalRequest ?? "",
    model: body.model ?? "",
    deployment: body.deployment ?? ""
  });
  const durationMs = Date.now() - startedAt;
  console.log(`[camp-emma-confirm] durationMs=${durationMs} success=${result.allowed}`);

  if (!result.allowed) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, student: result.student, audit: result.audit });
}
