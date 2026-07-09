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

import { getSavedStudentQuestionRecommendations, getStudentKnowledgeMatches } from "@/lib/scripture/knowledge";

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

  it("prefers student-visible live knowledge chunks when Supabase has curated matches", async () => {
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
      sourceChunkId: "chunk_1",
      title: "Romans 8 and patient hope",
      description: "Hold suffering and hope together without rushing the conversation."
    });
    expect(query.query.eq).toHaveBeenCalledWith("visibility", "student_visible");
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
