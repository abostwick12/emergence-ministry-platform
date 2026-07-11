import { randomUUID } from "crypto";

import { isSupabaseConfigured } from "@/lib/auth/config";
import type { AuthSession } from "@/lib/auth/server";
import type { StudentQuestionReflection } from "@/lib/scripture/student-reflections";
import type { LocalDiscussionDraft } from "@/lib/scripture/local-discussion-draft";
import type { StudentDiscussionKnowledgeContext, StudentDiscussionPrompt } from "@/lib/scripture/types";
import type { StudentHowToReadProgress } from "@/lib/scripture/how-to-read-progress";

type LocalStudentState = {
  prompts: StudentDiscussionPrompt[];
  reflections: Record<string, StudentQuestionReflection>;
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
};

const localState = new Map<string, LocalStudentState>();

export function shouldUseLocalStudentState(session: AuthSession) {
  return session.isMock || !session.accessToken || !isSupabaseConfigured();
}

export function listLocalStudentDiscussionPrompts(session: AuthSession) {
  return [...stateFor(session).prompts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    aiProvider: "gloo",
    aiStatus: "not_configured",
    aiModel: "",
    aiModelTier: "default",
    aiModelReason: "Local student portal mode. Saved in this server session until live Supabase storage is connected.",
    aiConfidence: null,
    topicTags: input.draft.topicTags,
    escalationReason: input.draft.escalationReason,
    safetyLabel: input.draft.safetyLabel,
    safetyNotes: input.draft.safetyNotes,
    discussionPrompt: input.draft.discussionPrompt,
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
  const key = session.user.id;
  const existing = localState.get(key);
  if (existing) return existing;

  const state: LocalStudentState = {
    prompts: [],
    reflections: {},
    progress: {
      completedModuleIds: new Set<string>(),
      shareWithGroup: false
    }
  };
  localState.set(key, state);
  return state;
}
