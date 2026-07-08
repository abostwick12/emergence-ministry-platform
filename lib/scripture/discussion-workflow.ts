import { isSupabaseConfigured } from "@/lib/auth/config";
import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAdminClient, getSupabaseAuthClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { generateGlooDiscussionDraft, isGlooConfigured } from "@/lib/scripture/gloo";
import { deliverDiscussionPromptToSlack, isSlackDiscussionDeliveryConfigured } from "@/lib/scripture/slack";
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
  action: "approve" | "request_changes" | "archive" | "post" | "regenerate";
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

const MAX_QUESTION_LENGTH = 1200;
const MAX_NOTES_LENGTH = 1200;
const MAX_DISCUSSION_PROMPT_LENGTH = 1800;

export function getStudentDiscussionReadiness(session: AuthSession): DiscussionReadiness {
  if (session.isMock || !session.accessToken || !isSupabaseConfigured()) {
    return {
      liveStorage: false,
      gloo: isGlooConfigured(),
      slack: isSlackDiscussionDeliveryConfigured(),
      message: "Real student discussion storage requires Supabase Auth and database configuration."
    };
  }

  const gloo = isGlooConfigured();
  const slack = isSlackDiscussionDeliveryConfigured();
  return {
    liveStorage: true,
    gloo,
    slack,
    message: gloo
      ? "Live storage is ready. Gloo drafts are generated for submitted questions."
      : "Live storage is ready. Gloo is not configured, so submitted questions will wait for leader handling."
  };
}

export async function getStudentDiscussionWorkflowState(session: AuthSession): Promise<DiscussionWorkflowState> {
  const readiness = getStudentDiscussionReadiness(session);
  if (!readiness.liveStorage) {
    return { readiness, prompts: [] };
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase
    .from("student_discussion_prompts")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<StudentDiscussionPromptRow[]>();

  throwIfSupabaseError(result.error);
  return {
    readiness,
    prompts: (result.data ?? []).map(toPrompt)
  };
}

export async function getApprovedStudentDiscussionFeed(session: AuthSession): Promise<StudentGroupDiscussionItem[]> {
  const readiness = getStudentDiscussionReadiness(session);
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
  const readiness = getStudentDiscussionReadiness(session);
  if (!readiness.liveStorage) {
    throw new DiscussionWorkflowError(readiness.message, 503, "live_storage_not_configured");
  }

  const question = normalizeRequiredText(input.question, "Question", MAX_QUESTION_LENGTH);
  const scripture = normalizeScriptureReference(input.scriptureReference ?? "");
  const metanarrativeMovement = input.metanarrativeMovement ?? inferMetanarrativeMovement(question, scripture.reference);
  const ministryId = await resolveMinistryScope(session);
  const groupId = await getPrimaryStudentGroupId(session);
  const draft = readiness.gloo
    ? await generateGlooDiscussionDraft({
        question,
        scriptureReference: scripture.reference,
        metanarrativeMovement
      })
    : {
        ok: false as const,
        code: "not_configured" as const,
        message: "Gloo AI Studio is not configured yet."
      };

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
    ai_model_reason: draft.ok ? draft.modelReason : null,
    ai_confidence: draft.ok ? draft.confidence : null,
    topic_tags: draft.ok ? draft.topicTags : [],
    escalation_reason: draft.ok ? draft.escalationReason : null,
    safety_label: draft.ok ? draft.safetyLabel : "unreviewed",
    safety_notes: draft.ok ? draft.safetyNotes : draft.message,
    discussion_prompt: draft.ok ? draft.discussionPrompt : null,
    leader_notes: null,
    status: "pending_review",
    delivery_status: "not_requested",
    delivery_message: ""
  };

  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase.from("student_discussion_prompts").insert(row).select("*").single<StudentDiscussionPromptRow>();
  throwIfSupabaseError(result.error);
  if (!result.data) throw new DiscussionWorkflowError("The discussion prompt was not saved.", 500, "missing_saved_prompt");

  await logPromptEvent(session, result.data.id, "submitted", { aiStatus: row.ai_status });
  return toPrompt(result.data);
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

  if (input.action === "post") {
    return postApprovedPrompt(session, prompt);
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

async function regenerateDiscussionDraft(session: AuthSession, prompt: StudentDiscussionPrompt) {
  if (!isGlooConfigured()) {
    throw new DiscussionWorkflowError("Gloo AI Studio is not configured yet.", 503, "gloo_not_configured");
  }

  const draft = await generateGlooDiscussionDraft({
    question: prompt.question,
    scriptureReference: prompt.scriptureReference,
    metanarrativeMovement: prompt.metanarrativeMovement ?? inferMetanarrativeMovement(prompt.question, prompt.scriptureReference)
  });

  const update: Partial<StudentDiscussionPromptRow> = {
    ai_status: draft.ok ? "generated" : "failed",
    ai_model: draft.ok ? draft.model : prompt.aiModel || null,
    ai_model_tier: draft.ok ? draft.modelTier : prompt.aiModelTier,
    ai_model_reason: draft.ok ? draft.modelReason : prompt.aiModelReason,
    ai_confidence: draft.ok ? draft.confidence : prompt.aiConfidence,
    topic_tags: draft.ok ? draft.topicTags : prompt.topicTags,
    escalation_reason: draft.ok ? draft.escalationReason : prompt.escalationReason,
    safety_label: draft.ok ? draft.safetyLabel : prompt.safetyLabel,
    safety_notes: draft.ok ? draft.safetyNotes : draft.message,
    discussion_prompt: draft.ok ? draft.discussionPrompt : prompt.discussionPrompt || null
  };

  const supabase = getSupabaseAuthClient(session.accessToken);
  const result = await supabase.from("student_discussion_prompts").update(update).eq("id", prompt.id).select("*").single<StudentDiscussionPromptRow>();
  throwIfSupabaseError(result.error);
  if (!result.data) throw new DiscussionWorkflowError("The regenerated draft was not saved.", 500, "missing_regenerated_prompt");

  await logPromptEvent(session, prompt.id, draft.ok ? "draft_regenerated" : "draft_regeneration_failed", {
    aiStatus: update.ai_status,
    model: update.ai_model
  });

  if (!draft.ok) {
    throw new DiscussionWorkflowError(draft.message, draft.code === "not_configured" ? 503 : 502, draft.code);
  }

  return toPrompt(result.data);
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

function toStatusForAction(action: Exclude<DecideStudentDiscussionInput["action"], "post" | "regenerate">): StudentDiscussionStatus {
  switch (action) {
    case "approve":
      return "approved";
    case "request_changes":
      return "changes_requested";
    case "archive":
      return "archived";
  }
}

function ministryScopeColumns(ministryId: string | undefined): { ministry_id?: string } {
  return ministryId ? { ministry_id: ministryId } : {};
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
