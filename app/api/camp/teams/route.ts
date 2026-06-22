import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import { archiveCampTeam, upsertCampTeam } from "@/lib/camp/repository";
import type { CampTeamInput } from "@/lib/camp/types";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));
  const body = (await request.json()) as CampTeamInput;
  if (!body.name?.trim()) return NextResponse.json({ error: "Team name is required." }, { status: 400 });

  try {
    const payload = await upsertCampTeam(session, context, body);
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ team: payload.team }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save team." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));
  const body = (await request.json()) as Partial<CampTeamInput> & { action?: "archive"; id?: string };
  if (!body.id) return NextResponse.json({ error: "Team id is required." }, { status: 400 });

  try {
    if (body.action === "archive") {
      const payload = await archiveCampTeam(session, context, { id: body.id });
      if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
      if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
      return NextResponse.json({ team: payload.team }, { status: payload.status });
    }

    const payload = await upsertCampTeam(session, context, body as CampTeamInput);
    if (!payload.allowed) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({ team: payload.team }, { status: payload.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update team." }, { status: 400 });
  }
}
