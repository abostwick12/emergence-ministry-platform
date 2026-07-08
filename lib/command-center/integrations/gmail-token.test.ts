import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import {
  GmailConnectionExpiredError,
  GmailConnectionInvalidError,
  GmailNotConnectedError,
  getValidGmailAccessToken
} from "@/lib/command-center/integrations/gmail-token";
import { updateIntegration } from "@/lib/command-center/repository";
import { __resetCommandCenterStoreForTests } from "@/lib/command-center/store";

function mockSession(): AuthSession {
  return {
    isMock: true,
    user: { id: "usr_andrew", email: "andrew.w.bostwick12@gmail.com", fullName: "Andrew Bostwick", role: "admin" }
  };
}

beforeEach(() => {
  __resetCommandCenterStoreForTests();
});

describe("getValidGmailAccessToken", () => {
  it("throws GmailNotConnectedError when the integration is disconnected", async () => {
    await expect(getValidGmailAccessToken(mockSession())).rejects.toThrow(GmailNotConnectedError);
  });

  it("throws GmailConnectionInvalidError when connected but the stored config is malformed", async () => {
    const session = mockSession();
    await updateIntegration(session, "gmail", { status: "connected", config: { accessToken: "at-only" } });
    await expect(getValidGmailAccessToken(session)).rejects.toThrow(GmailConnectionInvalidError);
  });

  it("returns the stored access token when it is not expired", async () => {
    const session = mockSession();
    await updateIntegration(session, "gmail", {
      status: "connected",
      config: { accessToken: "valid-at", expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), scope: "x" }
    });
    await expect(getValidGmailAccessToken(session)).resolves.toBe("valid-at");
  });

  it("throws GmailConnectionExpiredError when expired with no refresh token", async () => {
    const session = mockSession();
    await updateIntegration(session, "gmail", {
      status: "connected",
      config: { accessToken: "stale-at", expiresAt: new Date(Date.now() - 1000).toISOString(), scope: "x" }
    });
    await expect(getValidGmailAccessToken(session)).rejects.toThrow(GmailConnectionExpiredError);
  });

  it("refreshes and persists a new access token when expired with a refresh token", async () => {
    const session = mockSession();
    await updateIntegration(session, "gmail", {
      status: "connected",
      config: { accessToken: "stale-at", refreshToken: "rt", expiresAt: new Date(Date.now() - 1000).toISOString(), scope: "x" }
    });

    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "https://example.com/callback");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ access_token: "refreshed-at", expires_in: 3600 }) })
    );

    try {
      const accessToken = await getValidGmailAccessToken(session);
      expect(accessToken).toBe("refreshed-at");
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
