"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, BookOpen, Check, ChevronDown, Feather, Footprints, HelpCircle, Leaf, Plus, RotateCcw, Sprout } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { StudentQuestionComposer } from "@/components/student/student-question-composer";
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
  const [archivedPromptIds, setArchivedPromptIds] = useState<Set<string>>(new Set());
  const [entrySequences, setEntrySequences] = useState<Record<string, number[]>>({});
  const [localStateLoaded, setLocalStateLoaded] = useState(false);
  const [activeEntryByPrompt, setActiveEntryByPrompt] = useState<Record<string, number>>({});
  const [selectedPromptId, setSelectedPromptId] = useState(initialState.prompts[0]?.id ?? "");
  const [isComposerOpen, setIsComposerOpen] = useState(!initialState.prompts[0]);
  const activePrompts = prompts.filter((prompt) => prompt.status !== "archived" && !archivedPromptIds.has(prompt.id));
  const archivedPrompts = prompts.filter((prompt) => prompt.status === "archived" || archivedPromptIds.has(prompt.id));
  const selectedPrompt = activePrompts.find((prompt) => prompt.id === selectedPromptId) ?? activePrompts[0];
  const selectedEntries = selectedPrompt ? entrySequences[selectedPrompt.id] ?? [1] : [1];
  const activeEntrySequence = selectedPrompt ? activeEntryByPrompt[selectedPrompt.id] ?? selectedEntries[0] ?? 1 : 1;
  const selectedNextStep = useMemo(() => {
    if (!selectedPrompt) return null;
    return nextSteps[selectedPrompt.id] ?? buildQuestionNextStep(selectedPrompt);
  }, [nextSteps, selectedPrompt]);

  useEffect(() => {
    setArchivedPromptIds(readArchivedPromptIds());
    setEntrySequences(readEntrySequences());
    setLocalStateLoaded(true);
  }, []);

  useEffect(() => {
    if (!localStateLoaded) return;
    window.localStorage.setItem(studentQuestionArchiveStorageKey, JSON.stringify(Array.from(archivedPromptIds)));
  }, [archivedPromptIds, localStateLoaded]);

  useEffect(() => {
    if (!localStateLoaded) return;
    window.localStorage.setItem(studentJourneyEntriesStorageKey, JSON.stringify(entrySequences));
  }, [entrySequences, localStateLoaded]);

  useEffect(() => {
    if (!selectedPrompt && activePrompts[0]) setSelectedPromptId(activePrompts[0].id);
  }, [activePrompts, selectedPrompt]);

  function addCreatedPrompt(prompt: StudentDiscussionPrompt, nextStep: StudentQuestionNextStep) {
    setPrompts((current) => [prompt, ...current.filter((item) => item.id !== prompt.id)].slice(0, 5));
    setNextSteps((current) => ({ ...current, [prompt.id]: nextStep }));
    setArchivedPromptIds((current) => {
      const next = new Set(current);
      next.delete(prompt.id);
      return next;
    });
    setEntrySequences((current) => ({ ...current, [prompt.id]: [1] }));
    setActiveEntryByPrompt((current) => ({ ...current, [prompt.id]: 1 }));
    setSelectedPromptId(prompt.id);
    setIsComposerOpen(false);
  }

  function updateReflection(reflection: StudentQuestionReflection) {
    setReflections((current) => ({ ...current, [reflection.promptId]: reflection }));
  }

  function archivePrompt(promptId: string) {
    setArchivedPromptIds((current) => new Set(current).add(promptId));
    if (selectedPromptId === promptId) {
      const nextPrompt = activePrompts.find((prompt) => prompt.id !== promptId);
      setSelectedPromptId(nextPrompt?.id ?? "");
    }
  }

  function restorePrompt(promptId: string) {
    setArchivedPromptIds((current) => {
      const next = new Set(current);
      next.delete(promptId);
      return next;
    });
    setSelectedPromptId(promptId);
  }

  function addEntry(promptId: string) {
    setEntrySequences((current) => {
      const existing = current[promptId] ?? [1];
      const nextEntry = Math.max(...existing) + 1;
      setActiveEntryByPrompt((entries) => ({ ...entries, [promptId]: nextEntry }));
      return { ...current, [promptId]: [...existing, nextEntry] };
    });
  }

  function selectEntry(promptId: string, sequence: number) {
    setActiveEntryByPrompt((current) => ({ ...current, [promptId]: sequence }));
  }

  return (
    <div className="student-ask-page">
      <section className={`student-new-question-drawer ${isComposerOpen ? "open" : ""}`}>
        <button onClick={() => setIsComposerOpen((current) => !current)} type="button">
          <span>Start a new question</span>
          <Plus aria-hidden="true" size={16} />
        </button>
        {isComposerOpen ? <StudentQuestionComposer onCreated={addCreatedPrompt} readiness={initialState.readiness} /> : null}
      </section>
      {selectedPrompt ? (
        <section className="student-journal-control" aria-label="Journey journal selector">
          <details className="student-journal-dropdown">
            <summary>
              <div>
                <p className="eyebrow">Question Journal</p>
                <strong>{selectedPrompt.question}</strong>
                <span>
                  {selectedPrompt.scriptureReference || "Open question"} / {selectedEntries.length} {selectedEntries.length === 1 ? "entry" : "entries"}
                </span>
              </div>
              <ChevronDown aria-hidden="true" size={18} />
            </summary>
            <div className="student-journal-dropdown-menu">
              <p className="eyebrow">Active journeys</p>
              {activePrompts.map((prompt) => (
                <button
                  className={prompt.id === selectedPrompt.id ? "active" : ""}
                  key={prompt.id}
                  onClick={() => setSelectedPromptId(prompt.id)}
                  type="button"
                >
                  <span>{prompt.scriptureReference || "Question"}</span>
                  <strong>{prompt.question}</strong>
                </button>
              ))}
              {archivedPrompts.length ? (
                <>
                  <p className="eyebrow">Archived</p>
                  {archivedPrompts.map((prompt) => (
                    <button key={prompt.id} onClick={() => restorePrompt(prompt.id)} type="button">
                      <span>Archived / restore</span>
                      <strong>{prompt.question}</strong>
                    </button>
                  ))}
                </>
              ) : null}
            </div>
          </details>
          <div className="student-journal-entry-rail" role="group" aria-label="Journey entries">
            {selectedEntries.map((sequence) => (
              <button
                className={sequence === activeEntrySequence ? "active" : ""}
                key={sequence}
                onClick={() => selectEntry(selectedPrompt.id, sequence)}
                type="button"
              >
                {sequence}
              </button>
            ))}
            <button className="add-entry" onClick={() => addEntry(selectedPrompt.id)} type="button">
              <Plus aria-hidden="true" size={15} />
              Add entry
            </button>
          </div>
        </section>
      ) : null}
      {selectedPrompt && selectedNextStep ? (
        <StudentLovableJournalEntry
          entrySequence={activeEntrySequence}
          nextStep={selectedNextStep}
          onReflectionSaved={updateReflection}
          prompt={selectedPrompt}
          reflection={reflections[selectedPrompt.id]}
        />
      ) : null}
      <section className="student-feed-section student-journey-history" aria-label="Journey History">
        <div className="student-feed-section-heading">
          <h2>Journey History</h2>
        </div>
        {activePrompts.length ? (
          <div className="student-feed-list">
            {activePrompts.slice(0, 5).map((prompt) => (
              <article className="student-feed-row" key={prompt.id}>
                <div>
                  <span>{prompt.scriptureReference || "No passage selected"}</span>
                  <h3>{prompt.question}</h3>
                  <p>{prompt.status === "pending_review" ? "Sent to your leader for review." : prompt.status.replace(/_/g, " ")}</p>
                </div>
                <div className="student-feed-row-actions">
                  <span className="pill blue">{prompt.status === "pending_review" ? "With leader" : prompt.status.replace(/_/g, " ")}</span>
                  <button className="button secondary" onClick={() => setSelectedPromptId(prompt.id)} type="button">
                    Open
                  </button>
                  <button className="button compact" onClick={() => archivePrompt(prompt.id)} type="button">
                    <Archive aria-hidden="true" size={15} />
                    Archive
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
      {archivedPrompts.length ? (
        <section className="student-feed-section" aria-label="Archived questions">
          <div className="student-feed-section-heading">
            <h2>Archived questions</h2>
          </div>
          <div className="student-feed-list">
            {archivedPrompts.map((prompt) => (
              <article className="student-feed-row" key={prompt.id}>
                <div>
                  <span>{prompt.scriptureReference || "Archived question"}</span>
                  <h3>{prompt.question}</h3>
                  <p>This question is out of the active journey list, but the record is still here.</p>
                </div>
                <div className="student-feed-row-actions">
                  <button className="button compact" onClick={() => restorePrompt(prompt.id)} type="button">
                    <RotateCcw aria-hidden="true" size={15} />
                    Restore
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StudentLovableJournalEntry({
  entrySequence,
  nextStep,
  onReflectionSaved,
  prompt,
  reflection
}: {
  entrySequence: number;
  nextStep: StudentQuestionNextStep;
  onReflectionSaved: (reflection: StudentQuestionReflection) => void;
  prompt: StudentDiscussionPrompt;
  reflection?: StudentQuestionReflection;
}) {
  const [scriptureReflection, setScriptureReflection] = useState("");
  const [questionReflection, setQuestionReflection] = useState("");
  const [practiceReflection, setPracticeReflection] = useState("");
  const [livingReflection, setLivingReflection] = useState("");
  const [fruitReflection, setFruitReflection] = useState("");
  const [selectedPractice, setSelectedPractice] = useState<"embodied" | "guided">("embodied");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(reflection?.privateNote ? "Saved to your private note." : "Autosaved locally until you save the entry.");
  const practice = nextStep.journeyJournal.spiritualPractice;
  const guidedPrayer = practice.guidedPrayer;
  const readingCards = nextStep.journeyJournal.readingPath.slice(0, 3);
  const keyWords = nextStep.journeyJournal.keyWords.slice(0, 3);
  const phases = [
    { label: "Scripture", complete: Boolean(scriptureReflection.trim()) },
    { label: "Questions", complete: Boolean(questionReflection.trim()) },
    { label: "Practice", complete: Boolean(practiceReflection.trim()) },
    { label: "Life", complete: Boolean(livingReflection.trim()) },
    { label: "Fruit", complete: Boolean(fruitReflection.trim()) }
  ];

  async function saveEntry() {
    const privateNote = [
      `Entry ${entrySequence}: ${nextStep.journeyJournal.title}`,
      scriptureReflection ? `Scripture:\n${scriptureReflection}` : "",
      questionReflection ? `Questions:\n${questionReflection}` : "",
      practiceReflection ? `Practice (${selectedPractice}):\n${practiceReflection}` : "",
      livingReflection ? `Living it out:\n${livingReflection}` : "",
      fruitReflection ? `Fruit forming:\n${fruitReflection}` : ""
    ].filter(Boolean).join("\n\n").slice(0, 1200);
    setIsSaving(true);
    setStatus("Saved locally. Syncing...");
    try {
      const response = await fetch("/api/student/scripture/reflections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId: prompt.id, reflected: true, privateNote })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; reflection?: StudentQuestionReflection };
      if (!response.ok || !payload.ok || !payload.reflection) {
        setStatus(payload.error ?? "Entry could not be saved. Your text is still here.");
        return;
      }
      onReflectionSaved(payload.reflection);
      setStatus("Entry saved.");
    } catch {
      setStatus("Entry could not be saved. Your text is still here.");
    } finally {
      setIsSaving(false);
    }
  }

  const firstIncompletePhase = phases.findIndex((phase) => !phase.complete);
  const currentPhaseIndex = firstIncompletePhase === -1 ? phases.length - 1 : firstIncompletePhase;

  return (
    <section className="student-lovable-journal" aria-label="Journey journal entry">
      <ol className="student-lovable-road" aria-label="Entry progress">
        {phases.map((phase, index) => (
          <li key={phase.label} aria-current={index === currentPhaseIndex ? "step" : undefined}>
            <span className={phase.complete ? "complete" : ""}>
              <i>{phase.complete ? <Check aria-hidden="true" size={12} /> : index + 1}</i>
              {phase.label}
            </span>
          </li>
        ))}
      </ol>

      <LovableJournalSection
        icon={BookOpen}
        eyebrow="Scripture the app suggested"
        title="Sit with the passage before you speak back."
      >
        <div className="student-lovable-card-row">
          {readingCards.map((reading) => (
            <a className="student-lovable-mini-card" href={`/student/scripture/resources?reference=${encodeURIComponent(reading.lookupReference)}`} key={reading.id}>
              <strong>{reading.reference}</strong>
              <span>{reading.title}</span>
            </a>
          ))}
        </div>
        {keyWords.length ? (
          <div className="student-lovable-keyword-row" aria-label="Hebrew word study cards">
            {keyWords.map((word) => (
              <a className="student-lovable-keyword-card" href={word.lexicalUrl} key={word.transliteration} rel="noreferrer" target="_blank">
                <span>{word.originalLanguage}</span>
                <strong>{word.transliteration}</strong>
                <em>{word.term}</em>
                <p>{word.invitation}</p>
              </a>
            ))}
          </div>
        ) : null}
        <textarea
          onChange={(event) => setScriptureReflection(event.target.value)}
          placeholder="What did you notice? What word or phrase lingered? What is God stirring as you read slowly?"
          rows={5}
          value={scriptureReflection}
        />
      </LovableJournalSection>

      <LovableJournalSection
        icon={HelpCircle}
        eyebrow="Questions around your question"
        title="Wrestle honestly - the answer often lives inside a better question."
      >
        <ul className="student-lovable-question-list">
          {nextStep.wrestleQuestions.slice(0, 3).map((question) => (
            <li key={question}>&quot;{question}&quot;</li>
          ))}
        </ul>
        <textarea
          onChange={(event) => setQuestionReflection(event.target.value)}
          placeholder="Which of these presses on something real? Write toward it, not away from it."
          rows={5}
          value={questionReflection}
        />
      </LovableJournalSection>

      <LovableJournalSection
        icon={Sprout}
        eyebrow="Spiritual practices to try"
        title="Do not just think about it - practice it."
      >
        <div className="student-lovable-practice-grid" role="group" aria-label="Choose a spiritual practice">
          <button className={selectedPractice === "embodied" ? "active" : ""} onClick={() => setSelectedPractice("embodied")} type="button">
            <strong>{practice.title}</strong>
            <span>{practice.summary}</span>
          </button>
          {guidedPrayer ? (
            <button className={selectedPractice === "guided" ? "active" : ""} onClick={() => setSelectedPractice("guided")} type="button">
              <strong>{guidedPrayer.title}</strong>
              <span>{guidedPrayer.durationLabel}</span>
            </button>
          ) : null}
        </div>
        <details className="student-lovable-popout">
          <summary>Open practice details</summary>
          {selectedPractice === "guided" && guidedPrayer ? (
            <ol>{guidedPrayer.prompts.map((item) => <li key={item}>{item}</li>)}</ol>
          ) : (
            <ol>{practice.steps.map((item) => <li key={item}>{item}</li>)}</ol>
          )}
        </details>
        <textarea
          onChange={(event) => setPracticeReflection(event.target.value)}
          placeholder="Which practice will you try this week? When, where, and for how long?"
          rows={4}
          value={practiceReflection}
        />
      </LovableJournalSection>

      <LovableJournalSection
        icon={Footprints}
        eyebrow="Living it out"
        title={nextStep.wrestleTogetherPrompt.replace(/^Bring this to group:\s*/i, "")}
      >
        <textarea
          onChange={(event) => setLivingReflection(event.target.value)}
          placeholder="Where does this touch your actual life - relationships, your week, your phone, your calendar? What is one concrete step?"
          rows={5}
          value={livingReflection}
        />
      </LovableJournalSection>

      <LovableJournalSection
        icon={Leaf}
        eyebrow="Fruit forming"
        title="Notice what God is actually growing in you."
      >
        <textarea
          onChange={(event) => setFruitReflection(event.target.value)}
          placeholder="What fruit - however small - is beginning to show? Where is it hard-won? Where has God surprised you?"
          rows={5}
          value={fruitReflection}
        />
      </LovableJournalSection>

      <div className="student-lovable-save-row">
        <p>{status}</p>
        <button disabled={isSaving} onClick={() => void saveEntry()} type="button">
          <Feather aria-hidden="true" size={14} />
          {isSaving ? "Saving..." : "Save entry"}
        </button>
      </div>
    </section>
  );
}

function LovableJournalSection({
  children,
  eyebrow,
  icon: Icon,
  title
}: {
  children: React.ReactNode;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="student-lovable-section">
      <div className="student-lovable-section-heading">
        <span>
          <Icon aria-hidden={true} size={16} />
        </span>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="student-lovable-section-body">{children}</div>
    </section>
  );
}

const studentQuestionArchiveStorageKey = "lead-emergence:student-question-archives";
const studentJourneyEntriesStorageKey = "lead-emergence:student-journey-entries";

function readArchivedPromptIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(studentQuestionArchiveStorageKey) ?? "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function readEntrySequences() {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(studentJourneyEntriesStorageKey) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([promptId, value]) => [
          promptId,
          Array.isArray(value)
            ? value.filter((item): item is number => Number.isInteger(item) && item > 0).slice(0, 40)
            : [1]
        ])
        .filter(([, value]) => Array.isArray(value) && value.length > 0)
    );
  } catch {
    return {};
  }
}
