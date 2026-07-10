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

import {
  getStudentHowToReadProgress,
  saveStudentHowToReadProgress,
  StudentHowToReadProgressError
} from "@/lib/scripture/how-to-read-progress";

describe("student how to read progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    resolveMinistryScopeMock.mockResolvedValue("ministry_1");
  });

  it("falls back cleanly when live storage is not configured", async () => {
    isSupabaseConfiguredMock.mockReturnValue(false);

    await expect(getStudentHowToReadProgress(session())).resolves.toEqual({
      completedModuleIds: [],
      shareWithGroup: false,
      storage: "unavailable"
    });
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });

  it("loads only valid completed guide ids", async () => {
    const query = progressQuery([
      {
        module_id: "what-is-the-bible",
        completed_at: "2026-07-10T14:00:00.000Z",
        share_with_group: false,
        updated_at: "2026-07-10T14:00:00.000Z"
      },
      {
        module_id: "not-real",
        completed_at: "2026-07-10T14:00:00.000Z",
        share_with_group: true,
        updated_at: "2026-07-10T14:01:00.000Z"
      },
      {
        module_id: "big-story",
        completed_at: null,
        share_with_group: true,
        updated_at: "2026-07-10T14:02:00.000Z"
      }
    ]);
    getSupabaseAuthClientMock.mockReturnValue(query.client);

    const progress = await getStudentHowToReadProgress(session());

    expect(progress.completedModuleIds).toEqual(["what-is-the-bible"]);
    expect(progress.shareWithGroup).toBe(true);
    expect(progress.storage).toBe("server");
    expect(query.query.eq).toHaveBeenCalledWith("student_user_id", "usr_student");
  });

  it("saves a guide completion and returns refreshed progress", async () => {
    const client = saveProgressClient([
      {
        module_id: "what-is-the-bible",
        completed_at: "2026-07-10T14:00:00.000Z",
        share_with_group: false,
        updated_at: "2026-07-10T14:00:00.000Z"
      },
      {
        module_id: "big-story",
        completed_at: "2026-07-10T14:05:00.000Z",
        share_with_group: false,
        updated_at: "2026-07-10T14:05:00.000Z"
      }
    ]);
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const progress = await saveStudentHowToReadProgress(session(), {
      moduleId: "big-story",
      completed: true
    });

    expect(client.table.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        ministry_id: "ministry_1",
        student_user_id: "usr_student",
        module_id: "big-story",
        completed_at: expect.any(String)
      }),
      { onConflict: "student_user_id,module_id" }
    );
    expect(progress.completedModuleIds).toEqual(["what-is-the-bible", "big-story"]);
  });

  it("rejects unknown guide ids before saving", async () => {
    getSupabaseAuthClientMock.mockReturnValue(progressQuery([]).client);

    await expect(saveStudentHowToReadProgress(session(), { moduleId: "fake-guide", completed: true })).rejects.toMatchObject({
      code: "invalid_module",
      status: 400
    } satisfies Partial<StudentHowToReadProgressError>);
  });
});

function progressQuery(rows: Array<Record<string, unknown>>) {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    returns: vi.fn(async () => ({ data: rows, error: null }))
  };
  const table = {
    select: vi.fn(() => query)
  };
  const client = {
    from: vi.fn(() => table)
  };
  return { client, table, query };
}

function saveProgressClient(rows: Array<Record<string, unknown>>) {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    returns: vi.fn(async () => ({ data: rows, error: null }))
  };
  const saveResult = {
    single: vi.fn(async () => ({
      data: {
        module_id: "big-story",
        completed_at: "2026-07-10T14:05:00.000Z",
        share_with_group: false,
        updated_at: "2026-07-10T14:05:00.000Z"
      },
      error: null
    }))
  };
  const table = {
    select: vi.fn(() => query),
    upsert: vi.fn(() => ({
      select: vi.fn(() => saveResult)
    }))
  };
  const client = {
    from: vi.fn(() => table)
  };
  return { client, table, query, saveResult };
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
