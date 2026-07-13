"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { buildDiscussionVideoScript, formatDiscussionVideoScriptForCopy, type DiscussionVideoScript } from "@/lib/scripture/discussion-video";
import type { GlooDiagnosticResult } from "@/lib/scripture/gloo";
import { buildLocalDiscussionDraftForPrompt } from "@/lib/scripture/local-discussion-draft";
import { buildQuestionNextStep, type StudentQuestionNextStep } from "@/lib/scripture/student-home";
import { matchQuestionToStoryline, type StorylineQuestionMatch } from "@/lib/scripture/storyline-guide";
import type { StudentDiscussionPrompt, StudentDiscussionStatus } from "@/lib/scripture/types";
import type { StudentGroupLeaderState } from "@/lib/student/groups";

type ScriptureLeaderReviewProps = {
  initialGroupState: StudentGroupLeaderState;
  initialState: DiscussionWorkflowState;
};

type ReviewAction =
  | "approve"
  | "request_changes"
  | "archive"
  | "post"
  | "regenerate"
  | "use_local_draft"
  | "mark_discussed"
  | "flag_follow_up";

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
  const [activeGuideId, setActiveGuideId] = useState("");
  const [savingAction, setSavingAction] = useState<ReviewAction | "">("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [diagnostic, setDiagnostic] = useState<GlooDiagnosticResult | undefined>();
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const [status, setStatus] = useState(
    initialState.readiness.liveStorage || initialState.readiness.localStorage
      ? "Review student questions before anything is shared."
      : initialState.readiness.message
  );

  const activeTabConfig = reviewTabs.find((tab) => tab.id === activeTab) ?? reviewTabs[0];
  const filteredPrompts = useMemo(() => prompts.filter(activeTabConfig.matches), [activeTabConfig, prompts]);
  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedId) ?? filteredPrompts[0] ?? prompts[0];
  const activeGuidePrompt = prompts.find((prompt) => prompt.id === activeGuideId);
  const visibleSelectedId = selectedPrompt?.id ?? "";
  const stats = useMemo(() => buildReviewStats(prompts), [prompts]);
  const reviewReady = isInteractive && (initialState.readiness.liveStorage || initialState.readiness.localStorage);

  useEffect(() => {
    setIsInteractive(true);
  }, []);

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

      setPrompts((current) => current.map((prompt) => (prompt.id === payload.prompt!.id ? { ...prompt, ...payload.prompt! } : prompt)));
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

  function openPrompt(prompt: StudentDiscussionPrompt) {
    setSelectedId(prompt.id);
    setActiveTab(tabForPrompt(prompt));
    setStatus(`Opened ${prompt.submittedByName}'s question for review.`);
  }

  function openDiscussionGuide(prompt: StudentDiscussionPrompt) {
    setSelectedId(prompt.id);
    setActiveTab(tabForPrompt(prompt));
    setActiveGuideId(prompt.id);
    setStatus(`Opened the group guide for ${prompt.submittedByName}'s question.`);
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

      <TonightPrepPanel prompts={prompts} stats={stats} onOpenGuide={openDiscussionGuide} onOpenPrompt={openPrompt} />

      {activeGuidePrompt ? (
        <LeaderDiscussionGuide
          reviewReady={reviewReady}
          onClose={() => setActiveGuideId("")}
          onDecide={decidePrompt}
          prompt={activeGuidePrompt}
          savingAction={savingAction}
        />
      ) : null}

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
            reviewReady={reviewReady}
            onDecide={decidePrompt}
            onOpenGuide={openDiscussionGuide}
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

function TonightPrepPanel({
  onOpenGuide,
  onOpenPrompt,
  prompts,
  stats
}: {
  onOpenGuide: (prompt: StudentDiscussionPrompt) => void;
  onOpenPrompt: (prompt: StudentDiscussionPrompt) => void;
  prompts: StudentDiscussionPrompt[];
  stats: ReturnType<typeof buildReviewStats>;
}) {
  const readyPrompts = prompts.filter((prompt) => prompt.status === "approved" || prompt.status === "posted");
  const waitingPrompts = prompts.filter((prompt) => prompt.status === "pending_review");
  const reflectedPrompts = prompts.filter((prompt) => (prompt.studentReflectionCount ?? 0) > 0);
  const followUpPrompts = prompts.filter((prompt) => prompt.status === "changes_requested" || Boolean(careText(prompt)));
  const tonightPrompt = readyPrompts[0] ?? reflectedPrompts[0] ?? waitingPrompts[0];

  return (
    <section className="leader-tonight-prep" aria-label="Tonight discussion prep">
      <div className="leader-tonight-prep-heading">
        <div>
          <p className="eyebrow">Tonight Prep</p>
          <h2>Lead the next conversation</h2>
          <p>Use real student questions to decide what to discuss, what needs review, and who may need a slower follow-up.</p>
        </div>
        <div className="leader-tonight-prep-counts" aria-label="Small group readiness counts">
          <PrepCount label="Waiting" value={stats.pending} />
          <PrepCount label="Ready" value={readyPrompts.length} />
          <PrepCount label="Reflected" value={reflectedPrompts.length} />
          <PrepCount label="Follow up" value={followUpPrompts.length} />
        </div>
      </div>

      <div className="leader-tonight-prep-grid">
        <article className="leader-tonight-primary">
          <span>{tonightPrompt ? nextActionLabel(tonightPrompt) : "No live questions yet"}</span>
          <h3>{tonightPrompt ? tonightPrompt.discussionPrompt || tonightPrompt.question : "Invite students to ask before small group."}</h3>
          <p>
            {tonightPrompt
              ? tonightPrompt.question
              : "When students submit questions, this area becomes the leader's quick read for tonight's discussion."}
          </p>
          {tonightPrompt ? (
            <div className="leader-tonight-primary-actions">
              <button className="button primary" onClick={() => onOpenGuide(tonightPrompt)} type="button">
                Open guide
              </button>
              <button className="button" onClick={() => onOpenPrompt(tonightPrompt)} type="button">
                Review
              </button>
            </div>
          ) : null}
        </article>

        <PrepList
          emptyText="Approved prompts will appear here."
          items={readyPrompts}
          label="Ready for group"
          onOpenPrompt={onOpenPrompt}
        />
        <PrepList
          emptyText="Questions students have marked reflected will appear here."
          items={reflectedPrompts}
          label="Students are wrestling"
          onOpenPrompt={onOpenPrompt}
          secondaryText={(prompt) => `${prompt.studentReflectionCount ?? 0} reflected${prompt.studentLastReflectedAt ? `, latest ${formatShortDate(prompt.studentLastReflectedAt)}` : ""}`}
        />
        <PrepList
          emptyText="Care signals and requested changes will appear here."
          items={followUpPrompts}
          label="Follow up privately"
          onOpenPrompt={onOpenPrompt}
          secondaryText={(prompt) => careText(prompt) || statusLabel(prompt.status)}
        />
      </div>
    </section>
  );
}

function PrepCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PrepList({
  emptyText,
  items,
  label,
  onOpenPrompt,
  secondaryText = (prompt) => prompt.scriptureReference || statusLabel(prompt.status)
}: {
  emptyText: string;
  items: StudentDiscussionPrompt[];
  label: string;
  onOpenPrompt: (prompt: StudentDiscussionPrompt) => void;
  secondaryText?: (prompt: StudentDiscussionPrompt) => string;
}) {
  return (
    <article className="leader-tonight-list">
      <h3>{label}</h3>
      {items.length ? (
        <div>
          {items.slice(0, 3).map((prompt) => (
            <button key={prompt.id} onClick={() => onOpenPrompt(prompt)} type="button">
              <span>{secondaryText(prompt)}</span>
              <strong>{prompt.discussionPrompt || prompt.question}</strong>
            </button>
          ))}
        </div>
      ) : (
        <p>{emptyText}</p>
      )}
    </article>
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

function LeaderDiscussionGuide({
  reviewReady,
  onClose,
  onDecide,
  prompt,
  savingAction
}: {
  reviewReady: boolean;
  onClose: () => void;
  onDecide: (id: string, action: ReviewAction, leaderNotes: string, discussionPrompt: string) => Promise<void>;
  prompt: StudentDiscussionPrompt;
  savingAction: ReviewAction | "";
}) {
  const [followUpNote, setFollowUpNote] = useState(prompt.leaderNotes);
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(() => new Set());
  const [copyStatus, setCopyStatus] = useState("");
  const canSave = reviewReady && !savingAction;
  const isReady = prompt.status === "approved" || prompt.status === "posted";
  const guide = buildDiscussionGuide(prompt);
  const completedSteps = checkedSteps.size;

  useEffect(() => {
    setFollowUpNote(prompt.leaderNotes);
    setCheckedSteps(new Set());
    setCopyStatus("");
  }, [prompt]);

  async function copyGuide() {
    setCopyStatus("");
    try {
      await navigator.clipboard.writeText(formatDiscussionGuideForCopy(prompt, guide));
      setCopyStatus("Guide copied for leader notes.");
    } catch {
      setCopyStatus("Copy is not available in this browser.");
    }
  }

  function toggleStep(stepId: string) {
    setCheckedSteps((current) => {
      const next = new Set(current);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }

  return (
    <section className="leader-discussion-guide" aria-label="Wrestle Together leader guide">
      <div className="leader-discussion-guide-heading">
        <div>
          <p className="eyebrow">Wrestle Together</p>
          <h2>{guide.title}</h2>
          <p>Use this as a live small-group guide. Keep students thinking, reading, praying, and listening together.</p>
        </div>
        <div className="leader-discussion-guide-actions">
          <ReviewPill status={prompt.status} />
          <button className="button" onClick={copyGuide} type="button">
            Copy guide
          </button>
          <button className="button" onClick={onClose} type="button">
            Close guide
          </button>
        </div>
      </div>

      <div className="leader-discussion-guide-question">
        <span>{prompt.scriptureReference || "Choose a passage during group"}</span>
        <strong>{prompt.question}</strong>
        <p>{prompt.discussionPrompt || "Use the review panel to shape the leader-approved prompt before group."}</p>
      </div>

      <div className="leader-discussion-guide-signals" aria-label="Discussion signals">
        <MetaTile label="Students reflected" value={`${prompt.studentReflectionCount ?? 0}`} />
        <MetaTile label="Last reflection" value={prompt.studentLastReflectedAt ? formatShortDate(prompt.studentLastReflectedAt) : "None yet"} />
        <MetaTile label="Discussed" value={prompt.leaderDiscussedAt ? formatShortDate(prompt.leaderDiscussedAt) : "Not yet"} />
        <MetaTile label="Follow-up" value={prompt.leaderFollowUpFlagCount ? `${prompt.leaderFollowUpFlagCount} flagged` : "None"} />
      </div>

      <section className="leader-discussion-session-plan" aria-label="Leader session checklist">
        <div>
          <p className="eyebrow">Session Flow</p>
          <h3>{completedSteps} of {guide.sections.length} steps checked</h3>
        </div>
        <div className="leader-discussion-session-steps">
          {guide.sections.map((section) => (
            <label key={section.label}>
              <input checked={checkedSteps.has(section.label)} onChange={() => toggleStep(section.label)} type="checkbox" />
              <span>{section.label}</span>
            </label>
          ))}
        </div>
        <p role="status">{copyStatus || "Use this checklist while leading; it stays private in this browser session."}</p>
      </section>

      <div className="leader-discussion-guide-grid">
        {guide.sections.map((section) => (
          <article className="leader-discussion-guide-card" key={section.label}>
            <span>{section.label}</span>
            <h3>{section.title}</h3>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <label className="leader-review-field">
        <span>Private follow-up note</span>
        <textarea onChange={(event) => setFollowUpNote(event.target.value)} value={followUpNote} />
      </label>

      <div className="leader-review-actions">
        <button
          className="button primary"
          disabled={!canSave || !isReady}
          onClick={() => onDecide(prompt.id, "mark_discussed", followUpNote, prompt.discussionPrompt)}
          type="button"
        >
          {savingAction === "mark_discussed" ? "Saving..." : "Mark discussed"}
        </button>
        <button
          className="button"
          disabled={!canSave || prompt.status === "archived"}
          onClick={() => onDecide(prompt.id, "flag_follow_up", followUpNote, prompt.discussionPrompt)}
          type="button"
        >
          {savingAction === "flag_follow_up" ? "Flagging..." : "Flag follow-up"}
        </button>
      </div>
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
  const latestInvite = groupState.invites.find((invite) => invite.isActive);

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
          <p>Create one launch link, share it with students, then watch the first join, first question, and first reflection move through review.</p>
        </div>
        <span className={groupState.liveStorage ? "pill green" : "pill amber"}>{groupState.liveStorage ? "Live invites" : "Needs setup"}</span>
      </div>

      <div className="leader-student-launch-path" aria-label="Student launch path">
        <LaunchPathStep state={activeInvites ? "ready" : groupState.liveStorage ? "watch" : "setup"} title="Share link" detail={latestInvite ? latestInvite.groupName : "Create one group link"} />
        <LaunchPathStep state={activeStudents ? "ready" : activeInvites ? "watch" : "setup"} title="Students join" detail={activeStudents ? `${activeStudents} joined` : "Waiting for first signup"} />
        <LaunchPathStep state="watch" title="First question" detail="Students land in Ask + Keep Reading" />
        <LaunchPathStep state="watch" title="Leader review" detail="Approve before group or Slack" />
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
          <h3>Share with students</h3>
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
                <p className="leader-student-invite-script">
                  Send this to students: join the portal, ask one honest question, and use the reading path before group.
                </p>
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

function LaunchPathStep({ detail, state, title }: { detail: string; state: "ready" | "watch" | "setup"; title: string }) {
  return (
    <div className={`leader-student-launch-step ${state}`}>
      <span>{title}</span>
      <strong>{state === "ready" ? "Ready" : state === "watch" ? "Next" : "Setup"}</strong>
      <small>{detail}</small>
    </div>
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
  reviewReady,
  onDecide,
  onOpenGuide,
  prompt,
  savingAction
}: {
  glooReady: boolean;
  reviewReady: boolean;
  onDecide: (id: string, action: ReviewAction, leaderNotes: string, discussionPrompt: string) => Promise<void>;
  onOpenGuide: (prompt: StudentDiscussionPrompt) => void;
  prompt: StudentDiscussionPrompt;
  savingAction: ReviewAction | "";
}) {
  const [leaderNotes, setLeaderNotes] = useState(prompt.leaderNotes);
  const [discussionPrompt, setDiscussionPrompt] = useState(prompt.discussionPrompt);
  const [videoScriptOpen, setVideoScriptOpen] = useState(false);
  const [videoCopyStatus, setVideoCopyStatus] = useState("");
  const localDraft = useMemo(() => buildLocalDiscussionDraftForPrompt(prompt), [prompt]);
  const storylineMatch = useMemo(() => matchQuestionToStoryline(prompt), [prompt]);
  const studentNextStep = useMemo(() => buildQuestionNextStep(prompt, prompt.knowledgeContext ?? []), [prompt]);
  const videoScript = useMemo(() => buildDiscussionVideoScript({ ...prompt, discussionPrompt }), [discussionPrompt, prompt]);
  const reviewDraft = guidanceText(prompt, localDraft.discussionPrompt);
  const draftSource = prompt.discussionPrompt
    ? prompt.aiStatus === "generated"
      ? "Provider draft"
      : "Saved guided draft"
    : "Guided local draft";
  const canSave = reviewReady && !savingAction;
  const canApprove = canSave && discussionPrompt.trim().length > 0 && prompt.status !== "posted";
  const canPost = canSave && prompt.status === "approved";
  const canRegenerate = canSave && glooReady && prompt.status !== "posted";
  const canSaveLocalDraft = canSave && prompt.status !== "posted";
  const canPrepareVideo = prompt.status === "approved" || prompt.status === "posted";

  useEffect(() => {
    setLeaderNotes(prompt.leaderNotes);
    setDiscussionPrompt(prompt.discussionPrompt);
    setVideoScriptOpen(false);
    setVideoCopyStatus("");
  }, [prompt]);

  async function copyVideoScript() {
    const text = formatDiscussionVideoScriptForCopy(videoScript);
    try {
      await navigator.clipboard.writeText(text);
      setVideoCopyStatus("Video script copied for leader review.");
    } catch {
      setVideoCopyStatus("Copy was not available in this browser. Select the scene text manually.");
    }
  }

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

      <LeaderStorylineContext match={storylineMatch} />
      <LeaderStudentJourneyContext nextStep={studentNextStep} prompt={prompt} />

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

      {videoScriptOpen ? <LeaderDiscussionVideoScriptPanel onCopy={copyVideoScript} script={videoScript} status={videoCopyStatus} /> : null}

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
        <button className="button" disabled={prompt.status !== "approved" && prompt.status !== "posted"} onClick={() => onOpenGuide(prompt)} type="button">
          Open guide
        </button>
        <button
          className="button"
          disabled={!canPrepareVideo}
          onClick={() => setVideoScriptOpen((current) => !current)}
          title={canPrepareVideo ? "Prepare a leader-reviewed discussion video script" : "Approve the prompt before preparing a group video"}
          type="button"
        >
          {videoScriptOpen ? "Hide video" : "Prepare video"}
        </button>
        <button className="button" disabled={!canSave || prompt.status === "archived"} onClick={() => onDecide(prompt.id, "archive", leaderNotes, discussionPrompt)} type="button">
          {savingAction === "archive" ? "Archiving..." : "Archive"}
        </button>
      </div>
    </article>
  );
}

function LeaderDiscussionVideoScriptPanel({
  onCopy,
  script,
  status
}: {
  onCopy: () => void;
  script: DiscussionVideoScript;
  status: string;
}) {
  return (
    <section className="leader-video-script-panel" aria-label="Discussion video script">
      <div className="leader-video-script-heading">
        <div>
          <p className="eyebrow">Discussion Video</p>
          <h3>{script.title}</h3>
          <p>
            Review this short vertical video script before rendering or sharing. It uses only the leader-approved prompt,
            Scripture context, and public group next steps.
          </p>
        </div>
        <div className="leader-video-script-actions">
          <span className={script.status === "ready_for_review" ? "pill green" : "pill amber"}>
            {script.status === "ready_for_review" ? "Ready for review" : "Approve first"}
          </span>
          <button className="button" onClick={onCopy} type="button">
            Copy script
          </button>
        </div>
      </div>

      <div className="leader-video-script-meta" aria-label="Video format">
        <MetaTile label="Length" value={`${script.totalDurationSeconds}s`} />
        <MetaTile label="Format" value="Vertical 1080x1920" />
        <MetaTile label="Scenes" value={`${script.scenes.length}`} />
      </div>

      <div className="leader-video-script-guardrails">
        <span>Leader guardrails</span>
        <ul>
          {script.guardrails.map((guardrail) => (
            <li key={guardrail}>{guardrail}</li>
          ))}
        </ul>
      </div>

      <div className="leader-video-script-scenes">
        {script.scenes.map((scene, index) => (
          <article key={scene.id}>
            <span>
              Scene {index + 1} - {scene.eyebrow}
            </span>
            <h4>{scene.headline}</h4>
            <p>{scene.body}</p>
            <small>{scene.durationSeconds}s - {scene.speakerNotes}</small>
          </article>
        ))}
      </div>

      <p className="leader-video-script-status" role="status">
        {status || "Rendering is not connected yet. This prepares the reviewed scene plan for the Remotion renderer."}
      </p>
    </section>
  );
}

function LeaderStudentJourneyContext({
  nextStep,
  prompt
}: {
  nextStep: StudentQuestionNextStep;
  prompt: StudentDiscussionPrompt;
}) {
  const reflected = (prompt.studentReflectionCount ?? 0) > 0;

  return (
    <section className="leader-student-journey-context" aria-label="Student journey context">
      <div className="leader-student-journey-heading">
        <div>
          <p className="eyebrow">Student Journey</p>
          <h3>{reflected ? "Student has started wrestling with it" : "Student next steps are ready"}</h3>
          <p>
            This shows the guided path the student receives while the question is with leaders. Private journal notes stay private to the student.
          </p>
        </div>
        <div className="leader-student-journey-signals" aria-label="Reflection signals">
          <MetaTile label="Reflected" value={reflected ? `${prompt.studentReflectionCount}` : "Not yet"} />
          <MetaTile label="Latest" value={prompt.studentLastReflectedAt ? formatShortDate(prompt.studentLastReflectedAt) : "Waiting"} />
        </div>
      </div>

      <div className="leader-student-journey-grid">
        <JourneyPreview title="Wrestle with it" items={nextStep.wrestleQuestions.slice(0, 2)} />
        <JourneyPreview title="Dig deeper" items={nextStep.digQuestions.slice(0, 2)} />
        <JourneyPreview title="Reflect" items={nextStep.journalPrompts.slice(0, 2)} />
        <JourneyPreview title="Pray" items={nextStep.prayerPrompts.slice(0, 2)} />
      </div>

      <div className="leader-student-journey-together">
        <span>Wrestle together</span>
        <p>{nextStep.wrestleTogetherPrompt}</p>
      </div>
    </section>
  );
}

function JourneyPreview({ items, title }: { items: string[]; title: string }) {
  return (
    <article>
      <span>{title}</span>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function LeaderStorylineContext({ match }: { match: StorylineQuestionMatch }) {
  return (
    <section className="leader-storyline-context" aria-label="Bible storyline context">
      <div className="leader-storyline-context-copy">
        <p className="eyebrow">{match.label}</p>
        <h3>{match.title}</h3>
        <p>{match.leaderFrame}</p>
      </div>

      <div className="leader-storyline-context-grid" aria-label="Storyline path">
        <MetaTile label="Starts" value={match.startsHere} />
        <MetaTile label="Develops" value={match.developsThrough} />
        <MetaTile label="Fulfilled" value={match.fulfilledInChrist} />
      </div>

      <div className="leader-storyline-context-list">
        <div>
          <span>Passages to open</span>
          <p>{match.keyPassages.slice(0, 5).join(", ")}</p>
        </div>
        <div>
          <span>Questions to ask</span>
          <ul>
            {match.studentQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
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

function buildDiscussionGuide(prompt: StudentDiscussionPrompt) {
  const passage = prompt.scriptureReference || "the passage your group chooses together";
  const care = careText(prompt);
  const storylineMatch = matchQuestionToStoryline(prompt);
  const knowledgeQuestions = prompt.knowledgeContext?.flatMap((match) => match.digQuestions).filter(Boolean) ?? [];
  const storylineQuestions = storylineMatch.studentQuestions;
  const topic = prompt.topicTags[0] ?? "this question";
  return {
    title: prompt.discussionPrompt || prompt.question,
    sections: [
      {
        label: "Start Here",
        title: "Name what is really being asked",
        items: [
          "Ask students what they have heard or been taught about this before.",
          "Invite them to name what is sticking out, bothering them, or making the question feel important.",
          storylineMatch.leaderFrame,
          care ? `Frame this with care: ${care}.` : "Make room for honesty before trying to resolve the question."
        ]
      },
      {
        label: "Read Together",
        title: `Open ${passage}`,
        items: [
          "Read slowly enough for students to notice repeated words, tension, or surprises.",
          "Ask what the passage reveals about God, people, brokenness, and hope.",
          "Keep the text in front of the group before moving to opinions."
        ]
      },
      {
        label: "Wrestle With",
        title: "Let better questions surface",
        items: [
          knowledgeQuestions[0] ?? storylineQuestions[0] ?? `What question underneath ${topic} might God be inviting us to face honestly?`,
          knowledgeQuestions[1] ?? storylineQuestions[1] ?? "Where does this passage challenge what we assumed before we read it?",
          storylineQuestions[2] ?? "What would faithful trust look like if we do not have a complete answer tonight?"
        ]
      },
      {
        label: "Pray",
        title: "Turn the question toward God",
        items: [
          "Give students a quiet moment to name one honest sentence to God.",
          "Pray for wisdom, courage, and tenderness for anyone carrying this question personally.",
          "Ask God to make the group a safer place to bring real questions into the light."
        ]
      },
      {
        label: "Follow Up",
        title: "Decide what needs a slower conversation",
        items: [
          "Watch for students who seem unusually quiet, agitated, or personally affected.",
          "Flag private follow-up if the question points toward grief, family crisis, abuse, self-harm, or shame.",
          "Offer a next Scripture reading or trusted leader conversation before the student leaves."
        ]
      }
    ]
  };
}

function formatDiscussionGuideForCopy(prompt: StudentDiscussionPrompt, guide: ReturnType<typeof buildDiscussionGuide>) {
  const lines = [
    `Wrestle Together Guide`,
    `Question: ${prompt.question}`,
    `Passage: ${prompt.scriptureReference || "Choose together"}`,
    `Leader-approved prompt: ${prompt.discussionPrompt || prompt.question}`,
    ""
  ];

  for (const section of guide.sections) {
    lines.push(`${section.label}: ${section.title}`);
    for (const item of section.items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function tabForPrompt(prompt: StudentDiscussionPrompt): ReviewTab["id"] {
  if (prompt.status === "approved") return "approved";
  if (prompt.status === "changes_requested") return "changes";
  if (prompt.status === "posted") return "posted";
  if (prompt.status === "archived") return "archived";
  return "needs_review";
}

function nextActionLabel(prompt: StudentDiscussionPrompt) {
  if (prompt.status === "approved" || prompt.status === "posted") return "Lead this tonight";
  if ((prompt.studentReflectionCount ?? 0) > 0) return "Student is already wrestling";
  if (careText(prompt)) return "Review with care";
  return "Review before group";
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
  if (action === "mark_discussed") return "Marking this prompt discussed...";
  if (action === "flag_follow_up") return "Flagging private follow-up...";
  return "Saving leader decision...";
}

function statusForSaved(action: ReviewAction) {
  if (action === "use_local_draft") return "Knowledge-guided local draft saved for leader review.";
  if (action === "regenerate") return "AI draft regenerated for leader review.";
  if (action === "post") return "Approved prompt posted and logged.";
  if (action === "mark_discussed") return "Discussion marked for leader follow-through.";
  if (action === "flag_follow_up") return "Private follow-up flagged for a leader.";
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
