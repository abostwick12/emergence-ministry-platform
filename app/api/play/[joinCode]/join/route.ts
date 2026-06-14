import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { joinSession } from "@/lib/games/store";

const cookieName = "lead_emergence_team_token";

export async function POST(request: Request, { params }: { params: { joinCode: string } }) {
  const body = (await request.json()) as { teamName?: string; pin?: string };
  const existingToken = cookies().get(cookieName)?.value;

  try {
    const result = joinSession(params.joinCode, {
      teamName: body.teamName ?? "",
      pin: body.pin,
      reconnectToken: existingToken
    });
    const response = NextResponse.json({ team: result.team }, { status: 201 });
    response.cookies.set(cookieName, result.reconnectToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not join game." }, { status: 400 });
  }
}
