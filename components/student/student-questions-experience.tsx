"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, BookOpen, Check, ChevronDown, Feather, Footprints, GitFork, Leaf, Plus, RotateCcw, Sprout } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { StudentQuestionComposer } from "@/components/student/student-question-composer";
import { YouVersionReaderWindow } from "@/components/student/youversion-reader-window";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { studentLeaderFormationJourney } from "@/lib/scripture/student-formation-journeys";
import {
  buildJourneyExploreGuide,
  buildQuestionNextStep,
  getJourneyExploreToolPair,
  getYouVersionPracticeMedia,
  type StudentGuidedPrayer,
  type StudentJourneyJournal,
  type StudentJourneyPractice,
  type StudentQuestionNextStep
} from "@/lib/scripture/student-home";
import { studentJourneyEntryKey, type StudentJourneyEntry } from "@/lib/scripture/student-journey-entry-shared";
import type { StudentQuestionReflection } from "@/lib/scripture/student-reflections";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";
import { buildYouVersionReaderLink } from "@/lib/scripture/youversion";

type StudentQuestionsExperienceProps = {
  initialJourneyEntries: StudentJourneyEntry[];
  initialReflections: Record<string, StudentQuestionReflection>;
  initialState: DiscussionWorkflowState;
  studentId: string;
};

