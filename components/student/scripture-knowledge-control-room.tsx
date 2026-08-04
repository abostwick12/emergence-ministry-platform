"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useState } from "react";

import { buildDiscussionVideoScript, formatDiscussionVideoRenderPackageForCopy, formatDiscussionVideoScriptForCopy } from "@/lib/scripture/discussion-video";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import type { KnowledgeControlRoomState, KnowledgeSourceControlItem, KnowledgeVisibility } from "@/lib/scripture/knowledge-control-room";
import type { KnowledgeTestBenchResult } from "@/lib/scripture/knowledge-test-bench";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

type ScriptureKnowledgeControlRoomProps = {
  initialDiscussionState?: DiscussionWorkflowState;
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

type MeridianPromotionPayload = {
  legacyChunkId: string;
  sourceKind: "academic_paper" | "curriculum_material" | "sermon";
  rationale: string;
  source: {
    title: string;
    attribution?: string;
    authorityClass: "adopted_doctrine" | "approved_teaching" | "attributed_scholarship";
    externalVisibility: "ministry" | "external";
    quotePolicy: "never" | "review_required" | "allowed";
    sensitivity: "general" | "internal" | "safeguarding";
  };
  fragment: {
    text: string;
    locator: { kind: "record"; value: string };
    canQuote: boolean;
    canParaphrase: boolean;
    canCite: boolean;
    canUseFinalAnswer: true;
    canUseExternalCommunication: boolean;
  };
  claim: {
    proposition: string;
    kind: "doctrinal_position" | "teaching_history" | "scholarly_perspective" | "interpretation" | "recommendation";
    attribution?: string;
    authorityClass: "adopted_doctrine" | "approved_teaching" | "attributed_scholarship";
    confidence: number;
    scope: {
      sensitivity: Array<"general" | "internal" | "safeguarding">;
      scriptureReferences?: string[];
      topics?: string[];
    };
  };
};

type MeridianPromotionResponse = {
  ok?: boolean;
  error?: string;
  sourceId?: string;
  claimId?: string;
  sourceKind?: MeridianPromotionPayload["sourceKind"];
};

const visibilityActions: Array<{ visibility: KnowledgeVisibility; label: string; note: string }> = [
  { visibility: "student_visible", label: "Use for Matching", note: "Can inform follow-up, but publish student-facing helps below." },
  { visibility: "internal_grounding", label: "Internal Grounding", note: "Admin-only. Shapes theology, voice, questions, and journeys without student exposure." },
  { visibility: "leader_only", label: "Leader Only", note: "Usable for leader preparation, hidden from students." },
  { visibility: "scholar_citation_only", label: "Citation Only", note: "Kept as scholar context without student retrieval." },
  { visibility: "private_review", label: "Back to Review", note: "Held until a leader checks it again." }
];

const textImportExtensions = new Set(["txt", "md", "markdown", "csv", "json", "vtt", "srt"]);
const pasteOnlyExtensions = new Set(["pdf", "doc", "docx"]);

export function ScriptureKnowledgeControlRoom({ initialDiscussionState, initialState }: ScriptureKnowledgeControlRoomProps) {
  const [sources, setSources] = useState(initialState.sources);
  const [status, setStatus] = useState(initialState.readiness.message);
  const [importStatus, setImportStatus] = useState("Import text-based files directly, or paste extracted text from PDF and document reports.");
  const [selectedVideoPromptId, setSelectedVideoPromptId] = useState("");
  const [videoCopyStatus, setVideoCopyStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<KnowledgeTestBenchResult | null>(null);
  const [updatingId, setUpdatingId] = useState("");
  const [promotingId, setPromotingId] = useState("");
  const stats = useMemo(() => buildStats(sources, initialState.stats.chunkCount), [sources, initialState.stats.chunkCount]);
  const canWrite = initialState.readiness.liveStorage && !saving;
  const approvedPrompts = useMemo(
    () => (initialDiscussionState?.prompts ?? []).filter((prompt) => prompt.status === "approved" || prompt.status === "posted"),
    [initialDiscussionState?.prompts]
  );
  const selectedVideoPrompt = approvedPrompts.find((prompt) => prompt.id === selectedVideoPromptId) ?? approvedPrompts[0];
  const selectedVideoScript = selectedVideoPrompt ? buildDiscussionVideoScript(selectedVideoPrompt) : null;

  async function submitSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setStatus("Saving source for review...");

    try {
      const resourceFormat = String(form.get("resourceFormat") || "");
      const topicTags = String(form.get("tags") || "");
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
          tags: buildTagPayload(resourceFormat, topicTags),
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

  async function importResourceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const form = event.currentTarget.form;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const titleInput = form?.elements.namedItem("title") as HTMLInputElement | null;
    const sourceUriInput = form?.elements.namedItem("sourceUri") as HTMLInputElement | null;
    const citationInput = form?.elements.namedItem("citation") as HTMLInputElement | null;
    const contentInput = form?.elements.namedItem("content") as HTMLTextAreaElement | null;

    if (titleInput && !titleInput.value.trim()) titleInput.value = file.name.replace(/\.[^.]+$/, "");
    if (sourceUriInput && !sourceUriInput.value.trim()) sourceUriInput.value = `uploaded:${file.name}`;
    if (citationInput && !citationInput.value.trim()) citationInput.value = file.name;

    if (pasteOnlyExtensions.has(extension)) {
      setImportStatus("PDF and Word files are noted, but this launch build needs their text pasted below before saving.");
      return;
    }

    if (!textImportExtensions.has(extension)) {
      setImportStatus("This file type is not text-readable yet. Paste the useful transcript, notes, or report text below.");
      return;
    }

    try {
      const text = await file.text();
      if (contentInput) contentInput.value = cleanImportedText(text);
      setImportStatus(`${file.name} imported into the review form. Check the text before saving.`);
    } catch {
      setImportStatus("The file could not be read. Paste the useful text below instead.");
    }
  }

  async function copyVideoPackage(mode: "script" | "render") {
    if (!selectedVideoScript) return;
    const text = mode === "script" ? formatDiscussionVideoScriptForCopy(selectedVideoScript) : formatDiscussionVideoRenderPackageForCopy(selectedVideoScript);
    try {
      await navigator.clipboard.writeText(text);
      setVideoCopyStatus(mode === "script" ? "Video script copied." : "Render package copied.");
    } catch {
      setVideoCopyStatus("Copy was not available in this browser. Select the package text manually.");
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

      setSources((current) => current.map((source) => source.id === payload.source!.id
        ? { ...payload.source!, meridianReview: source.meridianReview }
        : source));
      setStatus(visibility === "student_visible" ? "Source can now inform matching. Publish student-facing helps below." : "Source visibility updated.");
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

      setSources((current) => current.map((source) => source.id === payload.source!.id
        ? { ...payload.source!, meridianReview: source.meridianReview }
        : source));
      setStatus("Source details saved. Rerun the Meridian test to check the updated retrieval path.");
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
        setStatus(payload.error ?? "The Meridian preview could not run.");
        return;
      }

      setTestResult(payload.result);
      setStatus("Preview ready. This did not save a student question or publish anything.");
    } catch {
      setStatus("The Meridian preview could not run.");
    } finally {
      setTesting(false);
    }
  }

  async function promoteMeridianClaim(sourceId: string, payload: MeridianPromotionPayload) {
    setPromotingId(sourceId);
    setStatus("Approving one grounded claim for Meridian...");
    try {
      const response = await fetch(`/api/meridian/knowledge/legacy-sources/${sourceId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as MeridianPromotionResponse;
      if (!response.ok || !result.ok || !result.sourceId || !result.claimId || !result.sourceKind) {
        setStatus(result.error ?? "The claim could not be approved for Meridian.");
        return;
      }

      setSources((current) => current.map((source) => source.id === sourceId
        ? {
            ...source,
            meridianReview: {
              ready: true,
              sourceId: result.sourceId,
              sourceKind: result.sourceKind,
              authorityClass: payload.source.authorityClass,
              externalVisibility: payload.source.externalVisibility,
              quotePolicy: payload.source.quotePolicy,
              sensitivity: payload.source.sensitivity,
              attribution: payload.source.attribution,
              approvedClaimCount: source.meridianReview.approvedClaimCount + 1
            }
          }
        : source));
      setStatus("Claim approved. Meridian search can now retrieve it with its exact supporting excerpt.");
    } catch {
      setStatus("The claim could not be approved for Meridian.");
    } finally {
      setPromotingId("");
    }
  }

  return (
    <section className="knowledge-control-room" aria-label="Knowledge source control room">
      <div className="knowledge-control-hero">
        <div>
          <p className="eyebrow">Resource Hub</p>
          <h1>Review the source library</h1>
          <p>Add trusted material, prepare group video packages, review extracted chunks, then publish student-facing helps separately.</p>
        </div>
        <div className="knowledge-control-stats" aria-label="Knowledge source counts">
          <StatTile label="Sources" value={stats.totalSources} />
          <StatTile label="In review" value={stats.reviewSources} />
          <StatTile label="Grounding" value={stats.internalGroundingSources} />
          <StatTile label="Student visible" value={stats.studentVisibleSources} />
          <StatTile label="Chunks" value={stats.chunkCount} />
        </div>
      </div>

      <p className="leader-review-status" aria-live="polite">
        {status}
      </p>

      <ResourceVideoPackagePanel
        copyStatus={videoCopyStatus}
        onCopy={copyVideoPackage}
        onSelectPrompt={setSelectedVideoPromptId}
        prompts={approvedPrompts}
        selectedPrompt={selectedVideoPrompt}
        script={selectedVideoScript}
        selectedPromptId={selectedVideoPrompt?.id ?? ""}
      />

      <div className="knowledge-test-bench">
        <form className="knowledge-test-form" onSubmit={runTestBench}>
          <div>
            <p className="eyebrow">Test bench</p>
            <h2>Test the Meridian before students receive guidance</h2>
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
            {testing ? "Testing..." : "Run Meridian Test"}
          </button>
        </form>

        <TestBenchPreview result={testResult} />
      </div>

      <div className="knowledge-control-grid">
        <form className="knowledge-source-form" onSubmit={submitSource}>
          <div>
            <p className="eyebrow">Add resource</p>
            <h2>Import into private review</h2>
          </div>

          <label className="knowledge-file-import">
            <span>Upload text resource</span>
            <input
              accept=".txt,.md,.markdown,.csv,.json,.vtt,.srt,.pdf,.doc,.docx"
              disabled={!canWrite}
              name="sourceFile"
              onChange={importResourceFile}
              type="file"
            />
            <small>{importStatus}</small>
          </label>

          <label className="leader-review-field">
            <span>Title</span>
            <input className="input" name="title" placeholder="NotebookLM report, podcast transcript, sermon notes, or study guide" required />
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
            <textarea name="content" placeholder="Paste the excerpt, NotebookLM report text, podcast transcript, sermon notes, or study guide material you want reviewed." required />
          </label>

          <label className="leader-review-field">
            <span>Student-safe summary</span>
            <textarea name="summary" placeholder="Optional. If blank, the app drafts a short summary from the source." />
          </label>

          <div className="knowledge-source-field-grid">
            <label className="leader-review-field">
              <span>Resource format</span>
              <select className="input" name="resourceFormat" defaultValue="study-guide">
                <option value="notebooklm-report">NotebookLM report</option>
                <option value="podcast-transcript">Podcast transcript</option>
                <option value="sermon-notes">Sermon notes</option>
                <option value="study-guide">Study guide</option>
                <option value="pdf-report-text">PDF/report text</option>
                <option value="lesson-plan">Lesson plan</option>
              </select>
            </label>

            <label className="leader-review-field">
              <span>Topics</span>
              <input className="input" name="tags" placeholder="trust, suffering, prayer" />
            </label>
          </div>

          <label className="leader-review-field">
            <span>Scripture</span>
            <input className="input" name="scriptureReferences" placeholder="Romans 8:18, Psalm 13" />
          </label>

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
                canPromoteMeridian={initialState.permissions.canPromoteMeridian}
                isUpdating={updatingId === source.id}
                isPromoting={promotingId === source.id}
                key={source.id}
                onDetailsSave={updateDetails}
                onMeridianPromote={promoteMeridianClaim}
                onVisibilityChange={updateVisibility}
                showInternalGroundingAction={initialState.permissions.canManageInternalGrounding}
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
      <aside className="knowledge-test-preview" aria-label="Meridian preview">
        <p className="eyebrow">Preview</p>
        <h3>Ready for a question</h3>
        <p>Run a test to see what sources are retrieved and what a student would be invited to explore next.</p>
      </aside>
    );
  }

  return (
    <aside className="knowledge-test-preview" aria-label="Meridian preview">
      <p className="eyebrow">Preview</p>
      <h3>{result.nextStep.label}</h3>
      <p>{result.nextStep.summary}</p>

      <div className="knowledge-test-section">
        <span>Gloo draft</span>
        {result.aiDraft.ok ? (
          <>
            <strong>{result.aiDraft.discussionPrompt}</strong>
            <p>
              {result.aiDraft.model} / {result.aiDraft.modelTier} / {Math.round(result.aiDraft.confidence * 100)}% confidence
            </p>
            <p>{result.aiDraft.safetyNotes}</p>
          </>
        ) : (
          <>
            <strong>{result.aiDraft.configured ? "Provider returned no usable draft" : "Provider not configured"}</strong>
            <p>{result.aiDraft.message}</p>
          </>
        )}
      </div>

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

function ResourceVideoPackagePanel({
  copyStatus,
  onCopy,
  onSelectPrompt,
  prompts,
  script,
  selectedPrompt,
  selectedPromptId
}: {
  copyStatus: string;
  onCopy: (mode: "script" | "render") => Promise<void>;
  onSelectPrompt: (promptId: string) => void;
  prompts: StudentDiscussionPrompt[];
  script: ReturnType<typeof buildDiscussionVideoScript> | null;
  selectedPrompt: StudentDiscussionPrompt | undefined;
  selectedPromptId: string;
}) {
  return (
    <section className="resource-video-workspace" aria-label="Discussion video packages">
      <div className="resource-video-heading">
        <div>
          <p className="eyebrow">Discussion Videos</p>
          <h2>Prepare a group video package</h2>
          <p>Select a leader-approved prompt, preview the vertical video scene plan, then copy a script or render-ready package.</p>
        </div>
        <span className={prompts.length ? "pill green" : "pill amber"}>{prompts.length ? `${prompts.length} ready` : "Approve a prompt first"}</span>
      </div>

      {prompts.length ? (
        <div className="resource-video-grid">
          <label className="leader-review-field">
            <span>Approved prompt</span>
            <select className="input" onChange={(event) => onSelectPrompt(event.target.value)} value={selectedPromptId}>
              {prompts.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.discussionPrompt || prompt.question}
                </option>
              ))}
            </select>
          </label>

          {script && selectedPrompt ? (
            <div className="resource-video-preview">
              <div className="resource-video-preview-title">
                <span>{selectedPrompt.scriptureReference || "Group discussion"}</span>
                <h3>{script.title}</h3>
                <p>{script.subtitle}</p>
              </div>

              <div className="leader-video-script-meta" aria-label="Video package format">
                <VideoMeta label="Length" value={`${script.totalDurationSeconds}s`} />
                <VideoMeta label="Format" value="1080x1920" />
                <VideoMeta label="Frames" value={`${script.totalDurationSeconds * script.remotion.fps}`} />
              </div>

              <div className="resource-video-scenes">
                {script.scenes.slice(0, 3).map((scene, index) => (
                  <article key={scene.id}>
                    <span>
                      Scene {index + 1} - {scene.eyebrow}
                    </span>
                    <strong>{scene.headline}</strong>
                    <p>{scene.body}</p>
                  </article>
                ))}
              </div>

              <div className="resource-video-actions">
                <button className="button" onClick={() => void onCopy("script")} type="button">
                  Copy script
                </button>
                <button className="button primary" onClick={() => void onCopy("render")} type="button">
                  Copy render package
                </button>
              </div>
              <p className="leader-video-script-status" role="status">
                {copyStatus || "Rendering is not connected yet. This package is ready for the Remotion renderer when that worker is added."}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="leader-review-empty">
          <strong>No approved prompts yet.</strong>
          <p>Approve a student question in Discussion Review, then it will appear here for video packaging.</p>
        </div>
      )}
    </section>
  );
}

function VideoMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="leader-review-meta-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SourceCard({
  canPromoteMeridian,
  canWrite,
  isPromoting,
  isUpdating,
  onDetailsSave,
  onMeridianPromote,
  onVisibilityChange,
  showInternalGroundingAction,
  source
}: {
  canPromoteMeridian: boolean;
  canWrite: boolean;
  isPromoting: boolean;
  isUpdating: boolean;
  onDetailsSave: (sourceId: string, form: HTMLFormElement) => Promise<void>;
  onMeridianPromote: (sourceId: string, payload: MeridianPromotionPayload) => Promise<void>;
  onVisibilityChange: (sourceId: string, visibility: KnowledgeVisibility) => Promise<void>;
  showInternalGroundingAction: boolean;
  source: KnowledgeSourceControlItem;
}) {
  const actions = visibilityActions.filter((action) => action.visibility !== "internal_grounding" || showInternalGroundingAction);

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
        {source.meridianReview.sourceKind ? (
          <span>Meridian: {source.meridianReview.sourceKind.replace(/_/g, " ")} / {source.meridianReview.approvedClaimCount} approved</span>
        ) : (
          <span>Meridian: not reviewed</span>
        )}
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

      {canPromoteMeridian && source.chunks.length ? (
        <MeridianPromotionForm
          disabled={!canWrite || isUpdating || isPromoting}
          isPromoting={isPromoting}
          onPromote={(payload) => onMeridianPromote(source.id, payload)}
          source={source}
        />
      ) : null}

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
        {actions.map((action) => (
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

function MeridianPromotionForm({
  disabled,
  isPromoting,
  onPromote,
  source
}: {
  disabled: boolean;
  isPromoting: boolean;
  onPromote: (payload: MeridianPromotionPayload) => Promise<void>;
  source: KnowledgeSourceControlItem;
}) {
  const [selectedChunkId, setSelectedChunkId] = useState(source.chunks[0]?.id ?? "");
  const selectedChunk = source.chunks.find((chunk) => chunk.id === selectedChunkId) ?? source.chunks[0];
  const existingReview = source.meridianReview.sourceId ? source.meridianReview : undefined;

  return (
    <details className="knowledge-source-edit">
      <summary>{existingReview ? "Approve another Meridian claim" : "Review for Meridian"}</summary>
      <form
        className="knowledge-source-edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!selectedChunk) return;
          const form = new FormData(event.currentTarget);
          const sourceKind = String(form.get("meridianSourceKind")) as MeridianPromotionPayload["sourceKind"];
          const authorityClass = String(form.get("meridianAuthority")) as MeridianPromotionPayload["source"]["authorityClass"];
          const claimKind = String(form.get("meridianClaimKind")) as MeridianPromotionPayload["claim"]["kind"];
          const sensitivity = String(form.get("meridianSensitivity")) as MeridianPromotionPayload["source"]["sensitivity"];
          const attribution = String(form.get("meridianAttribution") || "").trim() || undefined;
          const canQuote = form.get("meridianCanQuote") === "on";
          const canUseExternalCommunication = form.get("meridianCanUseExternal") === "on";

          void onPromote({
            legacyChunkId: selectedChunk.id,
            sourceKind,
            rationale: String(form.get("meridianRationale") || ""),
            source: {
              title: source.title,
              attribution,
              authorityClass: existingReview?.authorityClass ?? authorityClass,
              externalVisibility: existingReview?.externalVisibility ?? (canUseExternalCommunication ? "external" : "ministry"),
              quotePolicy: existingReview?.quotePolicy ?? (canQuote ? "allowed" : "review_required"),
              sensitivity: existingReview?.sensitivity ?? sensitivity
            },
            fragment: {
              text: String(form.get("meridianExcerpt") || ""),
              locator: { kind: "record", value: `Legacy chunk ${selectedChunk.chunkIndex + 1}` },
              canQuote,
              canParaphrase: form.get("meridianCanParaphrase") === "on",
              canCite: form.get("meridianCanCite") === "on",
              canUseFinalAnswer: true,
              canUseExternalCommunication
            },
            claim: {
              proposition: String(form.get("meridianClaim") || ""),
              kind: claimKind,
              attribution,
              authorityClass,
              confidence: Number(form.get("meridianConfidence") || 0.9),
              scope: {
                sensitivity: [sensitivity],
                scriptureReferences: selectedChunk.scriptureReferences.length ? selectedChunk.scriptureReferences : undefined,
                topics: source.tags.length ? source.tags : undefined
              }
            }
          });
        }}
      >
        <div>
          <p className="eyebrow">Governed knowledge</p>
          <strong>Approve one claim, not the whole document.</strong>
          <p className="muted">Choose its role, state one atomic claim, and confirm the exact words that support it. Obsidian notes never enter this workflow.</p>
        </div>

        <div className="knowledge-source-field-grid">
          <label className="leader-review-field">
            <span>Material type</span>
            {existingReview?.sourceKind ? (
              <>
                <input name="meridianSourceKind" type="hidden" value={existingReview.sourceKind} />
                <input className="input" disabled value={sourceKindLabel(existingReview.sourceKind)} />
              </>
            ) : (
              <select className="input" defaultValue="" name="meridianSourceKind" required>
                <option disabled value="">Choose the material type</option>
                <option value="academic_paper">Academic paper</option>
                <option value="curriculum_material">Curriculum material</option>
                <option value="sermon">Sermon / teaching history</option>
              </select>
            )}
          </label>

          <label className="leader-review-field">
            <span>Authority</span>
            <select className="input" defaultValue={existingReview?.authorityClass ?? "approved_teaching"} name="meridianAuthority" required>
              <option value="approved_teaching">Approved teaching</option>
              <option value="attributed_scholarship">Attributed scholarship</option>
              <option value="adopted_doctrine">Adopted church doctrine</option>
            </select>
          </label>
        </div>

        <div className="knowledge-source-field-grid">
          <label className="leader-review-field">
            <span>Claim type</span>
            <select className="input" defaultValue="interpretation" name="meridianClaimKind" required>
              <option value="interpretation">Theological interpretation</option>
              <option value="teaching_history">Teaching history</option>
              <option value="scholarly_perspective">Scholarly perspective</option>
              <option value="doctrinal_position">Doctrinal position</option>
              <option value="recommendation">Ministry recommendation</option>
            </select>
          </label>

          <label className="leader-review-field">
            <span>Confidence</span>
            <select className="input" defaultValue="0.9" name="meridianConfidence">
              <option value="1">Settled / explicit</option>
              <option value="0.9">Strongly supported</option>
              <option value="0.75">Qualified / contextual</option>
            </select>
          </label>
        </div>

        <label className="leader-review-field">
          <span>Atomic claim</span>
          <textarea name="meridianClaim" placeholder="State one proposition Meridian may rely on. Include nuance or limits in the claim itself." required />
        </label>

        <label className="leader-review-field">
          <span>Attribution</span>
          <input
            className="input"
            defaultValue={existingReview?.attribution ?? source.citation}
            name="meridianAttribution"
            placeholder="Author, course, curriculum, or sermon date"
          />
        </label>

        <label className="leader-review-field">
          <span>Supporting source section</span>
          <select className="input" onChange={(event) => setSelectedChunkId(event.target.value)} value={selectedChunkId}>
            {source.chunks.map((chunk) => (
              <option key={chunk.id} value={chunk.id}>Section {chunk.chunkIndex + 1}: {chunk.title}</option>
            ))}
          </select>
        </label>

        <label className="leader-review-field">
          <span>Exact supporting excerpt</span>
          <textarea defaultValue={selectedChunk?.body ?? ""} key={selectedChunkId} name="meridianExcerpt" required />
          <small>This must remain an exact, unedited portion of the selected section.</small>
        </label>

        <div className="knowledge-source-field-grid">
          <label className="leader-review-field">
            <span>Sensitivity</span>
            <select className="input" defaultValue={existingReview?.sensitivity ?? "internal"} name="meridianSensitivity">
              <option value="internal">Internal ministry</option>
              <option value="general">General</option>
              <option value="safeguarding">Safeguarding</option>
            </select>
          </label>
          <label className="leader-review-field">
            <span>Review rationale</span>
            <input className="input" name="meridianRationale" placeholder="Why this claim is reliable and appropriately scoped" required />
          </label>
        </div>

        <div className="knowledge-source-tags" aria-label="Meridian use permissions">
          <label><input defaultChecked name="meridianCanParaphrase" type="checkbox" /> Allow paraphrase</label>
          <label><input defaultChecked name="meridianCanCite" type="checkbox" /> Allow citation</label>
          <label><input name="meridianCanQuote" type="checkbox" /> Allow direct quotation</label>
          <label><input name="meridianCanUseExternal" type="checkbox" /> Allow external communication</label>
          <span>Final-answer use: explicitly approved by this action</span>
        </div>

        <button className="button primary" disabled={disabled} type="submit">
          {isPromoting ? "Approving claim..." : "Approve Claim for Meridian"}
        </button>
      </form>
    </details>
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
    internalGroundingSources: sources.filter((source) => source.visibility === "internal_grounding").length,
    studentVisibleSources: sources.filter((source) => source.visibility === "student_visible").length,
    chunkCount: sources.length ? sources.reduce((total, source) => total + source.chunkCount, 0) : fallbackChunkCount
  };
}

function sourceLabel(source: KnowledgeSourceControlItem) {
  const side = source.hemisphere === "own_voice" ? "Own voice" : source.hemisphere === "scholar" ? "Scholar" : "Platform";
  return `${side} / ${source.sourceKind.replace(/_/g, " ")}`;
}

function sourceKindLabel(sourceKind: MeridianPromotionPayload["sourceKind"]) {
  if (sourceKind === "academic_paper") return "Academic paper";
  if (sourceKind === "curriculum_material") return "Curriculum material";
  return "Sermon / teaching history";
}

function visibilityClassName(visibility: KnowledgeVisibility) {
  if (visibility === "student_visible") return "pill green";
  if (visibility === "internal_grounding") return "pill blue";
  if (visibility === "private_review") return "pill amber";
  if (visibility === "scholar_citation_only") return "pill blue";
  return "pill";
}

function visibilityLabel(visibility: KnowledgeVisibility) {
  if (visibility === "student_visible") return "Student visible";
  if (visibility === "internal_grounding") return "Internal grounding";
  if (visibility === "private_review") return "Private review";
  if (visibility === "scholar_citation_only") return "Citation only";
  return "Leader only";
}

function cleanImportedText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function buildTagPayload(resourceFormat: string, topicTags: string) {
  return [resourceFormat, ...topicTags.split(/[\n,]/)].map((tag) => tag.trim()).filter(Boolean);
}
