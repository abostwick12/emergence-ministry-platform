import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const {
  generateGlooDiscussionDraftMock,
  getSupabaseAdminClientMock,
  getSupabaseAuthClientMock,
  getPrimaryStudentGroupIdMock,
  getStudentKnowledgeMatchesMock,
  getStudentKnowledgeMatchesBatchMock,
  isGlooConfiguredMock,
  isSupabaseAdminConfiguredMock,
  isSupabaseConfiguredMock,
  formatStudentKnowledgeContextForGlooMock,
  resolveMinistryScopeMock
} = vi.hoisted(() => ({
  generateGlooDiscussionDraftMock: vi.fn(),
  getSupabaseAdminClientMock: vi.fn(),
  getSupabaseAuthClientMock: vi.fn(),
  getPrimaryStudentGroupIdMock: vi.fn(),
  getStudentKnowledgeMatchesMock: vi.fn(),
  getStudentKnowledgeMatchesBatchMock: vi.fn(),
  isGlooConfiguredMock: vi.fn(),
  isSupabaseAdminConfiguredMock: vi.fn(),
  isSupabaseConfiguredMock: vi.fn(),
  formatStudentKnowledgeContextForGlooMock: vi.fn(),
  resolveMinistryScopeMock: vi.fn()
}));

vi.mock("@/lib/auth/config", () => ({
  isSupabaseConfigured: isSupabaseConfiguredMock
}));

vi.mock("@/lib/auth/server", () => ({
  getSupabaseAdminClient: getSupabaseAdminClientMock,
  getSupabaseAuthClient: getSupabaseAuthClientMock,
  isSupabaseAdminConfigured: isSupabaseAdminConfiguredMock
}));

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: resolveMinistryScopeMock
}));

vi.mock("@/lib/scripture/gloo", () => ({
  generateGlooDiscussionDraft: generateGlooDiscussionDraftMock,
  isGlooConfigured: isGlooConfiguredMock
}));

vi.mock("@/lib/scripture/knowledge", () => ({
  formatStudentKnowledgeContextForGloo: formatStudentKnowledgeContextForGlooMock,
  getStudentKnowledgeMatches: getStudentKnowledgeMatchesMock,
  getStudentKnowledgeMatchesBatch: getStudentKnowledgeMatchesBatchMock
}));

vi.mock("@/lib/student/groups", () => ({
  getPrimaryStudentGroupId: getPrimaryStudentGroupIdMock
}));

import {
  createStudentDiscussionPrompt,
  decideStudentDiscussionPrompt,
  DiscussionWorkflowError,
  getApprovedStudentDiscussionFeed,
  getStudentDiscussionWorkflowState
} from "@/lib/scripture/discussion-workflow";
import { resetLocalStudentStateForTests } from "@/lib/scripture/student-local-state";

describe("approved student discussion feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    getStudentKnowledgeMatchesMock.mockResolvedValue([]);
    formatStudentKnowledgeContextForGlooMock.mockReturnValue("");
    resolveMinistryScopeMock.mockResolvedValue("ministry_1");
    getPrimaryStudentGroupIdMock.mockResolvedValue("group_1");
  });

  it("returns only sanitized approved group discussion fields", async () => {
    const admin = approvedFeedClient([
      {
        id: "prompt_1",
        group_id: "group_1",
        question: "How do we trust God when things are hard?",
        scripture_reference: "Psalm 13",
        discussion_prompt: "Where does this psalm give us language for honest trust?",
        status: "approved",
        created_at: "2026-07-08T00:00:00.000Z"
      }
    ]);
    const eventClient = workflowStateClient([], [
      {
        prompt_id: "prompt_1",
        action: "leader_discussed",
        actor_user_id: "usr_leader",
        created_at: "2026-07-09T00:00:00.000Z"
      },
      {
        prompt_id: "prompt_1",
        action: "leader_follow_up_flagged",
        actor_user_id: "usr_leader",
        created_at: "2026-07-09T01:00:00.000Z"
      }
    ]);
    getSupabaseAdminClientMock.mockReturnValue(admin.client);
    getSupabaseAuthClientMock.mockReturnValue(eventClient.client);

    const feed = await getApprovedStudentDiscussionFeed(session());

    expect(feed).toEqual([
      {
        id: "prompt_1",
        groupId: "group_1",
        question: "How do we trust God when things are hard?",
        scriptureReference: "Psalm 13",
        discussionPrompt: "Where does this psalm give us language for honest trust?",
        status: "approved",
        createdAt: "2026-07-08T00:00:00.000Z",
        leaderDiscussedAt: "2026-07-09T00:00:00.000Z"
      }
    ]);
    expect(admin.select).toHaveBeenCalledWith("id,group_id,question,scripture_reference,discussion_prompt,status,created_at");
    expect(eventClient.eventSelect).toHaveBeenCalledWith("prompt_id,action,actor_user_id,created_at");
    expect(admin.query.eq).toHaveBeenCalledWith("ministry_id", "ministry_1");
    expect(admin.query.in).toHaveBeenCalledWith("status", ["approved", "posted"]);
    expect(admin.query.not).toHaveBeenCalledWith("discussion_prompt", "is", null);
    expect(admin.query.or).toHaveBeenCalledWith("group_id.eq.group_1,group_id.is.null");
  });

  it("fails closed when the service role is unavailable", async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(false);

    await expect(getApprovedStudentDiscussionFeed(session())).resolves.toEqual([]);
    expect(getSupabaseAdminClientMock).not.toHaveBeenCalled();
  });
});

