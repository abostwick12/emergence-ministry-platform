import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const { getSupabaseAdminClientMock, isSupabaseAdminConfiguredMock, isSupabaseConfiguredMock, resolveMinistryScopeMock } = vi.hoisted(() => ({
  getSupabaseAdminClientMock: vi.fn(),
  isSupabaseAdminConfiguredMock: vi.fn(),
  isSupabaseConfiguredMock: vi.fn(),
  resolveMinistryScopeMock: vi.fn()
}));

vi.mock("@/lib/auth/config", () => ({
  isSupabaseConfigured: isSupabaseConfiguredMock
}));

vi.mock("@/lib/auth/server", () => ({
  getSupabaseAdminClient: getSupabaseAdminClientMock,
  getSupabaseAuthClient: vi.fn(),
  isSupabaseAdminConfigured: isSupabaseAdminConfiguredMock
}));

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: resolveMinistryScopeMock
}));

import { getApprovedStudentDiscussionFeed } from "@/lib/scripture/discussion-workflow";

describe("approved student discussion feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    resolveMinistryScopeMock.mockResolvedValue("ministry_1");
  });

  it("returns only sanitized approved group discussion fields", async () => {
    const admin = approvedFeedClient([
      {
        id: "prompt_1",
        question: "How do we trust God when things are hard?",
        scripture_reference: "Psalm 13",
        discussion_prompt: "Where does this psalm give us language for honest trust?",
        status: "approved",
        created_at: "2026-07-08T00:00:00.000Z"
      }
    ]);
    getSupabaseAdminClientMock.mockReturnValue(admin.client);

    const feed = await getApprovedStudentDiscussionFeed(session());

    expect(feed).toEqual([
      {
        id: "prompt_1",
        question: "How do we trust God when things are hard?",
        scriptureReference: "Psalm 13",
        discussionPrompt: "Where does this psalm give us language for honest trust?",
        status: "approved",
        createdAt: "2026-07-08T00:00:00.000Z"
      }
    ]);
    expect(admin.select).toHaveBeenCalledWith("id,question,scripture_reference,discussion_prompt,status,created_at");
    expect(admin.query.eq).toHaveBeenCalledWith("ministry_id", "ministry_1");
    expect(admin.query.in).toHaveBeenCalledWith("status", ["approved", "posted"]);
    expect(admin.query.not).toHaveBeenCalledWith("discussion_prompt", "is", null);
  });

  it("fails closed when the service role is unavailable", async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(false);

    await expect(getApprovedStudentDiscussionFeed(session())).resolves.toEqual([]);
    expect(getSupabaseAdminClientMock).not.toHaveBeenCalled();
  });
});

function approvedFeedClient(rows: Array<Record<string, unknown>>) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    not: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    returns: vi.fn(async () => ({ data: rows, error: null }))
  };
  const select = vi.fn(() => query);
  const client = {
    from: vi.fn(() => ({ select }))
  };
  return { client, select, query };
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
