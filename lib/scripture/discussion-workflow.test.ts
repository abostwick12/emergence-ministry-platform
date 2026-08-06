import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const {
  generateMeridianDiscussionDraftMock,
  getMeridianAiReadinessMock,
  getSupabaseAdminClientMock,
  getSupabaseAuthClientMock,
  getPrimaryStudentGroupIdMock,
  getInternalGroundingContextMock,
  getStudentKnowledgeMatchesMock,
  getStudentKnowledgeMatchesBatchMock,
  isSupabaseAdminConfiguredMock,
  isSupabaseConfiguredMock,
  formatStudentKnowledgeContextForGlooMock,
  lookupYouVersionPassageMock,
  resolveMinistryScopeMock
} = vi.hoisted(() => ({
  generateMeridianDiscussionDraftMock: vi.fn(),
  getMeridianAiReadinessMock: vi.fn(),
  getSupabaseAdminClientMock: vi.fn(),
  getSupabaseAuthClientMock: vi.fn(),
  getPrimaryStudentGroupIdMock: vi.fn(),
  getInternalGroundingContextMock: vi.fn(),
  getStudentKnowledgeMatchesMock: vi.fn(),
  getStudentKnowledgeMatchesBatchMock: vi.fn(),
  isSupabaseAdminConfiguredMock: vi.fn(),
  isSupabaseConfiguredMock: vi.fn(),
  formatStudentKnowledgeContextForGlooMock: vi.fn(),
  lookupYouVersionPassageMock: vi.fn().mockResolvedValue({
    ok: true,
    passageId: "1SA.8",
    passage: {
      id: "1SA.8",
      content: "The elders asked Samuel for a king to judge them like the nations. Samuel warned them what a king would take.",
      reference: "1 Samuel 8",
      provenance: { provider: "YouVersion", passageId: "1SA.8", bibleId: 3034, translationName: "BSB", retrievedAt: "2026-08-06T00:00:00.000Z" }
    }
  }),
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

vi.mock("@/lib/scripture/meridian-ai", () => ({
  generateMeridianDiscussionDraft: generateMeridianDiscussionDraftMock,
  getMeridianAiReadiness: getMeridianAiReadinessMock
}));

vi.mock("@/lib/scripture/knowledge", () => ({
  formatStudentKnowledgeContextForGloo: formatStudentKnowledgeContextForGlooMock,
  getInternalGroundingContext: getInternalGroundingContextMock,
  getStudentKnowledgeMatches: getStudentKnowledgeMatchesMock,
  getStudentKnowledgeMatchesBatch: getStudentKnowledgeMatchesBatchMock
}));

vi.mock("@/lib/student/groups", () => ({
  getPrimaryStudentGroupId: getPrimaryStudentGroupIdMock
}));

vi.mock("@/lib/scripture/youversion", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scripture/youversion")>("@/lib/scripture/youversion");
  return { ...actual, lookupYouVersionPassage: lookupYouVersionPassageMock };
});

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
    getMeridianAiReadinessMock.mockReturnValue(aiReadiness({ gloo: true }));
    getStudentKnowledgeMatchesMock.mockResolvedValue([]);
    getInternalGroundingContextMock.mockResolvedValue("");
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
    getMeridianAiReadinessMock.mockReturnValue(aiReadiness({ gloo: true }));
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
    getMeridianAiReadinessMock.mockReturnValue(aiReadiness({ gloo: true }));
    getStudentKnowledgeMatchesMock.mockResolvedValue([]);
    getInternalGroundingContextMock.mockResolvedValue("");
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

  it("accepts live student questions with a knowledge-guided draft when AI is offline", async () => {
    getMeridianAiReadinessMock.mockReturnValue(aiReadiness());
    resolveMinistryScopeMock.mockResolvedValue("ministry_1");
    getPrimaryStudentGroupIdMock.mockResolvedValue("group_1");
    getStudentKnowledgeMatchesMock.mockResolvedValue([
      {
        id: "context-map-gospel",
        label: "Because you asked about the gospel",
        title: "Gospel context map",
        description: "Steer gospel questions through Scripture's announcement about Jesus.",
        href: "/student/scripture/resources",
        digQuestions: ["What good news is being announced, and who is at the center of it?"],
        topicTags: ["gospel", "good_news"],
        scriptureReferences: ["Mark 1:15"]
      }
    ]);
    const client = liveSubmissionClient();
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const prompt = await createStudentDiscussionPrompt(session(), {
      question: "What is the Gospel?",
      scriptureReference: "Mark 1:15"
    });

    expect(prompt).toMatchObject({
      groupId: "group_1",
      aiStatus: "not_configured",
      aiProvider: "gloo",
      aiModel: "",
      aiConfidence: null,
      status: "pending_review",
      discussionPrompt: "What good news is being announced, and who is at the center of it?",
      safetyLabel: "safe",
      topicTags: ["gospel", "good_news"]
    });
    expect(generateMeridianDiscussionDraftMock).not.toHaveBeenCalled();
    expect(getInternalGroundingContextMock).not.toHaveBeenCalled();
    expect(client.insertedPrompt).toMatchObject({
      ministry_id: "ministry_1",
      group_id: "group_1",
      ai_status: "not_configured",
      ai_model: null,
      ai_confidence: null,
      status: "pending_review",
      discussion_prompt: "What good news is being announced, and who is at the center of it?"
    });
    expect(client.insertedEvent).toMatchObject({
      action: "submitted",
      details: { aiStatus: "not_configured" }
    });
  });
});