describe("student discussion workflow state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    isGlooConfiguredMock.mockReturnValue(false);
    getStudentKnowledgeMatchesMock.mockResolvedValue([
      {
        id: "knowledge-romans-hope",
        sourceChunkId: "chunk_1",
        label: "Because you asked about suffering",
        title: "Romans 8 and patient hope",
        description: "Hold suffering and hope together without rushing the conversation.",
        href: "/student/scripture/resources",
        digQuestions: ["Where does Romans 8 name pain without pretending it is small?"],
        topicTags: ["suffering", "hope"],
        scriptureReferences: ["Romans 8:18"]
      }
    ]);
    getStudentKnowledgeMatchesBatchMock.mockResolvedValue([[
      {
        id: "knowledge-romans-hope",
        sourceChunkId: "chunk_1",
        label: "Because you asked about suffering",
        title: "Romans 8 and patient hope",
        description: "Hold suffering and hope together without rushing the conversation.",
        href: "/student/scripture/resources",
        digQuestions: ["Where does Romans 8 name pain without pretending it is small?"],
        topicTags: ["suffering", "hope"],
        scriptureReferences: ["Romans 8:18"]
      }
    ]]);
  });

  it("attaches retrieved context to prompts for leader review", async () => {
    const client = workflowStateClient([discussionRow({ id: "prompt_context", scripture_reference: "Romans 8:18" })]);
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const state = await getStudentDiscussionWorkflowState(leaderSession());

    expect(state.prompts[0]).toMatchObject({
      id: "prompt_context",
      knowledgeContext: [
        {
          title: "Romans 8 and patient hope",
          scriptureReferences: ["Romans 8:18"]
        }
      ]
    });
    expect(getStudentKnowledgeMatchesBatchMock).toHaveBeenCalledWith(leaderSession(), [expect.objectContaining({ id: "prompt_context" })]);
  });

  it("summarizes student reflection activity without exposing private notes", async () => {
    const client = workflowStateClient(
      [discussionRow({ id: "prompt_reflected", status: "approved" })],
      [
        { prompt_id: "prompt_reflected", action: "leader_discussed", actor_user_id: "usr_leader", created_at: "2026-07-09T17:00:00.000Z" },
        { prompt_id: "prompt_reflected", action: "student_reflected", actor_user_id: "usr_student", created_at: "2026-07-09T16:00:00.000Z" },
        { prompt_id: "prompt_reflected", action: "student_reflected", actor_user_id: "usr_student", created_at: "2026-07-09T15:00:00.000Z" },
        { prompt_id: "prompt_reflected", action: "student_reflected", actor_user_id: "usr_other", created_at: "2026-07-09T14:00:00.000Z" },
        { prompt_id: "prompt_reflected", action: "leader_follow_up_flagged", actor_user_id: "usr_leader", created_at: "2026-07-09T13:00:00.000Z" }
      ]
    );
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const state = await getStudentDiscussionWorkflowState(leaderSession());

    expect(state.prompts[0]).toMatchObject({
      id: "prompt_reflected",
      studentReflectionCount: 2,
      studentLastReflectedAt: "2026-07-09T16:00:00.000Z",
      leaderDiscussedAt: "2026-07-09T17:00:00.000Z",
      leaderFollowUpFlaggedAt: "2026-07-09T13:00:00.000Z",
      leaderFollowUpFlagCount: 1
    });
    expect(client.eventSelect).toHaveBeenCalledWith("prompt_id,action,actor_user_id,created_at");
    expect(JSON.stringify(state.prompts[0])).not.toContain("private_note");
  });
});

