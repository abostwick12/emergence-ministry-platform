"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, BookOpen, Check, ChevronDown, Feather, Footprints, GitFork, Leaf, Plus, RotateCcw, Sprout } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { StudentQuestionComposer } from "@/components/student/student-question-composer";
import { YouVersionReaderWindow } from "@/components/student/youversion-reader-window";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { studentLeaderFormationJourney } from "@/lib/scripture/student-formation-journeys";
import { buildQuestionNextStep, type StudentJourneyJournal, type StudentQuestionNextStep } from "@/lib/scripture/student-home";
import type { StudentQuestionReflection } from "@/lib/scripture/student-reflections";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";
import { buildYouVersionReaderLink } from "@/lib/scripture/youversion";

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
  const [activeEntryByJourney, setActiveEntryByJourney] = useState<Record<string, number>>({});
  const [selectedJourneyId, setSelectedJourneyId] = useState(initialState.prompts[0]?.id ?? studentLeaderFormationJourney.id);
  const [isComposerOpen, setIsComposerOpen] = useState(!initialState.prompts[0]);
  const activePrompts = prompts.filter((prompt) => prompt.status !== "archived" && !archivedPromptIds.has(prompt.id));
  const archivedPrompts = prompts.filter((prompt) => prompt.status === "archived" || archivedPromptIds.has(prompt.id));
  const selectedPrompt = activePrompts.find((prompt) => prompt.id === selectedJourneyId);
  const isFormationJourneySelected = selectedJourneyId === studentLeaderFormationJourney.id;
  const rawSelectedEntries = isFormationJourneySelected
    ? studentLeaderFormationJourney.entries.map((_, index) => index + 1)
    : selectedPrompt
      ? entrySequences[selectedPrompt.id] ?? [1]
      : [1];
  const selectedNextStep = useMemo(() => {
    if (!selectedPrompt) return null;
    return nextSteps[selectedPrompt.id] ?? buildQuestionNextStep(selectedPrompt);
  }, [nextSteps, selectedPrompt]);
  const maxJournalEntries = Math.max(
    1,
    isFormationJourneySelected ? studentLeaderFormationJourney.entries.length : selectedNextStep?.journeyJournalEntries?.length ?? 1
  );
  const selectedEntries = rawSelectedEntries.filter((sequence) => sequence <= maxJournalEntries);
  const visibleSelectedEntries = selectedEntries.length ? selectedEntries : [1];
  const requestedEntrySequence = activeEntryByJourney[selectedJourneyId] ?? visibleSelectedEntries[0] ?? 1;
  const activeEntrySequence = Math.min(requestedEntrySequence, maxJournalEntries);

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
    if (selectedPrompt || isFormationJourneySelected) return;
    setSelectedJourneyId(activePrompts[0]?.id ?? studentLeaderFormationJourney.id);
  }, [activePrompts, isFormationJourneySelected, selectedPrompt]);

  function addCreatedPrompt(prompt: StudentDiscussionPrompt, nextStep: StudentQuestionNextStep) {
    setPrompts((current) => [prompt, ...current.filter((item) => item.id !== prompt.id)].slice(0, 5));
    setNextSteps((current) => ({ ...current, [prompt.id]: nextStep }));
    setArchivedPromptIds((current) => {
      const next = new Set(current);
      next.delete(prompt.id);
      return next;
    });
    setEntrySequences((current) => ({ ...current, [prompt.id]: [1] }));
    setActiveEntryByJourney((current) => ({ ...current, [prompt.id]: 1 }));
    setSelectedJourneyId(prompt.id);
    setIsComposerOpen(false);
  }

  function updateReflection(reflection: StudentQuestionReflection) {
    setReflections((current) => ({ ...current, [reflection.promptId]: reflection }));
  }

  function archivePrompt(promptId: string) {
    setArchivedPromptIds((current) => new Set(current).add(promptId));
    if (selectedJourneyId === promptId) {
      const nextPrompt = activePrompts.find((prompt) => prompt.id !== promptId);
      setSelectedJourneyId(nextPrompt?.id ?? studentLeaderFormationJourney.id);
    }
  }

  function restorePrompt(promptId: string) {
    setArchivedPromptIds((current) => {
      const next = new Set(current);
      next.delete(promptId);
      return next;
    });
    setSelectedJourneyId(promptId);
  }

  function addEntry(promptId: string) {
    setEntrySequences((current) => {
      const existing = (current[promptId] ?? [1]).filter((sequence) => sequence <= maxJournalEntries);
      if (existing.length >= maxJournalEntries) return current;
      const nextEntry = Math.max(...existing) + 1;
      if (nextEntry > maxJournalEntries) return current;
      setActiveEntryByJourney((entries) => ({ ...entries, [promptId]: nextEntry }));
      return { ...current, [promptId]: [...existing, nextEntry] };
    });
  }

  function selectEntry(promptId: string, sequence: number) {
    setActiveEntryByJourney((current) => ({ ...current, [promptId]: sequence }));
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
      <section className="student-journal-control" aria-label="Journey journal selector">
          <details className="student-journal-dropdown">
            <summary>
              <div>
                <p className="eyebrow">{isFormationJourneySelected ? "Formation Journey" : "Question Journal"}</p>
                <strong>{isFormationJourneySelected ? studentLeaderFormationJourney.title : selectedPrompt?.question}</strong>
                <span>{isFormationJourneySelected
                  ? `${studentLeaderFormationJourney.durationLabel} / ${studentLeaderFormationJourney.availableLabel}`
                  : `${selectedPrompt?.scriptureReference || "Open question"} / ${visibleSelectedEntries.length} ${visibleSelectedEntries.length === 1 ? "entry" : "entries"}`}</span>
              </div>
              <ChevronDown aria-hidden="true" size={18} />
            </summary>
            <div className="student-journal-dropdown-menu">
              <p className="eyebrow">Formation journeys</p>
              <button
                className={isFormationJourneySelected ? "active" : ""}
                onClick={() => setSelectedJourneyId(studentLeaderFormationJourney.id)}
                type="button"
              >
                <span>{studentLeaderFormationJourney.availableLabel}</span>
                <strong>{studentLeaderFormationJourney.title}</strong>
              </button>
              <p className="eyebrow">Submitted questions</p>
              {activePrompts.map((prompt) => (
                <button
                  className={prompt.id === selectedPrompt?.id ? "active" : ""}
                  key={prompt.id}
                  onClick={() => setSelectedJourneyId(prompt.id)}
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
            {visibleSelectedEntries.map((sequence) => (
              <button
                className={sequence === activeEntrySequence ? "active" : ""}
                key={sequence}
                onClick={() => selectEntry(selectedJourneyId, sequence)}
                type="button"
              >
                {sequence}
              </button>
            ))}
            {selectedPrompt ? (
              <button className="add-entry" disabled={visibleSelectedEntries.length >= maxJournalEntries} onClick={() => addEntry(selectedPrompt.id)} type="button">
                <Plus aria-hidden="true" size={15} />
                {visibleSelectedEntries.length >= maxJournalEntries ? "All paths open" : "Add entry"}
              </button>
            ) : null}
          </div>
        </section>
      {isFormationJourneySelected ? (
        <StudentLovableJournalEntry
          entrySequence={activeEntrySequence}
          journalId={studentLeaderFormationJourney.id}
          journeys={studentLeaderFormationJourney.entries}
        />
      ) : null}
      {selectedPrompt && selectedNextStep ? (
        <StudentLovableJournalEntry
          entrySequence={activeEntrySequence}
          journalId={selectedPrompt.id}
          journeys={selectedNextStep.journeyJournalEntries}
          onReflectionSaved={updateReflection}
          prompt={selectedPrompt}
          reflection={reflections[selectedPrompt.id]}
          walkPrompt={selectedNextStep.wrestleTogetherPrompt.replace(/^Bring this to group:\s*/i, "")}
        />
      ) : null}
      <details aria-label="Journey History" className="student-feed-section student-journey-history" role="region">
        <summary>
          <span>
            <span className="eyebrow">Journey history</span>
            <strong>{activePrompts.length} active {activePrompts.length === 1 ? "journey" : "journeys"}</strong>
          </span>
          <ChevronDown aria-hidden="true" size={18} />
        </summary>
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
                  <button className="button secondary" onClick={() => setSelectedJourneyId(prompt.id)} type="button">Open</button>
                  <button className="button compact" onClick={() => archivePrompt(prompt.id)} type="button"><Archive aria-hidden="true" size={15} />Archive</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="student-feed-empty"><strong>No questions sent yet.</strong><p>When you send a real question, it will show here while your leader reviews it.</p></div>
        )}
      </details>
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
  journalId,
  journeys,
  onReflectionSaved,
  prompt,
  reflection,
  walkPrompt
}: {
  entrySequence: number;
  journalId: string;
  journeys: StudentJourneyJournal[];
  onReflectionSaved?: (reflection: StudentQuestionReflection) => void;
  prompt?: StudentDiscussionPrompt;
  reflection?: StudentQuestionReflection;
  walkPrompt?: string;
}) {
  const [scriptureReflection, setScriptureReflection] = useState("");
  const [questionReflection, setQuestionReflection] = useState("");
  const [practiceReflection, setPracticeReflection] = useState("");
  const [livingReflection, setLivingReflection] = useState("");
  const [fruitReflection, setFruitReflection] = useState("");
  const [selectedPractice, setSelectedPractice] = useState<"embodied" | "guided">("embodied");
  const [studyPath, setStudyPath] = useState<"word" | "inductive">("word");
  const activeJourney = journeys[Math.min(entrySequence - 1, journeys.length - 1)] ?? journeys[0];
  const firstReadingId = activeJourney.readingPath[0]?.id ?? "";
  const draftStorageKey = `${studentJourneyDraftStorageKey}:${journalId}:entry-${entrySequence}`;
  const [selectedReadingId, setSelectedReadingId] = useState(firstReadingId);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(reflection?.privateNote ? "Saved to your private note." : "Autosaved locally until you save the entry.");
  const practice = activeJourney.spiritualPractice;
  const readingCards = activeJourney.readingPath.slice(0, 3);
  const selectedReading = readingCards.find((reading) => reading.id === selectedReadingId) ?? readingCards[0];
  const selectedReader = selectedReading ? buildYouVersionReaderLink(selectedReading.lookupReference) : undefined;
  const guidedPrayer = practice.guidedPrayer;
  const keyWords = activeJourney.keyWords.slice(0, 3);
  const phases = [
    { label: "Receive", complete: Boolean(scriptureReflection.trim()) },
    { label: "Explore", complete: Boolean(questionReflection.trim()) },
    { label: "Practice", complete: Boolean(practiceReflection.trim()) },
    { label: "Walk", complete: Boolean(livingReflection.trim()) },
    { label: "See", complete: Boolean(fruitReflection.trim()) }
  ];

  useEffect(() => {
    const draft = readJournalDraft(draftStorageKey);
    setScriptureReflection(draft?.scriptureReflection ?? "");
    setQuestionReflection(draft?.questionReflection ?? "");
    setPracticeReflection(draft?.practiceReflection ?? "");
    setLivingReflection(draft?.livingReflection ?? "");
    setFruitReflection(draft?.fruitReflection ?? "");
    setSelectedPractice(draft?.selectedPractice ?? "embodied");
    setStudyPath(draft?.studyPath ?? "word");
    setSelectedReadingId(draft?.selectedReadingId ?? firstReadingId);
    setStatus(
      reflection?.privateNote
        ? "Saved to your private note."
        : draft?.savedAt
          ? prompt
            ? "Entry saved locally and to your private note."
            : "Entry saved on this device."
          : "Your writing stays on this device until you save the entry."
    );
  }, [activeJourney.id, draftStorageKey, firstReadingId, prompt, reflection?.privateNote]);

  async function saveEntry() {
    const privateNote = [
      `${activeJourney.title}`,
      scriptureReflection ? `Receive:\n${scriptureReflection}` : "",
      questionReflection ? `Explore:\n${questionReflection}` : "",
      practiceReflection ? `Practice (${selectedPractice}):\n${practiceReflection}` : "",
      livingReflection ? `Walk:\n${livingReflection}` : "",
      fruitReflection ? `See:\n${fruitReflection}` : ""
    ].filter(Boolean).join("\n\n").slice(0, 1200);
    setIsSaving(true);
    setStatus(prompt ? "Saved on this device. Syncing to your private note..." : "Saving entry on this device...");
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify({
        scriptureReflection,
        questionReflection,
        practiceReflection,
        livingReflection,
        fruitReflection,
        selectedPractice,
        studyPath,
        selectedReadingId,
        savedAt: new Date().toISOString()
      } satisfies JournalEntryDraft));

      if (!prompt) {
        setStatus("Entry saved on this device.");
        return;
      }

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
      onReflectionSaved?.(payload.reflection);
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
      <JourneyRhythmIntro />
      <header className="student-formation-day-heading">
        <div>
          <p className="eyebrow">Journey Journal / {activeJourney.title}</p>
          <h1>{activeJourney.title}</h1>
          <p>{activeJourney.subtitle}</p>
        </div>
        {activeJourney.rhythm ? <span className="pill blue">Day {entrySequence} of 14</span> : null}
      </header>
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
        eyebrow="Receive the Story / Step 1"
        title="God speaks. We begin by listening."
      >
        <div className="student-scripture-recommendations" role="group" aria-label="Recommended Scripture passages">
          {readingCards.map((reading) => (
            <button className={selectedReading?.id === reading.id ? "active" : ""} key={reading.id} onClick={() => setSelectedReadingId(reading.id)} type="button">
              <strong>{reading.reference}</strong>
              <span>{reading.title}</span>
            </button>
          ))}
        </div>
        <YouVersionReaderWindow link={selectedReader?.ok ? selectedReader : undefined} title="Choose a recommended passage" />
        <textarea
          onChange={(event) => setScriptureReflection(event.target.value)}
          placeholder="What did you notice? What word or phrase lingered? What is God stirring as you read slowly?"
          rows={5}
          value={scriptureReflection}
        />
      </LovableJournalSection>

      <LovableJournalSection
        icon={GitFork}
        eyebrow="Explore the Story / Step 2"
        title={activeJourney.rhythm?.explore ?? "We seek understanding."}
      >
        <div className="student-lovable-investigate-grid" role="group" aria-label="Choose an investigation path">
          <button className={studyPath === "word" ? "active" : ""} onClick={() => setStudyPath("word")} type="button">
            <strong>Word study</strong>
            <span>Slow down around one meaningful word and its biblical context.</span>
          </button>
          <button className={studyPath === "inductive" ? "active" : ""} onClick={() => setStudyPath("inductive")} type="button">
            <strong>Inductive study</strong>
            <span>Observe what is there, interpret in context, then respond carefully.</span>
          </button>
        </div>
        {studyPath === "word" && keyWords.length ? (
          <div className="student-lovable-keyword-row" aria-label="Word study cards">
            {keyWords.map((word) => (
              <a className="student-lovable-keyword-card" href={word.lexicalUrl} key={word.transliteration} rel="noreferrer" target="_blank">
                <span>{word.originalLanguage}</span>
                <strong>{word.transliteration}</strong>
                <em>{word.term}</em>
                <p>{word.invitation}</p>
              </a>
            ))}
          </div>
        ) : (
          <ul className="student-lovable-question-list">
            {activeJourney.followUpQuestions.slice(0, 3).map((question) => <li key={question.id}>&quot;{question.prompt}&quot;</li>)}
          </ul>
        )}
        <textarea
          onChange={(event) => setQuestionReflection(event.target.value)}
          placeholder={studyPath === "word" ? "What does this word reveal in this passage?" : "What do you observe, what does it mean in context, and how will you respond?"}
          rows={5}
          value={questionReflection}
        />
      </LovableJournalSection>
      <LovableJournalSection
        icon={Sprout}
        eyebrow="Practice the Story / Step 3"
        title={activeJourney.rhythm?.practice ?? "Truth forms us as we faithfully respond."}
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
          placeholder="How will you practice this intentionally? When, where, and for how long?"
          rows={4}
          value={practiceReflection}
        />
      </LovableJournalSection>

      <LovableJournalSection
        icon={Footprints}
        eyebrow="Walk the Story / Step 4"
        title={activeJourney.rhythm?.walk ?? walkPrompt ?? activeJourney.openingPrompt}
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
        eyebrow="See the Story Growing / Step 5"
        title={activeJourney.rhythm?.see ?? "We learn to recognize what God has been doing all along."}
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

function JourneyRhythmIntro() {
  return (
    <section className="student-rhythm-intro" aria-labelledby="rhythm-of-the-way-title">
      <div>
        <p className="eyebrow">How to use this journal</p>
        <h2 id="rhythm-of-the-way-title">The Rhythm of the Way</h2>
        <p>
          Every journey follows the same rhythm—not because discipleship is predictable, but because God has always formed His people through listening, seeking, responding, walking, and remembering.
        </p>
      </div>
      <ol>
        <li><strong>Receive</strong><span>God speaks. We begin by listening.</span></li>
        <li><strong>Explore</strong><span>We seek understanding with curiosity and humility.</span></li>
        <li><strong>Practice</strong><span>Truth forms us as we faithfully respond.</span></li>
        <li><strong>Walk</strong><span>We carry God&apos;s Story into ordinary life.</span></li>
        <li><strong>See</strong><span>We recognize where the Spirit has been at work.</span></li>
      </ol>
      <p className="student-rhythm-closing">This rhythm is not a checklist to complete. It is a way of following Jesus—one faithful step at a time.</p>
    </section>
  );
}

const studentQuestionArchiveStorageKey = "lead-emergence:student-question-archives";
const studentJourneyEntriesStorageKey = "lead-emergence:student-journey-entries";
const studentJourneyDraftStorageKey = "lead-emergence:student-journey-draft";

type JournalEntryDraft = {
  scriptureReflection: string;
  questionReflection: string;
  practiceReflection: string;
  livingReflection: string;
  fruitReflection: string;
  selectedPractice: "embodied" | "guided";
  studyPath: "word" | "inductive";
  selectedReadingId: string;
  savedAt: string;
};

function readJournalDraft(storageKey: string): JournalEntryDraft | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as Partial<JournalEntryDraft> | null;
    if (!parsed || typeof parsed !== "object") return undefined;
    return {
      scriptureReflection: typeof parsed.scriptureReflection === "string" ? parsed.scriptureReflection : "",
      questionReflection: typeof parsed.questionReflection === "string" ? parsed.questionReflection : "",
      practiceReflection: typeof parsed.practiceReflection === "string" ? parsed.practiceReflection : "",
      livingReflection: typeof parsed.livingReflection === "string" ? parsed.livingReflection : "",
      fruitReflection: typeof parsed.fruitReflection === "string" ? parsed.fruitReflection : "",
      selectedPractice: parsed.selectedPractice === "guided" ? "guided" : "embodied",
      studyPath: parsed.studyPath === "inductive" ? "inductive" : "word",
      selectedReadingId: typeof parsed.selectedReadingId === "string" ? parsed.selectedReadingId : "",
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : ""
    };
  } catch {
    return undefined;
  }
}

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
