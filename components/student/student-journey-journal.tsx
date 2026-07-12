"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Headphones, Pause, Play } from "lucide-react";

import type { StudentJourneyReading, StudentQuestionNextStep } from "@/lib/scripture/student-home";
import type { StudentQuestionReflection } from "@/lib/scripture/student-reflections";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

type ReflectionResponse = {
  ok?: boolean;
  error?: string;
  reflection?: StudentQuestionReflection;
};

type LookupState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string; reference: string }
  | { status: "success"; message: string; passage: { id: string; reference: string; content: string } }
  | { status: "error"; message: string };

type JournalDraft = {
  answers: Record<string, string>;
  completedReadings: string[];
  practiceComplete: boolean;
};

type StudentJourneyJournalProps = {
  journey: StudentQuestionNextStep["journeyJournal"];
  onReflectionSaved: (reflection: StudentQuestionReflection) => void;
  prompt: StudentDiscussionPrompt;
  reflection?: StudentQuestionReflection;
};

const emptyDraft: JournalDraft = {
  answers: {},
  completedReadings: [],
  practiceComplete: false
};

export function StudentJourneyJournal({ journey, onReflectionSaved, prompt, reflection }: StudentJourneyJournalProps) {
  const storageKey = `lead-emergence:student-journey-journal:${prompt.id}`;
  const [draft, setDraft] = useState<JournalDraft>(emptyDraft);
  const [lookupState, setLookupState] = useState<LookupState>({
    status: "idle",
    message: "Open a reading to load the Scripture companion."
  });
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("Journal stays private unless you save it to your note.");

  const progressLabel = useMemo(() => {
    const completeCount = draft.completedReadings.length + (draft.practiceComplete ? 1 : 0);
    const totalCount = journey.readingPath.length + 1;
    return `${completeCount} of ${totalCount} steps marked`;
  }, [draft.completedReadings.length, draft.practiceComplete, journey.readingPath.length]);

  useEffect(() => {
    setHasLoadedDraft(false);
    try {
      const saved = window.localStorage.getItem(storageKey);
      setDraft(saved ? { ...emptyDraft, ...(JSON.parse(saved) as JournalDraft) } : emptyDraft);
    } catch {
      setDraft(emptyDraft);
    }
    setHasLoadedDraft(true);
    setLookupState({ status: "idle", message: "Open a reading to load the Scripture companion." });
    setStatus("Journal stays private unless you save it to your note.");
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoadedDraft) return;
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, hasLoadedDraft, storageKey]);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  function updateAnswer(id: string, value: string) {
    setDraft((current) => ({ ...current, answers: { ...current.answers, [id]: value } }));
  }

  function toggleReading(id: string) {
    setDraft((current) => {
      const completed = current.completedReadings.includes(id)
        ? current.completedReadings.filter((item) => item !== id)
        : [...current.completedReadings, id];
      return { ...current, completedReadings: completed };
    });
  }

  async function loadReading(reading: StudentJourneyReading) {
    setLookupState({ status: "loading", message: `Loading ${reading.lookupReference}...`, reference: reading.lookupReference });

    try {
      const response = await fetch("/api/student/scripture/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: reading.lookupReference })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        passage?: { id?: string; reference?: string; content?: string };
      };

      if (!response.ok || !payload.ok || !payload.passage?.id || !payload.passage.reference || !payload.passage.content) {
        setLookupState({ status: "error", message: payload.error ?? "Scripture reader is temporarily unavailable." });
        return;
      }

      setLookupState({
        status: "success",
        message: "Scripture companion loaded.",
        passage: {
          id: payload.passage.id,
          reference: payload.passage.reference,
          content: payload.passage.content
        }
      });
    } catch {
      setLookupState({ status: "error", message: "Scripture reader is temporarily unavailable." });
    }
  }

  function toggleListen() {
    if (lookupState.status !== "success" || !("speechSynthesis" in window)) return;

    if (isListening) {
      window.speechSynthesis.cancel();
      setIsListening(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(`${lookupState.passage.reference}. ${lookupState.passage.content}`);
    utterance.onend = () => setIsListening(false);
    utterance.onerror = () => setIsListening(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsListening(true);
  }

  async function saveJournal() {
    setIsSaving(true);
    setStatus("Saving journey to your private note...");

    try {
      const privateNote = composePrivateNote(journey, draft);
      const response = await fetch("/api/student/scripture/reflections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId: prompt.id, reflected: Boolean(reflection?.reflectedAt), privateNote })
      });
      const payload = (await response.json()) as ReflectionResponse;
      if (!response.ok || !payload.ok || !payload.reflection) {
        setStatus(payload.error ?? "Journey could not be saved.");
        return;
      }

      onReflectionSaved(payload.reflection);
      setStatus("Journey saved to your private note.");
    } catch {
      setStatus("Journey could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="student-journey-journal" aria-label="Journey journal">
      <div className="student-journey-header">
        <div>
          <p className="eyebrow">Journey Journal</p>
          <h3>{journey.title}</h3>
          <p>{journey.subtitle}</p>
        </div>
        <span className="pill blue">{progressLabel}</span>
      </div>

      <div className="student-journey-layout">
        <div className="student-journey-main">
          <section className="student-journey-opening" aria-label="Journal starting point">
            <strong>Start here</strong>
            <p>{journey.openingPrompt}</p>
          </section>

          <div className="student-journey-question-list">
            {journey.followUpQuestions.map((question) => (
              <label className="student-journey-question" key={question.id}>
                <span>{question.label}</span>
                <p>{question.prompt}</p>
                <textarea
                  maxLength={280}
                  onChange={(event) => updateAnswer(question.id, event.target.value)}
                  placeholder={question.placeholder}
                  value={draft.answers[question.id] ?? ""}
                />
              </label>
            ))}
          </div>

          <section aria-label="Guided reading path">
            <div className="student-journey-section-heading">
              <h4>Guided reading path</h4>
              <p>Swipe through the readings, open one in the companion, and mark what you finish.</p>
            </div>
            <div className="student-journey-reading-rail">
              {journey.readingPath.map((reading) => {
                const isComplete = draft.completedReadings.includes(reading.id);
                return (
                  <article className="student-journey-reading-card" key={reading.id}>
                    <span>{reading.reference}</span>
                    <h5>{reading.title}</h5>
                    <p>{reading.guidance}</p>
                    <div>
                      <strong>Try this</strong>
                      <p>{reading.practice}</p>
                    </div>
                    <div className="student-journey-card-actions">
                      <button className="button compact" onClick={() => void loadReading(reading)} type="button">
                        <BookOpen aria-hidden="true" size={16} />
                        Open reader
                      </button>
                      <button className="button compact" onClick={() => toggleReading(reading.id)} type="button">
                        <CheckCircle2 aria-hidden="true" size={16} />
                        {isComplete ? "Read" : `Mark ${reading.reference} read`}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="student-journey-keywords" aria-label="Study helps">
            <div className="student-journey-section-heading">
              <h4>Study helps</h4>
              <p>Brief anchors for reading carefully without overloading the page.</p>
            </div>
            <div className="student-journey-keyword-rail">
              {journey.keyWords.map((word) => (
                <article className="student-journey-keyword-card" key={`${word.term}-${word.transliteration ?? "study"}`}>
                  <span>{word.transliteration ?? "Tool"}</span>
                  <h5>{word.term}</h5>
                  <p>{word.meaning}</p>
                  <strong>{word.invitation}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="student-journey-practice" aria-label="Spiritual practice">
            <div>
              <p className="eyebrow">Practice</p>
              <h4>{journey.spiritualPractice.title}</h4>
              <p>{journey.spiritualPractice.summary}</p>
            </div>
            <ol>
              {journey.spiritualPractice.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {journey.spiritualPractice.guidedPrayer ? (
              <div className="student-guided-prayer" aria-label="Guided prayer">
                <div>
                  <span>{journey.spiritualPractice.guidedPrayer.durationLabel}</span>
                  <h5>{journey.spiritualPractice.guidedPrayer.title}</h5>
                  <p>{journey.spiritualPractice.guidedPrayer.backgroundHint}</p>
                </div>
                <ol>
                  {journey.spiritualPractice.guidedPrayer.prompts.map((prayerPrompt) => (
                    <li key={prayerPrompt}>{prayerPrompt}</li>
                  ))}
                </ol>
              </div>
            ) : null}
            <label className="student-journey-practice-check">
              <input
                checked={draft.practiceComplete}
                onChange={(event) => setDraft((current) => ({ ...current, practiceComplete: event.target.checked }))}
                type="checkbox"
              />
              <span>Practice completed</span>
            </label>
            <p className="student-journey-reflection-prompt">{journey.spiritualPractice.reflectionPrompt}</p>
          </section>

          <div className="student-journey-save-row">
            <button className="button primary" disabled={isSaving} onClick={() => void saveJournal()} type="button">
              {isSaving ? "Saving..." : "Save journal to private note"}
            </button>
            <p role="status">{status}</p>
          </div>
        </div>

        <aside className="student-scripture-companion" aria-label="Scripture reader companion">
          <div className="student-scripture-companion-top">
            <div>
              <p className="eyebrow">Scripture Window</p>
              <h4>{lookupState.status === "success" ? lookupState.passage.reference : "Reader and listen"}</h4>
            </div>
            <button
              className="button icon"
              disabled={lookupState.status !== "success"}
              onClick={toggleListen}
              title={isListening ? "Pause listening" : "Listen to Scripture"}
              type="button"
            >
              {isListening ? <Pause aria-hidden="true" size={18} /> : <Headphones aria-hidden="true" size={18} />}
              <span className="sr-only">{isListening ? "Pause listening" : "Listen to Scripture"}</span>
            </button>
          </div>
          <div className={`student-scripture-companion-status ${lookupState.status}`} role={lookupState.status === "error" ? "alert" : "status"}>
            {lookupState.message}
          </div>
          {lookupState.status === "success" ? (
            <div className="student-scripture-reader-window">
              <p>{lookupState.passage.content}</p>
              <small>Passage ID: {lookupState.passage.id}</small>
            </div>
          ) : (
            <div className="student-scripture-reader-empty">
              <Play aria-hidden="true" size={28} />
              <p>Open a reading card to populate this compact Scripture window while your journal stays on screen.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function composePrivateNote(journey: StudentQuestionNextStep["journeyJournal"], draft: JournalDraft) {
  const answers = journey.followUpQuestions
    .map((question) => {
      const answer = draft.answers[question.id]?.trim();
      return answer ? `${question.label}: ${answer}` : "";
    })
    .filter(Boolean);
  const completed = journey.readingPath
    .filter((reading) => draft.completedReadings.includes(reading.id))
    .map((reading) => reading.reference);

  const parts = [
    `${journey.title}`,
    answers.length ? `Journal answers:\n${answers.join("\n")}` : "",
    completed.length ? `Readings marked: ${completed.join(", ")}` : "",
    draft.practiceComplete ? `Practice completed: ${journey.spiritualPractice.title}` : "",
    `Reflection prompt: ${journey.spiritualPractice.reflectionPrompt}`
  ].filter(Boolean);

  return parts.join("\n\n").slice(0, 1200);
}
