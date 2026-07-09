import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import { analyzeSources } from "@/lib/command-center/weekly-feed/analyze";
import type { ChangedSource } from "@/lib/command-center/weekly-feed/ingest";
import type { KnowledgeSource } from "@/lib/command-center/types";

const callSageStructured = vi.fn();
const createKnowledgeItem = vi.fn();

vi.mock("@/lib/command-center/sage", () => ({
  callSageStructured: (...args: unknown[]) => callSageStructured(...args)
}));
vi.mock("@/lib/command-center/repository", () => ({
  createKnowledgeItem: (...args: unknown[]) => createKnowledgeItem(...args)
}));

function session(): AuthSession {
  return { isMock: true, user: { id: "usr_andrew", email: "andrew.w.bostwick12@gmail.com", fullName: "Andrew Bostwick", role: "admin" } };
}

function changedSource(overrides?: Partial<KnowledgeSource>): ChangedSource {
  return {
    source: {
      id: "source_1",
      googleDriveFileId: "file_1",
      fileName: "note.md",
      filePath: "SAGE Feed Sources/Articles/note.md",
      sourceType: "article",
      title: "Test Article",
      importedAt: "2026-07-01T00:00:00.000Z",
      contentHash: "hash",
      status: "new",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      ...overrides
    },
    body: "Body content about leadership."
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analyzeSources", () => {
  it("persists a knowledge item for a successful analysis", async () => {
    callSageStructured.mockResolvedValue({
      ok: true,
      data: {
        summary: "Concise summary.",
        keyTakeaways: "Takeaway.",
        topicTags: ["leadership"],
        relevanceScore: 8,
        ministryApplication: "app",
        commandCenterApplication: "",
        theologicalOrDiscipleshipConnection: "",
        careerReadinessConnection: "",
        caveats: ""
      },
      provider: "openai",
      modelLabel: "gpt-4o-mini"
    });
    createKnowledgeItem.mockResolvedValue({ id: "item_1" });

    const result = await analyzeSources(session(), [changedSource()]);

    expect(result.items).toEqual([{ id: "item_1" }]);
    expect(result.failures).toEqual([]);
    expect(createKnowledgeItem).toHaveBeenCalledWith(
      session(),
      expect.objectContaining({ sourceId: "source_1", summary: "Concise summary.", relevanceScore: 8 })
    );
  });

  it("records a failure and continues instead of throwing when one source fails to analyze", async () => {
    callSageStructured
      .mockResolvedValueOnce({ ok: false, reason: "invalid_output", message: "bad json" })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          summary: "OK",
          keyTakeaways: "",
          topicTags: [],
          relevanceScore: 5,
          ministryApplication: "",
          commandCenterApplication: "",
          theologicalOrDiscipleshipConnection: "",
          careerReadinessConnection: "",
          caveats: ""
        },
        provider: "openai",
        modelLabel: "gpt-4o-mini"
      });
    createKnowledgeItem.mockResolvedValue({ id: "item_2" });

    const result = await analyzeSources(session(), [
      changedSource({ id: "source_1", title: "Bad One" }),
      changedSource({ id: "source_2", title: "Good One" })
    ]);

    expect(result.items).toEqual([{ id: "item_2" }]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain("Bad One");
  });

  it("returns empty results without calling SAGE when there are no changed sources", async () => {
    const result = await analyzeSources(session(), []);
    expect(result).toEqual({ items: [], failures: [] });
    expect(callSageStructured).not.toHaveBeenCalled();
  });
});
