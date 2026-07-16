import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const { getStudentKnowledgeMatchesMock } = vi.hoisted(() => ({
  getStudentKnowledgeMatchesMock: vi.fn()
}));

vi.mock("@/lib/scripture/knowledge", () => ({
  getStudentKnowledgeMatches: getStudentKnowledgeMatchesMock
}));

import { KnowledgeTestBenchError, runKnowledgeTestBench } from "@/lib/scripture/knowledge-test-bench";

describe("Meridian test bench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStudentKnowledgeMatchesMock.mockResolvedValue([
      {
        id: "chunk-romans-hope",
        sourceChunkId: "chunk_1",
        label: "Because you asked about suffering",
        title: "Romans 8 and patient hope",
        description: "Hold suffering and hope together without rushing the conversation.",
        href: "/student/scripture/resources",
        topicTags: ["suffering", "hope"],
        scriptureReferences: ["Romans 8:18"],
        digQuestions: [
          "Where does the passage make room for honest grief?",
          "What does it reveal about God's nearness when life hurts?",
          "What response would be faithful without forcing a quick answer?"
        ]
      }
    ]);
  });

  it("previews source matches and next steps for leaders without saving a question", async () => {
    const result = await runKnowledgeTestBench(session("leader"), {
      question: "How do I trust God when suffering feels pointless?",
      scriptureReference: "Romans 8:18"
    });

    expect(getStudentKnowledgeMatchesMock).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ role: "leader" }) }),
      expect.objectContaining({
        id: "knowledge-test-bench",
        question: "How do I trust God when suffering feels pointless?",
        scriptureReference: "Romans 8:18"
      })
    );
    expect(result.matches[0].title).toBe("Romans 8 and patient hope");
    expect(result.nextStep.readingPlan.title).toBe("Romans 8 and patient hope");
    expect(result.visibilityNote).toContain("Nothing is saved");
  });

  it("blocks student accounts from the leader preview", async () => {
    await expect(
      runKnowledgeTestBench(session("student"), {
        question: "Can I test this?"
      })
    ).rejects.toMatchObject({
      code: "forbidden",
      status: 403
    } satisfies Partial<KnowledgeTestBenchError>);
  });

  it("requires a real question", async () => {
    await expect(
      runKnowledgeTestBench(session("leader"), {
        question: "   "
      })
    ).rejects.toMatchObject({
      code: "required",
      status: 400
    } satisfies Partial<KnowledgeTestBenchError>);
  });
});

function session(role: string): AuthSession {
  return {
    isMock: false,
    accessToken: "token",
    user: {
      id: `usr_${role}`,
      email: `${role}@example.test`,
      fullName: `${role} User`,
      role
    }
  };
}
