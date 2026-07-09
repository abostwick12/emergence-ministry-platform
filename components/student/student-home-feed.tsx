"use client";

import { BookOpen, Heart, MessageCircle, PenLine, Search, Sparkles, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StudentQuestionComposer } from "@/components/student/student-question-composer";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
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
  userName: string;
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

export function StudentHomeFeed({ initialState, initialFeed, userName }: StudentHomeFeedProps) {
  const [recentQuestions, setRecentQuestions] = useState(initialFeed.recentQuestions);
  const [keepReading, setKeepReading] = useState(initialFeed.keepReading);
  const [questionNextSteps, setQuestionNextSteps] = useState(initialFeed.questionNextSteps);
  const [nextStep, setNextStep] = useState<StudentQuestionNextStep | undefined>(initialFeed.questionNextSteps[0]);
  const firstName = userName.split(" ")[0] || userName;

  function addPrompt(prompt: StudentDiscussionPrompt, nextPromptStep: StudentQuestionNextStep) {
    setRecentQuestions((current) => [prompt, ...current].filter((item) => item.submittedByUserId === prompt.submittedByUserId).slice(0, 4));
    setQuestionNextSteps((current) => [nextPromptStep, ...current.filter((item) => item.promptId !== prompt.id)].slice(0, 4));
    setNextStep(nextPromptStep);
    setKeepReading((current) => mergeKeepReading(current, [nextPromptStep.readingPlan, nextPromptStep.resource]));
  }

  function nextStepForPrompt(promptId: string) {
    return questionNextSteps.find((item) => item.promptId === promptId);
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

        {nextStep ? <StudentQuestionNextStepCard nextStep={nextStep} /> : null}

        <FeedSection title="For your group" emptyTitle="Nothing approved yet." emptyBody="Leader-approved discussion prompts will appear here when they are ready.">
          {initialFeed.forGroup.map((prompt) => (
            <DiscussionFeedRow key={prompt.id} prompt={prompt} />
          ))}
        </FeedSection>

        <FeedSection title="Your recent questions" emptyTitle="No questions sent yet." emptyBody="When you send a real question, it will show here while your leader reviews it.">
          {recentQuestions.map((prompt) => (
            <QuestionFeedRow key={prompt.id} nextStep={nextStepForPrompt(prompt.id)} onOpenNextStep={setNextStep} prompt={prompt} />
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

function StudentQuestionNextStepCard({ nextStep }: { nextStep: StudentQuestionNextStep }) {
  return (
    <section className="student-next-step" aria-label="Question next steps">
      <div className="student-next-step-copy">
        <p className="eyebrow">{nextStep.label}</p>
        <h2>{nextStep.title}</h2>
        <p>{nextStep.summary}</p>
      </div>
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
      {nextStep.careNote ? (
        <p className="student-next-step-care">
          <strong>Bring this with you:</strong> {nextStep.careNote}
        </p>
      ) : null}
    </section>
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

function DiscussionFeedRow({ prompt }: { prompt: StudentGroupDiscussionItem }) {
  return (
    <article className="student-feed-row">
      <div>
        <span>{prompt.scriptureReference || "Group discussion"}</span>
        <h3>{prompt.discussionPrompt || prompt.question}</h3>
        <p>{prompt.question}</p>
      </div>
      <span className="pill green">{prompt.status === "posted" ? "Shared" : "Approved"}</span>
    </article>
  );
}

function QuestionFeedRow({
  prompt,
  nextStep,
  onOpenNextStep
}: {
  prompt: StudentDiscussionPrompt;
  nextStep?: StudentQuestionNextStep;
  onOpenNextStep: (nextStep: StudentQuestionNextStep) => void;
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
          <button className="button secondary" onClick={() => onOpenNextStep(nextStep)} type="button">
            Open next steps
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
