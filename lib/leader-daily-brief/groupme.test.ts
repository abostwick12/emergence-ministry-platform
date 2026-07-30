import { describe, expect, it, vi } from "vitest";

import { LeaderBriefGroupMePostError, sendLeaderDailyBriefToGroupMe } from "./groupme";

describe("leader daily brief GroupMe sender", () => {
  const env = {
    LEADER_DAILY_BRIEF_ENABLED: "true",
    GROUPME_LEADER_BRIEF_BOT_ID: "bot-test",
    GROUPME_LEADER_BRIEF_GROUP_ID: "group-test"
  };

  it("uses the bot endpoint and treats every non-2xx response as a post failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"error":"token=hidden"}', { status: 401, headers: { "content-type": "application/json" } }));

    await expect(sendLeaderDailyBriefToGroupMe({ text: "Safe test message", env, fetchImpl })).rejects.toBeInstanceOf(LeaderBriefGroupMePostError);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.groupme.com/v3/bots/post", expect.objectContaining({ body: JSON.stringify({ bot_id: "bot-test", text: "Safe test message" }) }));
  });

  it("confirms GroupMe success only after a 2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"response":{"message":{"id":"message_123"}}}', { status: 202 }));

    await expect(sendLeaderDailyBriefToGroupMe({ text: "Safe test message", env, fetchImpl })).resolves.toEqual({ messageId: "message_123", groupId: "group-test" });
  });
});
