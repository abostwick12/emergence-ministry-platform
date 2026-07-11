import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAdminClient, getSupabaseAuthClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { generateGlooDiscussionDraft, isGlooConfigured } from "@/lib/scripture/gloo";
import { formatStudentKnowledgeContextForGloo, getStudentKnowledgeMatches } from "@/lib/scripture/knowledge";
import { buildLocalDiscussionDraft, buildLocalDiscussionDraftForPrompt } from "@/lib/scripture/local-discussion-draft";
import { deliverDiscussionPromptToSlack, isSlackDiscussionDeliveryConfigured } from "@/lib/scripture/slack";
import {
  listLocalStudentDiscussionPrompts,
  saveLocalStudentDiscussionPrompt,
  shouldUseLocalStudentState
} from "@/lib/scripture/student-local-state";
import type { StudentGroupDiscussionItem } from "@/lib/scripture/student-home";
import { sanitizeScriptureReference } from "@/lib/scripture/youversion";
import { getPrimaryStudentGroupId } from "@/lib/student/groups";
import type {
  MetanarrativeMovement,
  StudentDiscussionDeliveryStatus,
  StudentDiscussionPrompt,
  StudentDiscussionStatus
} from "@/lib/scripture/types";

type DiscussionReadiness = {
  liveStorage: boolean;
  localStorage: boolean;
  canSubmit: boolean;
  gloo: boolean;
  slack: boolean;
  message: string;
};

export type DiscussionWorkflowState = {
  readiness: DiscussionReadiness;
  prompts: StudentDiscussionPrompt[];
};

export type CreateStudentDiscussionInput = {
  question: string;
  scriptureReference?: string;
  metanarrativeMovement?: MetanarrativeMovement;
};

export type DecideStudentDiscussionInput = {
  action:
    | "approve"
    | "request_changes"
    | "archive"
    | "post"
    | "regenerate"
    | "use_local_draft"
    | "mark_discussed"
    | "flag_follow_up";
  leaderNotes?: string;
  discussionPrompt?: string;
};

