"use client";

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

export function StudentHomeFeed({ initialState, initialFeed, userName }: StudentHomeFeedProps) {
  const [recentQuestions, setRecentQuestions] = useState(initialFeed.recentQuestions);
  const [keepReading, setKeepReading] = useState(initialFeed.keepReading);
  const [nextStep, setNextStep] = useState<StudentQuestionNextStep | undefined>();
  const firstName = userName.split(" ")[0] || userName;

  function addPrompt(prompt: StudentDiscussionPrompt, nextPromptStep: StudentQuestionNextStep) {
    setRecentQuestions((current) => [prompt, ...current].filter((item) => item.submittedByUserId === prompt.submittedByUserId).slice(0, 4));
    setNextStep(nextPromptStep);
    setKeepReading((current) => mergeKeepReading(current, [nextPromptStep.readingPlan, nextPromptStep.resource]));
  }

  return (
    <div className="student-feed">
      <section className="student-feed-main" aria-label="Student home feed">
        <div className="student-feed-welcome">
          <p className="eyebrow">Student Portal</p>
          <h1>Welcome back, {firstName}.</h1>
          <p>Ask real questions, keep reading, and bring better conversations to your group.</p>
        </div>

        <StudentQuestionComposer readiness={initialState.readiness} onCreated={addPrompt} />

        {nextStep ? <StudentQuestionNextStepCard nextStep={nextStep} /> : null}

        <FeedSection title="For your group" emptyTitle="Nothing approved yet." emptyBody="Leader-approved discussion prompts will appear here when they are ready.">
          {initialFeed.forGroup.map((prompt) => (
            <DiscussionFeedRow key={prompt.id} prompt={prompt} />
          ))}
        </FeedSection>

        <FeedSection title="Your recent questions" emptyTitle="No questions sent yet." emptyBody="When you send a real question, it will show here while your leader reviews it.">
          {recentQuestions.map((prompt) => (
            <QuestionFeedRow key={prompt.id} prompt={prompt} />
          ))}
        </FeedSection>
      </section>

      <aside className="student-feed-rail" aria-label="Keep reading">
        <div>
          <p className="eyebrow">Keep reading</p>
          <h2>Picked for where you are</h2>
        </div>
        <div className="student-feed-rail-list">
          {keepReading.map((item) => (
            <KeepReadingLink item={item} key={item.id} />
          ))}
        </div>
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
        <div className="student-next-step-panel">
          <span>Questions to dig into</span>
          <ul>
            {nextStep.digQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
        <div className="student-next-step-panel">
          <span>Reading direction</span>
          <KeepReadingLink item={nextStep.readingPlan} />
          <KeepReadingLink item={nextStep.resource} />
        </div>
      </div>
    </section>
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

function QuestionFeedRow({ prompt }: { prompt: StudentDiscussionPrompt }) {
  return (
    <article className="student-feed-row">
      <div>
        <span>{prompt.scriptureReference || "No passage selected"}</span>
        <h3>{prompt.question}</h3>
        <p>{statusText(prompt)}</p>
      </div>
      <span className={prompt.status === "changes_requested" ? "pill amber" : "pill blue"}>{statusLabel(prompt.status)}</span>
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
