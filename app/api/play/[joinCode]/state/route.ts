import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { teamState } from "@/lib/games/store";

const cookieName = "lead_emergence_team_token";

export async function GET(request: Request, { params }: { params: { joinCode: string } }) {
  const search = new URL(request.url).searchParams;
  try {
    const snapshot = teamState(params.joinCode, search.get("teamId") ?? undefined, cookies().get(cookieName)?.value);
    const publicGame = {
      ...snapshot.game,
      questions: snapshot.game.questions.map((question) => ({
        ...question,
        answers: question.answers.map((answer) => ({ ...answer, isCorrect: false }))
      }))
    };

    return NextResponse.json({
      game: snapshot.session.status === "answer_revealed" ? snapshot.game : publicGame,
      session: {
        ...snapshot.session,
        responses: snapshot.session.responses.map((response) => ({
          teamId: response.teamId,
          questionId: response.questionId
        }))
      },
      currentQuestion: snapshot.currentQuestion
        ? {
            ...snapshot.currentQuestion,
            answers: snapshot.session.status === "answer_revealed" ? snapshot.currentQuestion.answers : snapshot.currentQuestion.answers.map((answer) => ({ ...answer, isCorrect: false }))
          }
        : undefined,
      team: snapshot.team,
      currentResponse:
        snapshot.currentResponse && snapshot.session.status === "answer_revealed"
          ? snapshot.currentResponse
          : snapshot.currentResponse
            ? {
                questionId: snapshot.currentResponse.questionId,
                answerOptionId: snapshot.currentResponse.answerOptionId
              }
            : undefined,
      leaderboard: snapshot.leaderboard
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Game not found." }, { status: 404 });
  }
}
