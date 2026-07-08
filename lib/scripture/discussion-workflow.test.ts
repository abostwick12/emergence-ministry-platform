import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const {
  generateGlooDiscussionDraftMock,
  getSupabaseAdminClientMock,
  getSupabaseAuthClientMock,
  getPrimaryStudentGroupIdMock,
  isGlooConfiguredMock,
  isSupabaseAdminConfiguredMock,
  isSupabaseConfiguredMock,
  resolveMinistryScopeMock
} = vi.hoisted(() => ({
  generateGlooDiscussionDraftMock: vi.fn(),
  getSupabaseAdminClientMock: vi.fn(),
  getSupabaseAuthClientMock: vi.fn(),
  getPrimaryStudentGroupIdMock: vi.fn(),
  isGlooConfiguredMock: vi.fn(),
  isSupabaseAdminConfiguredMock: vi.fn(),
  isSupabaseConfiguredMock: vi.fn(),
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

vi.mock("@/lib/student/groups", () => ({
  getPrimaryStudentGroupId: getPrimaryStudentGroupIdMock
}));

import { decideStudentDiscussionPrompt, getApprovedStudentDiscussionFeed } from "@/lib/scripture/discussion-workflow";

describe("approved student discussion feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
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
    getSupabaseAdminClientMock.mockReturnValue(admin.client);

    const feed = await getApprovedStudentDiscussionFeed(session());

    expect(feed).toEqual([
      {
        id: "prompt_1",
        groupId: "group_1",
        question: "How do we trust God when things are hard?",
        scriptureReference: "Psalm 13",
        discussionPrompt: "Where does this psalm give us language for honest trust?",
        status: "approved",
        createdAt: "2026-07-08T00:00:00.000Z"
      }
    ]);
    expect(admin.select).toHaveBeenCalledWith("id,group_id,question,scripture_reference,discussion_prompt,status,created_at");
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

describe("leader discussion draft regeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    isGlooConfiguredMock.mockReturnValue(true);
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
      metanarrativeMovement: "Jesus / Kingdom Fulfilled"
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

  it("does not call Gloo when draft regeneration is not configured", async () => {
    isGlooConfiguredMock.mockReturnValue(false);
    getSupabaseAuthClientMock.mockReturnValue(regenerationClient(discussionRow()).client);

    await expect(decideStudentDiscussionPrompt(leaderSession(), "prompt_1", { action: "regenerate" })).rejects.toMatchObject({
      code: "gloo_not_configured",
      status: 503
    });
    expect(generateGlooDiscussionDraftMock).not.toHaveBeenCalled();
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
