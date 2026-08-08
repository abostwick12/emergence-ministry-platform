"use client";

import {
  AtSign,
  Camera,
  ChevronDown,
  Clipboard,
  Download,
  ExternalLink,
  Film,
  History,
  Image as ImageIcon,
  Megaphone,
  MessageCircleMore,
  Paperclip,
  RotateCcw,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Upload,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  approveContentFeedbackBatchAction,
  continueContentInterviewAction,
  rollbackContentGuideAction,
  startContentInterviewAction,
  submitContentFeedbackAction,
  type ContentStudioActionResult
} from "@/app/(app)/content-studio/actions";
import { ResourceAttachments } from "@/components/resource-attachments";
import { advanceInterview, contentBrief, previewInterviewPlaybook, selectOpeningQuestion } from "@/lib/meridian/content-studio/interview";
import type {
  ContentDraft,
  ContentGuide,
  ContentGuideKind,
  ContentPlatform,
  ContentSession,
  ContentStudioWorkspace,
  InterviewPlaybookData
} from "@/lib/meridian/content-studio/types";
import type { ResourceAttachment, ResourceAttachmentListPayload } from "@/lib/resources/types";

type StudioFormatId =
  | "instagram_post"
  | "instagram_story"
  | "instagram_reel"
  | "facebook"
  | "twitter"
  | "church_ad"
  | "bumper_video";

type StudioFormat = {
  id: StudioFormatId;
  icon: LucideIcon;
  label: string;
  platform: ContentPlatform;
  ratio: string;
  stageClass: "feed" | "square" | "vertical" | "wide";
};

const studioFormats: StudioFormat[] = [
  { id: "instagram_post", icon: Camera, label: "Instagram Post", platform: "instagram", ratio: "4:5", stageClass: "feed" },
  { id: "instagram_story", icon: ImageIcon, label: "Instagram Story", platform: "instagram", ratio: "9:16", stageClass: "vertical" },
  { id: "instagram_reel", icon: Film, label: "Instagram Reel", platform: "instagram", ratio: "9:16", stageClass: "vertical" },
  { id: "facebook", icon: Share2, label: "Facebook", platform: "facebook", ratio: "1.91:1", stageClass: "wide" },
  { id: "twitter", icon: AtSign, label: "X / Twitter", platform: "twitter", ratio: "16:9", stageClass: "wide" },
  { id: "church_ad", icon: Megaphone, label: "Church Ad", platform: "church_slide", ratio: "1:1", stageClass: "square" },
  { id: "bumper_video", icon: Film, label: "Bumper Video", platform: "church_slide", ratio: "16:9", stageClass: "wide" }
];

const toneOptions = ["Invitational", "Pastoral", "Bold", "Playful", "Reverent"] as const;

