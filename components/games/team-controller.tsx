"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameSessionSnapshot, GameTeam } from "@/lib/games/types";

type TeamState = GameSessionSnapshot & {
  team?: GameTeam;
  currentResponse?: { questionId: string; answerOptionId: string; totalPointsAwarded?: number; isCorrect?: boolean };
};

export function TeamController({ joinCode, initialState }: { joinCode: string; initialState: TeamState }) {
  const [state, setState] = useState(initialState);
  const [teamName, setTeamName] = useState("");
  const [pin, setPin] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async (teamId?: string) => {
    const teamQuery = teamId ? `?teamId=${teamId}` : "";
    const response = await fetch(`/api/play/${joinCode}/state${teamQuery}`);
    if (response.ok) {
      const payload = (await response.json()) as TeamState;
      setState((current) => ({
        ...payload,
        team: payload.team ?? current.team,
        currentResponse: payload.currentResponse ?? current.currentResponse
      }));
    }
  }, [joinCode]);

  useEffect(() => {
    const teamId = state.team?.id;
    const timer = window.setInterval(() => {
      refresh(teamId);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [refresh, state.team?.id]);

  async function join() {
    const response = await fetch(`/api/play/${joinCode}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName, pin })
    });
    const payload = (await response.json()) as { team?: GameTeam; error?: string };
    if (!response.ok || !payload.team) {
      setMessage(payload.error ?? "Could not join.");
      return;
    }
    setState((current) => ({ ...current, team: payload.team }));
    setMessage("");
  }

  async function submitAnswer() {
    if (!state.team || !state.currentQuestion || !selectedAnswer) return;
    const response = await fetch(`/api/play/${joinCode}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: state.team.id, questionId: state.currentQuestion.id, answerOptionId: selectedAnswer })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "Could not submit answer.");
      return;
    }
    setMessage("Answer Locked");
    await refresh(state.team.id);
  }

  const secondsLeft = useMemo(() => {
    if (!state.session.currentQuestionStartedAt || state.session.status !== "question_open") return null;
    const duration = state.session.currentQuestionDurationSeconds ?? state.currentQuestion?.timeLimitSeconds ?? 30;
    return Math.max(0, Math.ceil((new Date(state.session.currentQuestionStartedAt).getTime() + duration * 1000 - Date.now()) / 1000));
  }, [state.currentQuestion?.timeLimitSeconds, state.session.currentQuestionDurationSeconds, state.session.currentQuestionStartedAt, state.session.status]);

  if (!state.team) {
    return (
      <main className="team-controller">
        <section className="team-join-card">
          <p className="present-brand">Lead Emergence</p>
          <h1>{state.game.title}</h1>
          <p>One phone should represent your whole team.</p>
          <label><span>Team name</span><input value={teamName} onChange={(event) => setTeamName(event.target.value)} /></label>
          <label><span>Lobby PIN</span><input inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} /></label>
          <button type="button" onClick={join}>Join Game</button>
          {message ? <p role="status">{message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="team-controller">
      <section className="team-play-card">
        <header>
          <div>
            <p>{state.team.teamName}</p>
            <span>Connected</span>
          </div>
          <strong>{secondsLeft ?? ""}</strong>
        </header>

        {state.session.status === "question_open" && state.currentQuestion ? (
          <>
            <h1>{state.currentQuestion.questionText}</h1>
            <div className="team-answer-grid">
              {state.currentQuestion.answers.map((answer) => (
                <button
                  className={selectedAnswer === answer.id ? "selected" : ""}
                  disabled={Boolean(state.currentResponse)}
                  key={answer.id}
                  type="button"
                  onClick={() => setSelectedAnswer(answer.id)}
                >
                  {answer.answerText}
                </button>
              ))}
            </div>
            <button className="lock-answer-button" disabled={!selectedAnswer || Boolean(state.currentResponse)} type="button" onClick={submitAnswer}>
              {state.currentResponse ? "Answer Locked" : "Lock Answer"}
            </button>
          </>
        ) : null}

        {state.session.status === "answer_revealed" && state.currentQuestion ? (
          <div className="team-reveal">
            <h1>{state.currentResponse?.isCorrect ? "Correct" : "Not this time"}</h1>
            <p>Points earned: {state.currentResponse?.totalPointsAwarded ?? 0}</p>
            <p>Rank: #{state.leaderboard.find((entry) => entry.teamId === state.team?.id)?.rank ?? "-"}</p>
          </div>
        ) : null}

        {!["question_open", "answer_revealed"].includes(state.session.status) ? (
          <div className="team-waiting">
            <h1>Waiting for the next question</h1>
            <p>{state.session.status === "completed" ? "The game has ended." : "Stay close. The host controls the pace."}</p>
          </div>
        ) : null}

        {message ? <p role="status">{message}</p> : null}
      </section>
    </main>
  );
}
