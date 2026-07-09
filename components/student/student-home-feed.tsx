"use client";

import { BookOpen, Heart, MessageCircle, PenLine, Search, Sparkles, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StudentQuestionComposer } from "@/components/student/student-question-composer";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import type { StudentQuestionReflection } from "@/lib/scripture/student-reflections";
import type {
  StudentGroupDiscussionItem,
  StudentHomeFeed as StudentHomeFeedData,
  StudentKeepReadingItem,
  StudentQuestionNextStep
} from "@/lib/scripture/student-home";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

type StudentHomeFeedProps = {
  initialState: DiscussionWorkflowState;
  initialFeed: StudentHomeFeedData;
  initialReflections: Record<string, StudentQuestionReflection>;
  userName: string;
};

type ReflectionResponse = {
  ok?: boolean;
  error?: string;
  reflection?: StudentQuestionReflection;
};

const readingHelps = [
  {
    title: "How to Read the Bible",
    description: "Start with the whole story before zooming into a single verse.",
    icon: BookOpen
  },
  {
    title: "Understanding Context",
    description: "Ask who wrote it, who received it, and what was happening around them.",
    icon: Sparkles
  },
  {
    title: "Asking Good Questions",
    description: "Look for what it shows about God, people, and faithful response.",
    icon: Users
  }
] as const;

