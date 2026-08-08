"use client";

import {
  Archive,
  Check,
  ChevronRight,
  Clipboard,
  Download,
  Film,
  History,
  MessageCircleMore,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  ThumbsUp
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  approveContentFeedbackBatchAction,
  rollbackContentGuideAction,
  submitContentFeedbackAction,
  type ContentStudioActionResult
} from "@/app/(app)/content-studio/actions";
import { ResourceAttachments } from "@/components/resource-attachments";
import {
  contentPlatforms,
  type ContentDraft,
  type ContentGuide,
  type ContentGuideKind,
  type ContentPlatform,
  type ContentStudioWorkspace
} from "@/lib/meridian/content-studio/types";

const platformLabels: Record<ContentPlatform, string> = {
  twitter: "Twitter / X",
  facebook: "Facebook",
  instagram: "Instagram",
  church_slide: "Church Slide",
  linkedin: "LinkedIn",
  groupme: "GroupMe"
};

const guideKindLabels: Record<ContentGuideKind, string> = {
  voice: "Voice",
  visual: "Visual",
  platform: "Platform",
  interviewer: "Interviewer"
};

export function ContentStudioPage({ workspace }: { workspace: ContentStudioWorkspace }) {
  const router = useRouter();
  const [selectedDraftId, setSelectedDraftId] = useState(workspace.drafts[0]?.id ?? "");
  const [platformFilter, setPlatformFilter] = useState<ContentPlatform | "all">("all");
  const [starterOpen, setStarterOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [starterPlatforms, setStarterPlatforms] = useState<ContentPlatform[]>(["instagram"]);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSentiment, setFeedbackSentiment] = useState<"positive" | "correction">("positive");
  const [guideTarget, setGuideTarget] = useState<"voice" | "visual" | "platform">("voice");
  const [actionMessage, setActionMessage] = useState("");
  const [starterMessage, setStarterMessage] = useState("");
  const [guideFilter, setGuideFilter] = useState<ContentGuideKind | "all">("all");
  const [rollbackGuideId, setRollbackGuideId] = useState<string | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");
  const [pending, startTransition] = useTransition();

  const sessionsById = useMemo(() => new Map(workspace.sessions.map((session) => [session.id, session])), [workspace.sessions]);
  const filteredDrafts = workspace.drafts.filter((draft) => platformFilter === "all" || draft.platform === platformFilter);
  const selectedDraft = filteredDrafts.find((draft) => draft.id === selectedDraftId) ?? filteredDrafts[0] ?? workspace.drafts[0];
  const feedbackForDraft = workspace.feedback.filter((item) => item.draftId === selectedDraft?.id);
  const visibleGuides = workspace.guides.filter((guide) => guideFilter === "all" || guide.kind === guideFilter);
  const unbatchedFeedbackCount = workspace.feedback.filter((item) => !item.batchId).length;
  const pendingBatches = workspace.batches.filter((batch) => batch.status === "pending");

  function toggleStarterPlatform(platform: ContentPlatform) {
    setStarterPlatforms((current) => current.includes(platform)
      ? current.length === 1 ? current : current.filter((item) => item !== platform)
      : [...current, platform]);
  }

  async function copyStarter(mode: "guided" | "skipped") {
    if (!topic.trim()) {
      setStarterMessage("Add the topic you want to create content about.");
      return;
    }
    const selected = starterPlatforms.map((platform) => platformLabels[platform]).join(", ");
    const prompt = mode === "guided"
      ? `Use the Lead Emergence Meridian MCP to start a guided content interview about: ${topic.trim()}. Target platforms: ${selected}. Ask one dynamic question at a time from the active interviewer playbook, then generate and save platform-specific drafts only.`
      : `Use the Lead Emergence Meridian MCP to skip the interview and create content about: ${topic.trim()}. Target platforms: ${selected}. Apply the active voice, visual, and platform guides, then save platform-specific drafts only.`;
    const copied = await copyText(prompt);
    setStarterMessage(copied
      ? `${mode === "guided" ? "Guided" : "Skip-interview"} starter copied. Paste it into Codex or Claude with Meridian connected.`
      : "Copy was blocked by the browser. Select and copy the starter text manually.");
  }

  function submitFeedback() {
    if (!selectedDraft) return;
    runAction(() => submitContentFeedbackAction({
      draftId: selectedDraft.id,
      feedbackText,
      guideTarget,
      sentiment: feedbackSentiment
    }), (result) => {
      if (result.ok) setFeedbackText("");
    });
  }

  function runAction(action: () => Promise<ContentStudioActionResult>, after?: (result: ContentStudioActionResult) => void) {
    setActionMessage("");
    startTransition(async () => {
      const result = await action();
      setActionMessage(result.message);
      after?.(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <main className="content-studio-page">
      <section className="content-studio-hero">
        <div className="content-studio-hero-copy">
          <p className="eyebrow">Meridian Content Studio</p>
          <h2>Turn ministry insight into content worth keeping.</h2>
          <p>Interview in Codex or Claude. Review every platform draft, rendered asset, and learning decision here.</p>
          <div className="content-studio-trust-row" aria-label="Content safeguards">
            <span><ShieldCheck aria-hidden="true" /> Drafts only</span>
            <span><History aria-hidden="true" /> Versioned guides</span>
            <span><Check aria-hidden="true" /> Human approval</span>
          </div>
        </div>
        <div className="content-studio-hero-actions">
          <span className="content-studio-source-badge">{workspace.source === "preview" ? "Preview workspace" : "Live Meridian workspace"}</span>
          <button className="button primary" type="button" onClick={() => setStarterOpen((current) => !current)}>
            <Sparkles aria-hidden="true" />
            {starterOpen ? "Close creator" : "Start new content"}
          </button>
        </div>
      </section>

      {starterOpen ? (
        <section className="panel content-studio-starter" aria-labelledby="content-starter-title">
          <div className="content-studio-section-heading">
            <div>
              <p className="eyebrow">Codex + Claude handoff</p>
              <h3 id="content-starter-title">Choose how much conversation you want first.</h3>
            </div>
            <span className="pill">Nothing publishes from here</span>
          </div>
          <label className="field">
            <span>What do you want to create content about?</span>
            <textarea className="input" rows={3} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Example: Celebrate our students at MOTION while connecting the experience to everyday discipleship." />
          </label>
          <fieldset className="content-studio-platform-picker">
            <legend>Target platforms</legend>
            <div>
              {contentPlatforms.map((platform) => (
                <label key={platform} className={starterPlatforms.includes(platform) ? "content-studio-platform-option active" : "content-studio-platform-option"}>
                  <input type="checkbox" checked={starterPlatforms.includes(platform)} onChange={() => toggleStarterPlatform(platform)} />
                  {platformLabels[platform]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="content-studio-start-paths">
            <button type="button" onClick={() => void copyStarter("guided")}>
              <MessageCircleMore aria-hidden="true" />
              <span><strong>Start guided interview</strong><small>Meridian chooses each next question from your answers and stops at its defined limit.</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
            <button type="button" onClick={() => void copyStarter("skipped")}>
              <Sparkles aria-hidden="true" />
              <span><strong>Skip interview</strong><small>Go straight to platform-specific drafts using the topic and active guides.</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
          {starterMessage ? <p className="content-studio-form-message" role="status">{starterMessage}</p> : null}
        </section>
      ) : null}

      <section className="content-studio-metrics" aria-label="Content Studio summary">
        <article><span>Drafts</span><strong>{workspace.drafts.length}</strong><small>Never auto-published</small></article>
        <article><span>Feedback</span><strong>{workspace.feedback.length}</strong><small>{unbatchedFeedbackCount} awaiting a batch</small></article>
        <article><span>Pending reviews</span><strong>{pendingBatches.length}</strong><small>Approval required</small></article>
        <article><span>Guide versions</span><strong>{workspace.guides.length}</strong><small>Full history retained</small></article>
      </section>

      <section className="content-studio-workspace">
        <aside className="panel content-studio-draft-rail" aria-label="Content drafts">
          <div className="content-studio-section-heading compact">
            <div><p className="eyebrow">Draft library</p><h3>Recent content</h3></div>
            <span className="pill">{filteredDrafts.length}</span>
          </div>
          <label className="field content-studio-filter">
            <span>Platform</span>
            <select className="input" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value as ContentPlatform | "all")}>
              <option value="all">All platforms</option>
              {contentPlatforms.map((platform) => <option value={platform} key={platform}>{platformLabels[platform]}</option>)}
            </select>
          </label>
          <div className="content-studio-draft-list">
            {filteredDrafts.map((draft) => {
              const session = sessionsById.get(draft.sessionId);
              const active = selectedDraft?.id === draft.id;
              return (
                <button className={active ? "content-studio-draft-card active" : "content-studio-draft-card"} type="button" key={draft.id} onClick={() => setSelectedDraftId(draft.id)}>
                  <span className={`content-platform-badge platform-${draft.platform}`}>{platformLabels[draft.platform]}</span>
                  <strong>{session?.topic ?? "Untitled content"}</strong>
                  <small>{formatDate(draft.createdAt)} · {workspace.feedback.filter((item) => item.draftId === draft.id).length} feedback</small>
                </button>
              );
            })}
            {!filteredDrafts.length ? <p className="content-studio-empty">No drafts match this platform yet.</p> : null}
          </div>
        </aside>

        <div className="content-studio-review-column">
          {selectedDraft ? (
            <>
              <DraftReview draft={selectedDraft} topic={sessionsById.get(selectedDraft.sessionId)?.topic} />
              <ResourceAttachments compact inlineMedia parentId={selectedDraft.id} parentType="content_draft" title="Rendered assets" />
              <section className="panel content-studio-feedback-panel">
                <div className="content-studio-section-heading compact">
                  <div><p className="eyebrow">Teach Meridian carefully</p><h3>Feedback on this draft</h3></div>
                  <span className="pill">{feedbackForDraft.length} logged</span>
                </div>
                <p className="content-studio-policy-callout"><ShieldCheck aria-hidden="true" /> Feedback is evidence only. It cannot silently rewrite the active style guide.</p>
                <div className="content-studio-feedback-controls">
                  <div className="segmented-control" role="group" aria-label="Feedback type">
                    <button className={feedbackSentiment === "positive" ? "button compact-button active" : "button compact-button"} type="button" onClick={() => setFeedbackSentiment("positive")}><ThumbsUp aria-hidden="true" /> Keep doing this</button>
                    <button className={feedbackSentiment === "correction" ? "button compact-button active" : "button compact-button"} type="button" onClick={() => setFeedbackSentiment("correction")}><MessageCircleMore aria-hidden="true" /> Change this</button>
                  </div>
                  <label className="field">
                    <span>What should this feedback influence?</span>
                    <select className="input" value={guideTarget} onChange={(event) => setGuideTarget(event.target.value as typeof guideTarget)}>
                      <option value="voice">Voice and writing style</option>
                      <option value="visual">Visual direction</option>
                      <option value="platform">{platformLabels[selectedDraft.platform]} design guide</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Your feedback</span>
                    <textarea className="input" rows={4} value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Be specific about what worked or what should change." />
                  </label>
                  <button className="button primary" type="button" disabled={pending} onClick={submitFeedback}>Log feedback for batch review</button>
                </div>
                {feedbackForDraft.length ? (
                  <div className="content-studio-feedback-history">
                    {feedbackForDraft.map((item) => (
                      <article key={item.id}>
                        <span className={item.sentiment === "positive" ? "pill green" : "pill amber"}>{item.sentiment === "positive" ? "Keep" : "Correct"}</span>
                        <p>{item.feedbackText}</p>
                        <small>{guideKindLabels[item.guideTarget]} guide · {item.batchId ? "In review batch" : "Awaiting batch"}</small>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            </>
          ) : <section className="panel content-studio-empty">Generate a draft through Codex or Claude to begin reviewing it here.</section>}
        </div>

        <aside className="content-studio-learning-column">
          <section className="panel content-studio-batches">
            <div className="content-studio-section-heading compact">
              <div><p className="eyebrow">Learning review</p><h3>Feedback batches</h3></div>
              <span className="pill">{workspace.batches.length}</span>
            </div>
            {workspace.batches.map((batch) => (
              <article key={batch.id} className="content-studio-batch-card">
                <div><span className={batch.status === "pending" ? "pill amber" : "pill green"}>{batch.status}</span><small>{batch.feedbackIds.length} drafts reviewed</small></div>
                {batch.changes.map((change, index) => <p key={`${batch.id}-${index}`}>{change.changeSummary}</p>)}
                {batch.status === "pending" && workspace.accessLevel === "admin" ? (
                  <button className="button compact-button" type="button" disabled={pending} onClick={() => runAction(() => approveContentFeedbackBatchAction(batch.id))}>Approve new guide versions</button>
                ) : null}
              </article>
            ))}
            {!workspace.batches.length ? <p className="content-studio-empty">Three drafts with feedback are required before Meridian can propose a learning batch.</p> : null}
          </section>

          <section className="panel content-studio-guide-history">
            <div className="content-studio-section-heading compact">
              <div><p className="eyebrow">Meridian history</p><h3>Style guide versions</h3></div>
              <History aria-hidden="true" />
            </div>
            <label className="field content-studio-filter">
              <span>Guide</span>
              <select className="input" value={guideFilter} onChange={(event) => setGuideFilter(event.target.value as ContentGuideKind | "all")}>
                <option value="all">All guides</option>
                <option value="voice">Voice</option>
                <option value="visual">Visual</option>
                <option value="platform">Platform</option>
                <option value="interviewer">Interviewer</option>
              </select>
            </label>
            <div className="content-studio-guide-list">
              {visibleGuides.map((guide) => (
                <GuideVersion
                  guide={guide}
                  isAdmin={workspace.accessLevel === "admin"}
                  key={guide.id}
                  pending={pending}
                  reason={rollbackGuideId === guide.id ? rollbackReason : ""}
                  rollbackOpen={rollbackGuideId === guide.id}
                  onReasonChange={setRollbackReason}
                  onToggleRollback={() => {
                    setRollbackGuideId((current) => current === guide.id ? null : guide.id);
                    setRollbackReason("");
                  }}
                  onRollback={() => runAction(() => rollbackContentGuideAction({ reason: rollbackReason, targetVersionId: guide.id }))}
                />
              ))}
            </div>
          </section>
        </aside>
      </section>

      {actionMessage ? <div className="content-studio-toast" role="status">{actionMessage}</div> : null}
    </main>
  );
}

function DraftReview({ draft, topic }: { draft: ContentDraft; topic?: string }) {
  const [copyMessage, setCopyMessage] = useState("");

  async function copyDraft() {
    setCopyMessage(await copyText(draft.bodyMarkdown) ? "Draft copied." : "Copy was blocked by the browser.");
  }

  function downloadDraft() {
    const blob = new Blob([draft.bodyMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${draft.platform}-${slugify(topic ?? "content-draft")}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setCopyMessage("Draft downloaded for manual use.");
  }

  return (
    <article className="panel content-studio-draft-review">
      <header>
        <div>
          <span className={`content-platform-badge platform-${draft.platform}`}>{platformLabels[draft.platform]}</span>
          <h3>{topic ?? "Content draft"}</h3>
          <p>Created {formatDate(draft.createdAt)} · Draft only</p>
        </div>
        <div className="content-studio-draft-actions">
          <button className="button compact-button" type="button" onClick={() => void copyDraft()}><Clipboard aria-hidden="true" /> Copy</button>
          <button className="button compact-button" type="button" onClick={downloadDraft}><Download aria-hidden="true" /> Download</button>
        </div>
      </header>
      <div className="content-studio-copy-preview">{draft.bodyMarkdown}</div>
      <div className="content-studio-design-spec">
        <div><span>Canvas</span><strong>{draft.design.aspectRatio ?? "Not specified"}</strong></div>
        <div><span>Overlay</span><strong>{draft.design.overlayText ?? "No overlay"}</strong></div>
        <div className="wide"><span>Visual direction</span><p>{draft.design.visualDirection ?? "Not specified"}</p></div>
        <div className="wide"><span>Accessibility</span><p>{draft.design.accessibilityText ?? "Not specified"}</p></div>
      </div>
      <footer>
        <span><Film aria-hidden="true" /> Platform-specific design attached</span>
        <span><Archive aria-hidden="true" /> No publish, send, or schedule action exists</span>
        {copyMessage ? <small role="status">{copyMessage}</small> : null}
      </footer>
    </article>
  );
}

function GuideVersion({
  guide,
  isAdmin,
  onReasonChange,
  onRollback,
  onToggleRollback,
  pending,
  reason,
  rollbackOpen
}: {
  guide: ContentGuide;
  isAdmin: boolean;
  onReasonChange: (value: string) => void;
  onRollback: () => void;
  onToggleRollback: () => void;
  pending: boolean;
  reason: string;
  rollbackOpen: boolean;
}) {
  return (
    <article className="content-studio-guide-version">
      <div>
        <span className={guide.status === "active" ? "pill green" : "pill"}>{guide.status}</span>
        <small>v{guide.version}</small>
      </div>
      <strong>{guide.platform ? platformLabels[guide.platform] : guideKindLabels[guide.kind]}</strong>
      <p>{guide.changeSummary}</p>
      <small>{formatDate(guide.activatedAt)}</small>
      {isAdmin && guide.status === "retired" ? (
        <>
          <button className="button compact-button" type="button" onClick={onToggleRollback}><RotateCcw aria-hidden="true" /> {rollbackOpen ? "Cancel rollback" : "Restore this version"}</button>
          {rollbackOpen ? (
            <div className="content-studio-rollback-form">
              <label className="field"><span>Reason</span><textarea className="input" rows={3} value={reason} onChange={(event) => onReasonChange(event.target.value)} /></label>
              <button className="button compact-button primary" type="button" disabled={pending} onClick={onRollback}>Create restored version</button>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "content-draft";
}
