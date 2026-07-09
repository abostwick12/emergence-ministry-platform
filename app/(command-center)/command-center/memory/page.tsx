"use client";

import { useEffect, useState } from "react";
import type { PersonalDomain, SageMemory, SageMemoryType } from "@/lib/command-center/types";
import { formatDate } from "@/lib/utils";

const MEMORY_TYPES: { value: SageMemoryType; label: string }[] = [
  { value: "fact", label: "Fact" },
  { value: "preference", label: "Preference" },
  { value: "context", label: "Context" },
  { value: "relationship", label: "Relationship" }
];

const DOMAINS: { value: PersonalDomain; label: string }[] = [
  { value: "military_transition", label: "Military Transition" },
  { value: "sotf_fellowship", label: "SOTF Fellowship" },
  { value: "job_search", label: "Job Search" },
  { value: "life", label: "Life" }
];

export default function CommandCenterMemoryPage() {
  const [memories, setMemories] = useState<SageMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [memoryType, setMemoryType] = useState<SageMemoryType>("fact");
  const [domain, setDomain] = useState<PersonalDomain | "">("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/memory");
      if (!response.ok) throw new Error("Failed to load memory");
      const data = (await response.json()) as { memories: SageMemory[] };
      setMemories(data.memories);
    } catch {
      setError("SAGE memory could not be loaded. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addMemory() {
    if (!content.trim()) return;
    setError(null);
    const response = await fetch("/api/command-center/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryType, content: content.trim(), domain: domain || undefined })
    });
    if (!response.ok) {
      setError("Memory entry could not be saved.");
      return;
    }
    const memory = (await response.json()) as SageMemory;
    setMemories((current) => [memory, ...current]);
    setContent("");
  }

  async function removeMemory(id: string) {
    const previous = memories;
    setMemories((current) => current.filter((memory) => memory.id !== id));
    setError(null);
    const response = await fetch(`/api/command-center/memory/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setMemories(previous);
      setError("Memory entry could not be removed.");
    }
  }

  return (
    <div className="grid workspace-page">
      <section className="panel">
        <p className="eyebrow">SAGE Memory</p>
        <h2 className="section-title flush">Saved Facts, Preferences &amp; Context</h2>
        <p className="muted">
          SAGE only reads this list — it never saves a memory entry automatically from a conversation. Add or remove
          entries here yourself.
        </p>
        <div className="toolbar">
          <select value={memoryType} onChange={(event) => setMemoryType(event.target.value as SageMemoryType)}>
            {MEMORY_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select value={domain} onChange={(event) => setDomain(event.target.value as PersonalDomain | "")}>
            <option value="">No domain</option>
            {DOMAINS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="What should SAGE remember?"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <button className="button primary" type="button" onClick={addMemory}>
            + Save Memory
          </button>
        </div>
        {error ? (
          <p className="muted" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {loading ? (
        <p className="muted">Loading saved memory...</p>
      ) : memories.length === 0 ? (
        <p className="muted">No memory entries saved yet.</p>
      ) : (
        <section className="panel">
          <ul className="cc-nav-list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {memories.map((memory) => (
              <li key={memory.id} className="task-card command-center-task-card">
                <div className="toolbar split">
                  <span className="pill">{memory.memoryType}</span>
                  {memory.domain ? <span className="pill">{memory.domain}</span> : null}
                  <span className="muted">{formatDate(memory.createdAt)}</span>
                </div>
                <p>{memory.content}</p>
                <div className="toolbar">
                  <button className="button" type="button" onClick={() => removeMemory(memory.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
