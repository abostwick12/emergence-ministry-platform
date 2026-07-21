import { describe, expect, it, vi } from "vitest";
import {
  buildGroupMeAuthUrl,
  GroupMeConfigError,
  listGroupMeGroups,
  listGroupMeMessages,
  readGroupMeConfig,
  sendGroupMeMessage
} from "@/lib/integrations/groupme/client";

const configuredEnv = {
  GROUPME_CLIENT_ID: "client-id",
  GROUPME_REDIRECT_URI: "https://example.com/api/integrations/groupme/callback",
  GROUPME_ENCRYPTION_KEY: "local-test-encryption-key",
  GROUPME_API_BASE_URL: "https://groupme.example.test/v3"
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("GroupMe configuration", () => {
  it("requires only the values used by GroupMe implicit OAuth and encrypted storage", () => {
    expect(readGroupMeConfig({}).missing).toEqual(["GROUPME_CLIENT_ID", "GROUPME_REDIRECT_URI", "GROUPME_ENCRYPTION_KEY"]);
    expect(readGroupMeConfig(configuredEnv).configured).toBe(true);
  });

  it("builds the authorization URL with CSRF state", () => {
    const url = new URL(buildGroupMeAuthUrl({ state: "csrf-state", env: configuredEnv }));
    expect(url.origin + url.pathname).toBe("https://oauth.groupme.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.toString()).not.toContain("local-test-encryption-key");
  });

  it("fails closed when server configuration is missing", () => {
    expect(() => buildGroupMeAuthUrl({ state: "state", env: {} })).toThrow(GroupMeConfigError);
  });
});

describe("GroupMe API client", () => {
  it("lists groups with the access token in a header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ response: [{ id: "g1", name: "9th Grade", members: [{}, {}] }] }));
    await expect(listGroupMeGroups({ accessToken: "secret-token", env: configuredEnv, fetchImpl })).resolves.toEqual([
      { id: "g1", name: "9th Grade", memberCount: 2, description: undefined, imageUrl: undefined, shareUrl: undefined }
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://groupme.example.test/v3/groups?per_page=100",
      expect.objectContaining({ headers: expect.objectContaining({ "X-Access-Token": "secret-token" }) })
    );
    expect(fetchImpl.mock.calls[0]?.[0]).not.toContain("secret-token");
  });

  it("loads recent messages in chronological order", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ response: { messages: [
      { id: "m2", group_id: "g1", name: "Maya", text: "Second", created_at: 200 },
      { id: "m1", group_id: "g1", name: "Andrew", text: "First", created_at: 100 }
    ] } }));
    const messages = await listGroupMeMessages({ accessToken: "at", groupId: "g1", env: configuredEnv, fetchImpl });
    expect(messages.map((message) => message.text)).toEqual(["First", "Second"]);
  });

  it("sends a de-duplicated message with an explicit source guid", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ response: { message: { id: "message-1" } } }, true, 201));
    await expect(sendGroupMeMessage({
      accessToken: "at",
      groupId: "g1",
      text: "Leader guide is ready.",
      sourceGuid: "source-guid-1",
      env: configuredEnv,
      fetchImpl
    })).resolves.toEqual({ id: "message-1", sourceGuid: "source-guid-1" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://groupme.example.test/v3/groups/g1/messages",
      expect.objectContaining({ body: JSON.stringify({ message: { source_guid: "source-guid-1", text: "Leader guide is ready.", attachments: [] } }) })
    );
  });
});
