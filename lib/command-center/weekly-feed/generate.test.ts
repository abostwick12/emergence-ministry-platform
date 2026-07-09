import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import { generateWeeklyFeed } from "@/lib/command-center/weekly-feed/generate";
import { FeedSourceDriveUnavailableError, FeedSourceFolderNotFoundError } from "@/lib/command-center/weekly-feed/ingest";

const ingestFeedSources = vi.fn();
const analyzeSources = vi.fn();
const callSageStructured = vi.fn();
const createFeedRunLog = vi.fn();
const completeFeedRunLog = vi.fn();
const createWeeklyFeed = vi.fn();
const replaceWeeklyFeedItems = vi.fn();
const getLatestWeeklyFeedWithItems = vi.fn();

vi.mock("@/lib/command-center/weekly-feed/ingest", async () => {
  const actual = await vi.importActual<typeof import("@/lib/command-center/weekly-feed/ingest")>("@/lib/command-center/weekly-feed/ingest");
  return {
    ...actual,
    ingestFeedSources: (...args: unknown[]) => ingestFeedSources(...args)
  };
});
vi.mock("@/lib/command-center/weekly-feed/analyze", () => ({
  analyzeSources: (...args: unknown[]) => analyzeSources(...args)
}));
vi.mock("@/lib/command-center/sage", () => ({
  callSageStructured: (...args: unknown[]) => callSageStructured(...args)
}));
vi.mock("@/lib/command-center/repository", () => ({
  createFeedRunLog: (...args: unknown[]) => createFeedRunLog(...args),
  completeFeedRunLog: (...args: unknown[]) => completeFeedRunLog(...args),
  createWeeklyFeed: (...args: unknown[]) => createWeeklyFeed(...args),
  replaceWeeklyFeedItems: (...args: unknown[]) => replaceWeeklyFeedItems(...args),
  getLatestWeeklyFeedWithItems: (...args: unknown[]) => getLatestWeeklyFeedWithItems(...args)
}));

function session(): AuthSession {
  return { isMock: true, user: { id: "usr_andrew", email: "andrew.w.bostwick12@gmail.com", fullName: "Andrew Bostwick", role: "admin" } };
}

beforeEach(() => {
  vi.clearAllMocks();
  createFeedRunLog.mockResolvedValue({ id: "run_1" });
  createWeeklyFeed.mockImplementation(async (_session: AuthSession, input: Record<string, unknown>) => ({ id: "feed_1", ...input }));
  replaceWeeklyFeedItems.mockResolvedValue(undefined);
  completeFeedRunLog.mockResolvedValue(undefined);
});

describe("generateWeeklyFeed", () => {
  it("propagates FeedSourceDriveUnavailableError and logs the run as failed", async () => {
    ingestFeedSources.mockRejectedValue(new FeedSourceDriveUnavailableError());
    await expect(generateWeeklyFeed(session())).rejects.toThrow(FeedSourceDriveUnavailableError);
    expect(completeFeedRunLog).toHaveBeenCalledWith(
      session(),
      "run_1",
      expect.objectContaining({ status: "failed" })
    );
  });

  it("propagates FeedSourceFolderNotFoundError and logs the run as failed", async () => {
    ingestFeedSources.mockRejectedValue(new FeedSourceFolderNotFoundError());
    await expect(generateWeeklyFeed(session())).rejects.toThrow(FeedSourceFolderNotFoundError);
    expect(completeFeedRunLog).toHaveBeenCalledWith(
      session(),
      "run_1",
      expect.objectContaining({ status: "failed" })
    );
  });

  it("generates a short 'no new sources' feed and still logs a successful run when nothing changed", async () => {
    ingestFeedSources.mockResolvedValue({ filesScanned: 3, filesImported: 0, filesSkipped: 0, errors: [], changedSources: [] });
    analyzeSources.mockResolvedValue({ items: [], failures: [] });

    const result = await generateWeeklyFeed(session());

    expect(result.feed.executiveSummary).toBe("No new feed sources were found this week.");
    expect(result.items).toEqual([]);
    expect(callSageStructured).not.toHaveBeenCalled();
    expect(completeFeedRunLog).toHaveBeenCalledWith(session(), "run_1", expect.objectContaining({ status: "succeeded" }));
  });

  it("assembles a full weekly feed on the happy path", async () => {
    const knowledgeItem = { id: "item_1", sourceId: "source_1", summary: "s", topicTags: ["tag"], createdAt: "", updatedAt: "" };
    ingestFeedSources.mockResolvedValue({
      filesScanned: 1,
      filesImported: 1,
      filesSkipped: 0,
      errors: [],
      changedSources: [{ source: { id: "source_1" }, body: "body" }]
    });
    analyzeSources.mockResolvedValue({ items: [knowledgeItem], failures: [] });
    callSageStructured.mockResolvedValue({
      ok: true,
      data: {
        title: "Week of 2026-07-06",
        executiveSummary: "Big week.",
        topTopics: ["ai"],
        appPlatformImplications: "",
        ministryImplications: "",
        suggestedActionItems: "",
        items: [{ index: 0, section: "top5", rank: 1, reasonIncluded: "high relevance", recommendedAction: "", confidenceNote: "" }]
      },
      provider: "openai",
      modelLabel: "gpt-4o-mini"
    });
    getLatestWeeklyFeedWithItems.mockResolvedValue({
      feed: { id: "feed_1", title: "Week of 2026-07-06" },
      items: [{ id: "fi_1", knowledgeItem, source: { id: "source_1" } }]
    });

    const result = await generateWeeklyFeed(session());

    expect(replaceWeeklyFeedItems).toHaveBeenCalledWith(
      session(),
      "feed_1",
      expect.arrayContaining([expect.objectContaining({ knowledgeItemId: "item_1", section: "top5", rank: 1 })])
    );
    expect(result.feed.title).toBe("Week of 2026-07-06");
    expect(result.items).toHaveLength(1);
    expect(completeFeedRunLog).toHaveBeenCalledWith(session(), "run_1", expect.objectContaining({ status: "succeeded" }));
  });

  it("logs a failed run and a warning feed when SAGE cannot assemble the weekly feed", async () => {
    const knowledgeItem = { id: "item_1", sourceId: "source_1", summary: "s", topicTags: [], createdAt: "", updatedAt: "" };
    ingestFeedSources.mockResolvedValue({ filesScanned: 1, filesImported: 1, filesSkipped: 0, errors: [], changedSources: [] });
    analyzeSources.mockResolvedValue({ items: [knowledgeItem], failures: [] });
    callSageStructured.mockResolvedValue({ ok: false, reason: "invalid_output", message: "bad json" });

    const result = await generateWeeklyFeed(session());

    expect(result.feed.executiveSummary).toContain("could not assemble");
    expect(completeFeedRunLog).toHaveBeenCalledWith(session(), "run_1", expect.objectContaining({ status: "failed" }));
  });

  it("carries per-file ingestion warnings through to the completed run log", async () => {
    ingestFeedSources.mockResolvedValue({
      filesScanned: 2,
      filesImported: 0,
      filesSkipped: 1,
      errors: ['Skipped "bad.md": unsupported file type.'],
      changedSources: []
    });
    analyzeSources.mockResolvedValue({ items: [], failures: [] });

    const result = await generateWeeklyFeed(session());

    expect(result.warnings).toContain('Skipped "bad.md": unsupported file type.');
    expect(completeFeedRunLog).toHaveBeenCalledWith(
      session(),
      "run_1",
      expect.objectContaining({ errorDetails: expect.arrayContaining(['Skipped "bad.md": unsupported file type.']) })
    );
  });
});
