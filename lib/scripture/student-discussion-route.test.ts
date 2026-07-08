import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

const { createStudentDiscussionPromptMock, getServerSessionMock } = vi.hoisted(() => ({
  createStudentDiscussionPromptMock: vi.fn(),
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>()
}));

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
  getServerSessionMock.mockReset();
});

describe("student discussion route", () => {
  it("accepts a student question without requiring a metanarrative movement", async () => {
    const savedPrompt = prompt();
    getServerSessionMock.mockResolvedValue(session());
    createStudentDiscussionPromptMock.mockResolvedValue(savedPrompt);

    const response = await discussionPOST(jsonRequest({ question: "Why did God put the tree in the garden?", scriptureReference: "" }));
    const payload = (await response.json()) as { ok: boolean; prompt: StudentDiscussionPrompt };

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ ok: true, prompt: savedPrompt });
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
});

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
