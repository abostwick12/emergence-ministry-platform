"use client";

import { useEffect, useState } from "react";
import type { IntegrationDisplayStatus } from "@/lib/command-center/integrations-meta";
import type { PersonalDomain } from "@/lib/command-center/types";

type MondayBoard = { id: string; name: string };
type MondayItem = { id: string; name: string; columns: Array<{ id: string; text: string }> };
type SyncResult = { importedCount: number; skippedCount: number };

const DOMAIN_OPTIONS: { value: PersonalDomain; label: string }[] = [
  { value: "military_transition", label: "Military Transition" },
  { value: "sotf_fellowship", label: "SOTF Fellowship" },
  { value: "job_search", label: "Job Search" },
  { value: "life", label: "Life" }
];

export function MondayConnection({ displayStatus }: { displayStatus: IntegrationDisplayStatus }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boards, setBoards] = useState<MondayBoard[] | null>(null);
  const [openBoardId, setOpenBoardId] = useState<string | null>(null);
  const [items, setItems] = useState<MondayItem[] | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [syncDomain, setSyncDomain] = useState<PersonalDomain>("job_search");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

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
      setSyncResult(null);
      return;
    }
    setOpenBoardId(boardId);
    setItems(null);
    setSyncResult(null);
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

  // Monday.com -> Command Center only, one board at a time, Andrew-triggered.
  // Safe to click again later: already-imported items are skipped server-side.
  async function handleSyncTasks(boardId: string) {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const response = await fetch(`/api/command-center/integrations/monday/boards/${boardId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: syncDomain })
      });
      const data = (await response.json().catch(() => ({}))) as SyncResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to import tasks.");
      setSyncResult({ importedCount: data.importedCount, skippedCount: data.skippedCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import tasks.");
    } finally {
      setSyncing(false);
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
                    <>
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
                      <div className="toolbar">
                        <select value={syncDomain} onChange={(event) => setSyncDomain(event.target.value as PersonalDomain)}>
                          {DOMAIN_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button className="button" type="button" onClick={() => handleSyncTasks(board.id)} disabled={syncing}>
                          {syncing ? "Importing…" : "Import as tasks"}
                        </button>
                      </div>
                      {syncResult ? (
                        <p className="muted">
                          Imported {syncResult.importedCount} new task{syncResult.importedCount === 1 ? "" : "s"}
                          {syncResult.skippedCount > 0 ? ` (${syncResult.skippedCount} already imported)` : ""}.
                        </p>
                      ) : null}
                    </>
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