export function StudentQuestionsExperience({ initialJourneyEntries, initialReflections, initialState, studentId }: StudentQuestionsExperienceProps) {
  const [prompts, setPrompts] = useState(initialState.prompts);
  const [nextSteps, setNextSteps] = useState<Record<string, StudentQuestionNextStep>>({});
  const [reflections, setReflections] = useState(initialReflections);
  const [journeyEntries, setJourneyEntries] = useState(() => indexJourneyEntries(initialJourneyEntries));
  const [archivedPromptIds, setArchivedPromptIds] = useState<Set<string>>(new Set());
  const [entrySequences, setEntrySequences] = useState<Record<string, number[]>>({});
  const [localStateLoaded, setLocalStateLoaded] = useState(false);
  const [activeEntryByJourney, setActiveEntryByJourney] = useState<Record<string, number>>({});
  const [selectedJourneyId, setSelectedJourneyId] = useState(initialState.prompts[0]?.id ?? studentLeaderFormationJourney.id);
  const [isComposerOpen, setIsComposerOpen] = useState(!initialState.prompts[0]);
  const journalDropdownRef = useRef<HTMLDetailsElement>(null);
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
    setEntrySequences(mergeEntrySequences(initialJourneyEntries, readEntrySequences(studentId)));
    setLocalStateLoaded(true);
  }, [initialJourneyEntries, studentId]);

  useEffect(() => {
    if (!localStateLoaded) return;
    window.localStorage.setItem(studentQuestionArchiveStorageKey, JSON.stringify(Array.from(archivedPromptIds)));
  }, [archivedPromptIds, localStateLoaded]);

  useEffect(() => {
    if (!localStateLoaded) return;
    window.localStorage.setItem(scopedStorageKey(studentJourneyEntriesStorageKey, studentId), JSON.stringify(entrySequences));
  }, [entrySequences, localStateLoaded, studentId]);

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

  function updateJourneyEntry(entry: StudentJourneyEntry) {
    setJourneyEntries((current) => ({ ...current, [studentJourneyEntryKey(entry.journeyId, entry.entrySequence)]: entry }));
    if (entry.journeyKind === "question") {
      setEntrySequences((current) => ({
        ...current,
        [entry.journeyId]: Array.from(new Set([...(current[entry.journeyId] ?? [1]), entry.entrySequence])).sort((a, b) => a - b)
      }));
    }
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
    journalDropdownRef.current?.removeAttribute("open");
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

  function selectJourney(journeyId: string) {
    setSelectedJourneyId(journeyId);
    journalDropdownRef.current?.removeAttribute("open");
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
      <section className="student-feed-section student-journey-rhythm-summary" aria-label="Journey Journal rhythm">
        <div className="student-feed-section-heading">
          <p className="eyebrow">Journey Journal</p>
          <h2>Receive, Explore, Practice, Walk, See</h2>
        </div>
        <p>
          Every student question moves through Scripture, interpretation, embodied practice, shared walking, and visible fruit while leaders review the conversation before it reaches the group.
        </p>
      </section>
      <section className="student-journal-control" aria-label="Journey journal selector">
          <details className="student-journal-dropdown" ref={journalDropdownRef}>
            <summary>
              <div>
                <p className="eyebrow">{isFormationJourneySelected ? "Formation Journey" : "Question Journal"}</p>
                <strong>{isFormationJourneySelected ? studentLeaderFormationJourney.title : selectedPrompt?.question}</strong>
                <span>{isFormationJourneySelected
                  ? `${studentLeaderFormationJourney.durationLabel} / ${studentLeaderFormationJourney.availableLabel}`
                  : `${selectedPrompt ? passageLabelForPrompt(selectedPrompt, selectedNextStep) : "Open question"} / ${visibleSelectedEntries.length} ${visibleSelectedEntries.length === 1 ? "entry" : "entries"}`}</span>
              </div>
              <ChevronDown aria-hidden="true" size={18} />
            </summary>
            <div className="student-journal-dropdown-menu">
              <p className="eyebrow">Formation journeys</p>
              <button
                className={isFormationJourneySelected ? "active" : ""}
                onClick={() => selectJourney(studentLeaderFormationJourney.id)}
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
                  onClick={() => selectJourney(prompt.id)}
                  type="button"
                >
                  <span>{passageLabelForPrompt(prompt, nextSteps[prompt.id])}</span>
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
          accountEntry={journeyEntries[studentJourneyEntryKey(studentLeaderFormationJourney.id, activeEntrySequence)]}
          entrySequence={activeEntrySequence}
          journalId={studentLeaderFormationJourney.id}
          journeys={studentLeaderFormationJourney.entries}
          journeyKind="formation"
          onJourneyEntrySaved={updateJourneyEntry}
          studentId={studentId}
        />
      ) : null}
      {selectedPrompt && selectedNextStep ? (
        <StudentLovableJournalEntry
          key={selectedPrompt.id}
          accountEntry={journeyEntries[studentJourneyEntryKey(selectedPrompt.id, activeEntrySequence)]}
          entrySequence={activeEntrySequence}
          journalId={selectedPrompt.id}
          journeys={selectedNextStep.journeyJournalEntries}
          journeyKind="question"
          onJourneyEntrySaved={updateJourneyEntry}
          onReflectionSaved={updateReflection}
          prompt={selectedPrompt}
          reflection={reflections[selectedPrompt.id]}
          studentId={studentId}
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
                  <span>{passageLabelForPrompt(prompt, nextSteps[prompt.id])}</span>
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
  accountEntry,
  entrySequence,
  journalId,
  journeyKind,
  journeys,
  onJourneyEntrySaved,
  onReflectionSaved,
  prompt,
  reflection,
  studentId,
  walkPrompt
}: {
  accountEntry?: StudentJourneyEntry;
  entrySequence: number;
  journalId: string;
  journeyKind: StudentJourneyEntry["journeyKind"];
  journeys: StudentJourneyJournal[];
  onJourneyEntrySaved: (entry: StudentJourneyEntry) => void;
  onReflectionSaved?: (reflection: StudentQuestionReflection) => void;
  prompt?: StudentDiscussionPrompt;
  reflection?: StudentQuestionReflection;
  studentId: string;
  walkPrompt?: string;
}) {
  const activeJourney = journeys[Math.min(entrySequence - 1, journeys.length - 1)] ?? journeys[0];
  const firstReadingId = activeJourney.readingPath[0]?.id ?? "";
  const legacyDraftStorageKey = `${studentJourneyDraftStorageKey}:${journalId}:entry-${entrySequence}`;
  const draftStorageKey = `${scopedStorageKey(studentJourneyDraftStorageKey, studentId)}:${journalId}:entry-${entrySequence}`;
  const [draft, setDraft] = useState<JournalEntryDraft>(() => emptyJournalDraft(firstReadingId));
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("Loading your saved journey...");
  const practice = activeJourney.spiritualPractice;
  const readingCards = activeJourney.readingPath.slice(0, 3);
  const selectedReading = readingCards.find((reading) => reading.id === draft.selectedReadingId) ?? readingCards[0];
  const selectedReader = selectedReading ? buildYouVersionReaderLink(selectedReading.lookupReference) : undefined;
  const guidedPrayer = practice.guidedPrayer;
  const keyWords = activeJourney.keyWords.slice(0, 3);
  const exploreTools = getJourneyExploreToolPair(activeJourney.id, entrySequence);
  const selectedExploreTool = exploreTools.find((tool) => tool.storageStudyPath === draft.studyPath) ?? exploreTools[0];
  const selectedExploreGuide = buildJourneyExploreGuide(selectedExploreTool, activeJourney);
  const receiveGuide = buildReceiveFormationGuide(activeJourney, selectedReading, selectedExploreGuide.passageFocus);
  const practiceDetailItems = buildPracticeDetailItems(practice, draft.selectedPractice, guidedPrayer);
  const practiceGuide = buildPracticeFormationGuide(activeJourney, practice, draft.selectedPractice, guidedPrayer);
  const walkGuide = buildWalkFormationGuide(activeJourney, prompt, walkPrompt);
  const seeGuide = buildSeeFormationGuide(activeJourney, prompt);
  const youVersionPracticeMedia = practice.youVersionMedia ?? getYouVersionPracticeMedia(activeJourney.id, entrySequence);
  const phases = [
    { label: "Receive", complete: Boolean(draft.scriptureReflection.trim()) },
    { label: "Explore", complete: Boolean(draft.questionReflection.trim()) },
    { label: "Practice", complete: Boolean(draft.practiceReflection.trim()) },
    { label: "Walk", complete: Boolean(draft.livingReflection.trim()) },
    { label: "See", complete: Boolean(draft.fruitReflection.trim()) }
  ];

  useEffect(() => {
    setHasHydratedDraft(false);
    const localDraft = readJournalDraft(draftStorageKey) ?? readJournalDraft(legacyDraftStorageKey);
    const accountDraft = accountEntry ? journeyEntryToDraft(accountEntry, firstReadingId) : undefined;
    const localIsNewer = Boolean(localDraft?.savedAt && (!accountEntry || localDraft.savedAt > accountEntry.updatedAt));
    const nextDraft = localIsNewer ? localDraft! : accountDraft ?? localDraft ?? emptyJournalDraft(firstReadingId);
    setDraft(nextDraft);
    setStatus(
      localIsNewer
        ? "This device has newer changes. Save entry to sync them to your account."
        : accountEntry
          ? "Saved to your account. Your journey follows you across devices."
          : localDraft?.savedAt
            ? "A device-only draft was recovered. Review it, then save to your account."
            : reflection?.privateNote
              ? "An older private note is saved. Save this entry to add cross-device progress."
              : "Drafts stay on this device until you save them to your account."
    );
    setHasHydratedDraft(true);
  }, [accountEntry, activeJourney.id, draftStorageKey, firstReadingId, legacyDraftStorageKey, reflection?.privateNote]);

  useEffect(() => {
    if (!hasHydratedDraft) return;
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [draft, draftStorageKey, hasHydratedDraft]);

  function updateDraft(patch: Partial<JournalEntryDraft>) {
    setDraft((current) => ({ ...current, ...patch, savedAt: new Date().toISOString() }));
    setStatus("Changes are saved on this device. Save entry to sync them to your account.");
  }

  async function saveEntry() {
    const savedDraft = { ...draft, savedAt: new Date().toISOString() };
    const privateNote = composeJourneyPrivateNote(activeJourney.title, savedDraft);
    setIsSaving(true);
    setDraft(savedDraft);
    setStatus("Saving entry to your account...");
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(savedDraft));
      const journeyResponse = await fetch("/api/student/scripture/journey-entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyId: journalId,
          journeyKind,
          ...(prompt ? { promptId: prompt.id } : {}),
          entrySequence,
          scriptureReflection: savedDraft.scriptureReflection,
          questionReflection: savedDraft.questionReflection,
          practiceReflection: savedDraft.practiceReflection,
          livingReflection: savedDraft.livingReflection,
          fruitReflection: savedDraft.fruitReflection,
          selectedPractice: savedDraft.selectedPractice,
          studyPath: savedDraft.studyPath,
          selectedReadingId: savedDraft.selectedReadingId
        })
      });
      const journeyPayload = (await journeyResponse.json()) as { ok?: boolean; error?: string; entry?: StudentJourneyEntry };
      if (!journeyResponse.ok || !journeyPayload.ok || !journeyPayload.entry) {
        setStatus(journeyPayload.error ?? "Entry could not be synced. Your draft is still on this device.");
        return;
      }

      onJourneyEntrySaved(journeyPayload.entry);
      if (legacyDraftStorageKey !== draftStorageKey) window.localStorage.removeItem(legacyDraftStorageKey);

      if (prompt) {
        const reflectionResponse = await fetch("/api/student/scripture/reflections", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptId: prompt.id, reflected: true, privateNote })
        });
        const reflectionPayload = (await reflectionResponse.json()) as { ok?: boolean; error?: string; reflection?: StudentQuestionReflection };
        if (!reflectionResponse.ok || !reflectionPayload.ok || !reflectionPayload.reflection) {
          setStatus("Entry saved to your account, but its group reflection signal could not be updated.");
          return;
        }
        onReflectionSaved?.(reflectionPayload.reflection);
      }

      setStatus("Entry saved to your account. It will follow you across devices.");
    } catch {
      setStatus("Entry could not be synced. Your draft is still on this device.");
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
            <button className={selectedReading?.id === reading.id ? "active" : ""} key={reading.id} onClick={() => updateDraft({ selectedReadingId: reading.id })} type="button">
              <strong>{reading.reference}</strong>
              <span>{reading.title}</span>
            </button>
          ))}
        </div>
        <FormationGuideList ariaLabel="Receive formation guide" items={receiveGuide} />
        <YouVersionReaderWindow link={selectedReader?.ok ? selectedReader : undefined} title="Choose a recommended passage" />
        <textarea
          onChange={(event) => updateDraft({ scriptureReflection: event.target.value })}
          placeholder="What did you notice? What word or phrase lingered? What is God stirring as you read slowly?"
          rows={5}
          value={draft.scriptureReflection}
        />
      </LovableJournalSection>

      <LovableJournalSection
        icon={GitFork}
        eyebrow="Explore the Story / Step 2"
        title={activeJourney.rhythm?.explore ?? "We seek understanding."}
      >
        <div className="student-lovable-investigate-grid" role="group" aria-label="Choose an investigation path">
          {exploreTools.map((tool) => (
            <button
              className={draft.studyPath === tool.storageStudyPath ? "active" : ""}
              key={tool.id}
              onClick={() => updateDraft({ studyPath: tool.storageStudyPath })}
              type="button"
            >
              <span className="student-lovable-explore-category">{tool.category}</span>
              <strong>{tool.label}</strong>
              <span>{tool.description}</span>
            </button>
          ))}
        </div>
        <div className="student-lovable-tool-note" aria-label="Selected Bible study tool">
          <span>{selectedExploreTool.category}</span>
          <strong>{selectedExploreTool.label}</strong>
          <p>{selectedExploreGuide.summary}</p>
          <dl className="student-lovable-passage-guide" aria-label="Passage-specific study guide">
            <div>
              <dt>Passage focus</dt>
              <dd>{selectedExploreGuide.passageFocus}</dd>
            </div>
            <div>
              <dt>Text clue</dt>
              <dd>{selectedExploreGuide.textClue}</dd>
            </div>
            <div>
              <dt>Whole-story bridge</dt>
              <dd>{selectedExploreGuide.storylineBridge}</dd>
            </div>
            <div>
              <dt>Study habit</dt>
              <dd>{selectedExploreGuide.studyHabit}</dd>
            </div>
            <div>
              <dt>Next question</dt>
              <dd>{selectedExploreGuide.nextQuestion}</dd>
            </div>
          </dl>
        </div>
        {draft.studyPath === "word" && keyWords.length ? (
          <div className="student-lovable-keyword-row" aria-label="Study support cards">
            {keyWords.map((word) => (
              <a className="student-lovable-keyword-card" href={word.lexicalUrl} key={word.transliteration ?? word.term} rel="noreferrer" target="_blank">
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
          onChange={(event) => updateDraft({ questionReflection: event.target.value })}
          placeholder={selectedExploreTool.placeholder}
          rows={5}
          value={draft.questionReflection}
        />
      </LovableJournalSection>
      <LovableJournalSection
        icon={Sprout}
        eyebrow="Practice the Story / Step 3"
        title={activeJourney.rhythm?.practice ?? "Truth forms us as we faithfully respond."}
      >
        <div className="student-lovable-practice-grid" role="group" aria-label="Choose a spiritual practice">
          <button className={draft.selectedPractice === "embodied" ? "active" : ""} onClick={() => updateDraft({ selectedPractice: "embodied" })} type="button">
            <strong>{practice.title}</strong>
            <span>{practice.summary}</span>
          </button>
          {guidedPrayer ? (
            <button className={draft.selectedPractice === "guided" ? "active" : ""} onClick={() => updateDraft({ selectedPractice: "guided" })} type="button">
              <strong>{guidedPrayer.title}</strong>
              <span>{guidedPrayer.durationLabel}</span>
            </button>
          ) : null}
        </div>
        <details className="student-lovable-popout">
          <summary>Open practice details</summary>
          <ol>{practiceDetailItems.map((item) => <li key={item}>{item}</li>)}</ol>
        </details>
        <FormationGuideList ariaLabel="Practice formation guide" items={practiceGuide} />
        <section className="student-lovable-youversion-practice" aria-label="YouVersion guided prayer media">
          {youVersionPracticeMedia.embedUrl ? (
            <iframe
              allow="autoplay; encrypted-media; picture-in-picture"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              src={youVersionPracticeMedia.embedUrl}
              title={youVersionPracticeMedia.title}
            />
          ) : null}
          <div>
            <p className="eyebrow">{youVersionPracticeMedia.sourceLabel}</p>
            <strong>{youVersionPracticeMedia.title}</strong>
            <p>{youVersionPracticeMedia.description}</p>
            <a href={youVersionPracticeMedia.href} rel="noreferrer" target="_blank">Open in YouVersion</a>
          </div>
        </section>
        <textarea
          onChange={(event) => updateDraft({ practiceReflection: event.target.value })}
          placeholder="How will you practice this intentionally? When, where, and for how long?"
          rows={4}
          value={draft.practiceReflection}
        />
      </LovableJournalSection>

      <LovableJournalSection
        icon={Footprints}
        eyebrow="Walk the Story / Step 4"
        title={activeJourney.rhythm?.walk ?? walkPrompt ?? activeJourney.openingPrompt}
      >
        <FormationGuideList ariaLabel="Walk formation guide" items={walkGuide} />
        <textarea
          onChange={(event) => updateDraft({ livingReflection: event.target.value })}
          placeholder="Where does this touch your actual life - relationships, your week, your phone, your calendar? What is one concrete step?"
          rows={5}
          value={draft.livingReflection}
        />
      </LovableJournalSection>

      <LovableJournalSection
        icon={Leaf}
        eyebrow="See the Story Growing / Step 5"
        title={activeJourney.rhythm?.see ?? "We learn to recognize what God has been doing all along."}
      >
        <FormationGuideList ariaLabel="See formation guide" items={seeGuide} />
        <textarea
          onChange={(event) => updateDraft({ fruitReflection: event.target.value })}
          placeholder="What fruit - however small - is beginning to show? Where is it hard-won? Where has God surprised you?"
          rows={5}
          value={draft.fruitReflection}
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

type FormationGuideItem = {
  label: string;
  value: string;
};

function FormationGuideList({ ariaLabel, items }: { ariaLabel: string; items: FormationGuideItem[] }) {
  return (
    <dl className="student-lovable-formation-guide" aria-label={ariaLabel}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function buildReceiveFormationGuide(
  journey: StudentJourneyJournal,
  reading: StudentJourneyJournal["readingPath"][number] | undefined,
  passageFocus: string
): FormationGuideItem[] {
  const reference = reading ? `${reading.reference}: ${reading.title}` : journey.title;

  return [
    {
      label: "Read slowly for",
      value: passageFocus
    },
    {
      label: "Passage anchor",
      value: reference
    },
    {
      label: "Lifelong habit",
      value: "Listen before solving. Name what the passage actually says about God, people, and the world before deciding what to do."
    }
  ];
}

function buildPracticeFormationGuide(
  journey: StudentJourneyJournal,
  practice: StudentJourneyPractice,
  selectedPractice: JournalEntryDraft["selectedPractice"],
  guidedPrayer?: StudentGuidedPrayer
): FormationGuideItem[] {
  const practiceName = selectedPractice === "guided" && guidedPrayer ? guidedPrayer.title : practice.title;

  return [
    {
      label: "Formation aim",
      value: practice.reflectionPrompt
    },
    {
      label: "Practice plan",
      value: `Give ${practiceName.toLowerCase()} a real time, place, and limit so ${journey.title.toLowerCase()} moves from an idea into obedience.`
    },
    {
      label: "Lifelong habit",
      value: "Let study become worship, repentance, courage, or love. Scripture is learned deeply when it is lived faithfully."
    }
  ];
}

function buildWalkFormationGuide(journey: StudentJourneyJournal, prompt?: StudentDiscussionPrompt, walkPrompt?: string): FormationGuideItem[] {
  return [
    {
      label: "Ordinary place",
      value: prompt ? `Carry "${prompt.question}" into one real conversation, decision, or temptation this week.` : walkPrompt ?? journey.openingPrompt
    },
    {
      label: "Concrete step",
      value: "Choose one action small enough to do today and specific enough that you will know whether you followed through."
    },
    {
      label: "Community cue",
      value: "Bring one honest sentence to a leader or group: what you noticed, what you resisted, or where you need prayer."
    }
  ];
}

function buildSeeFormationGuide(journey: StudentJourneyJournal, prompt?: StudentDiscussionPrompt): FormationGuideItem[] {
  return [
    {
      label: "Fruit to watch",
      value: journey.rhythm?.see ?? "Look for small signs of repentance, courage, patience, humility, love, or renewed trust."
    },
    {
      label: "Discernment habit",
      value: "Do not only measure answers. Notice what kind of person Scripture is forming you to become with Jesus."
    },
    {
      label: "Next faithful question",
      value: prompt ? `Ask how this question is becoming prayer, practice, and love for others.` : "Return tomorrow with one place where the passage met real life."
    }
  ];
}

function buildPracticeDetailItems(
  practice: StudentJourneyPractice,
  selectedPractice: JournalEntryDraft["selectedPractice"],
  guidedPrayer?: StudentGuidedPrayer
) {
  if (selectedPractice === "guided" && guidedPrayer) {
    return [
      `Prepare: Find a quiet place, open the passage, and set aside ${guidedPrayer.durationLabel.toLowerCase()} without multitasking.`,
      `Focus: ${guidedPrayer.backgroundHint}. Let that setting help your body slow down before you begin.`,
      ...guidedPrayer.prompts.map((item) => `Pray: ${item}`),
      "Reflect: Write the sentence, image, or request that stayed with you after the guided prayer."
    ];
  }

  return [
    `Prepare: Choose a real time and place for ${practice.title.toLowerCase()} before you leave this journal.`,
    `Begin: ${practice.summary}`,
    ...practice.steps.map((item) => `Practice: ${item}`),
    `Reflect: ${practice.reflectionPrompt}`,
    "Share: Bring one honest sentence from this practice to a leader or group if it would help you keep walking."
  ];
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

function passageLabelForPrompt(prompt: StudentDiscussionPrompt, nextStep?: StudentQuestionNextStep | null) {
  return prompt.scriptureReference || nextStep?.storylineMatch.keyPassages[0] || buildQuestionNextStep(prompt).storylineMatch.keyPassages[0] || "Passage anchor pending";
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

function emptyJournalDraft(firstReadingId: string): JournalEntryDraft {
  return {
    scriptureReflection: "",
    questionReflection: "",
    practiceReflection: "",
    livingReflection: "",
    fruitReflection: "",
    selectedPractice: "embodied",
    studyPath: "word",
    selectedReadingId: firstReadingId,
    savedAt: ""
  };
}

function journeyEntryToDraft(entry: StudentJourneyEntry, firstReadingId: string): JournalEntryDraft {
  return {
    scriptureReflection: entry.scriptureReflection,
    questionReflection: entry.questionReflection,
    practiceReflection: entry.practiceReflection,
    livingReflection: entry.livingReflection,
    fruitReflection: entry.fruitReflection,
    selectedPractice: entry.selectedPractice,
    studyPath: entry.studyPath,
    selectedReadingId: entry.selectedReadingId || firstReadingId,
    savedAt: entry.updatedAt
  };
}

function composeJourneyPrivateNote(title: string, draft: JournalEntryDraft) {
  return [
    title,
    draft.scriptureReflection ? `Receive:\n${draft.scriptureReflection}` : "",
    draft.questionReflection ? `Explore:\n${draft.questionReflection}` : "",
    draft.practiceReflection ? `Practice (${draft.selectedPractice}):\n${draft.practiceReflection}` : "",
    draft.livingReflection ? `Walk:\n${draft.livingReflection}` : "",
    draft.fruitReflection ? `See:\n${draft.fruitReflection}` : ""
  ].filter(Boolean).join("\n\n").slice(0, 1200);
}

function indexJourneyEntries(entries: StudentJourneyEntry[]) {
  return Object.fromEntries(entries.map((entry) => [studentJourneyEntryKey(entry.journeyId, entry.entrySequence), entry]));
}

function mergeEntrySequences(entries: StudentJourneyEntry[], localEntries: Record<string, number[]>) {
  const merged: Record<string, number[]> = { ...localEntries };
  for (const entry of entries) {
    if (entry.journeyKind !== "question") continue;
    merged[entry.journeyId] = Array.from(new Set([...(merged[entry.journeyId] ?? [1]), entry.entrySequence])).sort((a, b) => a - b);
  }
  return merged;
}

function scopedStorageKey(baseKey: string, studentId: string) {
  return `${baseKey}:${studentId}`;
}

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

function readEntrySequences(studentId: string): Record<string, number[]> {
  if (typeof window === "undefined") return {};
  try {
    const scoped = window.localStorage.getItem(scopedStorageKey(studentJourneyEntriesStorageKey, studentId));
    const parsed = JSON.parse(scoped ?? window.localStorage.getItem(studentJourneyEntriesStorageKey) ?? "{}") as unknown;
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
