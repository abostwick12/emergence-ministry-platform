"use client";

import { useEffect, useState } from "react";
import type { IntegrationDisplayStatus } from "@/lib/command-center/integrations-meta";

type MondayBoard = { id: string; name: string };
type MondayItem = { id: string; name: string; columns: Array<{ id: string; text: string }> };

export function MondayConnection({ displayStatus }: { displayStatus: IntegrationDisplayStatus }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boards, setBoards] = useState<MondayBoard[] | null>(null);
  const [openBoardId, setOpenBoardId] = useState<string | null>(null);
  const [items, setItems] = useState<MondayItem[] | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (displayStatus === "connected") loadBoards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayStatus]);

  async function loadBoards() {
    try {
      const response = await fetch("/api/command-center/integrations/monday/boards");
      const data = (await response.json().catch(() => ({}))) as { boards?: MondayBoard[] };
      if (response.ok) setBoards(data.boards ?? []);
    } catch {
      // Leave boards as-is; the toolbar action buttons still work independently.
    }
  }

  async function handleTest() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/integrations/monday/boards");
      if (!response.ok) throw new Error("Failed to list boards.");
      window.location.reload();
    } catch {
      setError("Could not list boards. Check the API token.");
      setPending(false);
    }
  }

  async function handleViewItems(boardId: string) {
    if (openBoardId === boardId) {
      setOpenBoardId(null);
      setItems(null);
      return;
    }
    setOpenBoardId(boardId);
    setItems(null);
    setLoadingItems(true);
    setError(null);
    try {
      const response = await fetch(`/api/command-center/integrations/monday/boards/${boardId}/items`);
      const data = (await response.json().catch(() => ({}))) as { items?: MondayItem[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to load items.");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load items.");
    } finally {
      setLoadingItems(false);
    }
  }

  async function handleDisable() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/integrations/monday/disable", { method: "POST" });
      if (!response.ok) throw new Error("Failed to pause.");
      window.location.reload();
    } catch {
      setError("Could not pause Monday.com. Try again.");
      setPending(false);
    }
  }

  if (displayStatus === "not_configured") {
    return (
      <button className="button" type="button" disabled>
        Not active yet
      </button>
    );
  }

  if (displayStatus === "connected") {
    return (
      <div className="grid">
        <button className="button" type="button" onClick={handleDisable} disabled={pending}>
          {pending ? "Pausing…" : "Pause"}
        </button>
        {error ? <p className="muted">{error}</p> : null}
        {boards ? (
          <ul>
            {boards.map((board) => (
              <li key={board.id}>
                <strong>{board.name}</strong>
                {"  "}
                <button className="button" type="button" onClick={() => handleViewItems(board.id)}>
                  {openBoardId === board.id ? "Hide items" : "View items"}
                </button>
                {openBoardId === board.id ? (
                  loadingItems ? (
                    <p className="muted">Loading…</p>
                  ) : (
                    <ul>
                      {(items ?? []).map((item) => (
                        <li key={item.id}>
                          {item.name}
                          {item.columns.filter((column) => column.text).length > 0
                            ? ` — ${item.columns
                                .filter((column) => column.text)
                                .map((column) => column.text)
                                .join(", ")}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <button className="button primary" type="button" onClick={handleTest} disabled={pending}>
        {pending ? "Listing…" : "List boards"}
      </button>
      {error ? <p className="muted">{error}</p> : null}
    </>
  );
}