describe("local student discussion workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLocalStudentStateForTests();
    isSupabaseConfiguredMock.mockReturnValue(false);
    isSupabaseAdminConfiguredMock.mockReturnValue(false);
    getMeridianAiReadinessMock.mockReturnValue(aiReadiness());
    getStudentKnowledgeMatchesMock.mockResolvedValue([]);
    getInternalGroundingContextMock.mockResolvedValue("");
    formatStudentKnowledgeContextForGlooMock.mockReturnValue("");
  });

  it("routes the Saul question to a source-supported 1 Samuel journey and keeps it hidden until approval", async () => {
    const prompt = await createStudentDiscussionPrompt(session(), {
      question: "Why do the people choose Saul to be their first king?"
    });

    expect(prompt.journeySelection).toMatchObject({
      status: "matched",
      primaryReference: "1 Samuel 8",
      supportingReferences: ["1 Samuel 9-10", "1 Samuel 11-12"]
    });
    expect(prompt.journeySelection?.supportingReferences).not.toEqual(expect.arrayContaining(["Genesis 12:1-3", "Genesis 15", "Exodus 19"]));
    expect(prompt.journeyContent).toMatchObject({
      label: "AI-assisted commentary",
      sourceStatus: "supported",
      see: { biblicalStandardReference: "Galatians 5:22-23" }
    });
    expect((await getStudentDiscussionWorkflowState(session())).prompts[0].journeyContent).toBeUndefined();
    expect((await getStudentDiscussionWorkflowState(leaderSession())).prompts[0].journeyContent).toBeDefined();

    const approved = await decideStudentDiscussionPrompt(leaderSession(), prompt.id, {
      action: "approve",
      leaderNotes: "Use this Wednesday.",
      discussionPrompt: "Why did Israel ask for a king, and what warning did Samuel give them?"
    });
    const feed = await getApprovedStudentDiscussionFeed(session());
    const studentVisible = await getStudentDiscussionWorkflowState(session());

    expect(approved).toMatchObject({
      id: prompt.id,
      status: "approved",
      approvedByUserId: "usr_leader"
    });
    expect(feed).toEqual([
      expect.objectContaining({
        id: prompt.id,
        discussionPrompt: "Why did Israel ask for a king, and what warning did Samuel give them?",
        status: "approved"
      })
    ]);
    expect(studentVisible.prompts[0].journeyContent).toBeDefined();
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("uses Gloo for local/dev Meridian submissions when configured", async () => {
    getMeridianAiReadinessMock.mockReturnValue(aiReadiness({ gloo: true }));
    getStudentKnowledgeMatchesMock.mockResolvedValue([
      {
        id: "knowledge-garden",
        sourceChunkId: "chunk_garden",
        label: "Because you asked about the garden",
        title: "Garden trust",
        description: "Read Genesis 2-3 with gifts before failure.",
        href: "/student/scripture/resources",
        digQuestions: ["What gifts come before the warning?"],
        topicTags: ["creation", "trust"],
        scriptureReferences: ["Genesis 3"]
      }
    ]);
    formatStudentKnowledgeContextForGlooMock.mockReturnValue("Source 1: Garden trust");
    getInternalGroundingContextMock.mockResolvedValue("Internal posture only.");
    generateMeridianDiscussionDraftMock.mockResolvedValue({
      ok: true,
      provider: "gloo",
      model: "GPT-5 Nano",
      modelTier: "default",
      modelReason: "Default first-pass model for student question classification and draft generation.",
      escalationReason: "",
      topicTags: ["creation", "trust"],
      confidence: 0.9,
      discussionPrompt: "Where does Genesis 3 invite us to notice trust before failure?",
      safetyLabel: "safe",
      safetyNotes: "Leader can review before use."
    });

    const prompt = await createStudentDiscussionPrompt(session(), {
      question: "Why did God put the tree in the garden?",
      scriptureReference: "Genesis 3"
    });

    expect(prompt).toMatchObject({
      aiStatus: "generated",
      aiModel: "GPT-5 Nano",
      discussionPrompt: "Where does Genesis 3 invite us to notice trust before failure?",
      safetyLabel: "safe"
    });
    expect(generateMeridianDiscussionDraftMock).toHaveBeenCalledWith(expect.objectContaining({
      question: "Why did God put the tree in the garden?",
      scriptureReference: "Genesis 3",
      metanarrativeMovement: "Creation",
      retrievedContext: "Source 1: Garden trust",
      internalGroundingContext: "Internal posture only.",
      synthesisBrief: expect.objectContaining({
        taskType: "discussion_prompt",
        normalizedRequest: "Why did God put the tree in the garden?",
        sourceIds: expect.arrayContaining(["chunk:chunk_garden"]),
        sourceTypes: expect.arrayContaining(["meridian_knowledge"])
      })
    }));
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });

  it("flags an ambiguous question for leader assignment instead of guessing a journey", async () => {
    const prompt = await createStudentDiscussionPrompt(session(), { question: "Why did they do that?" });

    expect(prompt.journeySelection).toMatchObject({
      status: "leader_assignment_required",
      primaryReference: "",
      confidence: 0
    });
    expect(prompt.journeyContent).toBeUndefined();
    await expect(decideStudentDiscussionPrompt(leaderSession(), prompt.id, { action: "approve" })).rejects.toMatchObject({
      code: "local_decision_error",
      status: 409
    } satisfies Partial<DiscussionWorkflowError>);
  });

});

