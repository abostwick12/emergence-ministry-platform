import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const {
  createResourceAttachmentMock,
  generateMeridianSermonPrepResourceMock,
  getStudentKnowledgeMatchesMock,
  publishWeeklyVolunteerResourceMock,
  requireEmergeOperationsWriteAccessMock
} = vi.hoisted(() => ({
  createResourceAttachmentMock: vi.fn(),
  generateMeridianSermonPrepResourceMock: vi.fn(),
  getStudentKnowledgeMatchesMock: vi.fn(),
  publishWeeklyVolunteerResourceMock: vi.fn(),
  requireEmergeOperationsWriteAccessMock: vi.fn()
}));

vi.mock("@/lib/app-area-access", () => ({
  requireEmergeOperationsWriteAccess: requireEmergeOperationsWriteAccessMock
}));

vi.mock("@/lib/resources/repository", () => ({
  createResourceAttachment: createResourceAttachmentMock,
  resourceAttachmentErrorResponse: (error: unknown) => ({
    error: error instanceof Error ? error.message : "Resource error"
  })
}));

vi.mock("@/lib/scripture/knowledge", () => ({
  getStudentKnowledgeMatches: getStudentKnowledgeMatchesMock
}));

vi.mock("@/lib/scripture/meridian-ai", () => ({
  generateMeridianSermonPrepResource: generateMeridianSermonPrepResourceMock
}));

vi.mock("@/lib/volunteer-hub/data", () => ({
  publishWeeklyVolunteerResource: publishWeeklyVolunteerResourceMock
}));

import { POST } from "@/app/api/leader-prep/generate/route";

describe("leader prep generation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEmergeOperationsWriteAccessMock.mockResolvedValue({
      allowed: true,
      session: session()
    });
    getStudentKnowledgeMatchesMock.mockResolvedValue([
      {
        id: "knowledge-john-13",
        sourceChunkId: "chunk_john_13",
        label: "Because this lesson echoes prior teaching",
        title: "Receive before you serve",
        description: "Prior teaching emphasizes service as response to grace.",
        href: "/student/scripture/resources",
        digQuestions: ["Where does Jesus serve before asking disciples to imitate him?"],
        topicTags: ["grace", "service"],
        scriptureReferences: ["John 13:1-17"]
      }
    ]);
    generateMeridianSermonPrepResourceMock.mockResolvedValue({
      ok: true,
      provider: "gemini",
      model: "gemini-test",
      kind: "leader_guide",
      title: "When the King Kneels - Leader Guide",
      summary: "Leader guide shaped by John 13.",
      contentMarkdown: "## Lesson Summary\nA leader-ready guide.",
      estimatedMinutes: 10,
      sources: ["Current sermon draft", "Meridian provider: gemini"],
      warnings: [],
      provenance: {
        meridianRan: true,
        selectedSourceIds: ["chunk:chunk_john_13"],
        selectedSourceTypes: ["meridian_knowledge"],
        fallbackUsed: false,
        fallbackReason: "",
        validationResult: "validated"
      }
    });
    createResourceAttachmentMock.mockResolvedValue({});
    publishWeeklyVolunteerResourceMock.mockResolvedValue({});
  });

  it("retrieves knowledge matches before generating leader guides", async () => {
    const response = await POST(new Request("https://platform.test/api/leader-prep/generate", {
      method: "POST",
      body: JSON.stringify({
        kind: "leader_guide",
        title: "When the King Kneels",
        passage: "John 13:1-17",
        bigIdea: "Real authority stoops.",
        body: "Jesus knows where he comes from and where he is going, so he kneels."
      })
    }));

    expect(response.status).toBe(200);
    expect(getStudentKnowledgeMatchesMock).toHaveBeenCalledWith(session(), expect.objectContaining({
      scriptureReference: "John 13:1-17",
      topicTags: expect.arrayContaining(["leader_guide", "sermon_prep", "discipleship", "formation", "leader_review"])
    }));
    expect(generateMeridianSermonPrepResourceMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: "leader_guide",
      knowledgeMatches: expect.arrayContaining([
        expect.objectContaining({
          sourceChunkId: "chunk_john_13",
          title: "Receive before you serve"
        })
      ])
    }));
  });

  it("retrieves task-aware knowledge matches before generating small group questions", async () => {
    await POST(new Request("https://platform.test/api/leader-prep/generate", {
      method: "POST",
      body: JSON.stringify({
        kind: "small_group_questions",
        title: "When the King Kneels",
        passage: "John 13:1-17",
        bigIdea: "Real authority stoops.",
        body: "Jesus washes feet and teaches kingdom love."
      })
    }));

    expect(getStudentKnowledgeMatchesMock).toHaveBeenCalledWith(session(), expect.objectContaining({
      scriptureReference: "John 13:1-17",
      question: expect.stringContaining("small group questions"),
      topicTags: expect.arrayContaining(["small_group_questions", "small_group"])
    }));
    expect(generateMeridianSermonPrepResourceMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: "small_group_questions",
      knowledgeMatches: expect.any(Array)
    }));
  });

  it("keeps generation available when knowledge retrieval fails", async () => {
    getStudentKnowledgeMatchesMock.mockRejectedValue(new Error("knowledge unavailable"));

    const response = await POST(new Request("https://platform.test/api/leader-prep/generate", {
      method: "POST",
      body: JSON.stringify({
        kind: "leader_guide",
        title: "When the King Kneels",
        passage: "John 13:1-17",
        bigIdea: "Real authority stoops.",
        body: "Jesus kneels."
      })
    }));

    expect(response.status).toBe(200);
    expect(generateMeridianSermonPrepResourceMock).toHaveBeenCalledWith(expect.objectContaining({
      knowledgeMatches: []
    }));
  });

  it("returns permission failures without retrieving knowledge", async () => {
    requireEmergeOperationsWriteAccessMock.mockResolvedValue({
      allowed: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    });

    const response = await POST(new Request("https://platform.test/api/leader-prep/generate", {
      method: "POST",
      body: JSON.stringify({ kind: "leader_guide" })
    }));

    expect(response.status).toBe(403);
    expect(getStudentKnowledgeMatchesMock).not.toHaveBeenCalled();
  });
});

function session(): AuthSession {
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
