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
  const status = result.status === "denied" ? 403 : result.status === "failed" ? 400 : 200;
  return NextResponse.json(result, { status });
}
