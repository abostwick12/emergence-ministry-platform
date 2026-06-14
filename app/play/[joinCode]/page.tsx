import { notFound } from "next/navigation";
import { TeamController } from "@/components/games/team-controller";
import { teamState } from "@/lib/games/store";

export default function PlayPage({ params }: { params: { joinCode: string } }) {
  try {
    const state = teamState(params.joinCode);
    return (
      <TeamController
        joinCode={params.joinCode}
        initialState={{
          ...state,
          game: {
            ...state.game,
            questions: state.game.questions.map((question) => ({
              ...question,
              answers: question.answers.map((answer) => ({ ...answer, isCorrect: false }))
            }))
          },
          currentQuestion: state.currentQuestion
            ? {
                ...state.currentQuestion,
                answers: state.currentQuestion.answers.map((answer) => ({ ...answer, isCorrect: false }))
              }
            : undefined
        }}
      />
    );
  } catch {
    notFound();
  }
}
