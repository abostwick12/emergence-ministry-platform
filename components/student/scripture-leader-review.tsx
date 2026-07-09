"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import type { GlooDiagnosticResult } from "@/lib/scripture/gloo";
import { buildLocalDiscussionDraftForPrompt } from "@/lib/scripture/local-discussion-draft";
import type { StudentDiscussionPrompt, StudentDiscussionStatus } from "@/lib/scripture/types";
import type { StudentGroupLeaderState } from "@/lib/student/groups";

type ScriptureLeaderReviewProps = {
  initialGroupState: StudentGroupLeaderState;
  initialState: DiscussionWorkflowState;
};

type ReviewAction = "approve" | "request_changes" | "archive" | "post" | "regenerate" | "use_local_draft";

type DecisionResponse = {
  ok?: boolean;
  error?: string;
  prompt?: StudentDiscussionPrompt;
};

type GlooDiagnosticResponse = {
  ok?: boolean;
  error?: string;
  diagnostic?: GlooDiagnosticResult;
};

type StudentInviteResponse = {
  ok?: boolean;
  error?: string;
  state?: StudentGroupLeaderState;
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

export function ScriptureLeaderReview({ initialGroupState, initialState }: ScriptureLeaderReviewProps) {
  const [prompts, setPrompts] = useState(initialState.prompts);
  const [groupState, setGroupState] = useState(initialGroupState);
  const [activeTab, setActiveTab] = useState<ReviewTab["id"]>("needs_review");
  const [selectedId, setSelectedId] = useState(initialState.prompts[0]?.id ?? "");
  const [savingAction, setSavingAction] = useState<ReviewAction | "">("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [diagnostic, setDiagnostic] = useState<GlooDiagnosticResult | undefined>();
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [status, setStatus] = useState(initialState.readiness.liveStorage ? "Review student questions before anything is shared." : "Connect student access before review can begin.");

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

  async function runDiagnostic() {
    setIsRunningDiagnostic(true);
    setStatus("Running a safe Gloo test draft...");
    try {
      const response = await fetch("/api/student/scripture/gloo-diagnostics", { method: "POST" });
      const payload = (await response.json()) as GlooDiagnosticResponse;
      if (!response.ok || !payload.ok || !payload.diagnostic) {
        setStatus(payload.error ?? "AI connection check could not run.");
        return;
      }

      setDiagnostic(payload.diagnostic);
      setStatus(payload.diagnostic.ok ? "AI drafting connection is ready." : payload.diagnostic.message);
    } catch {
      setStatus("AI connection check could not run.");
    } finally {
      setIsRunningDiagnostic(false);
    }
  }

  async function createStudentInvite(input: { groupId?: string; groupName?: string; label?: string; maxUses?: number | null }) {
    setIsCreatingInvite(true);
    setStatus("Creating a student join link...");
    try {
      const response = await fetch("/api/student/groups/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const payload = (await response.json()) as StudentInviteResponse;
      if (!response.ok || !payload.ok || !payload.state) {
        setStatus(payload.error ?? "Student invite could not be created.");
        return;
      }

      setGroupState(payload.state);
      setStatus("Student join link is ready to share.");
    } catch {
      setStatus("Student invite could not be created.");
    } finally {
      setIsCreatingInvite(false);
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

      <GlooDiagnosticPanel
        diagnostic={diagnostic}
        isRunning={isRunningDiagnostic}
        onRun={runDiagnostic}
        readiness={initialState.readiness}
      />

      <StudentInvitePanel groupState={groupState} isCreating={isCreatingInvite} onCreate={createStudentInvite} />

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

function GlooDiagnosticPanel({
  diagnostic,
  isRunning,
  onRun,
  readiness
}: {
  diagnostic: GlooDiagnosticResult | undefined;
  isRunning: boolean;
  onRun: () => void;
  readiness: DiscussionWorkflowState["readiness"];
}) {
  return (
    <section className="leader-gloo-diagnostics" aria-label="Gloo diagnostics">
      <div>
        <p className="eyebrow">AI Connection</p>
        <h2>Test the draft connection</h2>
        <p>Runs one safe sample draft through the server-side AI connection and reports what happened.</p>
      </div>
      <div className="leader-gloo-diagnostics-actions">
        <span className={readiness.gloo ? "pill green" : "pill amber"}>{readiness.gloo ? "Connected" : "Local drafts active"}</span>
        <button className="button" disabled={isRunning} onClick={onRun} type="button">
          {isRunning ? "Testing..." : "Run Connection Test"}
        </button>
      </div>
      {diagnostic ? <GlooDiagnosticResultView diagnostic={diagnostic} /> : null}
    </section>
  );
}

function StudentInvitePanel({
  groupState,
  isCreating,
  onCreate
}: {
  groupState: StudentGroupLeaderState;
  isCreating: boolean;
  onCreate: (input: { groupId?: string; groupName?: string; label?: string; maxUses?: number | null }) => Promise<void>;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const activeInvites = groupState.invites.filter((invite) => invite.isActive).length;
  const activeStudents = groupState.members.filter((member) => member.status === "active").length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const groupId = String(form.get("groupId") || "");
    const groupName = String(form.get("groupName") || "");
    const label = String(form.get("label") || "");
    const maxUsesValue = Number(form.get("maxUses") || 0);

    await onCreate({
      groupId: groupId === "new" ? undefined : groupId,
      groupName,
      label,
      maxUses: maxUsesValue > 0 ? maxUsesValue : null
    });
  }

  async function copyLink(url: string) {
    setCopyStatus("");
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("Link copied.");
    } catch {
      setCopyStatus("Copy is not available in this browser.");
    }
  }

  return (
    <section className="leader-student-invites" aria-label="Student invite links">
      <div className="leader-student-invites-heading">
        <div>
          <p className="eyebrow">Student Access</p>
          <h2>Invite students to your group</h2>
          <p>Create a small-group link students can use to join, ask questions, and receive leader-reviewed next steps.</p>
        </div>
        <span className={groupState.liveStorage ? "pill green" : "pill amber"}>{groupState.liveStorage ? "Live invites" : "Needs setup"}</span>
      </div>

      <div className="leader-student-access-summary" aria-label="Student access readiness">
        <AccessSummaryItem label="Join links" value={activeInvites} detail={activeInvites ? "Ready to share" : "Create one for this group"} tone={activeInvites ? "ready" : "watch"} />
        <AccessSummaryItem
          label="Students joined"
          value={activeStudents}
          detail={activeStudents ? "Can use the portal" : "Waiting for signups"}
          tone={activeStudents ? "ready" : "watch"}
        />
        <AccessSummaryItem
          label="Storage"
          value={groupState.liveStorage ? "Live" : "Setup"}
          detail={groupState.liveStorage ? "Connected" : groupState.message}
          tone={groupState.liveStorage ? "ready" : "setup"}
        />
      </div>

      <form className="leader-student-invite-form" onSubmit={submit}>
        {groupState.groups.length ? (
          <label className="leader-review-field">
            <span>Group</span>
            <select className="input" name="groupId" defaultValue={groupState.groups[0]?.id ?? "new"}>
              {groupState.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
              <option value="new">Create a new group</option>
            </select>
          </label>
        ) : null}

        <label className="leader-review-field">
          <span>{groupState.groups.length ? "New group name" : "Group name"}</span>
          <input className="input" name="groupName" placeholder="Wednesday night high school" required={!groupState.groups.length} />
        </label>

        <label className="leader-review-field">
          <span>Invite label</span>
          <input className="input" name="label" placeholder="Small group launch" />
        </label>

        <label className="leader-review-field">
          <span>Use limit</span>
          <input className="input" name="maxUses" type="number" min={1} max={500} placeholder="40" />
        </label>

        <button className="button primary" disabled={!groupState.liveStorage || isCreating} type="submit">
          {isCreating ? "Creating..." : "Create join link"}
        </button>
      </form>

      <div className="leader-student-invite-results">
        <div className="leader-student-invite-list">
          <h3>Recent links</h3>
          {groupState.invites.length ? (
            groupState.invites.map((invite) => (
              <article className="leader-student-invite-row" key={invite.id}>
                <div>
                  <span>{invite.groupName}</span>
                  <strong>{invite.label}</strong>
                  <small>
                    {invite.useCount}{invite.maxUses ? ` of ${invite.maxUses}` : ""} joined{invite.expiresAt ? `, expires ${formatShortDate(invite.expiresAt)}` : ""}
                  </small>
                </div>
                <div className="leader-student-invite-copy">
                  <input className="input" readOnly value={invite.joinUrl} aria-label={`Join link for ${invite.groupName}`} />
                  <button className="button" type="button" onClick={() => void copyLink(invite.joinUrl)}>
                    Copy
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">{groupState.message}</p>
          )}
          {copyStatus ? <p className="leader-review-status">{copyStatus}</p> : null}
        </div>

        <div className="leader-student-member-list">
          <h3>Joined students</h3>
          {groupState.members.length ? (
            groupState.members.slice(0, 8).map((member) => (
              <div className="leader-student-member-row" key={member.id}>
                <strong>{member.displayName}</strong>
                <span>{member.groupName}</span>
              </div>
            ))
          ) : (
            <p className="muted">Share a recent link with your group. Students appear here after they create access.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function AccessSummaryItem({
  detail,
  label,
  tone,
  value
}: {
  detail: string;
  label: string;
  tone: "ready" | "watch" | "setup";
  value: number | string;
}) {
  return (
    <div className={`leader-student-access-item ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "later";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function GlooDiagnosticResultView({ diagnostic }: { diagnostic: GlooDiagnosticResult }) {
  return (
    <div className="leader-gloo-diagnostics-result">
      <div className="leader-review-meta-grid" aria-label="Gloo configuration signals">
        <MetaTile label="Result" value={diagnostic.ok ? "Usable draft" : "Needs attention"} />
        <MetaTile label="Base URL" value={diagnostic.baseUrlConfigured ? "Set" : "Missing"} />
        <MetaTile label="Credential" value={diagnostic.credentialsConfigured ? "Set" : "Missing"} />
        <MetaTile label="Model" value={diagnostic.selectedModel || diagnostic.primaryModel || "Missing"} />
      </div>
      <p>{diagnostic.message}</p>
      {diagnostic.draftPreview ? (
        <div className="leader-gloo-draft-preview">
          <span>Draft preview</span>
          <p>{diagnostic.draftPreview.discussionPrompt}</p>
          <small>
            {diagnostic.draftPreview.safetyLabel} - {Math.round(diagnostic.draftPreview.confidence * 100)}%
          </small>
        </div>
      ) : null}
      {diagnostic.attempts.length ? (
        <div className="leader-gloo-attempts">
          {diagnostic.attempts.map((attempt) => (
            <div className={attempt.ok ? "leader-gloo-attempt ok" : "leader-gloo-attempt"} key={`${attempt.url}-${attempt.status ?? "network"}`}>
              <span>{attempt.status ? `${attempt.status} ${attempt.statusText ?? ""}`.trim() : "Network"}</span>
              <strong>{attempt.url}</strong>
              <p>{attempt.message}</p>
            </div>
          ))}
        </div>
      ) : null}
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
  const localDraft = useMemo(() => buildLocalDiscussionDraftForPrompt(prompt), [prompt]);
  const reviewDraft = guidanceText(prompt, localDraft.discussionPrompt);
  const draftSource = prompt.discussionPrompt
    ? prompt.aiStatus === "generated"
      ? "Provider draft"
      : "Saved guided draft"
    : "Guided local draft";
  const canSave = liveStorageReady && !savingAction;
  const canApprove = canSave && discussionPrompt.trim().length > 0 && prompt.status !== "posted";
  const canPost = canSave && prompt.status === "approved";
  const canRegenerate = canSave && glooReady && prompt.status !== "posted";
  const canSaveLocalDraft = canSave && prompt.status !== "posted";

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

      <section className="leader-review-guidance" aria-label="Draft and care notes">
        <div>
          <p className="eyebrow">{draftSource}</p>
          <p>{reviewDraft}</p>
        </div>
        <div className="leader-review-guidance-actions">
          <button className="button" disabled={!reviewDraft || !canSave} onClick={() => setDiscussionPrompt(reviewDraft)} type="button">
            Use draft
          </button>
          <button className="button" disabled={!canSaveLocalDraft} onClick={() => onDecide(prompt.id, "use_local_draft", leaderNotes, discussionPrompt)} type="button">
            {savingAction === "use_local_draft" ? "Saving..." : "Save local draft"}
          </button>
          <button className="button" disabled={!canRegenerate} onClick={() => onDecide(prompt.id, "regenerate", leaderNotes, discussionPrompt)} type="button">
            {savingAction === "regenerate" ? "Regenerating..." : glooReady ? "Regenerate" : "Local draft active"}
          </button>
        </div>
      </section>

      {prompt.safetyNotes || prompt.escalationReason ? (
        <section className="leader-review-care" aria-label="Leader care notes">
          <p className="eyebrow">Leader care</p>
          <p>{prompt.escalationReason || prompt.safetyNotes}</p>
        </section>
      ) : null}

      {prompt.knowledgeContext?.length ? <LeaderKnowledgeContext matches={prompt.knowledgeContext} /> : null}

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

function LeaderKnowledgeContext({ matches }: { matches: NonNullable<StudentDiscussionPrompt["knowledgeContext"]> }) {
  return (
    <section className="leader-review-context" aria-label="Retrieved discipleship context">
      <div>
        <p className="eyebrow">Retrieved context</p>
        <h3>Use this to shape the conversation</h3>
      </div>
      <div className="leader-review-context-list">
        {matches.slice(0, 3).map((match) => (
          <article className="leader-review-context-card" key={match.id}>
            <span>{match.label}</span>
            <strong>{match.title}</strong>
            <p>{match.description}</p>
            {match.scriptureReferences.length ? <small>{match.scriptureReferences.join(", ")}</small> : null}
            {match.digQuestions.length ? (
              <ul>
                {match.digQuestions.slice(0, 2).map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
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

function guidanceText(prompt: StudentDiscussionPrompt, localDraft: string) {
  if (prompt.discussionPrompt) return prompt.discussionPrompt;
  return localDraft;
}

function careText(prompt: StudentDiscussionPrompt) {
  if (prompt.safetyLabel === "pastoral_escalation") return "Pastoral care";
  if (prompt.safetyLabel === "needs_leader_care" || prompt.escalationReason) return "Careful framing";
  return "";
}

function aiStatusLabel(prompt: StudentDiscussionPrompt) {
  if (prompt.aiStatus === "generated") return "Draft ready";
  if (prompt.aiStatus === "failed") return prompt.discussionPrompt ? "Local fallback" : "Needs local draft";
  if (prompt.aiStatus === "not_configured") return prompt.discussionPrompt ? "Local draft ready" : "Local draft needed";
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
  if (action === "use_local_draft") return "Saving a knowledge-guided local draft...";
  if (action === "regenerate") return "Requesting a fresh AI draft...";
  if (action === "post") return "Posting the approved prompt...";
  return "Saving leader decision...";
}

function statusForSaved(action: ReviewAction) {
  if (action === "use_local_draft") return "Knowledge-guided local draft saved for leader review.";
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
