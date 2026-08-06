import { randomUUID } from "crypto";

import { isSupabaseConfigured } from "@/lib/auth/config";
import type { AuthSession } from "@/lib/auth/server";
import type { StudentQuestionReflection } from "@/lib/scripture/student-reflections";
import { buildLocalDiscussionDraftForPrompt, type LocalDiscussionDraft } from "@/lib/scripture/local-discussion-draft";
import type { StudentGroupDiscussionItem } from "@/lib/scripture/student-home";
import type { StudentDiscussionKnowledgeContext, StudentDiscussionPrompt, StudentDiscussionStatus } from "@/lib/scripture/types";
import type { StudentJourneyFormationContent, StudentJourneySelection } from "@/lib/scripture/student-journey-draft";
import { buildSeededSaulJourneyContent } from "@/lib/scripture/student-journey-content";
import { selectStudentQuestionJourney } from "@/lib/scripture/student-journey-selection";
import { sanitizeScriptureReference } from "@/lib/scripture/youversion";
import type { StudentHowToReadProgress } from "@/lib/scripture/how-to-read-progress";
import type { SaveStudentJourneyEntryInput, StudentJourneyEntry } from "@/lib/scripture/student-journey-entry-shared";
import { competitionGuestQuestions } from "@/lib/guest/competition-demo-content";

type LocalStudentState = {
  prompts: StudentDiscussionPrompt[];
  reflections: Record<string, StudentQuestionReflection>;
  journeyEntries: Record<string, StudentJourneyEntry>;
  progress: {
    completedModuleIds: Set<string>;
    shareWithGroup: boolean;
    updatedAt?: string;
  };
};

type SaveLocalPromptInput = {
  groupId?: string;
  question: string;
  scriptureReference: string;
  scripturePassageId?: string;
  metanarrativeMovement: StudentDiscussionPrompt["metanarrativeMovement"];
  draft: LocalDiscussionDraft;
  knowledgeContext: StudentDiscussionKnowledgeContext[];
  journeySelection?: StudentJourneySelection;
  journeyContent?: StudentJourneyFormationContent;
  ai?: {
    provider?: StudentDiscussionPrompt["aiProvider"];
    status: StudentDiscussionPrompt["aiStatus"];
    model?: string;
    modelTier?: StudentDiscussionPrompt["aiModelTier"];
    modelReason?: string;
    confidence?: number | null;
  };
};

type LocalDiscussionDecisionInput = {
  action:
    | "approve"
    | "request_changes"
    | "archive"
    | "post"
    | "regenerate"
    | "use_local_draft"
    | "assign_journey_passage"
    | "mark_discussed"
    | "flag_follow_up";
  leaderNotes?: string;
  discussionPrompt?: string;
  journeyScriptureReference?: string;
  journeyWhyThisPassage?: string;
};

const localStudentStateKey = Symbol.for("lead-emergence.local-student-state");
type LocalStudentStateGlobal = typeof globalThis & {
  [localStudentStateKey]?: Map<string, LocalStudentState>;
};

const localState =
  (globalThis as LocalStudentStateGlobal)[localStudentStateKey] ??
  ((globalThis as LocalStudentStateGlobal)[localStudentStateKey] = new Map<string, LocalStudentState>());

export function shouldUseLocalStudentState(session: AuthSession) {
  if (session.isGuest) return true;
  if (!canUseLocalStudentState()) return false;
  return session.isMock || !session.accessToken || !isSupabaseConfigured();
}

export function canUseLocalStudentState(env: NodeJS.ProcessEnv = process.env) {
  if (env.E2E_MOCK_AUTH === "true" && env.NODE_ENV !== "production") return true;
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") return false;
  if (env.NODE_ENV === "production") return false;
  return env.NODE_ENV === "test" || !isSupabaseConfigured();
}

