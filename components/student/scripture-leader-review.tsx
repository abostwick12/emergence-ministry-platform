"use client";

import { useEffect, useMemo, useState } from "react";

import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import type { StudentDiscussionPrompt, StudentDiscussionStatus } from "@/lib/scripture/types";

type ScriptureLeaderReviewProps = {
  initialState: DiscussionWorkflowState;
};

type ReviewAction = "approve" | "request_changes" | "archive" | "post" | "regenerate";

type DecisionResponse = {
  ok?: boolean;
  error?: string;
  prompt?: StudentDiscussionPrompt;
};

type ReviewTab = {
  id: "needs_review" | "approved" | "changes" | "posted" | "archived" | "all";
  label: string;
  matches: (prompt: StudentDiscussionPrompt) => boolean;
};

const reviewTabs: ReviewTab[] = [
  { id: "needs_review", label: "Needs review", matches: (prompt) => prompt.status === "pending_review" },
  { id: "approved", label: "Ready to share", matches: (prompt) => prompt.status === "approved" },
  { id: "changes", label: "Needs changes", matches: (prompt) => prompt.status === "changes_requested" },
  { id: "posted", label: "Shared", matches: (prompt) => prompt.status === "posted" },
  { id: "archived", label: "Archived", matches: (prompt) => prompt.status === "archived" },
  { id: "all", label: "All", matches: () => true }
];

