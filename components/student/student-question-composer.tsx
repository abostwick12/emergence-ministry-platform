"use client";

import { useState } from "react";

import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import type { StudentQuestionNextStep } from "@/lib/scripture/student-home";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

type StudentQuestionComposerProps = {
  readiness: DiscussionWorkflowState["readiness"];
  onCreated?: (prompt: StudentDiscussionPrompt, nextStep: StudentQuestionNextStep) => void;
};

type CreateResponse = {
  ok?: boolean;
  error?: string;
  prompt?: StudentDiscussionPrompt;
  nextStep?: StudentQuestionNextStep;
  persistence?: "guest_session" | "ministry" | "none";
};

export function StudentQuestionComposer({ readiness, onCreated }: StudentQuestionComposerProps) {
  const [question, setQuestion] = useState("");
  const [scriptureReference, setScriptureReference] = useState("");
  const [status, setStatus] = useState(
    readiness.canSubmit
      ? "Ask the real question. You will get a guided way to wrestle with it while your leader reviews it."
      : readiness.message
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("Asking Meridian to shape leader-review next steps...");

    try {
      const response = await fetch("/api/student/scripture/discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, scriptureReference })
      });
      const payload = (await response.json()) as CreateResponse;
      if (!response.ok || !payload.ok || !payload.prompt || !payload.nextStep) {
        setStatus(payload.error ?? "Your question could not be saved.");
        return;
      }

      onCreated?.(payload.prompt, payload.nextStep);
      setQuestion("");
      setScriptureReference("");
      if (payload.persistence === "none") {
        setStatus("Preview generated for leader review. Nothing was saved, published, or shared.");
        return;
      }
      if (payload.persistence === "guest_session") {
        setStatus(
          payload.prompt.aiStatus === "generated"
            ? "Saved in this guest sandbox session. Meridian generated a leader-review draft."
            : "Saved in this guest sandbox session with a knowledge-guided leader-review draft."
        );
        return;
      }
      setStatus(
        payload.prompt.aiStatus === "generated"
          ? "Saved. Meridian drafted a leader-review conversation while you keep wrestling below."
          : "Saved. Meridian prepared knowledge-guided next steps while your leader shapes it for group discussion."
      );
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
        <p>Ask honestly. Then wrestle with better questions while your leader prepares the group conversation.</p>
      </div>

      <label className="student-question-field">
        <span>What are you wondering?</span>
        <textarea
          disabled={!readiness.canSubmit || isSubmitting}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask the question you actually want your group to wrestle with."
          value={question}
        />
      </label>

      <label className="student-question-field">
        <span>Passage, if you have one</span>
        <input
          disabled={!readiness.canSubmit || isSubmitting}
          onChange={(event) => setScriptureReference(event.target.value)}
          placeholder="Romans 8:18"
          type="text"
          value={scriptureReference}
        />
      </label>

      <div className="student-question-actions">
        <button className="button primary" disabled={!readiness.canSubmit || isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : "Ask and wrestle with it"}
        </button>
        <p role="status">{status}</p>
      </div>
    </form>
  );
}