const platformLabels: Record<ContentPlatform, string> = {
  twitter: "Twitter / X",
  facebook: "Facebook",
  instagram: "Instagram",
  church_slide: "Church Ad",
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
  const chatThreadRef = useRef<HTMLDivElement>(null);
  const [selectedFormatId, setSelectedFormatId] = useState<StudioFormatId>("instagram_reel");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<(typeof toneOptions)[number]>("Bold");
  const [interviewMode, setInterviewMode] = useState<"guided" | "skipped">("guided");
  const [interviewSession, setInterviewSession] = useState<ContentSession | null>(null);
  const [answer, setAnswer] = useState("");
  const [resourceOpen, setResourceOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSentiment, setFeedbackSentiment] = useState<"positive" | "correction">("positive");
  const [guideTarget, setGuideTarget] = useState<"voice" | "visual" | "platform">("voice");
  const [actionMessage, setActionMessage] = useState("");
  const [guideFilter, setGuideFilter] = useState<ContentGuideKind | "all">("all");
  const [rollbackGuideId, setRollbackGuideId] = useState<string | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");
  const [pending, startTransition] = useTransition();

  const selectedFormat = studioFormats.find((format) => format.id === selectedFormatId) ?? studioFormats[2];
  const selectedDraft = useMemo(() => {
    const platformDrafts = workspace.drafts.filter((draft) => draft.platform === selectedFormat.platform);
    return platformDrafts.find((draft) => draft.design.aspectRatio === selectedFormat.ratio) ?? platformDrafts[0];
  }, [selectedFormat, workspace.drafts]);
  const selectedDraftSession = selectedDraft ? workspace.sessions.find((session) => session.id === selectedDraft.sessionId) : undefined;
  const feedbackForDraft = workspace.feedback.filter((item) => item.draftId === selectedDraft?.id);
  const visibleGuides = workspace.guides.filter((guide) => guideFilter === "all" || guide.kind === guideFilter);

  useEffect(() => {
    const thread = chatThreadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [answer, interviewSession?.currentQuestion, interviewSession?.transcript.length, selectedDraft?.id]);

  function startContent() {
    if (!topic.trim()) {
      setActionMessage("Add a short brief before starting.");
      return;
    }
    setActionMessage("");
    setResourceOpen(false);
    startTransition(async () => {
      if (workspace.source === "preview") {
        const now = new Date().toISOString();
        const playbook = activePreviewPlaybook(workspace);
        const currentQuestion = interviewMode === "guided"
          ? selectOpeningQuestion({ playbook, topic: topic.trim(), platforms: [selectedFormat.platform] })
          : null;
        setInterviewSession({
          id: `preview-${Date.now()}`,
          ministryId: workspace.guides[0]?.ministryId ?? "preview",
          createdByUserId: "preview-user",
          topic: topic.trim(),
          contentType: `${selectedFormat.label} · ${tone}`,
          platforms: [selectedFormat.platform],
          interviewMode,
          status: interviewMode === "guided" ? "collecting" : "ready",
          questionCount: 0,
          maxQuestions: playbook.maxQuestions,
          coveredDimensions: [],
          transcript: [],
          currentQuestion,
          guideVersionIds: workspace.guides.filter((guide) => guide.status === "active").map((guide) => guide.id),
          createdAt: now,
          updatedAt: now
        });
        setActionMessage(interviewMode === "guided" ? "Meridian started a guided interview." : "Interview skipped. Your brief is ready for drafting.");
        return;
      }

      const result = await startContentInterviewAction({
        contentType: `${selectedFormat.label} · ${tone}`,
        platform: selectedFormat.platform,
        skipInterview: interviewMode === "skipped",
        topic
      });
      setActionMessage(result.message);
      if (result.session) setInterviewSession(result.session);
      if (result.ok) router.refresh();
    });
  }

  function submitAnswer(finishNow: boolean) {
    if (!interviewSession || interviewSession.status !== "collecting" || !answer.trim()) return;
    setActionMessage("");
    const submittedAnswer = answer.trim();
    setAnswer("");
    startTransition(async () => {
      if (workspace.source === "preview") {
        const advanced = advanceInterview({
          answer: submittedAnswer,
          finishNow,
          now: new Date().toISOString(),
          playbook: activePreviewPlaybook(workspace),
          session: interviewSession
        });
        setInterviewSession({ ...interviewSession, ...advanced, updatedAt: new Date().toISOString() });
        setActionMessage(advanced.status === "ready"
          ? "Interview complete. Your brief is ready for drafting."
          : "Answer saved. Meridian chose the next question from the active playbook.");
        return;
      }

      const result = await continueContentInterviewAction({
        answer: submittedAnswer,
        finishNow,
        sessionId: interviewSession.id
      });
      setActionMessage(result.message);
      if (result.session) setInterviewSession(result.session);
      if (result.ok) router.refresh();
    });
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
        <p className="eyebrow">Meridian Content Studio</p>
        <nav className="content-studio-format-tabs" aria-label="Content format">
          {studioFormats.map((format) => {
            const Icon = format.icon;
            return (
              <button
                aria-pressed={selectedFormat.id === format.id}
                className={selectedFormat.id === format.id ? "active" : ""}
                key={format.id}
                onClick={() => setSelectedFormatId(format.id)}
                type="button"
              >
                <Icon aria-hidden="true" />
                <span>{format.label}</span>
                <small>{format.ratio}</small>
              </button>
            );
          })}
        </nav>
      </section>

      <section className="panel content-studio-brief" aria-labelledby="content-studio-brief-title">
        <div className="content-studio-brief-heading">
          <div>
            <p className="eyebrow">Brief</p>
            <h2 id="content-studio-brief-title">What is this about?</h2>
          </div>
          <span className="content-studio-source-badge">{workspace.source === "preview" ? "Preview workspace" : "Live Meridian workspace"}</span>
        </div>
        <textarea
          className="input content-studio-brief-input"
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Example: Celebrate our students at MOTION and connect the moment to everyday discipleship."
          rows={2}
          value={topic}
        />
        <div className="content-studio-brief-footer">
          <div className="content-studio-tone-row" role="group" aria-label="Tone">
            <span>Tone</span>
            {toneOptions.map((option) => (
              <button aria-pressed={tone === option} className={tone === option ? "active" : ""} key={option} onClick={() => setTone(option)} type="button">{option}</button>
            ))}
          </div>
          <div className="content-studio-brief-actions">
            <div className="segmented-control" role="group" aria-label="Interview mode">
              <button className={interviewMode === "guided" ? "button compact-button active" : "button compact-button"} onClick={() => setInterviewMode("guided")} type="button">Guided interview</button>
              <button className={interviewMode === "skipped" ? "button compact-button active" : "button compact-button"} onClick={() => setInterviewMode("skipped")} type="button">Skip interview</button>
            </div>
            <button className="button primary" disabled={pending} onClick={startContent} type="button"><Sparkles aria-hidden="true" /> Start new content</button>
          </div>
        </div>
      </section>

      <section className="content-studio-creation-grid">
        <article className="panel content-studio-chat" aria-labelledby="content-studio-chat-title">
          <header className="content-studio-chat-header">
            <div>
              <p className="eyebrow">Meridian interview + copy</p>
              <h2 id="content-studio-chat-title">Ideas and text preview</h2>
            </div>
            <span className="pill">Drafts only</span>
          </header>

          <div className="content-studio-chat-thread" aria-live="polite" ref={chatThreadRef}>
            <ChatMessage role="assistant">
              {interviewSession
                ? `I’m shaping a ${selectedFormat.label.toLowerCase()} in a ${tone.toLowerCase()} voice. I’ll ask one useful question at a time and stop by ${interviewSession.maxQuestions} answers.`
                : "Add a brief above, choose guided or skip interview, and start new content. I’ll help turn the idea into a focused draft without measuring spiritual transformation by emotional intensity."}
            </ChatMessage>

            {interviewSession?.transcript.map((turn, index) => (
              <div className="content-studio-chat-turn" key={`${turn.answeredAt}-${index}`}>
                <ChatMessage role="assistant">{turn.question}</ChatMessage>
                <ChatMessage role="user">{turn.answer}</ChatMessage>
              </div>
            ))}

            {interviewSession?.currentQuestion ? (
              <ChatMessage role="assistant">
                <span className="content-studio-question-count">Question {interviewSession.currentQuestion.questionNumber} of {interviewSession.currentQuestion.maximumQuestions}</span>
                {interviewSession.currentQuestion.prompt}
              </ChatMessage>
            ) : null}

            {interviewSession?.status === "ready" ? (
              <ChatMessage role="assistant">
                <strong>Your brief is ready.</strong>
                <span>{interviewSession.interviewMode === "skipped" ? "You chose to skip the interview." : "Meridian reached the interview stopping condition."} The selected guides remain authoritative when the platform draft is created.</span>
                <button className="button compact-button" onClick={() => void copyDraftingHandoff(interviewSession, selectedFormat, setActionMessage)} type="button"><Clipboard aria-hidden="true" /> Copy drafting handoff</button>
              </ChatMessage>
            ) : null}

            {selectedDraft ? (
              <ChatMessage role="assistant" variant="draft">
                <span className="content-studio-question-count">{selectedFormat.label} copy · {selectedFormat.ratio}</span>
                <strong>{selectedDraftSession?.topic ?? "Current draft"}</strong>
                <span className="content-studio-chat-draft-copy">{selectedDraft.bodyMarkdown}</span>
                <div className="content-studio-chat-draft-actions">
                  <button className="button compact-button" onClick={() => void copyDraftText(selectedDraft, setActionMessage)} type="button"><Clipboard aria-hidden="true" /> Copy</button>
                  <button className="button compact-button" onClick={() => downloadDraft(selectedDraft, selectedDraftSession?.topic, setActionMessage)} type="button"><Download aria-hidden="true" /> Download</button>
                </div>
                <details className="content-studio-design-notes">
                  <summary>Design notes</summary>
                  <p><strong>Overlay:</strong> {selectedDraft.design.overlayText ?? "No overlay specified"}</p>
                  <p><strong>Direction:</strong> {selectedDraft.design.visualDirection ?? "No visual direction specified"}</p>
                </details>
              </ChatMessage>
            ) : (
              <ChatMessage role="assistant" variant="muted">No {selectedFormat.label} draft has been saved yet. Finish the interview, then use the drafting handoff through Meridian in Codex or Claude.</ChatMessage>
            )}
          </div>

          <div className="content-studio-chat-composer">
            <textarea
              aria-label="Message Meridian"
              className="input"
              disabled={!interviewSession || interviewSession.status !== "collecting" || pending}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitAnswer(false);
                }
              }}
              placeholder={interviewSession?.status === "collecting" ? "Answer Meridian…" : "Start guided content to answer here"}
              rows={3}
              value={answer}
            />
            <div className="content-studio-composer-actions">
              <button className="button compact-button" disabled={!selectedDraft} onClick={() => setResourceOpen((current) => !current)} type="button"><Paperclip aria-hidden="true" /> {resourceOpen ? "Close resources" : "Add resource"}</button>
              <div>
                {interviewSession?.status === "collecting" ? <button className="button compact-button" disabled={!answer.trim() || pending} onClick={() => submitAnswer(true)} type="button">Finish with this answer</button> : null}
                <button aria-label="Send answer" className="button primary" disabled={!answer.trim() || interviewSession?.status !== "collecting" || pending} onClick={() => submitAnswer(false)} type="button"><Send aria-hidden="true" /> Send</button>
              </div>
            </div>
            {resourceOpen && selectedDraft ? <ResourceAttachments compact parentId={selectedDraft.id} parentType="content_draft" title="Conversation resources" /> : null}
          </div>
        </article>

        <ContentStudioMediaPreview draft={selectedDraft} format={selectedFormat} topic={selectedDraftSession?.topic} />
      </section>

      {selectedDraft ? (
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
      ) : null}

      <details className="panel content-studio-governance">
        <summary>
          <span><History aria-hidden="true" /><span><strong>Meridian style guide and learning history</strong><small>Feedback batches, active versions, and rollback controls</small></span></span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="content-studio-governance-grid">
          <section className="content-studio-batches">
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

          <section className="content-studio-guide-history">
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
        </div>
      </details>

      {actionMessage ? <div className="content-studio-toast" role="status">{actionMessage}</div> : null}
    </main>
  );
}

