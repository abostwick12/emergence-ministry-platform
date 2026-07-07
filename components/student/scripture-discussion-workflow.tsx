"use client";

import { useMemo, useState } from "react";

import { metanarrativeMovements, type MetanarrativeMovement, type StudentDiscussionPrompt } from "@/lib/scripture/types";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";

type ScriptureDiscussionWorkflowProps = {
  initialState: DiscussionWorkflowState;
  role: "admin" | "leader" | "student";
};

type CreateResponse = {
  ok?: boolean;
  error?: string;
  prompt?: StudentDiscussionPrompt;
};

type DecisionResponse = {
  ok?: boolean;
  error?: string;
  prompt?: StudentDiscussionPrompt;
};

export function ScriptureDiscussionWorkflow({ initialState, role }: ScriptureDiscussionWorkflowProps) {
  const [prompts, setPrompts] = useState(initialState.prompts);
  const [question, setQuestion] = useState("");
  const [scriptureReference, setScriptureReference] = useState("");
  const [movement, setMovement] = useState<MetanarrativeMovement>("Jesus / Kingdom Fulfilled");
  const [status, setStatus] = useState(initialState.readiness.message);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canLead = role === "admin" || role === "leader";
  const pendingCount = useMemo(() => prompts.filter((prompt) => prompt.status === "pending_review").length, [prompts]);

  async function submitQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("Saving question for leader review...");

    try {
      const response = await fetch("/api/student/scripture/discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, scriptureReference, metanarrativeMovement: movement })
      });
      const payload = (await response.json()) as CreateResponse;
      if (!response.ok || !payload.ok || !payload.prompt) {
        setStatus(payload.error ?? "Question could not be saved.");
        return;
      }

      setPrompts((current) => [payload.prompt!, ...current]);
      setQuestion("");
      setScriptureReference("");
      setStatus(
        payload.prompt.aiStatus === "generated"
          ? "Question saved. Gloo generated a leader-review draft."
          : "Question saved. Gloo is not configured yet, so leaders will review it without an AI draft."
      );
    } catch {
      setStatus("Question could not be saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function decidePrompt(id: string, action: "approve" | "request_changes" | "archive" | "post", leaderNotes: string) {
    setStatus("Saving leader decision...");
    try {
      const response = await fetch(`/api/student/scripture/discussion/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, leaderNotes })
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
    <div className="scripture-discussion">
      <section className="panel scripture-discussion-intro">
        <div>
          <p className="eyebrow">Small group tryout</p>
          <h1 className="title">Ask, review, approve, and discuss with real guardrails.</h1>
          <p className="muted">
            Student questions are saved for leader review. Gloo drafts are generated only when configured, and Slack posting
            happens only after a leader approves the prompt.
          </p>
        </div>
        <div className="scripture-discussion-readiness" aria-label="Production readiness">
          <span className={initialState.readiness.liveStorage ? "pill green" : "pill amber"}>Live storage</span>
          <span className={initialState.readiness.gloo ? "pill green" : "pill amber"}>Gloo AI Studio</span>
          <span className={initialState.readiness.slack ? "pill green" : "pill amber"}>Slack delivery</span>
        </div>
      </section>

      <section className="scripture-discussion-layout">
        <form className="panel scripture-discussion-form" onSubmit={submitQuestion} aria-label="Submit a student question">
          <div>
            <p className="eyebrow">Student question</p>
            <h2 className="section-title flush">Send a real question to leader review</h2>
          </div>

          <label className="field">
            <span>Question</span>
            <textarea
              className="input scripture-discussion-question"
              disabled={!initialState.readiness.liveStorage || isSubmitting}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What is something your group wants to wrestle with honestly?"
              value={question}
            />
          </label>

          <label className="field">
            <span>Scripture reference</span>
            <input
              className="input"
              disabled={!initialState.readiness.liveStorage || isSubmitting}
              onChange={(event) => setScriptureReference(event.target.value)}
              placeholder="Romans 8:18"
              type="text"
              value={scriptureReference}
            />
          </label>

          <label className="field">
            <span>Metanarrative movement</span>
            <select
              className="input"
              disabled={!initialState.readiness.liveStorage || isSubmitting}
              onChange={(event) => setMovement(event.target.value as MetanarrativeMovement)}
              value={movement}
            >
              {metanarrativeMovements.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <button className="button primary" disabled={!initialState.readiness.liveStorage || isSubmitting} type="submit">
            {isSubmitting ? "Saving..." : "Send to Review"}
          </button>
        </form>

        <section className="panel scripture-discussion-queue" aria-label="Student discussion review queue">
          <div className="toolbar split">
            <div>
              <p className="eyebrow">{canLead ? "Leader queue" : "Your submissions"}</p>
              <h2 className="section-title flush">{canLead ? `${pendingCount} awaiting review` : "Questions under review"}</h2>
            </div>
            <span className="pill blue">{prompts.length} saved</span>
          </div>

          <p className="scripture-discussion-status" role="status">
            {status}
          </p>

          {prompts.length ? (
            <div className="scripture-discussion-list">
              {prompts.map((prompt) => (
                <DiscussionPromptCard canLead={canLead} key={prompt.id} onDecide={decidePrompt} prompt={prompt} />
              ))}
            </div>
          ) : (
            <div className="scripture-discussion-empty">
              <strong>No real submissions yet.</strong>
              <p className="muted">When students submit questions, they will appear here for review. No sample data is shown.</p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function DiscussionPromptCard({
  canLead,
  onDecide,
  prompt
}: {
  canLead: boolean;
  onDecide: (id: string, action: "approve" | "request_changes" | "archive" | "post", leaderNotes: string) => Promise<void>;
  prompt: StudentDiscussionPrompt;
}) {
  const [leaderNotes, setLeaderNotes] = useState(prompt.leaderNotes);

  return (
    <article className="card scripture-discussion-card">
      <div className="toolbar split">
        <div>
          <p className="eyebrow">{prompt.scriptureReference || "No reference selected"}</p>
          <h3>{prompt.question}</h3>
          <p className="muted">Submitted by {prompt.submittedByName}</p>
        </div>
        <span className={statusPillClassName(prompt.status)}>{statusLabel(prompt.status)}</span>
      </div>

      <dl className="scripture-discussion-details">
        <div>
          <dt>Movement</dt>
          <dd>{prompt.metanarrativeMovement}</dd>
        </div>
        <div>
          <dt>AI status</dt>
          <dd>{aiStatusLabel(prompt.aiStatus)}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{modelLabel(prompt)}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{prompt.aiConfidence === null ? "not scored" : `${Math.round(prompt.aiConfidence * 100)}%`}</dd>
        </div>
        <div>
          <dt>Safety</dt>
          <dd>{prompt.safetyLabel.replace(/_/g, " ")}</dd>
        </div>
      </dl>

      {prompt.topicTags.length || prompt.escalationReason ? (
        <div className="scripture-discussion-model-note">
          {prompt.topicTags.length ? (
            <div className="scripture-discussion-tags" aria-label="AI topic tags">
              {prompt.topicTags.map((tag) => (
                <span className="pill" key={tag}>
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          ) : null}
          {prompt.escalationReason ? <p>{prompt.escalationReason}</p> : null}
        </div>
      ) : null}

      <section className="scripture-discussion-draft">
        <p className="eyebrow">Leader-review draft</p>
        {prompt.discussionPrompt ? <p>{prompt.discussionPrompt}</p> : <p className="muted">{prompt.safetyNotes}</p>}
      </section>

      {prompt.deliveryMessage ? <p className="scripture-discussion-delivery">{prompt.deliveryMessage}</p> : null}

      {canLead ? (
        <div className="scripture-discussion-actions">
          <label className="field">
            <span>Leader notes</span>
            <textarea className="input" onChange={(event) => setLeaderNotes(event.target.value)} value={leaderNotes} />
          </label>
          <div className="toolbar">
            <button className="button primary" disabled={!prompt.discussionPrompt || prompt.status === "posted"} onClick={() => onDecide(prompt.id, "approve", leaderNotes)} type="button">
              Approve
            </button>
            <button className="button" onClick={() => onDecide(prompt.id, "request_changes", leaderNotes)} type="button">
              Request Changes
            </button>
            <button className="button" disabled={prompt.status !== "approved"} onClick={() => onDecide(prompt.id, "post", leaderNotes)} type="button">
              Post to Slack
            </button>
            <button className="button" onClick={() => onDecide(prompt.id, "archive", leaderNotes)} type="button">
              Archive
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function statusPillClassName(status: StudentDiscussionPrompt["status"]) {
  if (status === "approved" || status === "posted") return "pill green";
  if (status === "changes_requested") return "pill amber";
  if (status === "archived") return "pill";
  return "pill blue";
}

function statusLabel(status: StudentDiscussionPrompt["status"]) {
  return status.replace(/_/g, " ");
}

function aiStatusLabel(status: StudentDiscussionPrompt["aiStatus"]) {
  return status.replace(/_/g, " ");
}

function modelLabel(prompt: StudentDiscussionPrompt) {
  if (!prompt.aiModel) return "not selected";
  return `${prompt.aiModelTier.replace(/_/g, " ")}: ${prompt.aiModel}`;
}
