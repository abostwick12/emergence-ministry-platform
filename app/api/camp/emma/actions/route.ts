import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import { handleCampEmmaAction, type CampEmmaActionRequest } from "@/lib/camp/emma-actions";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));

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
