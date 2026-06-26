import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import { postCampTeamBulletin } from "@/lib/camp/repository";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));
  const body = (await request.json().catch(() => ({}))) as {
    teamId?: string;
    message?: string;
  };

  try {
    const payload = await postCampTeamBulletin(session, context, {
      teamId: body.teamId ?? "",
      message: body.message ?? ""
    });
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ bulletin: payload.bulletin }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to post Team Bulletin safely." }, { status: 400 });
  }
}