describe("student discussion live submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    isGlooConfiguredMock.mockReturnValue(false);
    getStudentKnowledgeMatchesMock.mockResolvedValue([]);
    formatStudentKnowledgeContextForGlooMock.mockReturnValue("");
    getPrimaryStudentGroupIdMock.mockResolvedValue(undefined);
  });

  it("fails clearly when a live student session is missing its signup-created profile", async () => {
    resolveMinistryScopeMock.mockResolvedValue(undefined);

    await expect(createStudentDiscussionPrompt(session(), { question: "Why did God put the tree in the garden?" })).rejects.toMatchObject({
      code: "missing_student_profile",
      status: 409
    } satisfies Partial<DiscussionWorkflowError>);
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });
});

describe("local student discussion workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLocalStudentStateForTests();
    isSupabaseConfiguredMock.mockReturnValue(false);
    isSupabaseAdminConfiguredMock.mockReturnValue(false);
    isGlooConfiguredMock.mockReturnValue(false);
    getStudentKnowledgeMatchesMock.mockResolvedValue([]);
    formatStudentKnowledgeContextForGlooMock.mockReturnValue("");
  });

  it("lets a locally submitted student question move through leader approval and the group feed", async () => {
    const prompt = await createStudentDiscussionPrompt(session(), {
      question: "Why did God put the tree in the garden?",
      scriptureReference: "Genesis 3"
    });

    const approved = await decideStudentDiscussionPrompt(leaderSession(), prompt.id, {
      action: "approve",
      leaderNotes: "Use this Wednesday.",
      discussionPrompt: "Where does Genesis 3 show trust breaking and God still pursuing?"
    });
    const feed = await getApprovedStudentDiscussionFeed(session());

    expect(approved).toMatchObject({
      id: prompt.id,
      status: "approved",
      approvedByUserId: "usr_leader"
    });
    expect(feed).toEqual([
      expect.objectContaining({
        id: prompt.id,
        discussionPrompt: "Where does Genesis 3 show trust breaking and God still pursuing?",
        status: "approved"
      })
    ]);
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminClientMock).not.toHaveBeenCalled();
  });
});

