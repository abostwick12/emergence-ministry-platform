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
  createKnowledgeSource,
  getKnowledgeControlRoomState,
  updateKnowledgeSourceDetails,
  updateKnowledgeSourceVisibility
} from "@/lib/scripture/knowledge-control-room";

describe("knowledge source control room", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
    resolveMinistryScopeMock.mockResolvedValue("00000000-0000-4000-8000-0000000000e1");
  });

  it("fails closed when live Supabase storage is not ready", async () => {
    isSupabaseConfiguredMock.mockReturnValue(false);

    await expect(getKnowledgeControlRoomState(leaderSession())).resolves.toMatchObject({
      readiness: {
        liveStorage: false
      },
      sources: []
    });
    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
  });

  it("creates a private-review source with extracted chunks", async () => {
    const client = createSourceClient();
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const source = await createKnowledgeSource(leaderSession(), {
      title: "Romans 8 and patient hope",
      sourceKind: "own_voice",
      hemisphere: "own_voice",
      summary: "Hold suffering and hope together without rushing the conversation.",
      tags: "suffering, hope",
      scriptureReferences: "Romans 8:18",
      content:
        "Romans 8 gives students language for groaning, hope, and patient endurance.\n\n" +
        "The conversation should not minimize pain or turn hope into a slogan."
    });

    expect(source).toMatchObject({
      id: "source_1",
      title: "Romans 8 and patient hope",
      visibility: "private_review",
      chunkCount: 1,
      chunks: [
        {
          visibility: "private_review",
          scriptureReferences: ["Romans 8:18"],
          topicTags: ["suffering", "hope"]
        }
      ]
    });
    expect(client.sourceInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: "private_review",
        tags: ["suffering", "hope"],
        created_by_user_id: "usr_leader"
      })
    );
    expect(client.chunkInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        source_id: "source_1",
        visibility: "private_review",
        topic_tags: ["suffering", "hope"],
        scripture_references: ["Romans 8:18"]
      })
    ]);
  });

  it("promotes a source and its chunks together", async () => {
    const client = updateVisibilityClient();
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const source = await updateKnowledgeSourceVisibility(leaderSession(), "source_1", "student_visible");

    expect(source).toMatchObject({
      id: "source_1",
      visibility: "student_visible",
      chunks: [
        {
          visibility: "student_visible"
        }
      ]
    });
    expect(client.sourceUpdate).toHaveBeenCalledWith({ visibility: "student_visible" });
    expect(client.chunkUpdate).toHaveBeenCalledWith({ visibility: "student_visible" });
  });

  it("lets admins mark a source as internal grounding", async () => {
    const client = updateVisibilityClient("internal_grounding");
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const source = await updateKnowledgeSourceVisibility(adminSession(), "source_1", "internal_grounding");

    expect(source).toMatchObject({
      id: "source_1",
      visibility: "internal_grounding",
      chunks: [
        {
          visibility: "internal_grounding"
        }
      ]
    });
    expect(client.sourceUpdate).toHaveBeenCalledWith({ visibility: "internal_grounding" });
    expect(client.chunkUpdate).toHaveBeenCalledWith({ visibility: "internal_grounding" });
  });

  it("does not let non-admin leaders mark a source as internal grounding", async () => {
    const client = updateVisibilityClient("internal_grounding");
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    await expect(updateKnowledgeSourceVisibility(leaderSession(), "source_1", "internal_grounding")).rejects.toMatchObject({
      status: 403,
      code: "forbidden"
    });
    expect(client.sourceUpdate).not.toHaveBeenCalled();
    expect(client.chunkUpdate).not.toHaveBeenCalled();
  });

  it("curates source details and keeps chunk retrieval metadata in sync", async () => {
    const client = updateDetailsClient();
    getSupabaseAuthClientMock.mockReturnValue(client.client);

    const source = await updateKnowledgeSourceDetails(leaderSession(), "source_1", {
      title: "Romans 8 and durable hope",
      summary: "A careful way to hold grief and hope together.",
      tags: "lament, hope",
      scriptureReferences: "Psalm 13, Romans 8:18",
      citation: "Camp lesson notes",
      sourceUri: "https://example.test/romans-8"
    });

    expect(source).toMatchObject({
      title: "Romans 8 and durable hope",
      summary: "A careful way to hold grief and hope together.",
      tags: ["lament", "hope"],
      citation: "Camp lesson notes",
      sourceUri: "https://example.test/romans-8",
      chunks: [
        {
          title: "Romans 8 and durable hope",
          studentSummary: "A careful way to hold grief and hope together.",
          topicTags: ["lament", "hope"],
          concepts: ["lament", "hope"],
          scriptureReferences: ["Psalm 13", "Romans 8:18"]
        }
      ]
    });
    expect(client.sourceUpdate).toHaveBeenCalledWith({
      title: "Romans 8 and durable hope",
      summary: "A careful way to hold grief and hope together.",
      tags: ["lament", "hope"],
      source_uri: "https://example.test/romans-8",
      citation: "Camp lesson notes"
    });
    expect(client.chunkUpdate).toHaveBeenCalledWith({
      title: "Romans 8 and durable hope",
      student_summary: "A careful way to hold grief and hope together.",
      topic_tags: ["lament", "hope"],
      concepts: ["lament", "hope"],
      scripture_references: ["Psalm 13", "Romans 8:18"]
    });
  });
});