describe("leader discussion draft regeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    getMeridianAiReadinessMock.mockReturnValue(aiReadiness({ gloo: true }));
    getStudentKnowledgeMatchesMock.mockResolvedValue([]);
    getInternalGroundingContextMock.mockResolvedValue("");
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
    getInternalGroundingContextMock.mockResolvedValue("Approved Meridian evidence for Psalm 13.");
    generateMeridianDiscussionDraftMock.mockResolvedValue({
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
    expect(generateMeridianDiscussionDraftMock).toHaveBeenCalledWith(expect.objectContaining({
      question: "How do I trust God when prayer feels quiet?",
      scriptureReference: "Psalm 13",
      metanarrativeMovement: "Jesus / Kingdom Fulfilled",
      retrievedContext: "Source 1: Psalm 13 and honest prayer",
      internalGroundingContext: "Approved Meridian evidence for Psalm 13.",
      synthesisBrief: expect.objectContaining({
        taskType: "discussion_prompt",
        normalizedRequest: "How do I trust God when prayer feels quiet?",
        sourceIds: expect.arrayContaining(["chunk:chunk_psalm_13"]),
        sourceTypes: expect.arrayContaining(["meridian_knowledge"])
      })
    }));
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

  it("blocks leader provider regeneration when governed evidence coverage is incomplete", async () => {
    const existingRow = discussionRow({
      id: "prompt_blocked_regen",
      question: "How are we saved by grace, and how should we understand faith and works?",
      scripture_reference: "Ephesians 2:8-10",
      discussion_prompt: "Old draft"
    });
    const client = regenerationClient(existingRow);
    getSupabaseAuthClientMock.mockReturnValue(client.client);
    getInternalGroundingContextMock.mockResolvedValue("");

    await decideStudentDiscussionPrompt(leaderSession(), "prompt_blocked_regen", { action: "regenerate" });

    expect(generateMeridianDiscussionDraftMock).not.toHaveBeenCalled();
    expect(client.updates[0]).toMatchObject({
      ai_model_reason: expect.stringContaining("provider regeneration was blocked")
    });
    expect(client.events[0]).toMatchObject({
      prompt_id: "prompt_blocked_regen",
      action: "local_draft_saved"
    });
  });

  it("saves a local guided draft when regeneration is not configured", async () => {
    getMeridianAiReadinessMock.mockReturnValue(aiReadiness());
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
    expect(generateMeridianDiscussionDraftMock).not.toHaveBeenCalled();
    expect(client.updates[0]).toMatchObject({
      ai_status: "not_configured",
      discussion_prompt: "What does the garden story show us about God's gifts, human trust, and God's pursuit after failure as you read Genesis 3?",
      ai_model_reason: expect.stringContaining("Knowledge-guided fallback")
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
    getInternalGroundingContextMock.mockResolvedValue("Approved Meridian evidence for suffering and hope.");
    generateMeridianDiscussionDraftMock.mockResolvedValue({
      ok: false,
      code: "provider_error",
      message: "Gloo AI Studio did not return a usable draft."
    });

    const prompt = await decideStudentDiscussionPrompt(leaderSession(), "prompt_failed_provider", { action: "regenerate" });

    expect(prompt).toMatchObject({
      aiStatus: "failed",
      discussionPrompt: "Where does Scripture give us room for honest pain while still helping us look for God's nearness and hope as you read Romans 8:18?",
      safetyLabel: "needs_leader_care",
      safetyNotes: "Gloo AI Studio did not return a usable draft. A knowledge-guided fallback draft is available for leader review."
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

describe("canonical student resource promotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    getMeridianAiReadinessMock.mockReturnValue(aiReadiness({ gloo: true }));
    getStudentKnowledgeMatchesMock.mockResolvedValue([]);
    getInternalGroundingContextMock.mockResolvedValue("");
    formatStudentKnowledgeContextForGlooMock.mockReturnValue("");
    resolveMinistryScopeMock.mockResolvedValue("ministry_1");
  });

  it("promotes an approved prompt into student-visible Meridian knowledge", async () => {
    const client = promotionClient(
      discussionRow({
        id: "prompt_canonical",
        status: "approved",
        question: "What is the Gospel?",
        scripture_reference: "Mark 1:15",
        discussion_prompt: "What good news is being announced, and who is at the center of it?",
        topic_tags: ["gospel", "good_news"]
      })
    );
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const prompt = await decideStudentDiscussionPrompt(leaderSession(), "prompt_canonical", { action: "promote_canonical" });

    expect(prompt).toMatchObject({
      id: "prompt_canonical",
      status: "approved"
    });
    expect(client.insertedSource).toMatchObject({
      ministry_id: "ministry_1",
      title: "Student Question: What is the Gospel?",
      source_kind: "curated_note",
      hemisphere: "own_voice",
      visibility: "student_visible",
      source_uri: "student-discussion:prompt_canonical",
      tags: ["gospel", "good_news", "student_question", "leader_approved"],
      created_by_user_id: "usr_leader"
    });
    expect(client.insertedChunk).toMatchObject({
      ministry_id: "ministry_1",
      source_id: "source_1",
      chunk_index: 0,
      visibility: "student_visible",
      student_summary: "What good news is being announced, and who is at the center of it?",
      topic_tags: ["gospel", "good_news", "student_question", "leader_approved"],
      scripture_references: ["Mark 1:15"]
    });
    expect(String(client.insertedChunk.body)).toContain("Original student question: What is the Gospel?");
    expect(String(client.insertedChunk.body)).toContain("Leader-approved framing: What good news is being announced");
    expect(client.events[0]).toMatchObject({
      prompt_id: "prompt_canonical",
      action: "canonical_resource_promoted",
      details: {
        sourceId: "source_1",
        chunkId: "chunk_1"
      }
    });
  });

  it("logs promotion without duplicating a canonical source when one already exists", async () => {
    const client = promotionClient(
      discussionRow({
        id: "prompt_existing_source",
        status: "posted",
        discussion_prompt: "Where does Scripture invite us to trust Jesus?"
      }),
      { existingSourceId: "source_existing" }
    );
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    await decideStudentDiscussionPrompt(leaderSession(), "prompt_existing_source", { action: "promote_canonical" });

    expect(client.insertedSource).toEqual({});
    expect(client.insertedChunk).toEqual({});
    expect(client.events[0]).toMatchObject({
      prompt_id: "prompt_existing_source",
      action: "canonical_resource_promoted",
      details: {
        sourceId: "source_existing",
        existing: true
      }
    });
  });

  it("requires approval before canonical promotion", async () => {
    const client = promotionClient(discussionRow({ id: "prompt_pending", status: "pending_review" }));
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    await expect(decideStudentDiscussionPrompt(leaderSession(), "prompt_pending", { action: "promote_canonical" })).rejects.toMatchObject({
      code: "prompt_not_approved",
      status: 409
    } satisfies Partial<DiscussionWorkflowError>);
    expect(client.insertedSource).toEqual({});
    expect(client.insertedChunk).toEqual({});
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

function liveSubmissionClient() {
  let insertedPrompt: Record<string, unknown> = {};
  let insertedEvent: Record<string, unknown> = {};
  const client = {
    from(table: string) {
      if (table === "student_discussion_prompts") {
        return {
          insert: (payload: Record<string, unknown>) => {
            insertedPrompt = payload;
            return {
              select: () => ({
                single: async () => ({
                  data: discussionRow({
                    id: "prompt_live_offline",
                    ...payload,
                    created_at: "2026-07-08T00:00:00.000Z",
                    updated_at: "2026-07-08T00:00:00.000Z"
                  }),
                  error: null
                })
              })
            };
          }
        };
      }

      if (table === "student_discussion_prompt_events") {
        return {
          insert: async (payload: Record<string, unknown>) => {
            insertedEvent = payload;
            return { data: null, error: null };
          }
        };
      }

      return {};
    }
  };

  return {
    client,
    get insertedPrompt() {
      return insertedPrompt;
    },
    get insertedEvent() {
      return insertedEvent;
    }
  };
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

function promotionClient(existingRow: Record<string, unknown>, options: { existingSourceId?: string } = {}) {
  const events: Array<Record<string, unknown>> = [];
  let insertedSource: Record<string, unknown> = {};
  let insertedChunk: Record<string, unknown> = {};
  const client = {
    from(table: string) {
      if (table === "student_discussion_prompts") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: existingRow, error: null })
            })
          })
        };
      }

      if (table === "knowledge_sources") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: options.existingSourceId ? { id: options.existingSourceId } : null,
                    error: null
                  })
                })
              })
            })
          }),
          insert: (payload: Record<string, unknown>) => {
            insertedSource = payload;
            return {
              select: () => ({
                single: async () => ({ data: { id: "source_1" }, error: null })
              })
            };
          }
        };
      }

      if (table === "knowledge_chunks") {
        return {
          insert: (payload: Record<string, unknown>) => {
            insertedChunk = payload;
            return {
              select: () => ({
                single: async () => ({ data: { id: "chunk_1" }, error: null })
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

  return {
    client,
    events,
    get insertedSource() {
      return insertedSource;
    },
    get insertedChunk() {
      return insertedChunk;
    }
  };
}

function aiReadiness(overrides: Partial<ReturnType<typeof baseAiReadiness>> = {}) {
  return {
    ...baseAiReadiness(),
    ...overrides,
    configured: overrides.configured ?? Boolean(overrides.gloo || overrides.gemini || overrides.openai)
  };
}

function baseAiReadiness() {
  return {
    configured: false,
    gloo: false,
    gemini: false,
    openai: false,
    fallbackProviders: [] as Array<"gemini" | "openai">,
    primaryProvider: "" as "gloo" | "gemini" | "openai" | ""
  };
}