function ChatMessage({ children, role, variant = "default" }: {
  children: React.ReactNode;
  role: "assistant" | "user";
  variant?: "default" | "draft" | "muted";
}) {
  return (
    <div className={`content-studio-chat-message ${role} ${variant}`}>
      <span className="content-studio-chat-avatar" aria-hidden="true">{role === "assistant" ? <Sparkles /> : "You"}</span>
      <div>{children}</div>
    </div>
  );
}

function ContentStudioMediaPreview({ draft, format, topic }: { draft?: ContentDraft; format: StudioFormat; topic?: string }) {
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [driveMessage, setDriveMessage] = useState("");

  useEffect(() => {
    let active = true;
    setVideoUrl("");
    setVideoTitle("");
    if (!draft) return () => { active = false; };
    setLoading(true);
    async function loadVideo() {
      try {
        const response = await fetch(`/api/resource-attachments/parents/content_draft/${encodeURIComponent(draft!.id)}?includeArchived=false`, { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as Partial<ResourceAttachmentListPayload>;
        if (!response.ok) return;
        const video = (payload.resources ?? []).find((resource: ResourceAttachment) => resource.resourceType === "video" && !resource.archivedAt);
        if (!video) return;
        const openResponse = await fetch(`/api/resource-attachments/items/${video.id}/open`, { cache: "no-store" });
        const openPayload = (await openResponse.json().catch(() => ({}))) as { url?: string };
        if (openResponse.ok && openPayload.url && active) {
          setVideoUrl(openPayload.url);
          setVideoTitle(video.title);
        }
      } catch {
        if (active) {
          setVideoUrl("");
          setVideoTitle("");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadVideo();
    return () => { active = false; };
  }, [draft]);

  function prepareForDrive() {
    if (!draft) {
      setDriveMessage("Save a draft before preparing a Google Drive handoff.");
      return;
    }
    downloadDraft(draft, topic, setDriveMessage);
    window.open("https://drive.google.com/drive/my-drive", "_blank", "noopener,noreferrer");
    setDriveMessage("Draft downloaded and Google Drive opened. Upload the reviewed draft or rendered video there manually.");
  }

  return (
    <aside className="panel content-studio-media-preview" aria-label={`${format.label} preview`}>
      <header>
        <p className="eyebrow">{format.label} preview · {format.ratio}</p>
        <span className="pill">Draft only</span>
      </header>
      <div className={`content-studio-preview-stage ${format.stageClass}`}>
        {videoUrl ? (
          <video aria-label={videoTitle || `${format.label} video`} controls playsInline preload="metadata" src={videoUrl}>Your browser does not support this video preview.</video>
        ) : (
          <div className="content-studio-preview-placeholder">
            <Film aria-hidden="true" />
            <strong>{loading ? "Loading video preview…" : draft?.design.overlayText ?? `${format.label} preview`}</strong>
            <span>{loading ? "Checking rendered assets" : "Attach a rendered video from the conversation to watch it here."}</span>
          </div>
        )}
      </div>
      {!draft ? <p className="content-studio-empty">No {format.label} draft is available yet.</p> : null}
      <button className="button content-studio-drive-button" onClick={prepareForDrive} type="button"><Upload aria-hidden="true" /> Publish to Google Drive <ExternalLink aria-hidden="true" /></button>
      <small className="content-studio-drive-note">Manual handoff only. Nothing is uploaded or published automatically.</small>
      {driveMessage ? <p className="content-studio-form-message" role="status">{driveMessage}</p> : null}
    </aside>
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

function activePreviewPlaybook(workspace: ContentStudioWorkspace) {
  const guide = workspace.guides.find((candidate) => candidate.kind === "interviewer" && candidate.status === "active");
  const data = guide?.guideData as Partial<InterviewPlaybookData> | undefined;
  return data?.dimensions?.length && data.maxQuestions && data.minQuestions ? data as InterviewPlaybookData : previewInterviewPlaybook;
}

async function copyDraftingHandoff(session: ContentSession, format: StudioFormat, setMessage: (message: string) => void) {
  const brief = contentBrief(session);
  const prompt = `Use the Lead Emergence Meridian MCP to create and save a ${format.label} draft at ${format.ratio}. Apply the active voice, visual, and platform guides. Brief: ${JSON.stringify(brief)}. Save drafts only; do not publish, send, or schedule.`;
  setMessage(await copyText(prompt) ? "Drafting handoff copied for Codex or Claude." : "Copy was blocked by the browser.");
}

async function copyDraftText(draft: ContentDraft, setMessage: (message: string) => void) {
  setMessage(await copyText(draft.bodyMarkdown) ? "Draft copied." : "Copy was blocked by the browser.");
}

function downloadDraft(draft: ContentDraft, topic: string | undefined, setMessage: (message: string) => void) {
  const blob = new Blob([draft.bodyMarkdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${draft.platform}-${slugify(topic ?? "content-draft")}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
  setMessage("Draft downloaded for manual use.");
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
