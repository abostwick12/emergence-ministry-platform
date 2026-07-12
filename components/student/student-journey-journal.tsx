"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, GitFork, Languages } from "lucide-react";

import { YouVersionReaderWindow } from "@/components/student/youversion-reader-window";
import { buildYouVersionReaderLink, type YouVersionReaderLink } from "@/lib/scripture/youversion";
import type { StudentJourneyReading, StudentQuestionNextStep } from "@/lib/scripture/student-home";
import type { StudentQuestionReflection } from "@/lib/scripture/student-reflections";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

type ReflectionResponse = {
  ok?: boolean;
  error?: string;
  reflection?: StudentQuestionReflection;
};

type ReaderState =
  | { status: "idle"; message: string }
  | { status: "success"; message: string; reader: YouVersionReaderLink }
  | { status: "error"; message: string };

type JournalDraft = {
  answers: Record<string, string>;
  completedReadings: string[];
  practiceComplete: boolean;
  practicePath: "embodied" | "guided";
  studyPath: "word" | "inductive";
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
  practiceComplete: false,
  practicePath: "embodied",
  studyPath: "word"
};

export function StudentJourneyJournal({ journey, onReflectionSaved, prompt, reflection }: StudentJourneyJournalProps) {
  const storageKey = `lead-emergence:student-journey-journal:${prompt.id}`;
  const [draft, setDraft] = useState<JournalDraft>(emptyDraft);
  const [readerState, setReaderState] = useState<ReaderState>({ status: "idle", message: "Open a reading to load the YouVersion companion." });
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
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
    setReaderState({ status: "idle", message: "Open a reading to load the YouVersion companion." });
    setStatus("Journal stays private unless you save it to your note.");
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoadedDraft) return;
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, hasLoadedDraft, storageKey]);

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

  function loadReading(reading: StudentJourneyReading) {
    const reader = buildYouVersionReaderLink(reading.lookupReference);
    if (reader.ok) {
      setReaderState({ status: "success", message: "YouVersion reader opened.", reader });
      return;
    }

    setReaderState({ status: "error", message: reader.message });
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
        </div>
        <span className="pill blue">{progressLabel}</span>
      </div>

      <div className="student-journey-layout">
        <div className="student-journey-main student-journey-road">
          <section className="student-journey-road-step current" aria-label="Journal starting point">
            <div className="student-journey-road-marker">1</div>
            <div className="student-journey-opening">
              <strong>The ask</strong>
              <p>{journey.openingPrompt}</p>
            </div>
          </section>

          <section className="student-journey-road-step current" aria-label="Reflection questions">
            <div className="student-journey-road-marker">2</div>
            <div className="student-journey-question-list">
              <div className="student-journey-road-copy">
                <p className="eyebrow">Current phase - reflection</p>
                <h4>Sit with the question before solving it.</h4>
              </div>
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
          </section>

          <section className="student-journey-road-step fork" aria-label="Choose a study path">
            <div className="student-journey-road-marker fork-marker">
              <GitFork aria-hidden="true" size={16} />
            </div>
            <div className="student-journey-fork-card">
              <div className="student-journey-section-heading">
                <div>
                  <p className="eyebrow">Fork in the road</p>
                  <h4>Choose how you want to study first.</h4>
                </div>
                <span className="pill blue">{draft.studyPath === "word" ? "Word study" : "Inductive"}</span>
              </div>
              <div className="student-journey-fork-options" role="group" aria-label="Study path options">
                <button className={draft.studyPath === "word" ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, studyPath: "word" }))} type="button">
                  <Languages aria-hidden="true" size={17} />
                  <span>Word study</span>
                </button>
                <button
                  className={draft.studyPath === "inductive" ? "active" : ""}
                  onClick={() => setDraft((current) => ({ ...current, studyPath: "inductive" }))}
                  type="button"
                >
                  <BookOpen aria-hidden="true" size={17} />
                  <span>Inductive reading</span>
                </button>
              </div>
            </div>
          </section>

          {draft.studyPath === "word" ? (
            <JourneyRoadStep marker="3" label="Word study helps">
              <KeywordRail title="Word study helps" journey={journey} />
            </JourneyRoadStep>
          ) : (
            <JourneyRoadStep marker="3" label="Guided reading path">
              <ReadingRail completedReadings={draft.completedReadings} journey={journey} loadReading={loadReading} toggleReading={toggleReading} title="Guided reading path" />
            </JourneyRoadStep>
          )}

          {draft.studyPath === "word" ? (
            <JourneyRoadStep marker="4" label="Guided reading path">
              <ReadingRail
                completedReadings={draft.completedReadings}
                journey={journey}
                loadReading={loadReading}
                toggleReading={toggleReading}
                title="Now read the passage"
              />
            </JourneyRoadStep>
          ) : (
            <JourneyRoadStep marker="4" label="Study helps">
              <KeywordRail title="Brief study helps" journey={journey} />
            </JourneyRoadStep>
          )}

          <section className="student-journey-road-step fork" aria-label="Choose a spiritual practice path">
            <div className="student-journey-road-marker fork-marker">
              <GitFork aria-hidden="true" size={16} />
            </div>
            <div className="student-journey-fork-card">
              <div className="student-journey-section-heading">
                <div>
                  <p className="eyebrow">Fork in the road</p>
                  <h4>Choose a practice for today.</h4>
                </div>
                <span className="pill amber">{draft.practicePath === "guided" ? "Guided prayer" : "Embodied"}</span>
              </div>
              <div className="student-journey-fork-options" role="group" aria-label="Spiritual practice path options">
                <button className={draft.practicePath === "embodied" ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, practicePath: "embodied" }))} type="button">
                  <span>Embodied practice</span>
                </button>
                <button
                  className={draft.practicePath === "guided" ? "active" : ""}
                  disabled={!journey.spiritualPractice.guidedPrayer}
                  onClick={() => setDraft((current) => ({ ...current, practicePath: "guided" }))}
                  type="button"
                >
                  <span>Guided prayer</span>
                </button>
              </div>
            </div>
          </section>

          <section className="student-journey-road-step" aria-label="Spiritual practice">
            <div className="student-journey-road-marker">5</div>
            <div className="student-journey-practice">
              <div>
                <p className="eyebrow">Practice</p>
                <h4>{draft.practicePath === "guided" && journey.spiritualPractice.guidedPrayer ? journey.spiritualPractice.guidedPrayer.title : journey.spiritualPractice.title}</h4>
              </div>
              {draft.practicePath === "guided" && journey.spiritualPractice.guidedPrayer ? (
                <div className="student-guided-prayer" aria-label="Guided prayer">
                  <div>
                    <span>{journey.spiritualPractice.guidedPrayer.durationLabel}</span>
                    <h5>{journey.spiritualPractice.guidedPrayer.title}</h5>
                  </div>
                  <ol>
                    {journey.spiritualPractice.guidedPrayer.prompts.map((prayerPrompt) => (
                      <li key={prayerPrompt}>{prayerPrompt}</li>
                    ))}
                  </ol>
                </div>
              ) : (
                <ol>
                  {journey.spiritualPractice.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
              <label className="student-journey-practice-check">
                <input
                  checked={draft.practiceComplete}
                  onChange={(event) => setDraft((current) => ({ ...current, practiceComplete: event.target.checked }))}
                  type="checkbox"
                />
                <span>Practice completed</span>
              </label>
              <p className="student-journey-reflection-prompt">{journey.spiritualPractice.reflectionPrompt}</p>
            </div>
          </section>

          <section className="student-journey-road-step muted" aria-label="Save journey">
            <div className="student-journey-road-marker">6</div>
            <div className="student-journey-save-row">
              <button className="button primary" disabled={isSaving} onClick={() => void saveJournal()} type="button">
                {isSaving ? "Saving..." : "Save journal to private note"}
              </button>
              {status ? <p role="status">{status}</p> : null}
            </div>
          </section>
        </div>

        <aside className="student-scripture-companion" aria-label="Scripture reader companion">
          <div className="student-scripture-companion-top">
            <div>
              <p className="eyebrow">Bible App Window</p>
              <h4>{readerState.status === "success" && readerState.reader.ok ? readerState.reader.displayReference : "Reader and tools"}</h4>
            </div>
          </div>
          <div className={`student-scripture-companion-status ${readerState.status}`} role={readerState.status === "error" ? "alert" : "status"}>
            {readerState.message}
          </div>
          <YouVersionReaderWindow link={readerState.status === "success" ? readerState.reader : undefined} title="Journey reading" />
        </aside>
      </div>
    </section>
  );
}

function JourneyRoadStep({
  children,
  label,
  marker
}: {
  children: React.ReactNode;
  label: string;
  marker: string;
}) {
  return (
    <section className="student-journey-road-step" aria-label={label}>
      <div className="student-journey-road-marker">{marker}</div>
      <div>{children}</div>
    </section>
  );
}

function ReadingRail({
  completedReadings,
  journey,
  loadReading,
  title,
  toggleReading
}: {
  completedReadings: string[];
  journey: StudentQuestionNextStep["journeyJournal"];
  loadReading: (reading: StudentJourneyReading) => void;
  title: string;
  toggleReading: (id: string) => void;
}) {
  return (
    <>
      <div className="student-journey-section-heading">
        <h4>{title}</h4>
      </div>
      <div className="student-journey-reading-rail">
        {journey.readingPath.map((reading) => {
          const isComplete = completedReadings.includes(reading.id);
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
                <button className="button compact" onClick={() => loadReading(reading)} type="button">
                  <BookOpen aria-hidden="true" size={16} />
                  Open YouVersion
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
    </>
  );
}

function KeywordRail({ journey, title }: { journey: StudentQuestionNextStep["journeyJournal"]; title: string }) {
  return (
    <section className="student-journey-keywords" aria-label="Study helps">
      <div className="student-journey-section-heading">
        <h4>{title}</h4>
      </div>
      <div className="student-journey-keyword-rail">
        {journey.keyWords.map((word) => (
          <article className="student-journey-keyword-card" key={`${word.term}-${word.transliteration ?? "study"}`}>
            {word.originalLanguage ? (
              <a className="student-keyword-original" href={word.lexicalUrl} rel="noreferrer" target="_blank">
                {word.originalLanguage}
              </a>
            ) : null}
            <span>{word.transliteration ?? "Tool"}</span>
            <h5>{word.term}</h5>
            <p>{word.meaning}</p>
            <strong>{word.invitation}</strong>
          </article>
        ))}
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
