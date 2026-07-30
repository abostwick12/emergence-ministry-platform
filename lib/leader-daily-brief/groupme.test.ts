import { describe, expect, it, vi } from "vitest";

import { LeaderBriefGroupMePostError, sendLeaderDailyBriefToGroupMe } from "./groupme";

describe("leader daily brief GroupMe sender", () => {
  const env = {
    LEADER_DAILY_BRIEF_ENABLED: "true",
    GROUPME_LEADER_BRIEF_BOT_ID: "bot-test",
    GROUPME_LEADER_BRIEF_GROUP_ID: "group-test",
    GROUPME_API_BASE_URL: "https://dev.groupme.com/v3/groups/group-test"
  };

  it("uses the exact official bot endpoint and treats unexpected responses as post failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"error":"token=hidden"}', { status: 401, headers: { "content-type": "application/json" } }));

    await expect(sendLeaderDailyBriefToGroupMe({ text: "Safe test message", env, fetchImpl })).rejects.toBeInstanceOf(LeaderBriefGroupMePostError);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.groupme.com/v3/bots/post", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }));
  });

  it("sends only bot_id and text in the request body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"response":{"message":{"id":"message_123"}}}', { status: 201 }));

    await expect(sendLeaderDailyBriefToGroupMe({ text: "Safe test message", env, fetchImpl })).resolves.toEqual({ messageId: "message_123", groupId: "group-test" });
    const [, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(requestInit.body as string)).toEqual({ bot_id: "bot-test", text: "Safe test message" });
  });

  it("trims the bot id before posting", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await expect(sendLeaderDailyBriefToGroupMe({
      text: "Safe test message",
      env: { ...env, GROUPME_LEADER_BRIEF_BOT_ID: "  bot-test  " },
      fetchImpl
    })).resolves.toEqual({ messageId: undefined, groupId: "group-test" });
    const [, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(requestInit.body as string)).toEqual({ bot_id: "bot-test", text: "Safe test message" });
  });

  it("confirms GroupMe success for 200 or 201 only", async () => {
    const success200 = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const success201 = vi.fn().mockResolvedValue(new Response('{"response":{"message":{"id":"message_123"}}}', { status: 201 }));
    const unexpected202 = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));

    await expect(sendLeaderDailyBriefToGroupMe({ text: "Safe test message", env, fetchImpl: success200 })).resolves.toEqual({ messageId: undefined, groupId: "group-test" });
    await expect(sendLeaderDailyBriefToGroupMe({ text: "Safe test message", env, fetchImpl: success201 })).resolves.toEqual({ messageId: "message_123", groupId: "group-test" });
    await expect(sendLeaderDailyBriefToGroupMe({ text: "Safe test message", env, fetchImpl: unexpected202 })).rejects.toBeInstanceOf(LeaderBriefGroupMePostError);
  });
});
