import { describe, expect, it, vi } from "vitest";
import { formatDailyBriefingMessage, readSlackConfig, sendSlackMessage, SlackConfigError } from "@/lib/command-center/integrations/slack";
import type { CommandCenterOverview, PersonalTask } from "@/lib/command-center/types";

const configuredEnv = { COMMAND_CENTER_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/test/webhook" };

function okResponse(): Response {
  return { ok: true, status: 200, json: async () => ({}) } as Response;
}

describe("readSlackConfig", () => {
  it("reports not configured with the specific missing env var", () => {
    const config = readSlackConfig({});
    expect(config.configured).toBe(false);
    expect(config.missing).toEqual(["COMMAND_CENTER_SLACK_WEBHOOK_URL"]);
  });

  it("reports configured when the webhook URL is present", () => {
    const config = readSlackConfig(configuredEnv);
    expect(config.configured).toBe(true);
    expect(config.webhookUrl).toBe(configuredEnv.COMMAND_CENTER_SLACK_WEBHOOK_URL);
  });
});

describe("sendSlackMessage", () => {
  it("throws SlackConfigError instead of calling fetch when not configured", async () => {
    const fetchImpl = vi.fn();
    await expect(sendSlackMessage({ text: "hello", env: {}, fetchImpl })).rejects.toThrow(SlackConfigError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the message text to the configured webhook URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await sendSlackMessage({ text: "hello Andrew", env: configuredEnv, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(configuredEnv.COMMAND_CENTER_SLACK_WEBHOOK_URL);
    expect(JSON.parse(init.body as string)).toEqual({ text: "hello Andrew" });
  });

  it("throws when the webhook post fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) } as Response);
    await expect(sendSlackMessage({ text: "hello", env: configuredEnv, fetchImpl })).rejects.toThrow("Slack webhook post failed");
  });
});

function task(overrides: Partial<PersonalTask> = {}): PersonalTask {
  return {
    id: "task_1",
    domain: "job_search",
    title: "Follow up with recruiter",
    status: "todo",
    priority: "high",
    tags: [],
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
    ...overrides
  };
}

function overview(overrides: Partial<CommandCenterOverview> = {}): CommandCenterOverview {
  return {
    todayPriority: task(),
    tasksByDomain: {
      military_transition: { total: 3, open: 3 },
      sotf_fellowship: { total: 2, open: 2 },
      job_search: { total: 4, open: 4 },
      life: { total: 1, open: 1 }
    },
    briefingItems: [],
    integrations: [],
    jobFollowUpsDueCount: 0,
    unprocessedCaptureCount: 0,
    ...overrides
  };
}

describe("formatDailyBriefingMessage", () => {
  it("includes today's priority, domain counts, and never sends via a network call", () => {
    const message = formatDailyBriefingMessage({ overview: overview() });
    expect(message).toContain("*SAGE Daily Briefing*");
    expect(message).toContain("Follow up with recruiter");
    expect(message).toContain("Military Transition: 3 open");
    expect(message).toContain("SOTF Fellowship: 2 open");
    expect(message).toContain("Job Search: 4 open");
    expect(message).toContain("Life: 1 open");
  });

  it("reports plainly when there is no open priority task", () => {
    const message = formatDailyBriefingMessage({ overview: overview({ todayPriority: null }) });
    expect(message).toContain("Today's priority: no open tasks.");
  });

  it("includes job follow-ups and unprocessed captures only when non-zero", () => {
    const withCounts = formatDailyBriefingMessage({ overview: overview({ jobFollowUpsDueCount: 2, unprocessedCaptureCount: 5 }) });
    expect(withCounts).toContain("Job follow-ups due: 2");
    expect(withCounts).toContain("Unprocessed quick captures: 5");

    const withoutCounts = formatDailyBriefingMessage({ overview: overview() });
    expect(withoutCounts).not.toContain("Job follow-ups due");
    expect(withoutCounts).not.toContain("Unprocessed quick captures");
  });

  it("appends live integration context when provided", () => {
    const message = formatDailyBriefingMessage({
      overview: overview(),
      liveIntegrationContext: "Read-only Google Calendar context (as of this turn):\n- 2026-07-10T14:00:00Z: Fellowship call"
    });
    expect(message).toContain("Read-only Google Calendar context");
    expect(message).toContain("Fellowship call");
  });
});
