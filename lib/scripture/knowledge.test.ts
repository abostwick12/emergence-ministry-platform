import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const { getSupabaseAdminClientMock, getSupabaseAuthClientMock, isSupabaseAdminConfiguredMock, isSupabaseConfiguredMock, resolveMinistryScopeMock } = vi.hoisted(() => ({
  getSupabaseAdminClientMock: vi.fn(),
  getSupabaseAuthClientMock: vi.fn(),
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

import {
  getSavedStudentQuestionRecommendations,
  getStudentKnowledgeMatches,
  getStudentKnowledgeMatchesBatch
} from "@/lib/scripture/knowledge";

describe("student knowledge matching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseAdminConfiguredMock.mockReturnValue(false);
    isSupabaseConfiguredMock.mockReturnValue(true);
    resolveMinistryScopeMock.mockResolvedValue("ministry_1");
  });

  it("falls back to launch-safe knowledge when no live corpus is available", async () => {
    const matches = await getStudentKnowledgeMatches(session(), {
      question: "Why did God put the tree of knowledge of good and evil in the garden?",
      scriptureReference: "Genesis 3",
      topicTags: []
    });

    expect(matches[0]).toMatchObject({
      id: "launch-garden-trust",
      label: "Because you asked about the garden",
      title: "Trust before the tree"
    });
    expect(matches[0].digQuestions).toContain("What kind of trust is being tested by the tree?");
  });

  it("routes gospel questions through the built-in gospel context map", async () => {
    const matches = await getStudentKnowledgeMatches(session(), {
      question: "What is the Gospel?",
      topicTags: []
    });

    expect(matches[0]).toMatchObject({
      id: "context-map-gospel",
      label: "Because you asked about the gospel",
      title: "Gospel context map",
      topicTags: expect.arrayContaining(["gospel", "good_news", "kingdom", "new_creation"])
    });
    expect(matches[0].scriptureReferences).toEqual(
      expect.arrayContaining(["Mark 1:14-15", "1 Corinthians 15:1-8", "Ephesians 2:1-10"])
    );
    expect(matches[0].digQuestions).toContain("What good news is being announced, and who is at the center of it?");
  });

  it("keeps the gospel context map first even when live knowledge returns another match", async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const query = knowledgeQuery([
      {
        id: "chunk_1",
        title: "Romans and grace",
        body: "Romans describes grace and faith.",
        student_summary: "Grace is received by faith.",
        topic_tags: ["grace", "faith"],
        concepts: [],
        scripture_references: ["Romans 3:21-26"]
      }
    ]);
    getSupabaseAdminClientMock.mockReturnValue(query.client);

    const matches = await getStudentKnowledgeMatches(session(), {
      question: "How would you explain the good news?",
      topicTags: []
    });

    expect(matches[0].id).toBe("context-map-gospel");
    expect(matches[1]).toMatchObject({
      sourceChunkId: "chunk_1",
      title: "Romans and grace"
    });
  });

  it("routes sensitive discipleship questions through care-shaped context maps", async () => {
    const matches = await getStudentKnowledgeMatches(session(), {
      question: "What does God think about gender and sexuality?",
      topicTags: []
    });

    expect(matches[0]).toMatchObject({
      id: "context-map-sexuality-gender",
      title: "Embodied dignity and patient care",
      topicTags: expect.arrayContaining(["sexuality", "gender", "pastoral_care"])
    });
    expect(matches[0].digQuestions).toContain(
      "Where would this question need gentleness, privacy, or direct leader care instead of public debate?"
    );
  });

  it("routes purpose questions through a calling map instead of generic identity", async () => {
    const matches = await getStudentKnowledgeMatches(session(), {
      question: "How do I know my calling and what I should do with my future?",
      topicTags: []
    });

    expect(matches[0]).toMatchObject({
      id: "context-map-calling-purpose",
      title: "Calling, wisdom, and faithful presence"
    });
    expect(matches[0].digQuestions).toContain("What faithful next step is already clear before the whole future is clear?");
  });

  it("keeps the built-in context map ahead of matching live knowledge chunks", async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const query = knowledgeQuery([
      {
        id: "chunk_1",
        title: "Romans 8 and patient hope",
        body: "Romans 8 gives language for suffering, hope, and waiting without minimizing pain.",
        student_summary: "Hold suffering and hope together without rushing the conversation.",
        topic_tags: ["suffering", "hope"],
        concepts: ["lament"],
        scripture_references: ["Romans 8:18"]
      }
    ]);
    getSupabaseAdminClientMock.mockReturnValue(query.client);

    const matches = await getStudentKnowledgeMatches(session(), {
      question: "How do I trust God when suffering feels pointless?",
      scriptureReference: "Romans 8:18",
      topicTags: []
    });

    expect(matches[0]).toMatchObject({
      id: "context-map-lament",
      title: "Lament and honest trust"
    });
    expect(matches[1]).toMatchObject({
      sourceChunkId: "chunk_1",
      title: "Romans 8 and patient hope",
      description: "Hold suffering and hope together without rushing the conversation."
    });
    expect(query.query.eq).toHaveBeenCalledWith("visibility", "student_visible");
  });

  it("loads the visible knowledge pack once for multiple prompts", async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const query = knowledgeQuery([
      {
        id: "chunk_1",
        title: "Trust and hope",
        body: "Trust can remain honest while hope grows slowly.",
        student_summary: "Explore trust without forcing a quick answer.",
        topic_tags: ["trust", "hope"],
        concepts: [],
        scripture_references: ["Psalm 13"]
      }
    ]);
    getSupabaseAdminClientMock.mockReturnValue(query.client);

    const matches = await getStudentKnowledgeMatchesBatch(session(), [
      { question: "How can I trust God?", scriptureReference: "Psalm 13" },
      { question: "Where can I find hope?", topicTags: ["hope"] }
    ]);

    expect(matches).toHaveLength(2);
    expect(query.client.from).toHaveBeenCalledTimes(1);
    expect(query.query.returns).toHaveBeenCalledTimes(1);
  });

  it("loads saved student question recommendations for recent prompts", async () => {
    const query = recommendationQuery([
      {
        prompt_id: "prompt_1",
        recommendation_kind: "dig_question",
        label: "Because you asked about trust",
        title: "What makes trust hard here?",
        description: "A question to explore.",
        href: "/student",
        rank: 0,
        source_chunk_id: "chunk_1"
      },
      {
        prompt_id: "prompt_1",
        recommendation_kind: "reading_plan",
        label: "Because you asked about trust",
        title: "Trust and prayer",
        description: "Read before group.",
        href: "/student/scripture/resources",
        rank: 10,
        source_chunk_id: null
      }
    ]);
    getSupabaseAuthClientMock.mockReturnValue(query.client);

    const recommendations = await getSavedStudentQuestionRecommendations(session(), ["prompt_1"]);

    expect(recommendations.prompt_1).toEqual([
      {
        promptId: "prompt_1",
        kind: "dig_question",
        label: "Because you asked about trust",
        title: "What makes trust hard here?",
        description: "A question to explore.",
        href: "/student",
        rank: 0,
        sourceChunkId: "chunk_1"
      },
      {
        promptId: "prompt_1",
        kind: "reading_plan",
        label: "Because you asked about trust",
        title: "Trust and prayer",
        description: "Read before group.",
        href: "/student/scripture/resources",
        rank: 10,
        sourceChunkId: undefined
      }
    ]);
    expect(query.query.eq).toHaveBeenCalledWith("student_user_id", "usr_student");
    expect(query.query.in).toHaveBeenCalledWith("prompt_id", ["prompt_1"]);
  });
});

function knowledgeQuery(rows: Array<Record<string, unknown>>) {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    returns: vi.fn(async () => ({ data: rows, error: null }))
  };
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => query)
    }))
  };
  return { client, query };
}

function recommendationQuery(rows: Array<Record<string, unknown>>) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    returns: vi.fn(async () => ({ data: rows, error: null }))
  };
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => query)
    }))
  };
  return { client, query };
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
