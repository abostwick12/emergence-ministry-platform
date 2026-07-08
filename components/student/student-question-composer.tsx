"use client";

import { useState } from "react";

import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

type StudentQuestionComposerProps = {
  readiness: DiscussionWorkflowState["readiness"];
  onCreated?: (prompt: StudentDiscussionPrompt) => void;
};

type CreateResponse = {
  ok?: boolean;
  error?: string;
  prompt?: StudentDiscussionPrompt;
};

export function StudentQuestionComposer({ readiness, onCreated }: StudentQuestionComposerProps) {
  const [question, setQuestion] = useState("");
  const [scriptureReference, setScriptureReference] = useState("");
  const [status, setStatus] = useState(readiness.liveStorage ? "Your question will go to a leader before it is shared." : "Live question submission needs a signed-in student account.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("Sending your question to a leader...");

    try {
      const response = await fetch("/api/student/scripture/discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, scriptureReference })
      });
      const payload = (await response.json()) as CreateResponse;
      if (!response.ok || !payload.ok || !payload.prompt) {
        setStatus(payload.error ?? "Your question could not be saved.");
        return;
      }

      onCreated?.(payload.prompt);
      setQuestion("");
      setScriptureReference("");
      setStatus("Sent to your leader. They will shape it for group discussion.");
    } catch {
      setStatus("Your question could not be saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="student-question-composer" onSubmit={submitQuestion} aria-label="Ask a small group question">
      <div className="student-question-composer-copy">
        <p className="eyebrow">Ask</p>
        <h1>What should we talk about next?</h1>
        <p>Your leader will help shape honest questions into careful group discussion.</p>
      </div>

      <label className="student-question-field">
        <span>What are you wondering?</span>
        <textarea
          disabled={!readiness.liveStorage || isSubmitting}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask the question you actually want your group to wrestle with."
          value={question}
        />
      </label>

      <label className="student-question-field">
        <span>Passage, if you have one</span>
        <input
          disabled={!readiness.liveStorage || isSubmitting}
          onChange={(event) => setScriptureReference(event.target.value)}
          placeholder="Romans 8:18"
          type="text"
          value={scriptureReference}
        />
      </label>

      <div className="student-question-actions">
        <button className="button primary" disabled={!readiness.liveStorage || isSubmitting} type="submit">
          {isSubmitting ? "Sending..." : "Send to leader"}
        </button>
        <p role="status">{status}</p>
      </div>
    </form>
  );
}
