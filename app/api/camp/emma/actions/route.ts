import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { requireCampAccessForRequest } from "@/lib/camp/api-guard";
import { handleCampEmmaAction, type CampEmmaActionRequest } from "@/lib/camp/emma-actions";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const access = await requireCampAccessForRequest(session, request);
  if (!access.allowed) return access.response;
  const context = access.context;

  let body: CampEmmaActionRequest = {};
  try {
    body = (await request.json()) as CampEmmaActionRequest;
  } catch {
    body = {};
  }

  const result = await handleCampEmmaAction(session, context, body);
  const status = responseStatus(result);
  return NextResponse.json(result, { status });
}

function responseStatus(result: Awaited<ReturnType<typeof handleCampEmmaAction>>): number {
  if (result.status === "denied") return 403;
  if (result.status !== "failed") return 200;
  if (result.code === "emma_provider_not_configured" || result.code === "emma_action_table_unavailable" || result.code === "emma_audit_table_unavailable") return 503;
  return 400;
}
