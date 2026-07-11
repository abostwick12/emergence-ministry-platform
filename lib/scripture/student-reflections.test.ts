import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const { getSupabaseAuthClientMock, isSupabaseConfiguredMock, resolveMinistryScopeMock } = vi.hoisted(() => ({
  getSupabaseAuthClientMock: vi.fn(),
  isSupabaseConfiguredMock: vi.fn(),
  resolveMinistryScopeMock: vi.fn()
}));

vi.mock("@/lib/auth/config", () => ({
  isSupabaseConfigured: isSupabaseConfiguredMock
}));

vi.mock("@/lib/auth/server", () => ({
  getSupabaseAuthClient: getSupabaseAuthClientMock
}));

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: resolveMinistryScopeMock
}));

import { saveStudentQuestionReflection, StudentQuestionReflectionError } from "@/lib/scripture/student-reflections";

describe("student question reflections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    resolveMinistryScopeMock.mockResolvedValue("ministry_1");
  });

  it("fails clearly when a live student session is missing its signup-created profile", async () => {
    resolveMinistryScopeMock.mockResolvedValue(undefined);

    await expect(
      saveStudentQuestionReflection(session(), {
        promptId: "prompt_1",
        reflected: true,
        privateNote: "I think this is about trust."
      })
    ).rejects.toMatchObject({
      code: "missing_student_profile",
      status: 409
    } satisfies Partial<StudentQuestionReflectionError>);
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });
});

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