type StudentDiscussionPromptRow = {
  id: string;
  ministry_id: string | null;
  group_id: string | null;
  submitted_by_user_id: string;
  submitted_by_name: string;
  submitted_by_email: string;
  question: string;
  scripture_reference: string | null;
  scripture_passage_id: string | null;
  metanarrative_movement: MetanarrativeMovement | null;
  ai_provider: "gloo";
  ai_status: "not_configured" | "pending" | "generated" | "failed";
  ai_model: string | null;
  ai_model_tier: "default" | "escalation" | "long_context" | null;
  ai_model_reason: string | null;
  ai_confidence: number | null;
  topic_tags: string[] | null;
  escalation_reason: string | null;
  safety_label: "safe" | "needs_leader_care" | "pastoral_escalation" | "unreviewed";
  safety_notes: string | null;
  discussion_prompt: string | null;
  leader_notes: string | null;
  status: StudentDiscussionStatus;
  delivery_channel: string | null;
  delivery_status: StudentDiscussionDeliveryStatus;
  delivery_message: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApprovedStudentDiscussionRow = {
  id: string;
  group_id: string | null;
  question: string;
  scripture_reference: string | null;
  discussion_prompt: string | null;
  status: Extract<StudentDiscussionStatus, "approved" | "posted">;
  created_at: string;
};

type StudentReflectionEventRow = {
  prompt_id: string;
  action: "student_reflected" | "leader_discussed" | "leader_follow_up_flagged";
  actor_user_id: string | null;
  created_at: string;
};

type StudentReflectionSummary = {
  studentReflectionCount: number;
  studentLastReflectedAt?: string;
  leaderDiscussedAt?: string;
  leaderFollowUpFlaggedAt?: string;
  leaderFollowUpFlagCount?: number;
};

const MAX_QUESTION_LENGTH = 1200;
const MAX_NOTES_LENGTH = 1200;
const MAX_DISCUSSION_PROMPT_LENGTH = 1800;
const MISSING_STUDENT_PROFILE_MESSAGE =
  "Your student profile is not connected to a ministry yet. Join through your group invite again, or ask your leader for a fresh invite.";

export function getStudentDiscussionReadiness(session: AuthSession): DiscussionReadiness {
  if (shouldUseLocalStudentState(session)) {
    return {
      liveStorage: false,
      localStorage: true,
      canSubmit: true,
      gloo: isGlooConfigured(),
      slack: isSlackDiscussionDeliveryConfigured(),
      message: "Local student portal mode is ready. Questions and progress work here without writing to live Supabase."
    };
  }

  const gloo = isGlooConfigured();
  const slack = isSlackDiscussionDeliveryConfigured();
  return {
    liveStorage: true,
    localStorage: false,
    canSubmit: true,
    gloo,
    slack,
    message: gloo
      ? "Live storage is ready. AI drafts are generated for submitted questions."
      : "Live storage is ready. Local guided drafts are active until the AI draft connection is online."
  };
}

export async function getStudentDiscussionWorkflowState(session: AuthSession): Promise<DiscussionWorkflowState> {
  const readiness = getStudentDiscussionReadiness(session);
  if (!readiness.liveStorage) {
    return { readiness, prompts: listLocalStudentDiscussionPrompts(session) };
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase
    .from("student_discussion_prompts")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<StudentDiscussionPromptRow[]>();

  throwIfSupabaseError(result.error);
  const prompts = (result.data ?? []).map(toPrompt);
  const eventSummaries = await getStudentPromptEventSummaries(
    session,
    prompts.map((prompt) => prompt.id)
  );
  return {
    readiness,
    prompts: await withKnowledgeContext(
      session,
      prompts.map((prompt) => ({
        ...prompt,
        ...eventSummaries[prompt.id]
      }))
    )
  };
}

export async function getApprovedStudentDiscussionFeed(session: AuthSession): Promise<StudentGroupDiscussionItem[]> {
  const readiness = getStudentDiscussionReadiness(session);
  if (!readiness.liveStorage && readiness.localStorage) {
    return [];
  }
  if (!readiness.liveStorage || !isSupabaseAdminConfigured()) {
    return [];
  }

  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) return [];

  const supabase = getSupabaseAdminClient();
  const groupId = await getPrimaryStudentGroupId(session);
  let query = supabase
    .from("student_discussion_prompts")
    .select("id,group_id,question,scripture_reference,discussion_prompt,status,created_at")
    .eq("ministry_id", ministryId)
    .in("status", ["approved", "posted"])
    .not("discussion_prompt", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);

  if (session.user.role.trim().toLowerCase() === "student") {
    query = groupId ? query.or(`group_id.eq.${groupId},group_id.is.null`) : query.is("group_id", null);
  }

  const result = await query.returns<ApprovedStudentDiscussionRow[]>();

  throwIfSupabaseError(result.error);
  return (result.data ?? []).map(toGroupDiscussionItem);
}

export async function createStudentDiscussionPrompt(session: AuthSession, input: CreateStudentDiscussionInput) {
  const question = normalizeRequiredText(input.question, "Question", MAX_QUESTION_LENGTH);
  const scripture = normalizeScriptureReference(input.scriptureReference ?? "");
  const metanarrativeMovement = input.metanarrativeMovement ?? inferMetanarrativeMovement(question, scripture.reference);
  const readiness = getStudentDiscussionReadiness(session);

  if (!readiness.liveStorage) {
    if (!readiness.canSubmit) {
      throw new DiscussionWorkflowError(readiness.message, 503, "live_storage_not_configured");
    }

    const knowledgeContext = await getStudentKnowledgeMatches(session, {
      question,
      scriptureReference: scripture.reference
    });
    const localDraft = buildLocalDiscussionDraft({
      question,
      scriptureReference: scripture.reference,
      metanarrativeMovement,
      knowledgeContext
    });

    return saveLocalStudentDiscussionPrompt(session, {
      question,
      scriptureReference: scripture.reference,
      scripturePassageId: scripture.passageId,
      metanarrativeMovement,
      draft: localDraft,
      knowledgeContext
    });
  }

  const ministryId = await requireStudentMinistryScope(session);
  const groupId = await getPrimaryStudentGroupId(session);
  const knowledgeContext = await getStudentKnowledgeMatches(session, {
    question,
    scriptureReference: scripture.reference
  });
  const retrievedContext = formatStudentKnowledgeContextForGloo(knowledgeContext);
  const draft = readiness.gloo
    ? await generateGlooDiscussionDraft({
        question,
        scriptureReference: scripture.reference,
        metanarrativeMovement,
        retrievedContext
      })
    : {
        ok: false as const,
        code: "not_configured" as const,
        message: "AI draft connection is offline. Local guided drafts remain available for leader review."
      };
  const localDraft = buildLocalDiscussionDraft({
    question,
    scriptureReference: scripture.reference,
    metanarrativeMovement,
    knowledgeContext
  });

  const row = {
    ...ministryScopeColumns(ministryId),
    group_id: groupId ?? null,
    submitted_by_user_id: session.user.id,
    submitted_by_name: session.user.fullName,
    submitted_by_email: session.user.email,
    question,
    scripture_reference: scripture.reference || null,
    scripture_passage_id: scripture.passageId ?? null,
    metanarrative_movement: metanarrativeMovement,
    ai_provider: "gloo",
    ai_status: draft.ok ? "generated" : draft.code === "not_configured" ? "not_configured" : "failed",
    ai_model: draft.ok ? draft.model : null,
    ai_model_tier: draft.ok ? draft.modelTier : null,
    ai_model_reason: draft.ok ? draft.modelReason : fallbackReason(draft.message),
    ai_confidence: draft.ok ? draft.confidence : null,
    topic_tags: draft.ok ? draft.topicTags : localDraft.topicTags,
    escalation_reason: draft.ok ? draft.escalationReason : localDraft.escalationReason || null,
    safety_label: draft.ok ? draft.safetyLabel : localDraft.safetyLabel,
    safety_notes: draft.ok ? draft.safetyNotes : localDraft.safetyNotes,
    discussion_prompt: draft.ok ? draft.discussionPrompt : localDraft.discussionPrompt,
    leader_notes: null,
    status: "pending_review",
    delivery_status: "not_requested",
    delivery_message: ""
  };

  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase.from("student_discussion_prompts").insert(row).select("*").single<StudentDiscussionPromptRow>();
  throwIfSupabaseError(result.error);
  if (!result.data) throw new DiscussionWorkflowError("The discussion prompt was not saved.", 500, "missing_saved_prompt");

  await logPromptEventBestEffort(session, result.data.id, "submitted", { aiStatus: row.ai_status });
  return {
    ...toPrompt(result.data),
    knowledgeContext
  };
}

export async function decideStudentDiscussionPrompt(session: AuthSession, id: string, input: DecideStudentDiscussionInput) {
  assertLeader(session);
  const readiness = getStudentDiscussionReadiness(session);
  if (!readiness.liveStorage) {
    throw new DiscussionWorkflowError(readiness.message, 503, "live_storage_not_configured");
  }

  const prompt = await getPromptById(session, id);
  if (input.action === "regenerate") {
    return regenerateDiscussionDraft(session, prompt);
  }

  if (input.action === "use_local_draft") {
    return saveLocalDiscussionDraft(session, prompt);
  }

  if (input.action === "post") {
    return postApprovedPrompt(session, prompt);
  }

  if (input.action === "mark_discussed" || input.action === "flag_follow_up") {
    return saveLeaderDiscussionEvent(session, prompt, input);
  }

  const leaderNotes = normalizeOptionalText(input.leaderNotes, MAX_NOTES_LENGTH);
  const discussionPrompt = normalizeOptionalText(input.discussionPrompt, MAX_DISCUSSION_PROMPT_LENGTH);
  const now = new Date().toISOString();
  const status = toStatusForAction(input.action);
  const update: Partial<StudentDiscussionPromptRow> = {
    status,
    leader_notes: leaderNotes || prompt.leaderNotes || null,
    discussion_prompt: discussionPrompt || prompt.discussionPrompt || null
  };

  if (input.action === "approve") {
    if (!discussionPrompt && !prompt.discussionPrompt) {
      throw new DiscussionWorkflowError("Write a discussion prompt before approving this question.", 409, "missing_discussion_prompt");
    }
    update.approved_by_user_id = session.user.id;
    update.approved_at = now;
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase.from("student_discussion_prompts").update(update).eq("id", id).select("*").single<StudentDiscussionPromptRow>();
  throwIfSupabaseError(result.error);
  if (!result.data) throw new DiscussionWorkflowError("The discussion prompt was not updated.", 500, "missing_updated_prompt");

  await logPromptEvent(session, id, input.action, { leaderNotes });
  return toPrompt(result.data);
}

async function saveLeaderDiscussionEvent(session: AuthSession, prompt: StudentDiscussionPrompt, input: DecideStudentDiscussionInput) {
  if (input.action !== "mark_discussed" && input.action !== "flag_follow_up") {
    throw new DiscussionWorkflowError("Choose a valid discussion action.", 400, "invalid_discussion_action");
  }

  if (input.action === "mark_discussed" && prompt.status !== "approved" && prompt.status !== "posted") {
    throw new DiscussionWorkflowError("Approve the prompt before marking it discussed.", 409, "prompt_not_ready");
  }

  if (prompt.status === "archived") {
    throw new DiscussionWorkflowError("Archived prompts cannot be updated for group discussion.", 409, "prompt_archived");
  }

  const leaderNotes = normalizeOptionalText(input.leaderNotes, MAX_NOTES_LENGTH);
  const discussionPrompt = normalizeOptionalText(input.discussionPrompt, MAX_DISCUSSION_PROMPT_LENGTH);
  const update: Partial<StudentDiscussionPromptRow> = {
    leader_notes: leaderNotes || prompt.leaderNotes || null,
    discussion_prompt: discussionPrompt || prompt.discussionPrompt || null
  };
  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase.from("student_discussion_prompts").update(update).eq("id", prompt.id).select("*").single<StudentDiscussionPromptRow>();
  throwIfSupabaseError(result.error);
  if (!result.data) throw new DiscussionWorkflowError("The discussion prompt was not updated.", 500, "missing_updated_prompt");

  const happenedAt = new Date().toISOString();
  const eventAction = input.action === "mark_discussed" ? "leader_discussed" : "leader_follow_up_flagged";
  await logPromptEvent(session, prompt.id, eventAction, {
    leaderNotes,
    discussionPrompt,
    happenedAt
  });

  return {
    ...toPrompt(result.data),
    ...(input.action === "mark_discussed" ? { leaderDiscussedAt: happenedAt } : { leaderFollowUpFlaggedAt: happenedAt, leaderFollowUpFlagCount: 1 })
  };
}

async function regenerateDiscussionDraft(session: AuthSession, prompt: StudentDiscussionPrompt) {
  if (!isGlooConfigured()) {
    return saveLocalDiscussionDraft(session, prompt, "AI draft connection is offline, so a knowledge-guided local draft was saved instead.");
  }

  const knowledgeContext = prompt.knowledgeContext?.length ? prompt.knowledgeContext : await getStudentKnowledgeMatches(session, prompt);
  const draft = await generateGlooDiscussionDraft({
    question: prompt.question,
    scriptureReference: prompt.scriptureReference,
    metanarrativeMovement: prompt.metanarrativeMovement ?? inferMetanarrativeMovement(prompt.question, prompt.scriptureReference),
    retrievedContext: formatStudentKnowledgeContextForGloo(knowledgeContext)
  });
  const localDraft = buildLocalDiscussionDraftForPrompt({ ...prompt, knowledgeContext });

  const update: Partial<StudentDiscussionPromptRow> = {
    ai_status: draft.ok ? "generated" : "failed",
    ai_model: draft.ok ? draft.model : prompt.aiModel || null,
    ai_model_tier: draft.ok ? draft.modelTier : prompt.aiModelTier,
    ai_model_reason: draft.ok ? draft.modelReason : fallbackReason(draft.message),
    ai_confidence: draft.ok ? draft.confidence : prompt.aiConfidence,
    topic_tags: draft.ok ? draft.topicTags : localDraft.topicTags,
    escalation_reason: draft.ok ? draft.escalationReason : localDraft.escalationReason || prompt.escalationReason,
    safety_label: draft.ok ? draft.safetyLabel : localDraft.safetyLabel,
    safety_notes: draft.ok ? draft.safetyNotes : `${draft.message} A knowledge-guided local draft is available for leader review.`,
    discussion_prompt: draft.ok ? draft.discussionPrompt : localDraft.discussionPrompt
  };

  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase.from("student_discussion_prompts").update(update).eq("id", prompt.id).select("*").single<StudentDiscussionPromptRow>();
  throwIfSupabaseError(result.error);
  if (!result.data) throw new DiscussionWorkflowError("The regenerated draft was not saved.", 500, "missing_regenerated_prompt");

  await logPromptEvent(session, prompt.id, draft.ok ? "draft_regenerated" : "draft_regeneration_failed", {
    aiStatus: update.ai_status,
    model: update.ai_model
  });

  return withKnowledgeContext(session, toPrompt(result.data));
}

async function saveLocalDiscussionDraft(session: AuthSession, prompt: StudentDiscussionPrompt, reason = "Knowledge-guided local draft saved for leader review.") {
  const knowledgeContext = prompt.knowledgeContext?.length ? prompt.knowledgeContext : await getStudentKnowledgeMatches(session, prompt);
  const localDraft = buildLocalDiscussionDraftForPrompt({ ...prompt, knowledgeContext });
  const update: Partial<StudentDiscussionPromptRow> = {
    ai_status: prompt.aiStatus === "not_configured" ? "not_configured" : prompt.aiStatus === "generated" ? "generated" : "failed",
    ai_model_reason: fallbackReason(reason),
    topic_tags: localDraft.topicTags.length ? localDraft.topicTags : prompt.topicTags,
    escalation_reason: localDraft.escalationReason || prompt.escalationReason || null,
    safety_label: localDraft.safetyLabel,
    safety_notes: localDraft.safetyNotes,
    discussion_prompt: localDraft.discussionPrompt
  };

  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase.from("student_discussion_prompts").update(update).eq("id", prompt.id).select("*").single<StudentDiscussionPromptRow>();
  throwIfSupabaseError(result.error);
  if (!result.data) throw new DiscussionWorkflowError("The local discussion draft was not saved.", 500, "missing_local_draft_prompt");

  await logPromptEvent(session, prompt.id, "local_draft_saved", { reason });
  return withKnowledgeContext(session, toPrompt(result.data));
}

async function postApprovedPrompt(session: AuthSession, prompt: StudentDiscussionPrompt) {
  if (prompt.status !== "approved") {
    throw new DiscussionWorkflowError("Only approved discussion prompts can be posted.", 409, "prompt_not_approved");
  }

  const delivery = await deliverDiscussionPromptToSlack(prompt);
  const supabase = getSupabaseAuthClient(session.accessToken);

  const update = delivery.ok
    ? {
        status: "posted" as StudentDiscussionStatus,
        delivery_channel: delivery.channel,
        delivery_status: "delivered" as StudentDiscussionDeliveryStatus,
        delivery_message: delivery.message,
        posted_at: new Date().toISOString()
      }
    : {
        delivery_channel: "Slack webhook",
        delivery_status: delivery.code === "not_configured" ? ("not_configured" as const) : ("failed" as const),
        delivery_message: delivery.message
      };

  const result = await supabase.from("student_discussion_prompts").update(update).eq("id", prompt.id).select("*").single<StudentDiscussionPromptRow>();
  throwIfSupabaseError(result.error);
  if (!result.data) throw new DiscussionWorkflowError("The discussion prompt delivery status was not updated.", 500, "missing_delivery_update");

  await logPromptEvent(session, prompt.id, delivery.ok ? "posted" : "post_failed", { deliveryStatus: update.delivery_status });

  if (!delivery.ok) {
    throw new DiscussionWorkflowError(delivery.message, delivery.code === "not_configured" ? 503 : 502, delivery.code);
  }

  return toPrompt(result.data);
}

async function getPromptById(session: AuthSession, id: string) {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase.from("student_discussion_prompts").select("*").eq("id", id).single<StudentDiscussionPromptRow>();
  throwIfSupabaseError(result.error);
  if (!result.data) throw new DiscussionWorkflowError("Discussion prompt not found.", 404, "not_found");
  return toPrompt(result.data);
}

async function logPromptEvent(session: AuthSession, promptId: string, action: string, details: Record<string, unknown>) {
  const supabase = getSupabaseAuthClient(session.accessToken);
  const ministryId = await resolveMinistryScope(session);
  const result = await supabase.from("student_discussion_prompt_events").insert({
    ...ministryScopeColumns(ministryId),
    prompt_id: promptId,
    actor_user_id: session.user.id,
    action,
    details
  });
  throwIfSupabaseError(result.error);
}

async function logPromptEventBestEffort(session: AuthSession, promptId: string, action: string, details: Record<string, unknown>) {
  try {
    await logPromptEvent(session, promptId, action, details);
  } catch (error) {
    console.warn("[scripture] prompt event logging unavailable after prompt save", {
      promptId,
      action,
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}

async function getStudentPromptEventSummaries(session: AuthSession, promptIds: string[]) {
  if (!promptIds.length) return {};

  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase
    .from("student_discussion_prompt_events")
    .select("prompt_id,action,actor_user_id,created_at")
    .in("action", ["student_reflected", "leader_discussed", "leader_follow_up_flagged"])
    .in("prompt_id", promptIds)
    .order("created_at", { ascending: false })
    .returns<StudentReflectionEventRow[]>();

  throwIfSupabaseError(result.error);

  const summaries: Record<string, StudentReflectionSummary> = {};
  const actorsSeen = new Set<string>();
  for (const row of result.data ?? []) {
    const current = summaries[row.prompt_id] ?? { studentReflectionCount: 0, leaderFollowUpFlagCount: 0 };
    const next: StudentReflectionSummary = {
      studentReflectionCount: current.studentReflectionCount,
      studentLastReflectedAt: current.studentLastReflectedAt,
      leaderDiscussedAt: current.leaderDiscussedAt,
      leaderFollowUpFlaggedAt: current.leaderFollowUpFlaggedAt,
      leaderFollowUpFlagCount: current.leaderFollowUpFlagCount ?? 0
    };

    if (row.action === "student_reflected" && row.actor_user_id) {
      const actorKey = `${row.prompt_id}:${row.actor_user_id}`;
      if (!actorsSeen.has(actorKey)) {
        actorsSeen.add(actorKey);
        next.studentReflectionCount += 1;
      }
      next.studentLastReflectedAt = next.studentLastReflectedAt ?? row.created_at;
    }

    if (row.action === "leader_discussed") {
      next.leaderDiscussedAt = next.leaderDiscussedAt ?? row.created_at;
    }

    if (row.action === "leader_follow_up_flagged") {
      next.leaderFollowUpFlaggedAt = next.leaderFollowUpFlaggedAt ?? row.created_at;
      next.leaderFollowUpFlagCount = (next.leaderFollowUpFlagCount ?? 0) + 1;
    }

    summaries[row.prompt_id] = next;
  }

  return summaries;
}

function toPrompt(row: StudentDiscussionPromptRow): StudentDiscussionPrompt {
  return {
    id: row.id,
    groupId: row.group_id ?? undefined,
    submittedByUserId: row.submitted_by_user_id,
    submittedByName: row.submitted_by_name,
    submittedByEmail: row.submitted_by_email,
    question: row.question,
    scriptureReference: row.scripture_reference ?? "",
    scripturePassageId: row.scripture_passage_id ?? undefined,
    metanarrativeMovement: row.metanarrative_movement ?? undefined,
    aiProvider: row.ai_provider,
    aiStatus: row.ai_status,
    aiModel: row.ai_model ?? "",
    aiModelTier: row.ai_model_tier ?? "default",
    aiModelReason: row.ai_model_reason ?? "",
    aiConfidence: row.ai_confidence,
    topicTags: row.topic_tags ?? [],
    escalationReason: row.escalation_reason ?? "",
    safetyLabel: row.safety_label,
    safetyNotes: row.safety_notes ?? "",
    discussionPrompt: row.discussion_prompt ?? "",
    leaderNotes: row.leader_notes ?? "",
    status: row.status,
    studentReflectionCount: 0,
    leaderFollowUpFlagCount: 0,
    deliveryChannel: row.delivery_channel ?? undefined,
    deliveryStatus: row.delivery_status,
    deliveryMessage: row.delivery_message ?? "",
    approvedByUserId: row.approved_by_user_id ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    postedAt: row.posted_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toGroupDiscussionItem(row: ApprovedStudentDiscussionRow): StudentGroupDiscussionItem {
  return {
    id: row.id,
    groupId: row.group_id ?? undefined,
    question: row.question,
    scriptureReference: row.scripture_reference ?? "",
    discussionPrompt: row.discussion_prompt ?? "",
    status: row.status,
    createdAt: row.created_at
  };
}

async function withKnowledgeContext(session: AuthSession, prompts: StudentDiscussionPrompt[]): Promise<StudentDiscussionPrompt[]>;
async function withKnowledgeContext(session: AuthSession, prompt: StudentDiscussionPrompt): Promise<StudentDiscussionPrompt>;
async function withKnowledgeContext(
  session: AuthSession,
  prompts: StudentDiscussionPrompt | StudentDiscussionPrompt[]
): Promise<StudentDiscussionPrompt | StudentDiscussionPrompt[]> {
  if (Array.isArray(prompts)) {
    return Promise.all(prompts.map((prompt) => withKnowledgeContext(session, prompt)));
  }

  const prompt = prompts;
  try {
    return {
      ...prompt,
      knowledgeContext: await getStudentKnowledgeMatches(session, prompt)
    };
  } catch (error) {
    console.warn("[scripture] leader knowledge context unavailable", {
      promptId: prompt.id,
      reason: error instanceof Error ? error.message : "unknown"
    });
    return {
      ...prompt,
      knowledgeContext: []
    };
  }
}

function normalizeScriptureReference(reference: string) {
  const trimmed = reference.trim();
  if (!trimmed) return { reference: "", passageId: undefined };

  const sanitized = sanitizeScriptureReference(trimmed);
  if (!sanitized.ok) {
    throw new DiscussionWorkflowError(sanitized.message, 400, "invalid_scripture_reference");
  }
  return { reference: sanitized.reference, passageId: sanitized.passageId };
}

function inferMetanarrativeMovement(question: string, reference: string): MetanarrativeMovement {
  const normalized = `${question} ${reference}`.toLowerCase();
  const checks: Array<[MetanarrativeMovement, RegExp]> = [
    ["Creation", /\b(genesis|garden|eden|tree|creation|created|image of god|beginning)\b/],
    ["Fall", /\b(sin|evil|curse|serpent|rebellion|broken|shame)\b/],
    ["Covenant", /\b(abraham|isaac|jacob|promise|covenant|blessing|genesis 1[2-9]|genesis 2[0-9]|genesis 3[0-9]|genesis 4[0-9]|genesis 50)\b/],
    ["Exodus / Deliverance", /\b(exodus|moses|pharaoh|egypt|passover|deliverance|slavery|wilderness|red sea)\b/],
    ["Law / Formation", /\b(leviticus|numbers|deuteronomy|law|commandments|sinai|torah)\b/],
    ["Land / Kingdom", /\b(joshua|judges|samuel|kings|chronicles|david|solomon|kingdom|temple)\b/],
    ["Wisdom", /\b(job|psalm|psalms|proverbs|ecclesiastes|song of songs|wisdom|suffering)\b/],
    ["Prophets / Exile", /\b(isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|exile|prophet)\b/],
    ["Return / Waiting", /\b(ezra|nehemiah|esther|return|waiting|rebuild)\b/],
    ["Jesus / Kingdom Fulfilled", /\b(matthew|mark|luke|john|jesus|christ|gospel|cross|resurrection|kingdom of god)\b/],
    ["Church / Spirit", /\b(acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|john|jude|church|spirit|pentecost)\b/],
    ["New Creation", /\b(revelation|new creation|new heaven|new earth|restore|restoration)\b/]
  ];

  return checks.find(([, pattern]) => pattern.test(normalized))?.[0] ?? "Jesus / Kingdom Fulfilled";
}

function normalizeRequiredText(value: string, label: string, maxLength: number) {
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized) throw new DiscussionWorkflowError(`${label} is required.`, 400, "required");
  if (normalized.length > maxLength) throw new DiscussionWorkflowError(`${label} is too long.`, 400, "too_long");
  return normalized;
}

function normalizeOptionalText(value: string | undefined, maxLength: number) {
  if (!value) return "";
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (normalized.length > maxLength) throw new DiscussionWorkflowError("Leader notes are too long.", 400, "too_long");
  return normalized;
}

function assertLeader(session: AuthSession) {
  const role = session.user.role.trim().toLowerCase();
  if (role !== "admin" && role !== "leader") {
    throw new DiscussionWorkflowError("Only leaders can review discussion prompts.", 403, "forbidden");
  }
}

function toStatusForAction(
  action: Exclude<DecideStudentDiscussionInput["action"], "post" | "regenerate" | "use_local_draft" | "mark_discussed" | "flag_follow_up">
): StudentDiscussionStatus {
  switch (action) {
    case "approve":
      return "approved";
    case "request_changes":
      return "changes_requested";
    case "archive":
      return "archived";
  }
}

function fallbackReason(reason: string) {
  return `Knowledge-guided local fallback: ${reason}`;
}

function ministryScopeColumns(ministryId: string | undefined): { ministry_id?: string } {
  return ministryId ? { ministry_id: ministryId } : {};
}

async function requireStudentMinistryScope(session: AuthSession) {
  const ministryId = await resolveMinistryScope(session);
  if (!ministryId && session.user.role.trim().toLowerCase() === "student") {
    throw new DiscussionWorkflowError(MISSING_STUDENT_PROFILE_MESSAGE, 409, "missing_student_profile");
  }
  return ministryId;
}

function throwIfSupabaseError(error: { message: string } | null) {
  if (error) {
    throw new DiscussionWorkflowError(error.message, 500, "supabase_error");
  }
}

export class DiscussionWorkflowError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}
