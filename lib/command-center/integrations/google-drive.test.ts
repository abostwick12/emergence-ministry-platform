import { describe, expect, it, vi } from "vitest";
import {
  buildGoogleDriveAuthUrl,
  exchangeGoogleDriveCode,
  GOOGLE_DRIVE_METADATA_READONLY_SCOPE,
  GoogleDriveConfigError,
  isGoogleDriveTokenExpired,
  parseStoredGoogleDriveTokens,
  readGoogleDriveConfig,
  refreshGoogleDriveAccessToken,
  searchGoogleDriveFiles
} from "@/lib/command-center/integrations/google-drive";

const configuredEnv = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  GOOGLE_REDIRECT_URI: "https://example.com/api/command-center/integrations/google-drive/callback"
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}

describe("readGoogleDriveConfig", () => {
  it("reports not configured with the specific missing env vars", () => {
    const config = readGoogleDriveConfig({});
    expect(config.configured).toBe(false);
    expect(config.missing).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]);
  });

  it("reports configured when all three shared Google OAuth env vars are present", () => {
    const config = readGoogleDriveConfig(configuredEnv);
    expect(config.configured).toBe(true);
  });
});

describe("buildGoogleDriveAuthUrl", () => {
  it("throws GoogleDriveConfigError when not configured", () => {
    expect(() => buildGoogleDriveAuthUrl({ state: "abc", env: {} })).toThrow(GoogleDriveConfigError);
  });

  it("requests only the metadata-readonly scope, never full drive.readonly", () => {
    const url = new URL(buildGoogleDriveAuthUrl({ state: "csrf-state", env: configuredEnv }));
    expect(url.searchParams.get("scope")).toBe(GOOGLE_DRIVE_METADATA_READONLY_SCOPE);
    expect(url.searchParams.get("state")).toBe("csrf-state");
  });
});

describe("exchangeGoogleDriveCode", () => {
  it("throws GoogleDriveConfigError instead of calling fetch when not configured", async () => {
    const fetchImpl = vi.fn();
    await expect(exchangeGoogleDriveCode({ code: "abc", env: {}, fetchImpl })).rejects.toThrow(GoogleDriveConfigError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exchanges an authorization code for tokens", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: GOOGLE_DRIVE_METADATA_READONLY_SCOPE }));
    const tokens = await exchangeGoogleDriveCode({ code: "auth-code", env: configuredEnv, fetchImpl });
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
  });
});

describe("refreshGoogleDriveAccessToken", () => {
  it("refreshes an access token using the refresh token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ access_token: "new-at", expires_in: 3600 }));
    const refreshed = await refreshGoogleDriveAccessToken({ refreshToken: "rt", env: configuredEnv, fetchImpl });
    expect(refreshed.accessToken).toBe("new-at");
  });
});

describe("isGoogleDriveTokenExpired", () => {
  it("treats a past expiry as expired", () => {
    expect(isGoogleDriveTokenExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
  });

  it("treats a comfortably future expiry as not expired", () => {
    expect(isGoogleDriveTokenExpired(new Date(Date.now() + 60 * 60 * 1000).toISOString())).toBe(false);
  });
});

describe("parseStoredGoogleDriveTokens", () => {
  it("returns null for malformed or partial stored config", () => {
    expect(parseStoredGoogleDriveTokens({})).toBeNull();
    expect(parseStoredGoogleDriveTokens({ accessToken: "at" })).toBeNull();
  });

  it("parses a well-formed stored token record", () => {
    const parsed = parseStoredGoogleDriveTokens({ accessToken: "at", refreshToken: "rt", expiresAt: "2026-01-01T00:00:00.000Z", scope: "x" });
    expect(parsed).toEqual({ accessToken: "at", refreshToken: "rt", expiresAt: "2026-01-01T00:00:00.000Z", scope: "x" });
  });
});

describe("searchGoogleDriveFiles", () => {
  it("requests only metadata fields and excludes trashed files", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        files: [
          { id: "file_1", name: "SOTF reflection outline", mimeType: "application/vnd.google-apps.document", webViewLink: "https://drive.google.com/file_1", modifiedTime: "2026-07-01T00:00:00.000Z" }
        ]
      })
    );

    const files = await searchGoogleDriveFiles({ accessToken: "at", query: "SOTF", fetchImpl });
    expect(files).toEqual([
      {
        id: "file_1",
        name: "SOTF reflection outline",
        mimeType: "application/vnd.google-apps.document",
        webViewLink: "https://drive.google.com/file_1",
        modifiedTime: "2026-07-01T00:00:00.000Z"
      }
    ]);

    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain("trashed+%3D+false");
    expect(calledUrl).toContain("fields=files%28id%2Cname%2CmimeType%2CwebViewLink%2CmodifiedTime%29");
  });

  it("escapes single quotes in the search query", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ files: [] }));
    await searchGoogleDriveFiles({ accessToken: "at", query: "Andrew's plan", fetchImpl });
    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain("Andrew%5C%27s+plan");
  });

  it("throws when the search request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 401));
    await expect(searchGoogleDriveFiles({ accessToken: "expired", query: "x", fetchImpl })).rejects.toThrow("Google Drive search failed");
  });
});
