import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LeaderDailyBrief, LeaderDailyBriefEvidence } from "@/lib/leader-daily-brief/types";

const mocks = vi.hoisted(() => ({
  loadLeaderDailyBriefEvidence: vi.fn(),
  hasPostedLeaderDailyBrief: vi.fn(),
  recordLeaderDailyBriefPosted: vi.fn(),
  sendLeaderDailyBriefToGroupMe: vi.fn(),
  buildLeaderDailyBrief: vi.fn(),
  isLeaderDailyBriefAiConfigured: vi.fn(() => true),
  isSupabaseAdminConfigured: vi.fn(() => true)
}));

vi.mock("@/lib/leader-daily-brief/repository", () => ({
  loadLeaderDailyBriefEvidence: mocks.loadLeaderDailyBriefEvidence,
  hasPostedLeaderDailyBrief: mocks.hasPostedLeaderDailyBrief,
  recordLeaderDailyBriefPosted: mocks.recordLeaderDailyBriefPosted
}));

vi.mock("@/lib/leader-daily-brief/groupme", async () => {
  const actual = await vi.importActual<typeof import("@/lib/leader-daily-brief/groupme")>("@/lib/leader-daily-brief/groupme");
  return {
    ...actual,
    sendLeaderDailyBriefToGroupMe: mocks.sendLeaderDailyBriefToGroupMe
  };
});

vi.mock("@/lib/leader-daily-brief/operations", () => ({
  buildLeaderDailyBrief: mocks.buildLeaderDailyBrief,
  isLeaderDailyBriefAiConfigured: mocks.isLeaderDailyBriefAiConfigured
}));

vi.mock("@/lib/auth/server", () => ({ isSupabaseAdminConfigured: mocks.isSupabaseAdminConfigured }));

import { POST } from "@/app/api/leader-daily-brief/groupme/route";

const secret = "leader-secret";

function evidence(): LeaderDailyBriefEvidence {
  return {
    generatedAt: "2026-07-16T23:00:00.000Z",
    contentDate: "2026-07-16",
    day: "thursday",
    ministryId: "00000000-0000-4000-8000-000000000001",
    upcomingEvents: [],
    openPreparationTasks: [],
    volunteerNeeds: [],
    leaderReminders: [],
    scheduleChanges: [],
    eventFileHints: [],
    publishedSermonResources: [],
    volunteerSignals: {
      guestsVisible: false,
      followUpVisible: false,
      quietStudentCareUseful: true,
      source: "test"
    },
    meridian: {
      profile: {
        vision: "Students follow Jesus.",
        mission: "Reduce administrative friction.",
        values: [],
        currentSeason: {
          title: "Scripture Practice",
          description: "Prepare leaders for Scripture-shaped small groups.",
          startDate: "2026-07-01",
          endDate: null,
          owner: "Ministry leadership",
          reviewDate: null,
          status: "active"
        },
        successLooksLike: [],
        owner: "Ministry leadership",
        lastUpdated: "2026-07-01",
        reviewDate: null
      },
      contextUsed: ["Vision: Students follow Jesus."],
      groupMeVoiceContext: [],
      leaderCommunicationVoiceContext: []
    }
  };
}

