"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TriviaGame } from "@/lib/games/types";

export function GamesLibrary({ initialGames }: { initialGames: TriviaGame[] }) {
  const [games, setGames] = useState(initialGames);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");

  const filtered = useMemo(() => {
    return games.filter((game) => {
      const matchesQuery = `${game.title} ${game.description}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === "all" || (status === "active" ? game.status !== "archived" : game.status === status);
      return matchesQuery && matchesStatus;
    });
  }, [games, query, status]);

  async function launchGame(gameId: string) {
    const response = await fetch(`/api/games/${gameId}/sessions`, { method: "POST" });
    const payload = (await response.json()) as { snapshot?: { session: { id: string } }; error?: string };
    if (!response.ok || !payload.snapshot) {
      alert(payload.error ?? "Could not launch game.");
      return;
    }
    window.location.href = `/games/sessions/${payload.snapshot.session.id}/host`;
  }

  async function duplicateGame(gameId: string) {
    const response = await fetch(`/api/games/${gameId}/duplicate`, { method: "POST" });
    if (response.ok) {
      const payload = (await response.json()) as { game: TriviaGame };
      setGames((current) => [payload.game, ...current]);
    }
  }

  async function archiveGame(gameId: string) {
    if (!confirm("Archive this game? It will be hidden by default.")) return;
    const response = await fetch(`/api/games/${gameId}/archive`, { method: "POST" });
    if (response.ok) {
      const payload = (await response.json()) as { game: TriviaGame };
      setGames((current) => current.map((game) => (game.id === payload.game.id ? payload.game : game)));
    }
  }

  return (
    <section className="games-workspace" aria-label="Games library">
      <div className="games-toolbar">
        <div>
          <h2>Games Library</h2>
          <p>Build, host, and review Team Trivia games for ministry gatherings.</p>
        </div>
        <Link className="button primary" href="/games/new">Create Game</Link>
      </div>

      <div className="games-filters">
        <label>
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="EMERGE Trivia" />
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          <span>Game type</span>
          <select value="team_trivia" disabled>
            <option value="team_trivia">Team Trivia</option>
          </select>
        </label>
      </div>

      <div className="games-grid">
        {filtered.map((game) => (
          <article className="game-card" key={game.id}>
            <div className="game-card-header">
              <div>
                <p className="eyebrow">Team Trivia</p>
                <h3>{game.title}</h3>
              </div>
              <span className={`game-status ${game.status}`}>{game.status}</span>
            </div>
            <p>{game.description}</p>
            <dl className="game-meta">
              <div><dt>Categories</dt><dd>{game.categories.length}</dd></div>
              <div><dt>Questions</dt><dd>{game.questions.length}</dd></div>
              <div><dt>Updated</dt><dd>{new Date(game.updatedAt).toLocaleDateString()}</dd></div>
              <div><dt>Last played</dt><dd>{game.lastPlayedAt ? new Date(game.lastPlayedAt).toLocaleDateString() : "Not yet"}</dd></div>
              <div><dt>Created by</dt><dd>Alex Walker</dd></div>
            </dl>
            <div className="game-actions">
              <Link className="button secondary" href={`/games/${game.id}/edit`}>Edit</Link>
              <button className="button secondary" type="button" onClick={() => duplicateGame(game.id)}>Duplicate</button>
              <button className="button primary" type="button" onClick={() => launchGame(game.id)}>Host Game</button>
              <Link className="button secondary" href={`/games/${game.id}/results`}>Results</Link>
              <button className="button danger" type="button" onClick={() => archiveGame(game.id)}>Archive</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
