"use client";

import { useMemo, useState } from "react";

import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

type ScriptureLeaderReviewProps = {
  initialState: DiscussionWorkflowState;
};

type DecisionResponse = {
  ok?: boolean;
  error?: string;
  prompt?: StudentDiscussionPrompt;
};

export function ScriptureLeaderReview({ initialState }: ScriptureLeaderReviewProps) {
  const [prompts, setPrompts] = useState(initialState.prompts);
  const [status, setStatus] = useState(initialState.readiness.liveStorage ? "Review student questions before anything is shared." : "Live storage is not ready for review.");
  const pendingCount = useMemo(() => prompts.filter((prompt) => prompt.status === "pending_review").length, [prompts]);

  async function decidePrompt(id: string, action: "approve" | "request_changes" | "archive" | "post", leaderNotes: string, discussionPrompt: string) {
    setStatus("Saving leader decision...");
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
      setStatus(action === "post" ? "Approved prompt posted and logged." : "Leader decision saved.");
    } catch {
      setStatus("Leader decision could not be saved.");
    }
  }

  return (
    <div className="leader-review">
      <section className="leader-review-intro">
        <div>
          <p className="eyebrow">Leader Review</p>
          <h1>Questions awaiting review</h1>
          <p>Shape student questions into careful group conversations before they are shared.</p>
        </div>
        <span className="pill blue">{pendingCount} awaiting review</span>
      </section>

      <p className="leader-review-status" role="status">
        {status}
      </p>

      {prompts.length ? (
        <section className="leader-review-list" aria-label="Questions awaiting leader review">
          {prompts.map((prompt) => (
            <LeaderReviewCard key={prompt.id} onDecide={decidePrompt} prompt={prompt} />
          ))}
        </section>
      ) : (
        <section className="leader-review-empty">
          <strong>No real submissions yet.</strong>
          <p>When students send questions, they will appear here for review. No sample student data is shown.</p>
        </section>
      )}
    </div>
  );
}

function LeaderReviewCard({
  onDecide,
  prompt
}: {
  onDecide: (id: string, action: "approve" | "request_changes" | "archive" | "post", leaderNotes: string, discussionPrompt: string) => Promise<void>;
  prompt: StudentDiscussionPrompt;
}) {
  const [leaderNotes, setLeaderNotes] = useState(prompt.leaderNotes);
  const [discussionPrompt, setDiscussionPrompt] = useState(prompt.discussionPrompt);
  const canApprove = discussionPrompt.trim().length > 0 && prompt.status !== "posted";

  return (
    <article className="leader-review-card">
      <div className="leader-review-question">
        <div>
          <span>{prompt.scriptureReference || "No passage selected"}</span>
          <h2>{prompt.question}</h2>
          <p>Submitted by {prompt.submittedByName}</p>
        </div>
        <span className={statusPillClassName(prompt.status)}>{statusLabel(prompt.status)}</span>
      </div>

      <section className="leader-review-guidance" aria-label="Agent guidance">
        <div>
          <p className="eyebrow">Agent guidance</p>
          <p>{guidanceText(prompt)}</p>
        </div>
        {careText(prompt) ? <span>{careText(prompt)}</span> : null}
      </section>

      <label className="leader-review-field">
        <span>Discussion prompt</span>
        <textarea onChange={(event) => setDiscussionPrompt(event.target.value)} value={discussionPrompt} />
      </label>

      <label className="leader-review-field">
        <span>Leader notes</span>
        <textarea onChange={(event) => setLeaderNotes(event.target.value)} value={leaderNotes} />
      </label>

      {prompt.deliveryMessage ? <p className="leader-review-delivery">{prompt.deliveryMessage}</p> : null}

      <div className="leader-review-actions">
        <button className="button primary" disabled={!canApprove} onClick={() => onDecide(prompt.id, "approve", leaderNotes, discussionPrompt)} type="button">
          Approve
        </button>
        <button className="button" onClick={() => onDecide(prompt.id, "request_changes", leaderNotes, discussionPrompt)} type="button">
          Ask for changes
        </button>
        <button className="button" disabled={prompt.status !== "approved"} onClick={() => onDecide(prompt.id, "post", leaderNotes, discussionPrompt)} type="button">
          Post after approval
        </button>
        <button className="button" onClick={() => onDecide(prompt.id, "archive", leaderNotes, discussionPrompt)} type="button">
          Archive
        </button>
      </div>
    </article>
  );
}

function guidanceText(prompt: StudentDiscussionPrompt) {
  if (prompt.discussionPrompt) return prompt.discussionPrompt;
  if (prompt.safetyNotes && prompt.aiStatus === "generated") return prompt.safetyNotes;
  return "No agent draft is ready yet. Write a discussion prompt in your own words before approving.";
}

function careText(prompt: StudentDiscussionPrompt) {
  if (prompt.safetyLabel === "pastoral_escalation") return "Pastoral care recommended";
  if (prompt.safetyLabel === "needs_leader_care" || prompt.escalationReason) return "Needs careful framing";
  return "";
}

function statusPillClassName(status: StudentDiscussionPrompt["status"]) {
  if (status === "approved" || status === "posted") return "pill green";
  if (status === "changes_requested") return "pill amber";
  if (status === "archived") return "pill";
  return "pill blue";
}

function statusLabel(status: StudentDiscussionPrompt["status"]) {
  if (status === "pending_review") return "pending review";
  if (status === "changes_requested") return "changes requested";
  return status;
}
