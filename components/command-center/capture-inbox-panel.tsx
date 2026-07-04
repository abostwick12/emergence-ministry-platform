"use client";

import { useEffect, useState } from "react";
import { DOMAIN_LABELS, DOMAIN_ORDER } from "@/components/command-center/domain-meta";
import type { CaptureEntry, PersonalDomain } from "@/lib/command-center/types";

type CaptureWithSuggestion = CaptureEntry & { suggestedDomain: PersonalDomain; suggestedTitle: string };

export function CaptureInboxPanel({ initialCount }: { initialCount: number }) {
  const [entries, setEntries] = useState<CaptureWithSuggestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { domain: PersonalDomain; title: string }>>({});

  useEffect(() => {
    if (initialCount === 0) return;
    fetch("/api/command-center/capture")
      .then((response) => response.json())
      .then((data: { entries: CaptureWithSuggestion[] }) => {
        setEntries(data.entries);
        setDrafts(
          Object.fromEntries(
            data.entries.map((entry) => [entry.id, { domain: entry.suggestedDomain, title: entry.suggestedTitle }])
          )
        );
        setLoaded(true);
      });
  }, [initialCount]);

  async function resolve(id: string, action: "approve" | "discard") {
    const draft = drafts[id];
    await fetch(`/api/command-center/capture/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "approve" ? { action, domain: draft.domain, title: draft.title } : { action })
    });
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  if (initialCount === 0) return null;
  if (!loaded) return null;
  if (entries.length === 0) return null;

  return (
    <section className="panel">
      <p className="eyebrow">Inbox</p>
      <h2 className="section-title flush">Quick Capture ({entries.length})</h2>
      <p className="muted">SAGE has suggested a domain and task title for each. Review and approve, or discard.</p>
      <div className="grid">
        {entries.map((entry) => {
          const draft = drafts[entry.id] ?? { domain: entry.suggestedDomain, title: entry.suggestedTitle };
          return (
            <div className="panel" key={entry.id}>
              <p className="muted">{entry.rawText}</p>
              <div className="toolbar">
                <select
                  value={draft.domain}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [entry.id]: { ...draft, domain: event.target.value as PersonalDomain } }))
                  }
                >
                  {DOMAIN_ORDER.map((domain) => (
                    <option key={domain} value={domain}>
                      {DOMAIN_LABELS[domain]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) => setDrafts((current) => ({ ...current, [entry.id]: { ...draft, title: event.target.value } }))}
                />
              </div>
              <div className="toolbar">
                <button className="button primary" type="button" onClick={() => resolve(entry.id, "approve")}>
                  Approve → Task
                </button>
                <button className="button ghost" type="button" onClick={() => resolve(entry.id, "discard")}>
                  Discard
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
