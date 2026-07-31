import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

const { createStudentDiscussionPromptMock, generateMeridianDiscussionDraftMock, getServerSessionMock, getStudentKnowledgeMatchesMock, saveStudentQuestionRecommendationsMock } = vi.hoisted(() => ({
  createStudentDiscussionPromptMock: vi.fn(),
  generateMeridianDiscussionDraftMock: vi.fn(),
  getStudentKnowledgeMatchesMock: vi.fn(),
  saveStudentQuestionRecommendationsMock: vi.fn(),
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>()
}));

const originalGuestEnv = {
  GUEST_AI_GENERATION_ENABLED: process.env.GUEST_AI_GENERATION_ENABLED,
  GUEST_SANDBOX_WRITES_ENABLED: process.env.GUEST_SANDBOX_WRITES_ENABLED
};

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    getServerSession: getServerSessionMock,
    unauthorizedResponse: () => Response.json({ error: "Authentication required" }, { status: 401 })
  };
});

vi.mock("@/lib/scripture/discussion-workflow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scripture/discussion-workflow")>("@/lib/scripture/discussion-workflow");
  return {
    ...actual,
    createStudentDiscussionPrompt: createStudentDiscussionPromptMock
  };
});

vi.mock("@/lib/scripture/knowledge", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scripture/knowledge")>("@/lib/scripture/knowledge");
  return {
    ...actual,
    getStudentKnowledgeMatches: getStudentKnowledgeMatchesMock,
    saveStudentQuestionRecommendations: saveStudentQuestionRecommendationsMock
  };
});

vi.mock("@/lib/scripture/meridian-ai", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scripture/meridian-ai")>("@/lib/scripture/meridian-ai");
  return {
    ...actual,
    generateMeridianDiscussionDraft: generateMeridianDiscussionDraftMock
  };
});

import { POST as discussionPOST } from "@/app/api/student/scripture/discussion/route";

function session(role = "student"): AuthSession {
  return {
    isMock: false,
    accessToken: "token",
    user: {
      id: "usr_student",
      email: "student@example.test",
      fullName: "Student User",
      role
    }
  };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/student/scripture/discussion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  createStudentDiscussionPromptMock.mockReset();
  generateMeridianDiscussionDraftMock.mockReset();
  getStudentKnowledgeMatchesMock.mockReset();
  getServerSessionMock.mockReset();
  saveStudentQuestionRecommendationsMock.mockReset();
  getStudentKnowledgeMatchesMock.mockResolvedValue([]);
  saveStudentQuestionRecommendationsMock.mockResolvedValue(undefined);
  process.env.GUEST_AI_GENERATION_ENABLED = "false";
  process.env.GUEST_SANDBOX_WRITES_ENABLED = "false";
});

afterEach(() => {
  process.env.GUEST_AI_GENERATION_ENABLED = originalGuestEnv.GUEST_AI_GENERATION_ENABLED;
  process.env.GUEST_SANDBOX_WRITES_ENABLED = originalGuestEnv.GUEST_SANDBOX_WRITES_ENABLED;
});