export function StudentHomeFeed({ initialState, initialFeed, initialReflections, userName }: StudentHomeFeedProps) {
  const [recentQuestions, setRecentQuestions] = useState(initialFeed.recentQuestions);
  const [keepReading, setKeepReading] = useState(initialFeed.keepReading);
  const [questionNextSteps, setQuestionNextSteps] = useState(initialFeed.questionNextSteps);
  const [reflections, setReflections] = useState(initialReflections);
  const [activePromptId, setActivePromptId] = useState(initialFeed.recentQuestions[0]?.id);
  const [activeGroupPromptId, setActiveGroupPromptId] = useState(initialFeed.forGroup[0]?.id);
  const [activeJourneyType, setActiveJourneyType] = useState<"question" | "group">(initialFeed.recentQuestions[0] ? "question" : "group");
  const firstName = userName.split(" ")[0] || userName;
  const activePrompt = activeJourneyType === "question" ? recentQuestions.find((prompt) => prompt.id === activePromptId) : undefined;
  const activeNextStep = activePrompt ? nextStepForPrompt(activePrompt.id) : undefined;
  const activeGroupPrompt = activeJourneyType === "group" ? initialFeed.forGroup.find((prompt) => prompt.id === activeGroupPromptId) : undefined;
  const activeGroupNextStep = activeGroupPrompt ? groupNextStepForPrompt(activeGroupPrompt.id) : undefined;

  function addPrompt(prompt: StudentDiscussionPrompt, nextPromptStep: StudentQuestionNextStep) {
    setRecentQuestions((current) => [prompt, ...current].filter((item) => item.submittedByUserId === prompt.submittedByUserId).slice(0, 4));
    setQuestionNextSteps((current) => [nextPromptStep, ...current.filter((item) => item.promptId !== prompt.id)].slice(0, 4));
    setActivePromptId(prompt.id);
    setActiveJourneyType("question");
    setKeepReading((current) => mergeKeepReading(current, [nextPromptStep.readingPlan, nextPromptStep.resource]));
  }

  function updateReflection(reflection: StudentQuestionReflection) {
    setReflections((current) => ({ ...current, [reflection.promptId]: reflection }));
  }

  function nextStepForPrompt(promptId: string) {
    return questionNextSteps.find((item) => item.promptId === promptId);
  }

  function groupNextStepForPrompt(promptId: string) {
    return initialFeed.groupNextSteps.find((item) => item.promptId === promptId);
  }

  return (
    <div className="student-feed">
      <section className="student-reading-helps" aria-label="Bible reading helps">
        {readingHelps.map((help) => (
          <article className="student-reading-help" key={help.title}>
            <span className="student-help-icon" aria-hidden="true">
              <help.icon size={17} />
            </span>
            <div>
              <h2>{help.title}</h2>
              <p>{help.description}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="student-feed-main" aria-label="Student home feed">
        <div className="student-feed-welcome">
          <p className="eyebrow">Student Portal</p>
          <h1>Welcome back, {firstName}.</h1>
          <p>Ask real questions, keep reading, and bring better conversations to your group.</p>
        </div>

        <section className="student-scripture-tool" aria-label="Scripture study shortcuts">
          <div className="student-tool-heading">
            <span className="student-help-icon" aria-hidden="true">
              <BookOpen size={17} />
            </span>
            <h2>Scripture Study Tool</h2>
          </div>
          <div className="student-tool-search">
            <Search size={17} aria-hidden="true" />
            <span>Look up a passage or topic through the resources below.</span>
          </div>
          <div className="student-tool-chips" aria-label="Starter passages">
            {["Genesis 1", "Psalm 23", "John 1:1-14", "Romans 8", "The Sermon on the Mount"].map((label) => (
              <Link href="/student/scripture/resources" key={label}>
                {label}
              </Link>
            ))}
          </div>
        </section>

        {activePrompt && activeNextStep ? (
          <StudentQuestionJourneyCard
            key={activePrompt.id}
            nextStep={activeNextStep}
            onReflectionSaved={updateReflection}
            prompt={activePrompt}
            reflection={reflections[activePrompt.id]}
          />
        ) : null}

        {activeGroupPrompt && activeGroupNextStep ? (
          <GroupDiscussionFollowThroughCard key={activeGroupPrompt.id} nextStep={activeGroupNextStep} prompt={activeGroupPrompt} />
        ) : null}

        <FeedSection title="For your group" emptyTitle="Nothing approved yet." emptyBody="Leader-approved discussion prompts will appear here when they are ready.">
          {initialFeed.forGroup.map((prompt) => (
            <DiscussionFeedRow
              isActive={activeJourneyType === "group" && prompt.id === activeGroupPromptId}
              key={prompt.id}
              onOpen={() => {
                setActiveGroupPromptId(prompt.id);
                setActiveJourneyType("group");
              }}
              prompt={prompt}
            />
          ))}
        </FeedSection>

        <FeedSection title="Your recent questions" emptyTitle="No questions sent yet." emptyBody="When you send a real question, it will show here while your leader reviews it.">
          {recentQuestions.map((prompt) => (
            <QuestionFeedRow
              isActive={prompt.id === activePromptId}
              key={prompt.id}
              nextStep={nextStepForPrompt(prompt.id)}
              onOpenJourney={() => {
                setActivePromptId(prompt.id);
                setActiveJourneyType("question");
              }}
              prompt={prompt}
            />
          ))}
        </FeedSection>
      </section>

      <aside className="student-feed-rail" aria-label="Student actions and keep reading">
        <StudentQuestionComposer readiness={initialState.readiness} onCreated={addPrompt} />

        <section className="student-feed-rail-card" aria-label="Keep reading">
          <div>
            <p className="eyebrow">Keep reading</p>
            <h2>Picked for where you are</h2>
          </div>
          <div className="student-feed-rail-list">
            {keepReading.map((item) => (
              <KeepReadingLink item={item} key={item.id} />
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function GroupDiscussionFollowThroughCard({
  nextStep,
  prompt
}: {
  nextStep: StudentQuestionNextStep;
  prompt: StudentGroupDiscussionItem;
}) {
  return (
    <section className="student-question-journey student-group-follow-through" aria-label="Group discussion follow-through">
      <div className="student-question-journey-header">
        <div>
          <p className="eyebrow">Wrestle Together</p>
          <h2>{prompt.discussionPrompt || prompt.question}</h2>
          <p>Use this leader-approved prompt before or after group so the conversation keeps forming you.</p>
        </div>
        <span className="pill green">{prompt.status === "posted" ? "Shared" : "Ready"}</span>
      </div>

      <div className="student-question-journey-meta" aria-label="Group discussion status">
        <JourneyMeta label="Passage" value={prompt.scriptureReference || "Open together"} />
        <JourneyMeta label="Question" value="Leader reviewed" />
        <JourneyMeta label="Next" value="Read, reflect, bring it back" />
      </div>

      <div className="student-question-journey-response">
        <span>Original question</span>
        <p>{prompt.question}</p>
      </div>

      <div className="student-next-step-copy">
        <p className="eyebrow">{nextStep.label}</p>
        <h2>{nextStep.title}</h2>
        <p>{nextStep.summary}</p>
      </div>
      <StudentNextStepRhythm nextStep={nextStep} />
      <p className="student-next-step-care">
        <strong>Bring this back:</strong> Write down one thing you noticed, one question you still have, and one way your group can respond together.
      </p>
    </section>
  );
}

function StudentQuestionJourneyCard({
  prompt,
  nextStep,
  onReflectionSaved,
  reflection
}: {
  prompt: StudentDiscussionPrompt;
  nextStep: StudentQuestionNextStep;
  onReflectionSaved: (reflection: StudentQuestionReflection) => void;
  reflection?: StudentQuestionReflection;
}) {
  const hasLeaderResponse = prompt.status === "approved" || prompt.status === "posted";

  return (
    <section className="student-question-journey" aria-label="Question journey">
      <div className="student-question-journey-header">
        <div>
          <p className="eyebrow">Question Journey</p>
          <h2>{prompt.question}</h2>
          <p>{journeySummary(prompt)}</p>
        </div>
        <span className={prompt.status === "changes_requested" ? "pill amber" : "pill blue"}>{statusLabel(prompt.status)}</span>
      </div>

      <div className="student-question-journey-meta" aria-label="Question status">
        <JourneyMeta label="Passage" value={prompt.scriptureReference || "No passage selected"} />
        <JourneyMeta label="Submitted" value={formatQuestionDate(prompt.createdAt)} />
        <JourneyMeta label="Next" value={hasLeaderResponse ? "Bring it to group" : "Keep wrestling while it is with your leader"} />
      </div>

      <div className="student-question-journey-response">
        <span>{hasLeaderResponse ? "Leader-approved prompt" : "With your leader"}</span>
        <p>
          {hasLeaderResponse && prompt.discussionPrompt
            ? prompt.discussionPrompt
            : "Your leader can shape this into a careful group conversation. Use the rhythm below while you wait."}
        </p>
      </div>

      <div className="student-next-step-copy">
        <p className="eyebrow">{nextStep.label}</p>
        <h2>{nextStep.title}</h2>
        <p>{nextStep.summary}</p>
      </div>
      <StudentNextStepRhythm nextStep={nextStep} />
      <StudentReflectionPanel onSaved={onReflectionSaved} prompt={prompt} reflection={reflection} />
      {nextStep.careNote ? (
        <p className="student-next-step-care">
          <strong>Bring this with you:</strong> {nextStep.careNote}
        </p>
      ) : null}
    </section>
  );
}

function StudentReflectionPanel({
  onSaved,
  prompt,
  reflection
}: {
  onSaved: (reflection: StudentQuestionReflection) => void;
  prompt: StudentDiscussionPrompt;
  reflection?: StudentQuestionReflection;
}) {
  const [privateNote, setPrivateNote] = useState(reflection?.privateNote ?? "");
  const [isReflected, setIsReflected] = useState(Boolean(reflection?.reflectedAt));
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(reflection?.reflectedAt ? "You marked this as reflected." : "Private to you.");

  async function saveReflection(reflected: boolean) {
    setIsSaving(true);
    setStatus(reflected ? "Saving your reflection..." : "Saving your private note...");
    try {
      const response = await fetch("/api/student/scripture/reflections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId: prompt.id, reflected, privateNote })
      });
      const payload = (await response.json()) as ReflectionResponse;
      if (!response.ok || !payload.ok || !payload.reflection) {
        setStatus(payload.error ?? "Reflection could not be saved.");
        return;
      }

      onSaved(payload.reflection);
      setIsReflected(Boolean(payload.reflection.reflectedAt));
      setPrivateNote(payload.reflection.privateNote);
      setStatus(payload.reflection.reflectedAt ? "Reflection saved. Bring this with you to group." : "Private note saved.");
    } catch {
      setStatus("Reflection could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="student-question-reflection" aria-label="Private reflection">
      <div>
        <p className="eyebrow">Reflect</p>
        <h3>What are you noticing?</h3>
        <p>Save a private note for yourself before this becomes a group conversation.</p>
      </div>
      <label>
        <span>Private note</span>
        <textarea
          maxLength={1200}
          onChange={(event) => setPrivateNote(event.target.value)}
          placeholder="What are you starting to see, wonder, or pray?"
          value={privateNote}
        />
      </label>
      <div className="student-question-reflection-actions">
        <button className="button" disabled={isSaving} onClick={() => void saveReflection(isReflected)} type="button">
          {isSaving ? "Saving..." : "Save note"}
        </button>
        <button className="button primary" disabled={isSaving} onClick={() => void saveReflection(true)} type="button">
          {isReflected ? "Reflected" : "I reflected on this"}
        </button>
      </div>
      <p className="student-question-reflection-status" role="status">
        {status}
      </p>
    </section>
  );
}

function JourneyMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StudentNextStepRhythm({ nextStep }: { nextStep: StudentQuestionNextStep }) {
  return (
    <div className="student-next-step-grid">
      <StudentNextStepPanel icon={MessageCircle} title="Wrestle with your question">
        <QuestionList questions={nextStep.wrestleQuestions} />
      </StudentNextStepPanel>

      <StudentNextStepPanel icon={BookOpen} title="Dig deeper">
        <QuestionList questions={nextStep.digQuestions} />
        <KeepReadingLink item={nextStep.readingPlan} />
        <KeepReadingLink item={nextStep.resource} />
      </StudentNextStepPanel>

      <StudentNextStepPanel icon={PenLine} title="Reflect">
        <QuestionList questions={nextStep.journalPrompts} />
      </StudentNextStepPanel>

      <StudentNextStepPanel icon={Heart} title="Pray">
        <QuestionList questions={nextStep.prayerPrompts} />
      </StudentNextStepPanel>

      <StudentNextStepPanel className="student-next-step-panel-wide" icon={Users} title="Wrestle together">
        <p className="student-next-step-together">{nextStep.wrestleTogetherPrompt}</p>
      </StudentNextStepPanel>
    </div>
  );
}

function StudentNextStepPanel({
  title,
  icon: Icon,
  className = "",
  children
}: {
  title: string;
  icon: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`student-next-step-panel ${className}`}>
      <span className="student-next-step-panel-title">
        <Icon size={14} aria-hidden="true" />
        {title}
      </span>
      {children}
    </div>
  );
}

function QuestionList({ questions }: { questions: string[] }) {
  return (
    <ul>
      {questions.map((question) => (
        <li key={question}>{question}</li>
      ))}
    </ul>
  );
}

function FeedSection({
  title,
  emptyTitle,
  emptyBody,
  children
}: {
  title: string;
  emptyTitle: string;
  emptyBody: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section className="student-feed-section">
      <div className="student-feed-section-heading">
        <h2>{title}</h2>
      </div>
      {hasChildren ? <div className="student-feed-list">{children}</div> : <EmptyFeedState title={emptyTitle} body={emptyBody} />}
    </section>
  );
}

function DiscussionFeedRow({
  isActive,
  onOpen,
  prompt
}: {
  isActive: boolean;
  onOpen: () => void;
  prompt: StudentGroupDiscussionItem;
}) {
  return (
    <article className="student-feed-row">
      <div>
        <span>{prompt.scriptureReference || "Group discussion"}</span>
        <h3>{prompt.discussionPrompt || prompt.question}</h3>
        <p>{prompt.question}</p>
      </div>
      <div className="student-feed-row-actions">
        <span className="pill green">{prompt.status === "posted" ? "Shared" : "Approved"}</span>
        <button className="button secondary" onClick={onOpen} type="button">
          {isActive ? "Open above" : "Open follow-up"}
        </button>
      </div>
    </article>
  );
}

function QuestionFeedRow({
  prompt,
  nextStep,
  isActive,
  onOpenJourney
}: {
  prompt: StudentDiscussionPrompt;
  nextStep?: StudentQuestionNextStep;
  isActive: boolean;
  onOpenJourney: () => void;
}) {
  return (
    <article className="student-feed-row">
      <div>
        <span>{prompt.scriptureReference || "No passage selected"}</span>
        <h3>{prompt.question}</h3>
        <p>{statusText(prompt)}</p>
      </div>
      <div className="student-feed-row-actions">
        <span className={prompt.status === "changes_requested" ? "pill amber" : "pill blue"}>{statusLabel(prompt.status)}</span>
        {nextStep ? (
          <button className="button secondary" onClick={onOpenJourney} type="button">
            {isActive ? "Journey open" : "Open journey"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function KeepReadingLink({ item }: { item: StudentKeepReadingItem }) {
  return (
    <Link className="student-keep-reading-link" href={item.href}>
      <span>{item.label}</span>
      <strong>{item.title}</strong>
      <p>{item.description}</p>
    </Link>
  );
}

function mergeKeepReading(current: StudentKeepReadingItem[], incoming: StudentKeepReadingItem[]) {
  const merged = [...incoming, ...current];
  const seen = new Set<string>();
  return merged
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, 4);
}

function EmptyFeedState({ title, body }: { title: string; body: string }) {
  return (
    <div className="student-feed-empty">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function statusText(prompt: StudentDiscussionPrompt) {
  if (prompt.status === "changes_requested") return "Your leader asked for a little more shaping.";
  if (prompt.status === "approved") return "Approved for group discussion.";
  if (prompt.status === "posted") return "Shared with the group.";
  if (prompt.status === "archived") return "Archived by a leader.";
  return "Sent to your leader for review.";
}

function statusLabel(status: StudentDiscussionPrompt["status"]) {
  if (status === "pending_review") return "With leader";
  if (status === "changes_requested") return "Needs update";
  return status.replace(/_/g, " ");
}

function journeySummary(prompt: StudentDiscussionPrompt) {
  if (prompt.status === "changes_requested") return "Your leader asked for more shaping. Keep naming what you are really asking.";
  if (prompt.status === "approved") return "Your leader approved this for group discussion. Keep reading before you wrestle together.";
  if (prompt.status === "posted") return "This has been shared for group discussion. Come ready to listen and respond.";
  if (prompt.status === "archived") return "This question has been archived, but the reading path can still help you process it.";
  return "Use this space to keep wrestling with your question while your leader prepares the group conversation.";
}

function formatQuestionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}