describe("leader discussion draft regeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    isGlooConfiguredMock.mockReturnValue(true);
    getStudentKnowledgeMatchesMock.mockResolvedValue([]);
    formatStudentKnowledgeContextForGlooMock.mockReturnValue("");
    resolveMinistryScopeMock.mockResolvedValue("ministry_1");
  });

  it("regenerates and saves a fresh AI draft for leader review", async () => {
    const existingRow = discussionRow({
      id: "prompt_regen",
      question: "How do I trust God when prayer feels quiet?",
      scripture_reference: "Psalm 13",
      discussion_prompt: "Old draft"
    });
    const client = regenerationClient(existingRow);
    getSupabaseAuthClientMock.mockReturnValue(client.client);
    getStudentKnowledgeMatchesMock.mockResolvedValue([
      {
        id: "knowledge-psalm-13",
        sourceChunkId: "chunk_psalm_13",
        label: "Because you asked about prayer",
        title: "Psalm 13 and honest prayer",
        description: "Psalm 13 gives language for waiting, grief, and trust.",
        href: "/student/scripture/resources",
        digQuestions: ["Where does the psalm make room for honest speech?"],
        topicTags: ["prayer", "trust"],
        scriptureReferences: ["Psalm 13"]
      }
    ]);
    formatStudentKnowledgeContextForGlooMock.mockReturnValue("Source 1: Psalm 13 and honest prayer");
    generateGlooDiscussionDraftMock.mockResolvedValue({
      ok: true,
      provider: "gloo",
      model: "GPT-5 Mini",
      modelTier: "escalation",
      modelReason: "Sensitive or complex theological topic selected the escalation model.",
      escalationReason: "doubt_deconstruction",
      topicTags: ["trust", "prayer"],
      confidence: 0.91,
      discussionPrompt: "Where does Psalm 13 help us speak honestly with God when prayer feels quiet?",
      safetyLabel: "needs_leader_care",
      safetyNotes: "Leader should frame doubt with care."
    });

    const prompt = await decideStudentDiscussionPrompt(leaderSession(), "prompt_regen", { action: "regenerate" });

    expect(prompt).toMatchObject({
      id: "prompt_regen",
      aiStatus: "generated",
      aiModel: "GPT-5 Mini",
      aiModelTier: "escalation",
      discussionPrompt: "Where does Psalm 13 help us speak honestly with God when prayer feels quiet?",
      safetyLabel: "needs_leader_care"
    });
    expect(generateGlooDiscussionDraftMock).toHaveBeenCalledWith({
      question: "How do I trust God when prayer feels quiet?",
      scriptureReference: "Psalm 13",
      metanarrativeMovement: "Jesus / Kingdom Fulfilled",
      retrievedContext: "Source 1: Psalm 13 and honest prayer"
    });
    expect(client.updates[0]).toMatchObject({
      ai_status: "generated",
      ai_model: "GPT-5 Mini",
      discussion_prompt: "Where does Psalm 13 help us speak honestly with God when prayer feels quiet?"
    });
    expect(client.events[0]).toMatchObject({
      prompt_id: "prompt_regen",
      action: "draft_regenerated"
    });
  });

  it("saves a local guided draft when regeneration is not configured", async () => {
    isGlooConfiguredMock.mockReturnValue(false);
    const client = regenerationClient(
      discussionRow({
        ai_status: "not_configured",
        ai_model: null,
        ai_model_tier: null,
        question: "Why did God put the tree in the garden?",
        scripture_reference: "Genesis 3",
        discussion_prompt: null
      })
    );
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const prompt = await decideStudentDiscussionPrompt(leaderSession(), "prompt_1", { action: "regenerate" });

    expect(prompt).toMatchObject({
      aiStatus: "not_configured",
      discussionPrompt: "What does the garden story show us about God's gifts, human trust, and God's pursuit after failure as you read Genesis 3?",
      safetyLabel: "safe"
    });
    expect(generateGlooDiscussionDraftMock).not.toHaveBeenCalled();
    expect(client.updates[0]).toMatchObject({
      ai_status: "not_configured",
      discussion_prompt: "What does the garden story show us about God's gifts, human trust, and God's pursuit after failure as you read Genesis 3?",
      ai_model_reason: expect.stringContaining("Knowledge-guided local fallback")
    });
    expect(client.events[0]).toMatchObject({
      prompt_id: "prompt_1",
      action: "local_draft_saved"
    });
  });

  it("saves a local guided draft when the provider fails", async () => {
    const client = regenerationClient(
      discussionRow({
        id: "prompt_failed_provider",
        ai_status: "failed",
        question: "How do I trust God when suffering feels pointless?",
        scripture_reference: "Romans 8:18",
        discussion_prompt: null
      })
    );
    getSupabaseAuthClientMock.mockReturnValue(client.client);
    generateGlooDiscussionDraftMock.mockResolvedValue({
      ok: false,
      code: "provider_error",
      message: "Gloo AI Studio did not return a usable draft."
    });

    const prompt = await decideStudentDiscussionPrompt(leaderSession(), "prompt_failed_provider", { action: "regenerate" });

    expect(prompt).toMatchObject({
      aiStatus: "failed",
      discussionPrompt: "Where does Scripture give us room for honest pain while still helping us look for God's nearness and hope as you read Romans 8:18?",
      safetyLabel: "needs_leader_care",
      safetyNotes: "Gloo AI Studio did not return a usable draft. A knowledge-guided local draft is available for leader review."
    });
    expect(client.events[0]).toMatchObject({
      prompt_id: "prompt_failed_provider",
      action: "draft_regeneration_failed"
    });
  });

  it("lets leaders explicitly save a local guided draft", async () => {
    const client = regenerationClient(
      discussionRow({
        id: "prompt_local",
        question: "What should we do when faith feels confusing?",
        scripture_reference: "",
        discussion_prompt: null
      })
    );
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const prompt = await decideStudentDiscussionPrompt(leaderSession(), "prompt_local", { action: "use_local_draft" });

    expect(prompt.discussionPrompt).toContain("What question is underneath this question");
    expect(client.events[0]).toMatchObject({
      prompt_id: "prompt_local",
      action: "local_draft_saved"
    });
  });

  it("marks an approved prompt discussed without changing student-facing status", async () => {
    const client = regenerationClient(
      discussionRow({
        id: "prompt_discussed",
        status: "approved",
        discussion_prompt: "What does this passage invite us to trust?"
      })
    );
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const prompt = await decideStudentDiscussionPrompt(leaderSession(), "prompt_discussed", {
      action: "mark_discussed",
      leaderNotes: "Group discussed this Wednesday.",
      discussionPrompt: "What does this passage invite us to trust?"
    });

    expect(prompt).toMatchObject({
      id: "prompt_discussed",
      status: "approved",
      leaderNotes: "Group discussed this Wednesday.",
      leaderDiscussedAt: expect.any(String)
    });
    expect(client.updates[0]).toMatchObject({
      leader_notes: "Group discussed this Wednesday.",
      discussion_prompt: "What does this passage invite us to trust?"
    });
    expect(client.events[0]).toMatchObject({
      prompt_id: "prompt_discussed",
      action: "leader_discussed"
    });
  });

  it("flags private leader follow-up without exposing a student-visible status change", async () => {
    const client = regenerationClient(
      discussionRow({
        id: "prompt_follow_up",
        status: "approved",
        leader_notes: "Talk to Jordan after group."
      })
    );
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const prompt = await decideStudentDiscussionPrompt(leaderSession(), "prompt_follow_up", {
      action: "flag_follow_up",
      leaderNotes: "Follow up with parent context.",
      discussionPrompt: "Old draft"
    });

    expect(prompt).toMatchObject({
      id: "prompt_follow_up",
      status: "approved",
      leaderNotes: "Follow up with parent context.",
      leaderFollowUpFlaggedAt: expect.any(String),
      leaderFollowUpFlagCount: 1
    });
    expect(client.events[0]).toMatchObject({
      prompt_id: "prompt_follow_up",
      action: "leader_follow_up_flagged"
    });
  });
});

