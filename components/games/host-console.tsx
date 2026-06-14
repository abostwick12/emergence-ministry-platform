"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameSessionSnapshot } from "@/lib/games/types";

export function HostConsole({ initialSnapshot }: { initialSnapshot: GameSessionSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [muted, setMuted] = useState(snapshot.game.audioSettings.muted);
  const [volume, setVolume] = useState(snapshot.game.audioSettings.volume);
  const joinUrl = typeof window === "undefined" ? `/play/${snapshot.session.joinCode}` : `${window.location.origin}/play/${snapshot.session.joinCode}`;
  const answeredCount = snapshot.session.currentQuestionId
    ? snapshot.session.responses.filter((response) => response.questionId === snapshot.session.currentQuestionId).length
    : 0;
  const currentCategory = snapshot.currentQuestion
    ? snapshot.game.categories.find((category) => category.id === snapshot.currentQuestion?.categoryId)
    : snapshot.session.currentCategoryId
      ? snapshot.game.categories.find((category) => category.id === snapshot.session.currentCategoryId)
      : undefined;
  const correctAnswer = snapshot.currentQuestion?.answers.find((answer) => answer.isCorrect)?.answerText;

  const nextActionLabel = useMemo(() => {
    if (snapshot.session.status === "lobby") return "Start Game";
    if (snapshot.session.status === "category_intro") return "Start Question";
    return "Open Next Question";
  }, [snapshot.session.status]);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/games/sessions/${snapshot.session.id}`);
    if (response.ok) {
      const payload = (await response.json()) as { snapshot: GameSessionSnapshot };
      setSnapshot(payload.snapshot);
    }
  }, [snapshot.session.id]);

  useEffect(() => {
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function send(action: string, body: Record<string, unknown> = {}) {
    if (action === "complete" && !confirm("End this game and show final results?")) return;
    const response = await fetch(`/api/games/sessions/${snapshot.session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body })
    });
    const payload = (await response.json()) as { snapshot?: GameSessionSnapshot; error?: string };
    if (!response.ok || !payload.snapshot) {
      alert(payload.error ?? "Could not update game.");
      return;
    }
    setSnapshot(payload.snapshot);
  }

  async function nextPrimaryAction() {
    if (snapshot.session.status === "lobby") return send("start");
    if (snapshot.session.status === "category_intro") return send("open_question", { questionId: snapshot.session.currentQuestionId, skipIntro: true });
    return send("open_question");
  }

  return (
    <section className="games-workspace host-console" aria-label="Host console">
      <div className="games-toolbar">
        <div>
          <p className="eyebrow">Host Console</p>
          <h2>{snapshot.game.title}</h2>
          <p>Join code <strong>{snapshot.session.joinCode}</strong> · PIN <strong>{snapshot.session.joinPin}</strong></p>
        </div>
        <div className="game-actions">
          <Link className="button secondary" href={`/games/sessions/${snapshot.session.id}/present`} target="_blank">Open Presentation Screen</Link>
          <button className="button secondary" type="button" onClick={() => navigator.clipboard?.writeText(joinUrl)}>Copy Join Link</button>
        </div>
      </div>

      <div className="host-grid">
        <div className="builder-panel qr-panel">
          <h3>Lobby</h3>
          <div className="qr-code" aria-label={`Join link: ${joinUrl}`}>
            {Array.from({ length: 49 }).map((_, index) => <span key={index} className={(index * 7 + snapshot.session.joinCode.charCodeAt(index % snapshot.session.joinCode.length)) % 3 === 0 ? "dark" : ""} />)}
          </div>
          <p className="join-code">{snapshot.session.joinCode}</p>
          <p>One phone per team. Team captains scan or visit the join link.</p>
          <div className="team-list">
            {snapshot.session.teams.map((team) => (
              <span className="team-pill" style={{ borderColor: team.teamColor }} key={team.id}>{team.teamName}</span>
            ))}
          </div>
        </div>

        <div className="builder-panel host-stage">
          <p className="eyebrow">{snapshot.session.status.replace("_", " ")}</p>
          {snapshot.session.status === "category_intro" && currentCategory ? (
            <>
              <h3>Category Intro: {currentCategory.theme.introTitle || currentCategory.name}</h3>
              <p>{currentCategory.theme.introSubtitle}</p>
            </>
          ) : snapshot.currentQuestion ? (
            <>
              <p>{currentCategory?.name}</p>
              <h3>{snapshot.currentQuestion.questionText}</h3>
              <p>Correct answer: <strong>{correctAnswer}</strong></p>
              <p>{answeredCount} of {snapshot.session.teams.length} teams answered</p>
            </>
          ) : (
            <h3>Ready in the lobby</h3>
          )}
          <div className="game-actions">
            <button className="button primary" type="button" onClick={nextPrimaryAction}>{nextActionLabel}</button>
            <button className="button secondary" type="button" onClick={() => send("add_time")} disabled={snapshot.session.status !== "question_open"}>+15 seconds</button>
            <button className="button secondary" type="button" onClick={() => send("close_question")} disabled={snapshot.session.status !== "question_open"}>Close Responses</button>
            <button className="button secondary" type="button" onClick={() => send("reveal_answer")} disabled={snapshot.session.status !== "question_closed"}>Reveal Answer</button>
            <button className="button danger" type="button" onClick={() => send("complete")}>End Game</button>
          </div>
        </div>

        <div className="builder-panel">
          <h3>Game Audio</h3>
          <button className="button primary" type="button" onClick={() => setAudioEnabled(true)}>Enable Game Audio</button>
          <label className="checkbox-row"><input type="checkbox" checked={muted} onChange={(event) => setMuted(event.target.checked)} /> Mute</label>
          <label><span>Volume</span><input type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
          <p>{audioEnabled ? "Audio is enabled for this browser." : "Press once before the session begins if audio will be used."}</p>
        </div>

        <div className="builder-panel leaderboard-panel">
          <h3>Leaderboard</h3>
          {snapshot.leaderboard.map((entry) => (
            <div className="leaderboard-row" key={entry.teamId}>
              <span>#{entry.rank} {entry.teamName}</span>
              <strong>{entry.totalScore}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
