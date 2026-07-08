"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import type { KnowledgeControlRoomState, KnowledgeSourceControlItem, KnowledgeVisibility } from "@/lib/scripture/knowledge-control-room";
import type { KnowledgeTestBenchResult } from "@/lib/scripture/knowledge-test-bench";

type ScriptureKnowledgeControlRoomProps = {
  initialState: KnowledgeControlRoomState;
};

type CreateSourceResponse = {
  ok?: boolean;
  error?: string;
  source?: KnowledgeSourceControlItem;
};

type UpdateSourceResponse = CreateSourceResponse;

type TestBenchResponse = {
  ok?: boolean;
  error?: string;
  result?: KnowledgeTestBenchResult;
};

const visibilityActions: Array<{ visibility: KnowledgeVisibility; label: string; note: string }> = [
  { visibility: "student_visible", label: "Make Student Visible", note: "Available to question follow-up and Keep Reading." },
  { visibility: "leader_only", label: "Leader Only", note: "Usable for leader preparation, hidden from students." },
  { visibility: "scholar_citation_only", label: "Citation Only", note: "Kept as scholar context without student retrieval." },
  { visibility: "private_review", label: "Back to Review", note: "Held until a leader checks it again." }
];

export function ScriptureKnowledgeControlRoom({ initialState }: ScriptureKnowledgeControlRoomProps) {
  const [sources, setSources] = useState(initialState.sources);
  const [status, setStatus] = useState(initialState.readiness.message);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<KnowledgeTestBenchResult | null>(null);
  const [updatingId, setUpdatingId] = useState("");
  const stats = useMemo(() => buildStats(sources, initialState.stats.chunkCount), [sources, initialState.stats.chunkCount]);
  const canWrite = initialState.readiness.liveStorage && !saving;

  async function submitSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setStatus("Saving source for review...");

    try {
      const response = await fetch("/api/student/scripture/knowledge-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(form.get("title") || ""),
          sourceKind: String(form.get("sourceKind") || "own_voice"),
          hemisphere: String(form.get("hemisphere") || "own_voice"),
          sourceUri: String(form.get("sourceUri") || ""),
          citation: String(form.get("citation") || ""),
          summary: String(form.get("summary") || ""),
          tags: String(form.get("tags") || ""),
          scriptureReferences: String(form.get("scriptureReferences") || ""),
          content: String(form.get("content") || "")
        })
      });
      const payload = (await response.json()) as CreateSourceResponse;
      if (!response.ok || !payload.ok || !payload.source) {
        setStatus(payload.error ?? "The source could not be saved.");
        return;
      }

      setSources((current) => [payload.source!, ...current]);
      setStatus("Source saved in private review. Check the chunks before making it visible.");
      event.currentTarget.reset();
    } catch {
      setStatus("The source could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function updateVisibility(sourceId: string, visibility: KnowledgeVisibility) {
    setUpdatingId(sourceId);
    setStatus("Updating source visibility...");
    try {
      const response = await fetch(`/api/student/scripture/knowledge-sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility })
      });
      const payload = (await response.json()) as UpdateSourceResponse;
      if (!response.ok || !payload.ok || !payload.source) {
        setStatus(payload.error ?? "The source visibility could not be updated.");
        return;
      }

      setSources((current) => current.map((source) => (source.id === payload.source!.id ? payload.source! : source)));
      setStatus(visibility === "student_visible" ? "Source is now available for student question follow-up." : "Source visibility updated.");
    } catch {
      setStatus("The source visibility could not be updated.");
    } finally {
      setUpdatingId("");
    }
  }

  async function updateDetails(sourceId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    setUpdatingId(sourceId);
    setStatus("Saving source details...");
    try {
      const response = await fetch(`/api/student/scripture/knowledge-sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(data.get("editTitle") || ""),
          summary: String(data.get("editSummary") || ""),
          tags: String(data.get("editTags") || ""),
          scriptureReferences: String(data.get("editScriptureReferences") || ""),
          citation: String(data.get("editCitation") || ""),
          sourceUri: String(data.get("editSourceUri") || "")
        })
      });
      const payload = (await response.json()) as UpdateSourceResponse;
      if (!response.ok || !payload.ok || !payload.source) {
        setStatus(payload.error ?? "The source details could not be saved.");
        return;
      }

      setSources((current) => current.map((source) => (source.id === payload.source!.id ? payload.source! : source)));
      setStatus("Source details saved. Rerun the brain test to check the updated retrieval path.");
    } catch {
      setStatus("The source details could not be saved.");
    } finally {
      setUpdatingId("");
    }
  }

  async function runTestBench(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setTesting(true);
    setStatus("Testing source matches and student next steps...");

    try {
      const response = await fetch("/api/student/scripture/knowledge-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: String(form.get("testQuestion") || ""),
          scriptureReference: String(form.get("testScriptureReference") || "")
        })
      });
      const payload = (await response.json()) as TestBenchResponse;
      if (!response.ok || !payload.ok || !payload.result) {
        setStatus(payload.error ?? "The knowledge brain preview could not run.");
        return;
      }

      setTestResult(payload.result);
      setStatus("Preview ready. This did not save a student question or publish anything.");
    } catch {
      setStatus("The knowledge brain preview could not run.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="knowledge-control-room" aria-label="Knowledge source control room">
      <div className="knowledge-control-hero">
        <div>
          <p className="eyebrow">Knowledge Sources</p>
          <h1>Build the discipleship brain</h1>
          <p>Add trusted material, review the extracted chunks, then choose what can shape student-facing follow-up.</p>
        </div>
        <div className="knowledge-control-stats" aria-label="Knowledge source counts">
          <StatTile label="Sources" value={stats.totalSources} />
          <StatTile label="In review" value={stats.reviewSources} />
          <StatTile label="Student visible" value={stats.studentVisibleSources} />
          <StatTile label="Chunks" value={stats.chunkCount} />
        </div>
      </div>

      <p className="leader-review-status" aria-live="polite">
        {status}
      </p>

      <div className="knowledge-test-bench">
        <form className="knowledge-test-form" onSubmit={runTestBench}>
          <div>
            <p className="eyebrow">Test bench</p>
            <h2>Ask the brain before students do</h2>
            <p>Preview the source matches, digging questions, and reading path a student would receive. Nothing is saved or shared.</p>
          </div>

          <label className="leader-review-field">
            <span>Student-style question</span>
            <textarea
              name="testQuestion"
              placeholder="How do I trust God when something painful still does not make sense?"
              required
            />
          </label>

          <label className="leader-review-field">
            <span>Passage, if there is one</span>
            <input className="input" name="testScriptureReference" placeholder="Psalm 13" />
          </label>

          <button className="button primary" disabled={testing} type="submit">
            {testing ? "Testing..." : "Run Brain Test"}
          </button>
        </form>

        <TestBenchPreview result={testResult} />
      </div>

      <div className="knowledge-control-grid">
        <form className="knowledge-source-form" onSubmit={submitSource}>
          <div>
            <p className="eyebrow">Add source</p>
            <h2>Private review first</h2>
          </div>

          <label className="leader-review-field">
            <span>Title</span>
            <input className="input" name="title" placeholder="Romans 8 and patient hope" required />
          </label>

          <div className="knowledge-source-field-grid">
            <label className="leader-review-field">
              <span>Source type</span>
              <select className="input" name="sourceKind" defaultValue="own_voice">
                <option value="own_voice">My writing</option>
                <option value="scholar_reference">Scholar reference</option>
                <option value="app_resource">App resource</option>
                <option value="curated_note">Curated note</option>
              </select>
            </label>

            <label className="leader-review-field">
              <span>Library side</span>
              <select className="input" name="hemisphere" defaultValue="own_voice">
                <option value="own_voice">Left: own voice</option>
                <option value="scholar">Right: scholars</option>
                <option value="platform">Platform resource</option>
              </select>
            </label>
          </div>

          <label className="leader-review-field">
            <span>Paste source material</span>
            <textarea name="content" placeholder="Paste the excerpt or lesson content you want reviewed for the knowledge brain." required />
          </label>

          <label className="leader-review-field">
            <span>Student-safe summary</span>
            <textarea name="summary" placeholder="Optional. If blank, the app drafts a short summary from the source." />
          </label>

          <div className="knowledge-source-field-grid">
            <label className="leader-review-field">
              <span>Topics</span>
              <input className="input" name="tags" placeholder="trust, suffering, prayer" />
            </label>

            <label className="leader-review-field">
              <span>Scripture</span>
              <input className="input" name="scriptureReferences" placeholder="Romans 8:18, Psalm 13" />
            </label>
          </div>

          <label className="leader-review-field">
            <span>Citation</span>
            <input className="input" name="citation" placeholder="Author, title, page, or sermon date" />
          </label>

          <label className="leader-review-field">
            <span>Source link</span>
            <input className="input" name="sourceUri" placeholder="https://..." />
          </label>

          <button className="button primary" disabled={!canWrite} type="submit">
            {saving ? "Saving..." : "Save for Review"}
          </button>
        </form>

        <div className="knowledge-source-list">
          {sources.length ? (
            sources.map((source) => (
              <SourceCard
                canWrite={initialState.readiness.liveStorage && !updatingId}
                isUpdating={updatingId === source.id}
                key={source.id}
                onDetailsSave={updateDetails}
                onVisibilityChange={updateVisibility}
                source={source}
              />
            ))
          ) : (
            <div className="leader-review-empty">
              <strong>No sources loaded yet.</strong>
              <p>Saved sources will appear here with chunk previews and visibility controls.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TestBenchPreview({ result }: { result: KnowledgeTestBenchResult | null }) {
  if (!result) {
    return (
      <aside className="knowledge-test-preview" aria-label="Knowledge brain preview">
        <p className="eyebrow">Preview</p>
        <h3>Ready for a question</h3>
        <p>Run a test to see what sources are retrieved and what a student would be invited to explore next.</p>
      </aside>
    );
  }

  return (
    <aside className="knowledge-test-preview" aria-label="Knowledge brain preview">
      <p className="eyebrow">Preview</p>
      <h3>{result.nextStep.label}</h3>
      <p>{result.nextStep.summary}</p>

      <div className="knowledge-test-section">
        <span>Questions to dig into</span>
        <ul>
          {result.nextStep.digQuestions.slice(0, 3).map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </div>

      <div className="knowledge-test-section">
        <span>Keep Reading</span>
        <strong>{result.nextStep.readingPlan.title}</strong>
        <p>{result.nextStep.readingPlan.description}</p>
      </div>

      <div className="knowledge-test-section">
        <span>Matched sources</span>
        {result.matches.length ? (
          result.matches.map((match) => (
            <article className="knowledge-test-match" key={match.id}>
              <strong>{match.title}</strong>
              <p>{match.description}</p>
              <small>{match.scriptureReferences.join(", ") || "No passage tagged"}</small>
            </article>
          ))
        ) : (
          <p>No source matches yet. The launch-safe defaults will carry the preview.</p>
        )}
      </div>

      <p className="knowledge-test-note">{result.visibilityNote}</p>
    </aside>
  );
}

function SourceCard({
  canWrite,
  isUpdating,
  onDetailsSave,
  onVisibilityChange,
  source
}: {
  canWrite: boolean;
  isUpdating: boolean;
  onDetailsSave: (sourceId: string, form: HTMLFormElement) => Promise<void>;
  onVisibilityChange: (sourceId: string, visibility: KnowledgeVisibility) => Promise<void>;
  source: KnowledgeSourceControlItem;
}) {
  return (
    <article className="knowledge-source-card">
      <header className="knowledge-source-card-header">
        <div>
          <span>{sourceLabel(source)}</span>
          <h3>{source.title}</h3>
          <p>{source.summary}</p>
        </div>
        <span className={visibilityClassName(source.visibility)}>{visibilityLabel(source.visibility)}</span>
      </header>

      <div className="knowledge-source-tags">
        {source.tags.slice(0, 6).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
        {source.citation ? <span>{source.citation}</span> : null}
      </div>

      <div className="knowledge-source-chunks">
        {source.chunks.slice(0, 3).map((chunk) => (
          <details key={chunk.id}>
            <summary>
              <span>{chunk.title}</span>
              <strong>{chunk.scriptureReferences.join(", ") || "No passage tagged"}</strong>
            </summary>
            <p>{chunk.studentSummary || chunk.body}</p>
          </details>
        ))}
      </div>

      <details className="knowledge-source-edit">
        <summary>Curate source details</summary>
        <form
          className="knowledge-source-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onDetailsSave(source.id, event.currentTarget);
          }}
        >
          <label className="leader-review-field">
            <span>Title</span>
            <input className="input" defaultValue={source.title} name="editTitle" required />
          </label>

          <label className="leader-review-field">
            <span>Student-safe summary</span>
            <textarea defaultValue={source.summary} name="editSummary" required />
          </label>

          <div className="knowledge-source-field-grid">
            <label className="leader-review-field">
              <span>Topics</span>
              <input className="input" defaultValue={source.tags.join(", ")} name="editTags" placeholder="trust, suffering, prayer" />
            </label>

            <label className="leader-review-field">
              <span>Scripture</span>
              <input
                className="input"
                defaultValue={source.chunks[0]?.scriptureReferences.join(", ") ?? ""}
                name="editScriptureReferences"
                placeholder="Romans 8:18, Psalm 13"
              />
            </label>
          </div>

          <div className="knowledge-source-field-grid">
            <label className="leader-review-field">
              <span>Citation</span>
              <input className="input" defaultValue={source.citation} name="editCitation" placeholder="Author, title, page, or sermon date" />
            </label>

            <label className="leader-review-field">
              <span>Source link</span>
              <input className="input" defaultValue={source.sourceUri} name="editSourceUri" placeholder="https://..." />
            </label>
          </div>

          <button className="button" disabled={!canWrite || isUpdating} type="submit">
            {isUpdating ? "Saving..." : "Save Details"}
          </button>
        </form>
      </details>

      <div className="knowledge-source-actions">
        {visibilityActions.map((action) => (
          <button
            className={action.visibility === "student_visible" ? "button primary" : "button"}
            disabled={!canWrite || isUpdating || source.visibility === action.visibility}
            key={action.visibility}
            onClick={() => onVisibilityChange(source.id, action.visibility)}
            title={action.note}
            type="button"
          >
            {isUpdating ? "Updating..." : action.label}
          </button>
        ))}
      </div>
    </article>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="leader-review-meta-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildStats(sources: KnowledgeSourceControlItem[], fallbackChunkCount: number) {
  return {
    totalSources: sources.length,
    reviewSources: sources.filter((source) => source.visibility === "private_review").length,
    studentVisibleSources: sources.filter((source) => source.visibility === "student_visible").length,
    chunkCount: sources.length ? sources.reduce((total, source) => total + source.chunkCount, 0) : fallbackChunkCount
  };
}

function sourceLabel(source: KnowledgeSourceControlItem) {
  const side = source.hemisphere === "own_voice" ? "Own voice" : source.hemisphere === "scholar" ? "Scholar" : "Platform";
  return `${side} / ${source.sourceKind.replace(/_/g, " ")}`;
}

function visibilityClassName(visibility: KnowledgeVisibility) {
  if (visibility === "student_visible") return "pill green";
  if (visibility === "private_review") return "pill amber";
  if (visibility === "scholar_citation_only") return "pill blue";
  return "pill";
}

function visibilityLabel(visibility: KnowledgeVisibility) {
  if (visibility === "student_visible") return "Student visible";
  if (visibility === "private_review") return "Private review";
  if (visibility === "scholar_citation_only") return "Citation only";
  return "Leader only";
}
