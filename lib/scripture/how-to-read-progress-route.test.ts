import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import type { StudentHowToReadProgress } from "@/lib/scripture/how-to-read-progress";

const { getProgressMock, getServerSessionMock, saveProgressMock } = vi.hoisted(() => ({
  getProgressMock: vi.fn(),
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>(),
  saveProgressMock: vi.fn()
}));

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    getServerSession: getServerSessionMock,
    unauthorizedResponse: () => Response.json({ error: "Authentication required" }, { status: 401 })
  };
});

vi.mock("@/lib/scripture/how-to-read-progress", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scripture/how-to-read-progress")>("@/lib/scripture/how-to-read-progress");
  return {
    ...actual,
    getStudentHowToReadProgress: getProgressMock,
    saveStudentHowToReadProgress: saveProgressMock
  };
});

import { GET as progressGET, PATCH as progressPATCH } from "@/app/api/student/scripture/how-to-read-progress/route";

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
  return new Request("http://localhost/api/student/scripture/how-to-read-progress", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  getProgressMock.mockReset();
  getServerSessionMock.mockReset();
  saveProgressMock.mockReset();
});

describe("student how to read progress route", () => {
  it("returns saved progress for an authenticated student", async () => {
    const progress: StudentHowToReadProgress = {
      completedModuleIds: ["what-is-the-bible"],
      shareWithGroup: false,
      storage: "server"
    };
    getServerSessionMock.mockResolvedValue(session());
    getProgressMock.mockResolvedValue(progress);

    const response = await progressGET();
    const payload = (await response.json()) as { ok: boolean; progress: StudentHowToReadProgress };

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, progress });
  });

  it("saves guide completion for an authenticated student", async () => {
    const progress: StudentHowToReadProgress = {
      completedModuleIds: ["what-is-the-bible"],
      shareWithGroup: false,
      storage: "server"
    };
    getServerSessionMock.mockResolvedValue(session());
    saveProgressMock.mockResolvedValue(progress);

    const response = await progressPATCH(jsonRequest({ moduleId: "what-is-the-bible", completed: true }));
    const payload = (await response.json()) as { ok: boolean; progress: StudentHowToReadProgress };

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, progress });
    expect(saveProgressMock).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: "usr_student" }) }), {
      moduleId: "what-is-the-bible",
      completed: true,
      shareWithGroup: undefined
    });
  });

  it("rejects malformed completion requests", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await progressPATCH(jsonRequest({ moduleId: "what-is-the-bible", completed: "yes" }));
    const payload = (await response.json()) as { ok: boolean; code: string };

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, code: "invalid_completion" });
    expect(saveProgressMock).not.toHaveBeenCalled();
  });

  it("fails closed for unauthenticated progress writes", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const response = await progressPATCH(jsonRequest({ moduleId: "what-is-the-bible", completed: true }));

    expect(response.status).toBe(401);
    expect(saveProgressMock).not.toHaveBeenCalled();
  });
});
