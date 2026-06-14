"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CategoryTheme, GameSessionSnapshot } from "@/lib/games/types";

export function PresentationScreen({ initialSnapshot }: { initialSnapshot: GameSessionSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [celebrationMode, setCelebrationMode] = useState<"ready" | "running" | "skipped">("ready");
  const category = snapshot.currentQuestion
    ? snapshot.game.categories.find((item) => item.id === snapshot.currentQuestion?.categoryId)
    : snapshot.session.currentCategoryId
      ? snapshot.game.categories.find((item) => item.id === snapshot.session.currentCategoryId)
      : undefined;
  const theme = category?.theme;
  const correctAnswer = snapshot.currentQuestion?.answers.find((answer) => answer.isCorrect);
  const answeredCount = snapshot.session.currentQuestionId
    ? snapshot.session.responses.filter((response) => response.questionId === snapshot.session.currentQuestionId).length
    : 0;
  const winner = snapshot.leaderboard[0];

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/games/sessions/${snapshot.session.id}`);
    if (response.ok) {
      const payload = (await response.json()) as { snapshot: GameSessionSnapshot };
      setSnapshot(payload.snapshot);
    }
  }, [snapshot.session.id]);

  useEffect(() => {
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (snapshot.session.status === "completed" && snapshot.game.celebrationSettings.enabled && celebrationMode === "ready") {
      setCelebrationMode("running");
    }
  }, [celebrationMode, snapshot.game.celebrationSettings.enabled, snapshot.session.status]);

  const secondsLeft = useMemo(() => {
    if (!snapshot.session.currentQuestionStartedAt || snapshot.session.status !== "question_open") return null;
    const duration = snapshot.session.currentQuestionDurationSeconds ?? snapshot.currentQuestion?.timeLimitSeconds ?? 30;
    return Math.max(0, Math.ceil((new Date(snapshot.session.currentQuestionStartedAt).getTime() + duration * 1000 - Date.now()) / 1000));
  }, [snapshot.currentQuestion?.timeLimitSeconds, snapshot.session.currentQuestionDurationSeconds, snapshot.session.currentQuestionStartedAt, snapshot.session.status]);

  return (
    <main className={themeClass(theme)} style={themeStyle(theme)}>
      <div className="presentation-safe-layer">
        {snapshot.session.status === "lobby" ? (
          <section className="present-lobby">
            <p className="present-brand">Lead Emergence</p>
            <h1>{snapshot.game.title}</h1>
            <div className="present-join-card">
              <div className="qr-code large" aria-hidden="true">
                {Array.from({ length: 64 }).map((_, index) => <span key={index} className={(index + snapshot.session.joinCode.charCodeAt(index % snapshot.session.joinCode.length)) % 3 === 0 ? "dark" : ""} />)}
              </div>
              <div>
                <p>Join Code</p>
                <strong>{snapshot.session.joinCode}</strong>
                <span>PIN {snapshot.session.joinPin}</span>
              </div>
            </div>
            <div className="present-teams">{snapshot.session.teams.map((team) => <span key={team.id}>{team.teamName}</span>)}</div>
            <p>Waiting for host</p>
          </section>
        ) : null}

        {snapshot.session.status === "category_intro" && category ? (
          <section className="category-intro-slide">
            <div className="category-badge">{theme?.icon}</div>
            <p>Round {category.sortOrder}</p>
            <h1>{theme?.introTitle || category.name}</h1>
            <h2>{theme?.introSubtitle}</h2>
          </section>
        ) : null}

        {snapshot.currentQuestion && ["question_open", "question_closed", "answer_revealed"].includes(snapshot.session.status) ? (
          <section className="question-slide">
            <header>
              <span className="category-chip">{category?.name}</span>
              <span className="timer-display">{secondsLeft ?? "Locked"}</span>
            </header>
            <h1>{snapshot.currentQuestion.questionText}</h1>
            <div className="present-answer-grid">
              {snapshot.currentQuestion.answers.map((answer) => (
                <div className={snapshot.session.status === "answer_revealed" && answer.isCorrect ? "present-answer correct" : "present-answer"} key={answer.id}>
                  {answer.answerText}
                </div>
              ))}
            </div>
            <div className="answered-strip">
              {snapshot.session.teams.map((team) => {
                const answered = snapshot.session.responses.some((response) => response.teamId === team.id && response.questionId === snapshot.currentQuestion?.id);
                return <span className={answered ? "answered" : ""} key={team.id}>{team.teamName}</span>;
              })}
            </div>
            {snapshot.session.status === "question_closed" ? <p className="locked-banner">Answers Locked · {answeredCount} teams answered</p> : null}
            {snapshot.session.status === "answer_revealed" && correctAnswer ? (
              <div className="reveal-panel">
                <p>Correct Answer</p>
                <strong>{correctAnswer.answerText}</strong>
                {snapshot.currentQuestion.explanation ? <span>{snapshot.currentQuestion.explanation}</span> : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {snapshot.session.status === "completed" ? (
          <section className={celebrationMode === "running" ? "final-results celebrating" : "final-results"}>
            {snapshot.game.celebrationSettings.enabled && celebrationMode === "running" ? <Confetti /> : null}
            <div className="celebration-controls">
              <button type="button" onClick={() => setCelebrationMode("skipped")}>Skip</button>
              <button type="button" onClick={() => setCelebrationMode("running")}>Replay</button>
            </div>
            <p className="present-brand">Final Results</p>
            {winner ? (
              <>
                <h1>{winner.teamName}</h1>
                <h2>{winner.totalScore.toLocaleString()} points</h2>
              </>
            ) : <h1>No teams joined</h1>}
            <div className="podium">
              {snapshot.leaderboard.slice(0, 3).map((entry) => (
                <div className={`podium-step rank-${entry.rank}`} key={entry.teamId}>
                  <span>#{entry.rank}</span>
                  <strong>{entry.teamName}</strong>
                  <em>{entry.totalScore}</em>
                </div>
              ))}
            </div>
            <div className="final-stats">
              <span>Most accurate: {snapshot.leaderboard.sort((a, b) => b.accuracy - a.accuracy)[0]?.teamName ?? "n/a"}</span>
              <span>Fastest correct average: {snapshot.leaderboard.filter((entry) => entry.averageCorrectResponseMs !== null).sort((a, b) => (a.averageCorrectResponseMs ?? 0) - (b.averageCorrectResponseMs ?? 0))[0]?.teamName ?? "n/a"}</span>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function themeClass(theme?: CategoryTheme) {
  return `presentation-screen theme-${theme?.accentStyle ?? "mixed"} transition-${theme?.transitionAnimation ?? "fade"}`;
}

function themeStyle(theme?: CategoryTheme): CSSProperties {
  return {
    "--category-accent": theme?.accentColor ?? "#2563eb",
    ...(theme?.backgroundImageUrl ? { backgroundImage: `linear-gradient(rgba(255,255,255,.82), rgba(255,255,255,.82)), url(${theme.backgroundImageUrl})` } : {})
  } as CSSProperties;
}

function Confetti() {
  return <div className="confetti" aria-hidden="true">{Array.from({ length: 36 }).map((_, index) => <i key={index} />)}</div>;
}