function createSourceClient() {
  const sourceInsert = vi.fn(() => ({
    select: () => ({
      single: async () => ({
        data: sourceRow({ visibility: "private_review" }),
        error: null
      })
    })
  }));
  const chunkInsert = vi.fn((rows: Array<Record<string, unknown>>) => ({
    select: () => ({
      returns: async () => ({
        data: rows.map((row, index) =>
          chunkRow({
            id: `chunk_${index + 1}`,
            source_id: String(row.source_id),
            title: String(row.title),
            body: String(row.body),
            student_summary: String(row.student_summary),
            topic_tags: row.topic_tags as string[],
            concepts: row.concepts as string[],
            scripture_references: row.scripture_references as string[],
            visibility: row.visibility as string,
            chunk_index: index
          })
        ),
        error: null
      })
    })
  }));

  const client = {
    from(table: string) {
      if (table === "knowledge_sources") return { insert: sourceInsert };
      if (table === "knowledge_chunks") return { insert: chunkInsert };
      return {};
    }
  };

  return { client, sourceInsert, chunkInsert };
}

function updateVisibilityClient(visibility = "student_visible") {
  const sourceUpdate = vi.fn(() => ({
    eq: () => ({
      select: () => ({
        single: async () => ({
          data: sourceRow({ visibility }),
          error: null
        })
      })
    })
  }));
  const chunkUpdate = vi.fn(() => ({
    eq: () => ({
      select: () => ({
        returns: async () => ({
          data: [chunkRow({ visibility })],
          error: null
        })
      })
    })
  }));

  const client = {
    from(table: string) {
      if (table === "knowledge_sources") return { update: sourceUpdate };
      if (table === "knowledge_chunks") return { update: chunkUpdate };
      return {};
    }
  };

  return { client, sourceUpdate, chunkUpdate };
}

function updateDetailsClient() {
  const updatedSource = sourceRow({
    title: "Romans 8 and durable hope",
    summary: "A careful way to hold grief and hope together.",
    tags: ["lament", "hope"],
    citation: "Camp lesson notes",
    source_uri: "https://example.test/romans-8"
  });
  const updatedChunk = chunkRow({
    title: "Romans 8 and durable hope",
    student_summary: "A careful way to hold grief and hope together.",
    topic_tags: ["lament", "hope"],
    concepts: ["lament", "hope"],
    scripture_references: ["Psalm 13", "Romans 8:18"]
  });
  const sourceUpdate = vi.fn(() => ({
    eq: () => ({
      select: () => ({
        single: async () => ({
          data: updatedSource,
          error: null
        })
      })
    })
  }));
  const chunkUpdate = vi.fn(() => ({
    eq: () => ({
      select: () => ({
        returns: async () => ({
          data: [updatedChunk],
          error: null
        })
      })
    })
  }));

  const client = {
    from(table: string) {
      if (table === "knowledge_sources") return { update: sourceUpdate };
      if (table === "knowledge_chunks") return { update: chunkUpdate };
      return {};
    }
  };

  return { client, sourceUpdate, chunkUpdate };
}

function leaderSession(): AuthSession {
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

function adminSession(): AuthSession {
  return {
    isMock: false,
    accessToken: "admin-token",
    user: {
      id: "usr_admin",
      email: "admin@example.test",
      fullName: "Admin User",
      role: "admin"
    }
  };
}

function sourceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "source_1",
    title: "Romans 8 and patient hope",
    source_kind: "own_voice",
    hemisphere: "own_voice",
    visibility: "private_review",
    source_uri: null,
    citation: null,
    summary: "Hold suffering and hope together without rushing the conversation.",
    tags: ["suffering", "hope"],
    created_at: "2026-07-08T00:00:00.000Z",
    updated_at: "2026-07-08T00:00:00.000Z",
    ...overrides
  };
}

function chunkRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "chunk_1",
    source_id: "source_1",
    chunk_index: 0,
    title: "Romans 8 and patient hope",
    body: "Romans 8 gives students language for groaning, hope, and patient endurance.",
    student_summary: "Romans 8 gives students language for groaning, hope, and patient endurance.",
    topic_tags: ["suffering", "hope"],
    concepts: ["suffering", "hope"],
    scripture_references: ["Romans 8:18"],
    visibility: "private_review",
    created_at: "2026-07-08T00:00:00.000Z",
    updated_at: "2026-07-08T00:00:00.000Z",
    ...overrides
  };
}