export function listLocalStudentDiscussionPrompts(session: AuthSession) {
  const state = stateFor(session);
  return state.prompts
    .map((prompt) => {
      const reflection = state.reflections[prompt.id];
      return {
        ...prompt,
        studentReflectionCount: reflection?.reflectedAt ? 1 : 0,
        studentLastReflectedAt: reflection?.reflectedAt
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listLocalApprovedStudentDiscussionPrompts(session: AuthSession): StudentGroupDiscussionItem[] {
  return listLocalStudentDiscussionPrompts(session)
    .filter((prompt) => (prompt.status === "approved" || prompt.status === "posted") && Boolean(prompt.discussionPrompt))
    .slice(0, 6)
    .map((prompt) => ({
      id: prompt.id,
      groupId: prompt.groupId,
      question: prompt.question,
      scriptureReference: prompt.scriptureReference,
      discussionPrompt: prompt.discussionPrompt,
      status: prompt.status as Extract<StudentDiscussionStatus, "approved" | "posted">,
      createdAt: prompt.createdAt,
      ...(prompt.leaderDiscussedAt ? { leaderDiscussedAt: prompt.leaderDiscussedAt } : {})
    }));
}

export function saveLocalStudentDiscussionPrompt(session: AuthSession, input: SaveLocalPromptInput) {
  const now = new Date().toISOString();
  const prompt: StudentDiscussionPrompt = {
    id: `local_${randomUUID()}`,
    groupId: input.groupId,
    submittedByUserId: session.user.id,
    submittedByName: session.user.fullName,
    submittedByEmail: session.user.email,
    question: input.question,
    scriptureReference: input.scriptureReference,
    scripturePassageId: input.scripturePassageId,
    metanarrativeMovement: input.metanarrativeMovement,
    aiProvider: input.ai?.provider ?? (session.isGuest ? "guest-stock-responses" : "gloo"),
    aiStatus: input.ai?.status ?? "not_configured",
    aiModel: input.ai?.model ?? "",
    aiModelTier: input.ai?.modelTier ?? "default",
    aiModelReason: input.ai?.modelReason ?? "Development-only session storage. Production and preview use live Meridian storage.",
    aiConfidence: input.ai?.confidence ?? null,
    topicTags: input.draft.topicTags,
    escalationReason: input.draft.escalationReason,
    safetyLabel: input.draft.safetyLabel,
    safetyNotes: input.draft.safetyNotes,
    discussionPrompt: input.draft.discussionPrompt,
    ...(input.journeySelection ? { journeySelection: input.journeySelection } : {}),
    ...(input.journeyContent ? { journeyContent: input.journeyContent } : {}),
    leaderNotes: "",
    status: "pending_review",
    knowledgeContext: input.knowledgeContext,
    deliveryStatus: "not_requested",
    deliveryMessage: "",
    createdAt: now,
    updatedAt: now
  };

  const state = stateFor(session);
  state.prompts.unshift(prompt);
  state.prompts = state.prompts.slice(0, 20);
  return prompt;
}

export function decideLocalStudentDiscussionPrompt(session: AuthSession, id: string, input: LocalDiscussionDecisionInput) {
  const state = stateFor(session);
  const prompt = state.prompts.find((item) => item.id === id);
  if (!prompt) throw new Error("Discussion prompt not found.");

  const now = new Date().toISOString();
  const leaderNotes = normalizeLocalText(input.leaderNotes) || prompt.leaderNotes;
  const discussionPrompt = normalizeLocalText(input.discussionPrompt) || prompt.discussionPrompt;
  const updated: StudentDiscussionPrompt = {
    ...prompt,
    leaderNotes,
    discussionPrompt,
    updatedAt: now
  };

  if (input.action === "assign_journey_passage") {
    const sanitized = sanitizeScriptureReference(input.journeyScriptureReference ?? "");
    if (!sanitized.ok) throw new Error(sanitized.message);
    const whyThisPassage = normalizeLocalText(input.journeyWhyThisPassage);
    if (!whyThisPassage) throw new Error("Explain why this passage directly addresses the student's question.");
    const selection = selectStudentQuestionJourney({
      question: prompt.question,
      scriptureReference: sanitized.reference,
      topicTags: []
    }).selection;
    if (selection.status !== "matched") {
      throw new Error("Choose a passage from the same narrative, figures, or an explicit biblical cross-reference.");
    }
    updated.journeySelection = {
      ...selection,
      confidence: 1,
      whyThisPassage,
      matchSignals: [`Leader assigned: ${sanitized.reference}`, "Leader supplied the direct-relevance rationale."],
      passageReasons: selection.passageReasons.map((passage, index) =>
        index === 0
          ? { ...passage, reason: whyThisPassage, relationship: "leader_assigned" as const }
          : passage
      )
    };
    updated.journeyContent = /\bsaul\b/i.test(prompt.question) && /^1\s*samuel\s+8\b/i.test(selection.primaryReference)
      ? buildSeededSaulJourneyContent(now)
      : undefined;
    updated.status = "pending_review";
    updated.approvedAt = undefined;
    updated.approvedByUserId = undefined;
  }

  if (input.action === "regenerate" || input.action === "use_local_draft") {
    const localDraft = buildLocalDiscussionDraftForPrompt(prompt);
    updated.aiStatus = "not_configured";
    updated.aiModelReason = "Development-only session storage. Knowledge-guided fallback draft saved without an external AI call.";
    updated.topicTags = localDraft.topicTags;
    updated.escalationReason = localDraft.escalationReason;
    updated.safetyLabel = localDraft.safetyLabel;
    updated.safetyNotes = localDraft.safetyNotes;
    updated.discussionPrompt = localDraft.discussionPrompt;
  }

  if (input.action === "approve") {
    if (!updated.discussionPrompt.trim()) throw new Error("Write a discussion prompt before approving this question.");
    if (updated.journeySelection && updated.journeySelection.status !== "matched") {
      throw new Error("Assign a directly relevant Scripture passage before approving this question.");
    }
    if (updated.journeySelection && (!updated.journeyContent || updated.journeyContent.sourceStatus !== "supported" || updated.journeyContent.missingSourceFields.length)) {
      throw new Error("Generate and review source-supported Journey Journal content before approving this question.");
    }
    updated.status = "approved";
    updated.approvedByUserId = session.user.id;
    updated.approvedAt = now;
  }

  if (input.action === "request_changes") {
    updated.status = "changes_requested";
  }

  if (input.action === "archive") {
    updated.status = "archived";
  }

  if (input.action === "post") {
    if (prompt.status !== "approved") throw new Error("Only approved discussion prompts can be shared.");
    updated.status = "posted";
    updated.postedAt = now;
    updated.deliveryChannel = "Local preview";
    updated.deliveryStatus = "not_configured";
    updated.deliveryMessage = "Local preview only. No Slack message was sent.";
  }

  if (input.action === "mark_discussed") {
    if (prompt.status !== "approved" && prompt.status !== "posted") throw new Error("Approve the prompt before marking it discussed.");
    updated.leaderDiscussedAt = now;
  }

  if (input.action === "flag_follow_up") {
    if (prompt.status === "archived") throw new Error("Archived prompts cannot be updated for group discussion.");
    updated.leaderFollowUpFlaggedAt = now;
    updated.leaderFollowUpFlagCount = (prompt.leaderFollowUpFlagCount ?? 0) + 1;
  }

  state.prompts = state.prompts.map((item) => (item.id === id ? updated : item));
  return updated;
}

export function getLocalStudentQuestionReflections(session: AuthSession, promptIds: string[]) {
  const reflections = stateFor(session).reflections;
  return Object.fromEntries(promptIds.filter((promptId) => reflections[promptId]).map((promptId) => [promptId, reflections[promptId]]));
}

export function saveLocalStudentQuestionReflection(
  session: AuthSession,
  input: { promptId: string; reflected: boolean; privateNote: string }
) {
  const now = new Date().toISOString();
  const reflection: StudentQuestionReflection = {
    promptId: input.promptId,
    reflectedAt: input.reflected ? now : undefined,
    privateNote: input.privateNote,
    updatedAt: now
  };
  stateFor(session).reflections[input.promptId] = reflection;
  return reflection;
}

export function getLocalStudentJourneyEntries(session: AuthSession) {
  return Object.values(stateFor(session).journeyEntries).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveLocalStudentJourneyEntry(session: AuthSession, input: SaveStudentJourneyEntryInput) {
  const now = new Date().toISOString();
  const entry: StudentJourneyEntry = {
    ...input,
    savedAt: now,
    updatedAt: now
  };
  stateFor(session).journeyEntries[`${input.journeyId}:entry-${input.entrySequence}`] = entry;
  return entry;
}

export function getLocalStudentHowToReadProgress(session: AuthSession): StudentHowToReadProgress {
  const progress = stateFor(session).progress;
  return {
    completedModuleIds: Array.from(progress.completedModuleIds),
    shareWithGroup: progress.shareWithGroup,
    updatedAt: progress.updatedAt,
    storage: "local"
  };
}

export function saveLocalStudentHowToReadProgress(
  session: AuthSession,
  input: { moduleId: string; completed: boolean; shareWithGroup?: boolean }
) {
  const progress = stateFor(session).progress;
  if (input.completed) {
    progress.completedModuleIds.add(input.moduleId);
  } else {
    progress.completedModuleIds.delete(input.moduleId);
  }
  if (input.shareWithGroup !== undefined) progress.shareWithGroup = input.shareWithGroup;
  progress.updatedAt = new Date().toISOString();
  return getLocalStudentHowToReadProgress(session);
}

export function resetLocalStudentStateForTests() {
  localState.clear();
}

function stateFor(session: AuthSession) {
  const key = session.isGuest
    ? `guest:${session.guestSessionId ?? session.user.id}`
    : shouldUseLocalStudentState(session)
      ? "local-dev-ministry"
      : session.user.id;
  const existing = localState.get(key);
  if (existing) return existing;

  const state: LocalStudentState = {
    prompts: session.isGuest
      ? competitionGuestQuestions.map((prompt) => ({
          ...prompt,
          submittedByUserId: session.user.id,
          submittedByName: session.user.fullName,
          submittedByEmail: session.user.email,
          topicTags: [...prompt.topicTags]
        }))
      : [],
    reflections: {},
    journeyEntries: {},
    progress: {
      completedModuleIds: new Set<string>(),
      shareWithGroup: false
    }
  };
  localState.set(key, state);
  return state;
}

function normalizeLocalText(value: string | undefined) {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}