describe("student discussion route", () => {
  it("accepts a student question without requiring a metanarrative movement", async () => {
    const savedPrompt = prompt();
    getServerSessionMock.mockResolvedValue(session());
    createStudentDiscussionPromptMock.mockResolvedValue(savedPrompt);

    const response = await discussionPOST(jsonRequest({ question: "Why did God put the tree in the garden?", scriptureReference: "" }));
    const payload = (await response.json()) as { ok: boolean; prompt: StudentDiscussionPrompt; nextStep: { title: string } };

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      ok: true,
      prompt: savedPrompt,
      nextStep: {
        title: "Wrestle with your question",
        wrestleTogetherPrompt: "Bring this to group: What does the garden story show about God's gifts, human trust, and God's pursuit after failure?"
      }
    });
    expect(createStudentDiscussionPromptMock).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ id: "usr_student" }) }),
      {
        question: "Why did God put the tree in the garden?",
        scriptureReference: ""
      }
    );
  });

  it("keeps Scripture reference optional", async () => {
    getServerSessionMock.mockResolvedValue(session());
    createStudentDiscussionPromptMock.mockResolvedValue(prompt());

    const response = await discussionPOST(jsonRequest({ question: "How do I trust God when prayer feels quiet?" }));

    expect(response.status).toBe(201);
    expect(createStudentDiscussionPromptMock).toHaveBeenCalledWith(expect.anything(), {
      question: "How do I trust God when prayer feels quiet?",
      scriptureReference: undefined
    });
  });

  it("still returns next steps when knowledge matching is unavailable after the prompt is saved", async () => {
    getServerSessionMock.mockResolvedValue(session());
    createStudentDiscussionPromptMock.mockResolvedValue(prompt());
    getStudentKnowledgeMatchesMock.mockRejectedValue(new Error("knowledge table unavailable"));

    const response = await discussionPOST(jsonRequest({ question: "Why did God put the tree in the garden?" }));
    const payload = (await response.json()) as { ok: boolean; nextStep: { title: string; wrestleTogetherPrompt: string } };

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      ok: true,
      nextStep: {
        title: "Wrestle with your question",
        wrestleTogetherPrompt: "Bring this to group: What does the garden story show about God's gifts, human trust, and God's pursuit after failure?"
      }
    });
  });

  it("does not fail the student submission when recommendation persistence is unavailable", async () => {
    getServerSessionMock.mockResolvedValue(session());
    createStudentDiscussionPromptMock.mockResolvedValue(prompt());
    saveStudentQuestionRecommendationsMock.mockRejectedValue(new Error("recommendation table unavailable"));

    const response = await discussionPOST(jsonRequest({ question: "Why did God put the tree in the garden?" }));
    const payload = (await response.json()) as { ok: boolean; prompt: StudentDiscussionPrompt };

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.prompt.id).toBe("prompt_1");
  });

  it("returns an unsaved live guest preview when guest AI is enabled without sandbox writes", async () => {
    process.env.GUEST_AI_GENERATION_ENABLED = "true";
    getServerSessionMock.mockResolvedValue(guestSession());
    generateMeridianDiscussionDraftMock.mockResolvedValue({
      ok: true,
      provider: "gloo",
      model: "gloo-openai-gpt-5-nano",
      modelTier: "default",
      modelReason: "Default Gloo model.",
      escalationReason: "",
      topicTags: ["welcome"],
      confidence: 0.91,
      discussionPrompt: "What does Luke 15 reveal about God's welcome?",
      safetyLabel: "safe",
      safetyNotes: "Leader review required.",
      provenance: {}
    });

    const response = await discussionPOST(jsonRequest({ question: "What does welcome look like?", scriptureReference: "Luke 15" }));
    const payload = (await response.json()) as { persistence: string; prompt: StudentDiscussionPrompt };

    expect(response.status).toBe(201);
    expect(payload.persistence).toBe("none");
    expect(payload.prompt).toMatchObject({ aiProvider: "gloo", aiStatus: "generated", aiModel: "gloo-openai-gpt-5-nano" });
    expect(createStudentDiscussionPromptMock).not.toHaveBeenCalled();
  });

  it("uses isolated local persistence when guest sandbox writes are enabled", async () => {
    process.env.GUEST_SANDBOX_WRITES_ENABLED = "true";
    getServerSessionMock.mockResolvedValue(guestSession());
    createStudentDiscussionPromptMock.mockResolvedValue(prompt());

    const response = await discussionPOST(jsonRequest({ question: "What should we notice?", scriptureReference: "John 15" }));
    const payload = (await response.json()) as { persistence: string };

    expect(response.status).toBe(201);
    expect(payload.persistence).toBe("guest_session");
    expect(createStudentDiscussionPromptMock).toHaveBeenCalled();
  });
});

function guestSession(): AuthSession {
  return {
    isGuest: true,
    isMock: false,
    guestSessionId: "guest-route-test",
    user: {
      id: "guest_guest-route-test",
      email: "guest@lead-emergence.local",
      fullName: "Guest",
      role: "guest"
    }
  };
}

function prompt(): StudentDiscussionPrompt {
  return {
    id: "prompt_1",
    submittedByUserId: "usr_student",
    submittedByName: "Student User",
    submittedByEmail: "student@example.test",
    question: "Why did God put the tree in the garden?",
    scriptureReference: "",
    aiProvider: "gloo",
    aiStatus: "not_configured",
    aiModel: "",
    aiModelTier: "default",
    aiModelReason: "",
    aiConfidence: null,
    topicTags: [],
    escalationReason: "",
    safetyLabel: "unreviewed",
    safetyNotes: "",
    discussionPrompt: "",
    leaderNotes: "",
    status: "pending_review",
    deliveryStatus: "not_requested",
    deliveryMessage: "",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z"
  };
}
