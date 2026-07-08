"use client";

import { useState } from "react";
import type { IntegrationDisplayStatus } from "@/lib/command-center/integrations-meta";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
};

export function GoogleDriveConnection({ displayStatus }: { displayStatus: IntegrationDisplayStatus }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [content, setContent] = useState<{ fileId: string; text: string; truncated: boolean } | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");

  async function handleDisconnect() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/integrations/google-drive/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("Failed to disconnect.");
      window.location.reload();
    } catch {
      setError("Could not disconnect. Try again.");
      setPending(false);
    }
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setContent(null);
    try {
      const response = await fetch(`/api/command-center/integrations/google-drive/search?q=${encodeURIComponent(query.trim())}`);
      const data = (await response.json().catch(() => ({}))) as { files?: DriveFile[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Search failed.");
      setFiles(data.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function handleRead(fileId: string) {
    setReadingId(fileId);
    setError(null);
    setContent(null);
    try {
      const response = await fetch(`/api/command-center/integrations/google-drive/files/${fileId}`);
      const data = (await response.json().catch(() => ({}))) as { content?: { content: string; truncated: boolean }; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not read this file.");
      setContent({ fileId, text: data.content?.content ?? "", truncated: Boolean(data.content?.truncated) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read this file.");
    } finally {
      setReadingId(null);
    }
  }

  async function handleMove(fileId: string) {
    if (!folderName.trim()) return;
    setError(null);
    try {
      const response = await fetch(`/api/command-center/integrations/google-drive/files/${fileId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderName: folderName.trim() })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Move failed.");
      setMovingId(null);
      setFolderName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Move failed.");
    }
  }

  if (displayStatus === "not_configured") {
    return (
      <button className="button" type="button" disabled>
        Not active yet
      </button>
    );
  }

  if (displayStatus !== "connected") {
    return (
      <a className="button primary" href="/api/command-center/integrations/google-drive/connect">
        Connect Google Drive
      </a>
    );
  }

  return (
    <div className="grid">
      <div className="toolbar">
        <input aria-label="Search Google Drive" placeholder="Search Drive" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="button primary" type="button" onClick={handleSearch} disabled={searching || !query.trim()}>
          {searching ? "Searching…" : "Search"}
        </button>
        <button className="button" type="button" onClick={handleDisconnect} disabled={pending}>
          {pending ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>
      {error ? <p className="muted">{error}</p> : null}
      {files ? (
        <ul>
          {files.map((file) => (
            <li key={file.id}>
              <strong>{file.name}</strong>
              {"  "}
              <button className="button" type="button" onClick={() => handleRead(file.id)} disabled={readingId === file.id}>
                {readingId === file.id ? "Reading…" : "Read"}
              </button>{" "}
              <button className="button" type="button" onClick={() => setMovingId(movingId === file.id ? null : file.id)}>
                Move to…
              </button>
              {movingId === file.id ? (
                <div className="toolbar">
                  <input
                    aria-label="Folder name"
                    placeholder="Folder name"
                    value={folderName}
                    onChange={(event) => setFolderName(event.target.value)}
                  />
                  <button className="button primary" type="button" onClick={() => handleMove(file.id)} disabled={!folderName.trim()}>
                    Move
                  </button>
                </div>
              ) : null}
              {content && content.fileId === file.id ? (
                <textarea aria-label="File content" readOnly rows={6} value={content.text + (content.truncated ? "\n\n[truncated]" : "")} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
