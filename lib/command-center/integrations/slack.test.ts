import { describe, expect, it, vi } from "vitest";
import { readSlackConfig, sendSlackMessage, SlackConfigError } from "@/lib/command-center/integrations/slack";

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
