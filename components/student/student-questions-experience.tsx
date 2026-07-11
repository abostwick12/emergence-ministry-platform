"use client";

import { useMemo, useState } from "react";

import { StudentQuestionComposer } from "@/components/student/student-question-composer";
import { StudentReflectionPanel } from "@/components/student/student-reflection-panel";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { buildQuestionNextStep, type StudentQuestionNextStep } from "@/lib/scripture/student-home";
import type { StudentQuestionReflection } from "@/lib/scripture/student-reflections";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

type StudentQuestionsExperienceProps = {
  initialReflections: Record<string, StudentQuestionReflection>;
  initialState: DiscussionWorkflowState;
};

export function StudentQuestionsExperience({ initialReflections, initialState }: StudentQuestionsExperienceProps) {
  const [prompts, setPrompts] = useState(initialState.prompts);
  const [nextSteps, setNextSteps] = useState<Record<string, StudentQuestionNextStep>>({});
  const [reflections, setReflections] = useState(initialReflections);
  const [selectedPromptId, setSelectedPromptId] = useState(initialState.prompts[0]?.id ?? "");
  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedPromptId) ?? prompts[0];
  const selectedNextStep = useMemo(() => {
    if (!selectedPrompt) return null;
    return nextSteps[selectedPrompt.id] ?? buildQuestionNextStep(selectedPrompt);
  }, [nextSteps, selectedPrompt]);

  function addCreatedPrompt(prompt: StudentDiscussionPrompt, nextStep: StudentQuestionNextStep) {
    setPrompts((current) => [prompt, ...current.filter((item) => item.id !== prompt.id)].slice(0, 5));
    setNextSteps((current) => ({ ...current, [prompt.id]: nextStep }));
    setSelectedPromptId(prompt.id);
  }

  function updateReflection(reflection: StudentQuestionReflection) {
    setReflections((current) => ({ ...current, [reflection.promptId]: reflection }));
  }

  return (
    <div className="student-ask-page">
      <StudentQuestionComposer onCreated={addCreatedPrompt} readiness={initialState.readiness} />
      {selectedPrompt && selectedNextStep ? (
        <StudentQuestionNextStepPreview
          nextStep={selectedNextStep}
          onReflectionSaved={updateReflection}
          prompt={selectedPrompt}
          reflection={reflections[selectedPrompt.id]}
        />
      ) : null}
      <section className="student-feed-section">
        <div className="student-feed-section-heading">
          <h2>Your recent questions</h2>
        </div>
        {prompts.length ? (
          <div className="student-feed-list">
            {prompts.slice(0, 5).map((prompt) => (
              <article className="student-feed-row" key={prompt.id}>
                <div>
                  <span>{prompt.scriptureReference || "No passage selected"}</span>
                  <h3>{prompt.question}</h3>
                  <p>{prompt.status === "pending_review" ? "Sent to your leader for review." : prompt.status.replace(/_/g, " ")}</p>
                </div>
                <div className="student-feed-row-actions">
                  <span className="pill blue">{prompt.status === "pending_review" ? "With leader" : prompt.status.replace(/_/g, " ")}</span>
                  <button className="button secondary" onClick={() => setSelectedPromptId(prompt.id)} type="button">
                    Open path
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="student-feed-empty">
            <strong>No questions sent yet.</strong>
            <p>When you send a real question, it will show here while your leader reviews it.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function StudentQuestionNextStepPreview({
  nextStep,
  onReflectionSaved,
  prompt,
  reflection
}: {
  nextStep: StudentQuestionNextStep;
  onReflectionSaved: (reflection: StudentQuestionReflection) => void;
  prompt: StudentDiscussionPrompt;
  reflection?: StudentQuestionReflection;
}) {
  return (
    <section className="student-next-step" aria-live="polite" aria-label="Question next step">
      <div className="student-next-step-copy">
        <p className="eyebrow">{nextStep.label}</p>
        <h2>{nextStep.title}</h2>
        <p>{nextStep.summary}</p>
      </div>
      <div className="student-next-step-grid">
        <div className="student-next-step-panel">
          <span className="student-next-step-panel-title">Wrestle with it</span>
          <ul>
            {nextStep.wrestleQuestions.slice(0, 2).map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
        <div className="student-next-step-panel">
          <span className="student-next-step-panel-title">Dig deeper</span>
          <ul>
            {nextStep.digQuestions.slice(0, 2).map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
        <div className="student-next-step-panel student-next-step-panel-wide">
          <span className="student-next-step-panel-title">Bring to group</span>
          <p className="student-next-step-together">{nextStep.wrestleTogetherPrompt}</p>
        </div>
      </div>
      <StudentReflectionPanel onSaved={onReflectionSaved} prompt={prompt} reflection={reflection} />
    </section>
  );
}