function approvedFeedClient(rows: Array<Record<string, unknown>>) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    not: vi.fn(() => query),
    or: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    returns: vi.fn(async () => ({ data: rows, error: null }))
  };
  const select = vi.fn(() => query);
  const client = {
    from: vi.fn(() => ({ select }))
  };
  return { client, select, query };
}

function workflowStateClient(rows: Array<Record<string, unknown>>, eventRows: Array<Record<string, unknown>> = []) {
  const promptQuery = {
    order: vi.fn(() => promptQuery),
    limit: vi.fn(() => promptQuery),
    returns: vi.fn(async () => ({ data: rows, error: null }))
  };
  const eventQuery = {
    eq: vi.fn(() => eventQuery),
    in: vi.fn(() => eventQuery),
    order: vi.fn(() => eventQuery),
    returns: vi.fn(async () => ({ data: eventRows, error: null }))
  };
  const select = vi.fn(() => promptQuery);
  const eventSelect = vi.fn(() => eventQuery);
  const client = {
    from: vi.fn((table: string) => ({ select: table === "student_discussion_prompt_events" ? eventSelect : select }))
  };
  return { client, select, eventSelect, promptQuery, eventQuery };
}

function session(): AuthSession {
  return {
    isMock: false,
    accessToken: "student-token",
    user: {
      id: "usr_student",
      email: "student@example.test",
      fullName: "Student User",
      role: "student"
    }
  };
}

function leaderSession(): AuthSession {
  return {
    isMock: false,
    accessToken: "leader-token",
    user: {
      id: "usr_leader",
      email: "leader@example.test",
      fullName: "Leader User",
      role: "leader"
    }
  };
}

function discussionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "prompt_1",
    ministry_id: "ministry_1",
    group_id: null,
    submitted_by_user_id: "usr_student",
    submitted_by_name: "Student User",
    submitted_by_email: "student@example.test",
    question: "How do I trust God?",
    scripture_reference: "",
    scripture_passage_id: null,
    metanarrative_movement: "Jesus / Kingdom Fulfilled",
    ai_provider: "gloo",
    ai_status: "generated",
    ai_model: "GPT-5 Nano",
    ai_model_tier: "default",
    ai_model_reason: "",
    ai_confidence: 0.72,
    topic_tags: ["trust"],
    escalation_reason: "",
    safety_label: "safe",
    safety_notes: "Leader can review before use.",
    discussion_prompt: "Old draft",
    leader_notes: "",
    status: "pending_review",
    delivery_channel: null,
    delivery_status: "not_requested",
    delivery_message: "",
    approved_by_user_id: null,
    approved_at: null,
    posted_at: null,
    created_at: "2026-07-08T00:00:00.000Z",
    updated_at: "2026-07-08T00:00:00.000Z",
    ...overrides
  };
}

function regenerationClient(existingRow: Record<string, unknown>) {
  const updates: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      if (table === "student_discussion_prompts") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: existingRow, error: null })
            })
          }),
          update: (payload: Record<string, unknown>) => {
            updates.push(payload);
            const updatedRow = {
              ...existingRow,
              ...payload,
              updated_at: "2026-07-08T00:05:00.000Z"
            };
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: updatedRow, error: null })
                })
              })
            };
          }
        };
      }

      if (table === "student_discussion_prompt_events") {
        return {
          insert: async (payload: Record<string, unknown>) => {
            events.push(payload);
            return { data: null, error: null };
          }
        };
      }

      return {};
    }
  };

  return { client, updates, events };
}
