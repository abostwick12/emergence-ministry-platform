import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { submitAnswer } from "@/lib/games/store";

const cookieName = "lead_emergence_team_token";

export async function POST(request: Request, { params }: { params: { joinCode: string } }) {
  const body = (await request.json()) as { teamId?: string; questionId?: string; answerOptionId?: string };
  if (!body.teamId || !body.questionId || !body.answerOptionId) {
    return NextResponse.json({ error: "Missing answer information." }, { status: 400 });
  }

  try {
    const response = submitAnswer(params.joinCode, {
      teamId: body.teamId,
      questionId: body.questionId,
      answerOptionId: body.answerOptionId,
      reconnectToken: cookies().get(cookieName)?.value
    });
    return NextResponse.json({ response }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not submit answer." }, { status: 400 });
  }
}
