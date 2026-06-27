import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { getDefaultCampAccessScope } from "@/lib/camp/access";
import { requireCampAccessForRequest } from "@/lib/camp/api-guard";
import { interpretCampEmmaCommand } from "@/lib/camp/emma-command";
import { getLegacyCampEmmaCommandReadiness } from "@/lib/camp/emma-readiness";
import { assertCampEmmaOperationsAccess } from "@/lib/camp/permissions";
import { getCampOverview } from "@/lib/camp/repository";

// Proposes an EMMA room-change action from natural language. This route only
// ever reads (campers + the model's classification) — it never writes to the
// roster. A write can only happen via a separate, explicit POST to
// /api/camp/emma/confirm using the studentId + proposedRoom this route
// returns. Access is gated here, server-side, against the authenticated
// session's resolved Camp role — never against any role value sent by the
// client.
type CampEmmaCommandRequestBody = {
  text?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const campAccess = await requireCampAccessForRequest(session, request);
  if (!campAccess.allowed) return campAccess.response;
  const context = campAccess.context;

  const access = assertCampEmmaOperationsAccess(context);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const readiness = getLegacyCampEmmaCommandReadiness();
  if (!readiness.ok) {
    return NextResponse.json({ ok: false, code: readiness.code, error: readiness.message }, { status: readiness.status });
  }

  let body: CampEmmaCommandRequestBody = {};
  try {
    body = (await request.json()) as CampEmmaCommandRequestBody;
  } catch {
    body = {};
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "A command is required, e.g. \"Change John West to room 508.\"" }, { status: 400 });
  }

  const vehicleId = getDefaultCampAccessScope(context.effectiveRole).vehicleId;
  const overview = await getCampOverview(session, context, vehicleId ? { vehicleId } : {});

  const { result, log } = await interpretCampEmmaCommand({ rawText: text, students: overview.students });

  // Duration + outcome only. Never log the raw command text or model output
  // here — they may echo back restricted-adjacent phrasing even when the
  // result itself was correctly blocked, and they could one day include an
  // API key fragment from a misbehaving provider response.
  console.log(`[camp-emma-command] durationMs=${log.durationMs} success=${log.success} outcome=${log.outcomeKind}`);

  return NextResponse.json({ ok: true, result });
}