describe("leader daily brief route", () => {
  beforeEach(() => {
    process.env.LEADER_DAILY_BRIEF_CRON_SECRET = secret;
    process.env.LEADER_DAILY_BRIEF_ENABLED = "true";
    process.env.GROUPME_LEADER_BRIEF_BOT_ID = "bot_123";
    process.env.GROUPME_LEADER_BRIEF_GROUP_ID = "116140688";
    mocks.loadLeaderDailyBriefEvidence.mockResolvedValue(evidence());
    mocks.hasPostedLeaderDailyBrief.mockResolvedValue({ status: "clear", duplicate: false });
    mocks.recordLeaderDailyBriefPosted.mockResolvedValue({ status: "recorded" });
    mocks.sendLeaderDailyBriefToGroupMe.mockResolvedValue({ messageId: "msg_123", groupId: "116140688" });
    mocks.buildLeaderDailyBrief.mockResolvedValue({
      evidence: evidence(),
      message: "# LEADER DAILY BRIEF\nA safe test message.",
      messageHash: "hash_123",
      eventIdsConsulted: [],
      meridianContextUsed: [],
      firecrawl: { used: false },
      warnings: []
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.LEADER_DAILY_BRIEF_CRON_SECRET;
    delete process.env.LEADER_DAILY_BRIEF_ENABLED;
    delete process.env.GROUPME_LEADER_BRIEF_BOT_ID;
    delete process.env.GROUPME_LEADER_BRIEF_GROUP_ID;
  });

  it("exits without posting when the leader brief is disabled", async () => {
    process.env.LEADER_DAILY_BRIEF_ENABLED = "false";

    const response = await POST(new Request("https://leademergence.com/api/leader-daily-brief/groupme", { method: "POST", headers: { authorization: `Bearer ${secret}` } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("disabled");
    expect(mocks.loadLeaderDailyBriefEvidence).not.toHaveBeenCalled();
    expect(mocks.sendLeaderDailyBriefToGroupMe).not.toHaveBeenCalled();
  });

  it("skips duplicate Central-date posts before generating", async () => {
    mocks.hasPostedLeaderDailyBrief.mockResolvedValueOnce({ status: "duplicate_found", duplicate: true });

    const response = await POST(
      new Request("https://leademergence.com/api/leader-daily-brief/groupme", {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("duplicate_skipped");
    expect(mocks.sendLeaderDailyBriefToGroupMe).not.toHaveBeenCalled();
  });

  it("posts only through the GroupMe leader brief sender", async () => {
    const response = await POST(
      new Request("https://leademergence.com/api/leader-daily-brief/groupme", {
        method: "POST",
        headers: { "x-leader-daily-brief-secret": secret }
      })
    );
    const body = await response.json() as { status: string; posted: boolean; activityRecorded: boolean; requestId: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("sent");
    expect(body.posted).toBe(true);
    expect(body.activityRecorded).toBe(true);
    expect(body.requestId).toBeTruthy();
    expect(mocks.sendLeaderDailyBriefToGroupMe).toHaveBeenCalledWith({ text: expect.stringContaining("# LEADER DAILY BRIEF") });
    expect(mocks.recordLeaderDailyBriefPosted).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ messageId: "msg_123" }));
  });

  it("returns a safe staged failure when generation fails before posting", async () => {
    mocks.buildLeaderDailyBrief.mockRejectedValue(new Error("provider token=should-not-leak"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(new Request("https://leademergence.com/api/leader-daily-brief/groupme", { method: "POST", headers: { authorization: `Bearer ${secret}` } }));
    const body = await response.json() as { error: string; stage: string; downstreamStatus: number | null; requestId: string };

    expect(response.status).toBe(502);
    expect(body).toMatchObject({ error: "Leader Daily Brief workflow failed.", stage: "generate_brief", downstreamStatus: null });
    expect(body.requestId).toBeTruthy();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("should-not-leak");
    expect(mocks.sendLeaderDailyBriefToGroupMe).not.toHaveBeenCalled();
  });

  it("reports a GroupMe non-2xx as post_groupme without leaking the response", async () => {
    const { LeaderBriefGroupMePostError } = await import("@/lib/leader-daily-brief/groupme");
    mocks.sendLeaderDailyBriefToGroupMe.mockRejectedValue(new LeaderBriefGroupMePostError(401, "application/json", '{"token":"hidden"}'));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(new Request("https://leademergence.com/api/leader-daily-brief/groupme", { method: "POST", headers: { authorization: `Bearer ${secret}` } }));
    const body = await response.json() as { stage: string; downstreamStatus: number; requestId: string };

    expect(response.status).toBe(502);
    expect(body).toMatchObject({ stage: "post_groupme", downstreamStatus: 401 });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("hidden");
  });

  it("preserves a successful GroupMe post when activity recording fails", async () => {
    mocks.recordLeaderDailyBriefPosted.mockResolvedValue({ status: "unavailable" });

    const response = await POST(new Request("https://leademergence.com/api/leader-daily-brief/groupme", { method: "POST", headers: { authorization: `Bearer ${secret}` } }));
    const body = await response.json() as { status: string; posted: boolean; activityRecorded: boolean; requestId: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "sent_activity_unrecorded", posted: true, activityRecorded: false });
    expect(body.requestId).toBeTruthy();
  });

  it("returns missing configuration names without exposing values", async () => {
    delete process.env.GROUPME_LEADER_BRIEF_BOT_ID;

    const response = await POST(new Request("https://leademergence.com/api/leader-daily-brief/groupme", { method: "POST", headers: { authorization: `Bearer ${secret}` } }));
    const body = await response.json() as { stage: string; missing: string[]; requestId: string };

    expect(response.status).toBe(503);
    expect(body.stage).toBe("validate_configuration");
    expect(body.missing).toContain("GROUPME_LEADER_BRIEF_BOT_ID");
    expect(body.requestId).toBeTruthy();
  });
});
