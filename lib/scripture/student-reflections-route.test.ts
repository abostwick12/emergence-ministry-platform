import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import type { StudentQuestionReflection } from "@/lib/scripture/student-reflections";

const { getServerSessionMock, saveReflectionMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>(),
  saveReflectionMock: vi.fn()
}));

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    getServerSession: getServerSessionMock,
    unauthorizedResponse: () => Response.json({ error: "Authentication required" }, { status: 401 })
  };
});

vi.mock("@/lib/scripture/student-reflections", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scripture/student-reflections")>("@/lib/scripture/student-reflections");
  return {
    ...actual,
    saveStudentQuestionReflection: saveReflectionMock
  };
});

import { PATCH as reflectionsPATCH } from "@/app/api/student/scripture/reflections/route";

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
  return new Request("http://localhost/api/student/scripture/reflections", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  getServerSessionMock.mockReset();
  saveReflectionMock.mockReset();
});

describe("student reflection route", () => {
  it("saves a student's private reflection state", async () => {
    const reflection: StudentQuestionReflection = {
      promptId: "prompt_1",
      reflectedAt: "2026-07-09T16:00:00.000Z",
      privateNote: "I think the deeper question is about trust.",
      updatedAt: "2026-07-09T16:00:00.000Z"
    };
    getServerSessionMock.mockResolvedValue(session());
    saveReflectionMock.mockResolvedValue(reflection);

    const response = await reflectionsPATCH(
      jsonRequest({ promptId: "prompt_1", reflected: true, privateNote: "I think the deeper question is about trust." })
    );
    const payload = (await response.json()) as { ok: boolean; reflection: StudentQuestionReflection };

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, reflection });
    expect(saveReflectionMock).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: "usr_student" }) }), {
      promptId: "prompt_1",
      reflected: true,
      privateNote: "I think the deeper question is about trust."
    });
  });

  it("rejects malformed reflection requests", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await reflectionsPATCH(jsonRequest({ promptId: "prompt_1", reflected: "yes" }));
    const payload = (await response.json()) as { ok: boolean; code: string };

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, code: "invalid_reflection" });
    expect(saveReflectionMock).not.toHaveBeenCalled();
  });
});
