import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LeaderDailyBrief, LeaderDailyBriefEvidence } from "@/lib/leader-daily-brief/types";

const mocks = vi.hoisted(() => ({
  loadLeaderDailyBriefEvidence: vi.fn(),
  hasPostedLeaderDailyBrief: vi.fn(),
  recordLeaderDailyBriefPosted: vi.fn(),
  sendLeaderDailyBriefToGroupMe: vi.fn()
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

    const response = await POST(new Request("https://leademergence.com/api/leader-daily-brief/groupme", { method: "POST" }));
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
    const body = await response.json() as { status: string; brief: LeaderDailyBrief; groupMe: { messageId: string } };

    expect(response.status).toBe(200);
    expect(body.status).toBe("sent");
    expect(body.groupMe.messageId).toBe("msg_123");
    expect(mocks.sendLeaderDailyBriefToGroupMe).toHaveBeenCalledWith({ text: expect.stringContaining("# LEADER DAILY BRIEF") });
    expect(body.brief.message).not.toContain("Daily Intelligence Brief");
  });
});
