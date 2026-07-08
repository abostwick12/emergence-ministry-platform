"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StudentQuestionComposer } from "@/components/student/student-question-composer";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import type { StudentHomeFeed as StudentHomeFeedData, StudentKeepReadingItem } from "@/lib/scripture/student-home";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

type StudentHomeFeedProps = {
  initialState: DiscussionWorkflowState;
  initialFeed: StudentHomeFeedData;
  userName: string;
};

export function StudentHomeFeed({ initialState, initialFeed, userName }: StudentHomeFeedProps) {
  const [prompts, setPrompts] = useState(initialState.prompts);
  const firstName = userName.split(" ")[0] || userName;

  const forGroup = useMemo(
    () => prompts.filter((prompt) => prompt.status === "approved" || prompt.status === "posted").slice(0, 4),
    [prompts]
  );
  const recentQuestions = useMemo(() => prompts.slice(0, 4), [prompts]);

  function addPrompt(prompt: StudentDiscussionPrompt) {
    setPrompts((current) => [prompt, ...current]);
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

        <FeedSection title="For your group" emptyTitle="Nothing approved yet." emptyBody="Leader-approved discussion prompts will appear here when they are ready.">
          {(forGroup.length ? forGroup : initialFeed.forGroup).map((prompt) => (
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
          {initialFeed.keepReading.map((item) => (
            <KeepReadingLink item={item} key={item.id} />
          ))}
        </div>
      </aside>
    </div>
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

function DiscussionFeedRow({ prompt }: { prompt: StudentDiscussionPrompt }) {
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
