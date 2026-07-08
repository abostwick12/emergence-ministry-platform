import { describe, expect, it, vi } from "vitest";
import {
  buildGmailAuthUrl,
  createGmailDraft,
  exchangeGmailCode,
  GmailConfigError,
  GMAIL_COMPOSE_SCOPE,
  GMAIL_READONLY_SCOPE,
  isGmailTokenExpired,
  listRecentGmailMessages,
  parseStoredGmailTokens,
  readGmailConfig,
  refreshGmailAccessToken
} from "@/lib/command-center/integrations/gmail";

const configuredEnv = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  GOOGLE_REDIRECT_URI: "https://example.com/api/command-center/integrations/gmail/callback"
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}

describe("readGmailConfig", () => {
  it("reports not configured with the specific missing env vars", () => {
    const config = readGmailConfig({});
    expect(config.configured).toBe(false);
    expect(config.missing).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]);
  });

  it("reports configured when all three shared Google OAuth env vars are present", () => {
    const config = readGmailConfig(configuredEnv);
    expect(config.configured).toBe(true);
    expect(config.missing).toEqual([]);
  });
});

describe("buildGmailAuthUrl", () => {
  it("throws GmailConfigError when not configured", () => {
    expect(() => buildGmailAuthUrl({ state: "abc", env: {} })).toThrow(GmailConfigError);
  });

  it("requests both readonly and compose scopes, never a send-only scope", () => {
    const url = new URL(buildGmailAuthUrl({ state: "csrf-state", env: configuredEnv }));
    const scope = url.searchParams.get("scope");
    expect(scope).toContain(GMAIL_READONLY_SCOPE);
    expect(scope).toContain(GMAIL_COMPOSE_SCOPE);
    expect(url.searchParams.get("state")).toBe("csrf-state");
  });
});

describe("exchangeGmailCode", () => {
  it("throws GmailConfigError instead of calling fetch when not configured", async () => {
    const fetchImpl = vi.fn();
    await expect(exchangeGmailCode({ code: "abc", env: {}, fetchImpl })).rejects.toThrow(GmailConfigError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exchanges an authorization code for tokens", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: GMAIL_READONLY_SCOPE })
    );
    const tokens = await exchangeGmailCode({ code: "auth-code", env: configuredEnv, fetchImpl });
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
  });
});

describe("refreshGmailAccessToken", () => {
  it("refreshes an access token using the refresh token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ access_token: "new-at", expires_in: 3600 }));
    const refreshed = await refreshGmailAccessToken({ refreshToken: "rt", env: configuredEnv, fetchImpl });
    expect(refreshed.accessToken).toBe("new-at");
  });
});

describe("isGmailTokenExpired", () => {
  it("treats a past expiry as expired", () => {
    expect(isGmailTokenExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
  });

  it("treats a comfortably future expiry as not expired", () => {
    expect(isGmailTokenExpired(new Date(Date.now() + 60 * 60 * 1000).toISOString())).toBe(false);
  });
});

describe("parseStoredGmailTokens", () => {
  it("returns null for malformed or partial stored config", () => {
    expect(parseStoredGmailTokens({})).toBeNull();
    expect(parseStoredGmailTokens({ accessToken: "at" })).toBeNull();
  });

  it("parses a well-formed stored token record", () => {
    const parsed = parseStoredGmailTokens({ accessToken: "at", refreshToken: "rt", expiresAt: "2026-01-01T00:00:00.000Z", scope: "x" });
    expect(parsed).toEqual({ accessToken: "at", refreshToken: "rt", expiresAt: "2026-01-01T00:00:00.000Z", scope: "x" });
  });
});

describe("listRecentGmailMessages", () => {
  it("fetches only metadata headers and the snippet, never the full message body", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ messages: [{ id: "msg_1", threadId: "thread_1" }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "msg_1",
          threadId: "thread_1",
          snippet: "Quick check-in about the fellowship reflection...",
          payload: {
            headers: [
              { name: "Subject", value: "Fellowship reflection reminder" },
              { name: "From", value: "mentor@example.com" },
              { name: "Date", value: "Mon, 6 Jul 2026 10:00:00 -0500" }
            ]
          }
        })
      );

    const messages = await listRecentGmailMessages({ accessToken: "at", fetchImpl });
    expect(messages).toEqual([
      {
        id: "msg_1",
        threadId: "thread_1",
        subject: "Fellowship reflection reminder",
        from: "mentor@example.com",
        date: "Mon, 6 Jul 2026 10:00:00 -0500",
        snippet: "Quick check-in about the fellowship reflection..."
      }
    ]);

    const metadataCall = fetchImpl.mock.calls[1][0] as string;
    expect(metadataCall).toContain("format=metadata");
    expect(metadataCall).not.toContain("format=full");
  });

  it("throws when the list request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 401));
    await expect(listRecentGmailMessages({ accessToken: "expired", fetchImpl })).rejects.toThrow("Gmail message list fetch failed");
  });
});

describe("createGmailDraft", () => {
  it("creates a draft via the drafts endpoint and never calls a send endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "draft_1", message: { id: "msg_draft_1" } }));
    const result = await createGmailDraft({
      accessToken: "at",
      to: "mentor@example.com",
      subject: "Re: Fellowship reflection",
      body: "Thanks for the reminder, here is my draft outline.",
      fetchImpl
    });

    expect(result).toEqual({ draftId: "draft_1", messageId: "msg_draft_1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/drafts");
    expect(calledUrl).not.toContain("/send");
    expect(init.method).toBe("POST");
  });

  it("throws when draft creation fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 400));
    await expect(
      createGmailDraft({ accessToken: "at", to: "a@example.com", subject: "s", body: "b", fetchImpl })
    ).rejects.toThrow("Gmail draft creation failed");
  });
});