export function ScriptureLeaderReview({ initialState }: ScriptureLeaderReviewProps) {
  const [prompts, setPrompts] = useState(initialState.prompts);
  const [activeTab, setActiveTab] = useState<ReviewTab["id"]>("needs_review");
  const [selectedId, setSelectedId] = useState(initialState.prompts[0]?.id ?? "");
  const [savingAction, setSavingAction] = useState<ReviewAction | "">("");
  const [status, setStatus] = useState(initialState.readiness.liveStorage ? "Review student questions before anything is shared." : "Live storage is not ready for review.");

  const activeTabConfig = reviewTabs.find((tab) => tab.id === activeTab) ?? reviewTabs[0];
  const filteredPrompts = useMemo(() => prompts.filter(activeTabConfig.matches), [activeTabConfig, prompts]);
  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedId) ?? filteredPrompts[0] ?? prompts[0];
  const visibleSelectedId = selectedPrompt?.id ?? "";
  const stats = useMemo(() => buildReviewStats(prompts), [prompts]);

  useEffect(() => {
    if (!filteredPrompts.length) return;
    if (!filteredPrompts.some((prompt) => prompt.id === visibleSelectedId)) {
      setSelectedId(filteredPrompts[0].id);
    }
  }, [filteredPrompts, visibleSelectedId]);

  async function decidePrompt(id: string, action: ReviewAction, leaderNotes: string, discussionPrompt: string) {
    setSavingAction(action);
    setStatus(statusForSaving(action));
    try {
      const response = await fetch(`/api/student/scripture/discussion/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, leaderNotes, discussionPrompt })
      });
      const payload = (await response.json()) as DecisionResponse;
      if (!response.ok || !payload.ok || !payload.prompt) {
        setStatus(payload.error ?? "Leader decision could not be saved.");
        return;
      }

      setPrompts((current) => current.map((prompt) => (prompt.id === payload.prompt!.id ? payload.prompt! : prompt)));
      setSelectedId(payload.prompt.id);
      setStatus(statusForSaved(action));
    } catch {
      setStatus("Leader decision could not be saved.");
    } finally {
      setSavingAction("");
    }
  }

  return (
    <div className="leader-workspace">
      <section className="leader-workspace-hero">
        <div>
          <p className="eyebrow">Leader Workspace</p>
          <h1>Discussion Review</h1>
          <p>Turn real student questions into careful, leader-approved conversations.</p>
        </div>
        <div className="leader-workspace-stats" aria-label="Review counts">
          <StatBadge label="Needs review" value={stats.pending} tone="blue" />
          <StatBadge label="Ready" value={stats.approved} tone="green" />
          <StatBadge label="Care" value={stats.care} tone="amber" />
        </div>
      </section>

      <p className="leader-review-status" role="status">
        {status}
      </p>

      <div className="leader-workspace-grid">
        <aside className="leader-review-queue" aria-label="Discussion review queue">
          <div className="leader-review-tabs" role="tablist" aria-label="Review filters">
            {reviewTabs.map((tab) => (
              <button
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? "leader-review-tab active" : "leader-review-tab"}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                <span>{tab.label}</span>
                <strong>{prompts.filter(tab.matches).length}</strong>
              </button>
            ))}
          </div>

          {filteredPrompts.length ? (
            <div className="leader-review-queue-list">
              {filteredPrompts.map((prompt) => (
                <button
                  className={prompt.id === visibleSelectedId ? "leader-review-queue-item active" : "leader-review-queue-item"}
                  key={prompt.id}
                  onClick={() => setSelectedId(prompt.id)}
                  type="button"
                >
                  <span>{prompt.scriptureReference || "No passage selected"}</span>
                  <strong>{prompt.question}</strong>
                  <small>{prompt.submittedByName}</small>
                  <ReviewPill status={prompt.status} />
                </button>
              ))}
            </div>
          ) : prompts.length ? (
            <div className="leader-review-empty">
              <strong>No questions here.</strong>
              <p>{emptyText(activeTab)}</p>
            </div>
          ) : null}
        </aside>

        {selectedPrompt ? (
          <LeaderReviewDetail
            key={selectedPrompt.id}
            glooReady={initialState.readiness.gloo}
            liveStorageReady={initialState.readiness.liveStorage}
            onDecide={decidePrompt}
            prompt={selectedPrompt}
            savingAction={savingAction}
          />
        ) : (
          <section className="leader-review-detail leader-review-empty">
            <strong>No real submissions yet.</strong>
            <p>When students ask questions, leaders will review, shape, and approve them here.</p>
          </section>
        )}
      </div>
    </div>
  );
}

function LeaderReviewDetail({
  glooReady,
  liveStorageReady,
  onDecide,
  prompt,
  savingAction
}: {
  glooReady: boolean;
  liveStorageReady: boolean;
  onDecide: (id: string, action: ReviewAction, leaderNotes: string, discussionPrompt: string) => Promise<void>;
  prompt: StudentDiscussionPrompt;
  savingAction: ReviewAction | "";
}) {
  const [leaderNotes, setLeaderNotes] = useState(prompt.leaderNotes);
  const [discussionPrompt, setDiscussionPrompt] = useState(prompt.discussionPrompt);
  const aiDraft = guidanceText(prompt);
  const canSave = liveStorageReady && !savingAction;
  const canApprove = canSave && discussionPrompt.trim().length > 0 && prompt.status !== "posted";
  const canPost = canSave && prompt.status === "approved";
  const canRegenerate = canSave && glooReady && prompt.status !== "posted";

  useEffect(() => {
    setLeaderNotes(prompt.leaderNotes);
    setDiscussionPrompt(prompt.discussionPrompt);
  }, [prompt]);

  return (
    <article className="leader-review-detail" aria-label="Selected discussion review">
      <header className="leader-review-detail-header">
        <div>
          <span>{prompt.scriptureReference || "No passage selected"}</span>
          <h2>{prompt.question}</h2>
          <p>Submitted by {prompt.submittedByName}</p>
        </div>
        <ReviewPill status={prompt.status} />
      </header>

      <div className="leader-review-meta-grid" aria-label="Review signals">
        <MetaTile label="AI status" value={aiStatusLabel(prompt)} />
        <MetaTile label="Model" value={prompt.aiModel || "Not selected"} />
        <MetaTile label="Confidence" value={prompt.aiConfidence == null ? "Not scored" : `${Math.round(prompt.aiConfidence * 100)}%`} />
        <MetaTile label="Care signal" value={careText(prompt) || "Standard review"} />
      </div>

      <section className="leader-review-guidance" aria-label="AI draft and care notes">
        <div>
          <p className="eyebrow">AI draft</p>
          <p>{aiDraft}</p>
        </div>
        <div className="leader-review-guidance-actions">
          <button className="button" disabled={!aiDraft || !canSave} onClick={() => setDiscussionPrompt(aiDraft)} type="button">
            Use draft
          </button>
          <button className="button" disabled={!canRegenerate} onClick={() => onDecide(prompt.id, "regenerate", leaderNotes, discussionPrompt)} type="button">
            {savingAction === "regenerate" ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </section>

      {prompt.safetyNotes || prompt.escalationReason ? (
        <section className="leader-review-care" aria-label="Leader care notes">
          <p className="eyebrow">Leader care</p>
          <p>{prompt.escalationReason || prompt.safetyNotes}</p>
        </section>
      ) : null}

      <label className="leader-review-field">
        <span>Leader-approved prompt</span>
        <textarea onChange={(event) => setDiscussionPrompt(event.target.value)} value={discussionPrompt} />
      </label>

      <label className="leader-review-field">
        <span>Private leader notes</span>
        <textarea onChange={(event) => setLeaderNotes(event.target.value)} value={leaderNotes} />
      </label>

      {prompt.deliveryMessage ? <p className="leader-review-delivery">{prompt.deliveryMessage}</p> : null}

      <div className="leader-review-actions">
        <button className="button primary" disabled={!canApprove} onClick={() => onDecide(prompt.id, "approve", leaderNotes, discussionPrompt)} type="button">
          {savingAction === "approve" ? "Approving..." : "Approve"}
        </button>
        <button className="button" disabled={!canSave} onClick={() => onDecide(prompt.id, "request_changes", leaderNotes, discussionPrompt)} type="button">
          {savingAction === "request_changes" ? "Saving..." : "Request changes"}
        </button>
        <button className="button" disabled={!canPost} onClick={() => onDecide(prompt.id, "post", leaderNotes, discussionPrompt)} type="button">
          {savingAction === "post" ? "Posting..." : "Post to Slack"}
        </button>
        <button className="button" disabled={!canSave || prompt.status === "archived"} onClick={() => onDecide(prompt.id, "archive", leaderNotes, discussionPrompt)} type="button">
          {savingAction === "archive" ? "Archiving..." : "Archive"}
        </button>
      </div>
    </article>
  );
}

function StatBadge({ label, tone, value }: { label: string; tone: "blue" | "green" | "amber"; value: number }) {
  return (
    <div className={`leader-review-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="leader-review-meta-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReviewPill({ status }: { status: StudentDiscussionStatus }) {
  return <span className={statusPillClassName(status)}>{statusLabel(status)}</span>;
}

function buildReviewStats(prompts: StudentDiscussionPrompt[]) {
  return {
    pending: prompts.filter((prompt) => prompt.status === "pending_review").length,
    approved: prompts.filter((prompt) => prompt.status === "approved").length,
    care: prompts.filter((prompt) => prompt.safetyLabel === "needs_leader_care" || prompt.safetyLabel === "pastoral_escalation" || Boolean(prompt.escalationReason)).length
  };
}

function guidanceText(prompt: StudentDiscussionPrompt) {
  if (prompt.discussionPrompt) return prompt.discussionPrompt;
  if (prompt.safetyNotes && prompt.aiStatus === "generated") return prompt.safetyNotes;
  return "";
}

function careText(prompt: StudentDiscussionPrompt) {
  if (prompt.safetyLabel === "pastoral_escalation") return "Pastoral care";
  if (prompt.safetyLabel === "needs_leader_care" || prompt.escalationReason) return "Careful framing";
  return "";
}

function aiStatusLabel(prompt: StudentDiscussionPrompt) {
  if (prompt.aiStatus === "generated") return "Draft ready";
  if (prompt.aiStatus === "failed") return "Draft failed";
  if (prompt.aiStatus === "not_configured") return "Not configured";
  return "Pending";
}

function emptyText(tab: ReviewTab["id"]) {
  if (tab === "needs_review") return "New student questions will land here first.";
  if (tab === "approved") return "Approved prompts ready for Slack will appear here.";
  if (tab === "changes") return "Questions sent back for clarification will appear here.";
  if (tab === "posted") return "Prompts shared with the group will appear here.";
  if (tab === "archived") return "Archived questions will appear here.";
  return "No real student submissions are available yet.";
}

function statusForSaving(action: ReviewAction) {
  if (action === "regenerate") return "Requesting a fresh AI draft...";
  if (action === "post") return "Posting the approved prompt...";
  return "Saving leader decision...";
}

function statusForSaved(action: ReviewAction) {
  if (action === "regenerate") return "AI draft regenerated for leader review.";
  if (action === "post") return "Approved prompt posted and logged.";
  return "Leader decision saved.";
}

function statusPillClassName(status: StudentDiscussionStatus) {
  if (status === "approved" || status === "posted") return "pill green";
  if (status === "changes_requested") return "pill amber";
  if (status === "archived") return "pill";
  return "pill blue";
}

function statusLabel(status: StudentDiscussionStatus) {
  if (status === "pending_review") return "Needs review";
  if (status === "changes_requested") return "Needs changes";
  if (status === "posted") return "Shared";
  return status.replace(/_/g, " ");
}
