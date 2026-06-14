import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server";
import { getGame, getSnapshot, listSessionsForGame } from "@/lib/games/store";

export default async function GameResultsPage({ params }: { params: { gameId: string } }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const game = getGame(params.gameId);
  if (!game) notFound();

  const sessions = listSessionsForGame(params.gameId).map((gameSession) => getSnapshot(gameSession.id));

  return (
    <section className="games-workspace">
      <div className="games-toolbar">
        <div>
          <p className="eyebrow">Results</p>
          <h2>{game.title}</h2>
          <p>Session reports appear here after hosted games are completed.</p>
        </div>
      </div>
      <div className="builder-panel">
        <h3>Game Summary</h3>
        <p>{game.questions.length} questions · {game.categories.length} categories · {game.status}</p>
        {sessions.length === 0 ? <p>No completed sessions yet.</p> : null}
      </div>
      {sessions.map((snapshot) => (
        <div className="builder-panel" key={snapshot.session.id}>
          <h3>{new Date(snapshot.session.createdAt).toLocaleString()}</h3>
          <p>{snapshot.session.teams.length} teams · {snapshot.session.status}</p>
          <div className="leaderboard-panel">
            {snapshot.leaderboard.map((entry) => (
              <div className="leaderboard-row" key={entry.teamId}>
                <span>#{entry.rank} {entry.teamName} · {entry.correctAnswers} correct · {entry.accuracy}% accuracy</span>
                <strong>{entry.totalScore}</strong>
              </div>
            ))}
          </div>
          <h4>Question Analytics</h4>
          {snapshot.questionAnalytics.slice(0, 8).map((question) => (
            <p key={question.questionId}><strong>{question.categoryName}</strong>: {question.percentCorrect}% correct · {question.teamsAnswered} answered</p>
          ))}
        </div>
      ))}
    </section>
  );
}
