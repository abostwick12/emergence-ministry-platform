import { describe, expect, it, vi } from "vitest";
import {
  buildGoogleCalendarAuthUrl,
  exchangeGoogleCalendarCode,
  GoogleCalendarConfigError,
  GOOGLE_CALENDAR_READONLY_SCOPE,
  isGoogleCalendarTokenExpired,
  listUpcomingGoogleCalendarEvents,
  readGoogleCalendarConfig,
  refreshGoogleCalendarAccessToken
} from "@/lib/command-center/integrations/google-calendar";

const configuredEnv = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  GOOGLE_REDIRECT_URI: "https://example.com/api/command-center/integrations/google-calendar/callback"
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}

describe("readGoogleCalendarConfig", () => {
  it("reports not configured with the specific missing env vars", () => {
    const config = readGoogleCalendarConfig({});
    expect(config.configured).toBe(false);
    expect(config.missing).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]);
  });

  it("reports configured when all three env vars are present", () => {
    const config = readGoogleCalendarConfig(configuredEnv);
    expect(config.configured).toBe(true);
    expect(config.missing).toEqual([]);
  });
});

describe("buildGoogleCalendarAuthUrl", () => {
  it("throws GoogleCalendarConfigError when not configured", () => {
    expect(() => buildGoogleCalendarAuthUrl({ state: "abc", env: {} })).toThrow(GoogleCalendarConfigError);
  });

  it("builds a read-only consent URL with the CSRF state", () => {
    const url = new URL(buildGoogleCalendarAuthUrl({ state: "csrf-state", env: configuredEnv }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(configuredEnv.GOOGLE_REDIRECT_URI);
    expect(url.searchParams.get("scope")).toBe(GOOGLE_CALENDAR_READONLY_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("csrf-state");
  });
});

describe("exchangeGoogleCalendarCode", () => {
  it("throws GoogleCalendarConfigError instead of calling fetch when not configured", async () => {
    const fetchImpl = vi.fn();
    await expect(exchangeGoogleCalendarCode({ code: "abc", env: {}, fetchImpl })).rejects.toThrow(GoogleCalendarConfigError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exchanges an authorization code for tokens", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: GOOGLE_CALENDAR_READONLY_SCOPE })
    );
    const tokens = await exchangeGoogleCalendarCode({ code: "auth-code", env: configuredEnv, fetchImpl });
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.scope).toBe(GOOGLE_CALENDAR_READONLY_SCOPE);
    expect(new Date(tokens.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("throws when Google returns a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 400));
    await expect(exchangeGoogleCalendarCode({ code: "bad-code", env: configuredEnv, fetchImpl })).rejects.toThrow(
      "Google Calendar token exchange failed"
    );
  });
});

describe("refreshGoogleCalendarAccessToken", () => {
  it("refreshes an access token using the refresh token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ access_token: "new-at", expires_in: 3600 }));
    const refreshed = await refreshGoogleCalendarAccessToken({ refreshToken: "rt", env: configuredEnv, fetchImpl });
    expect(refreshed.accessToken).toBe("new-at");
  });
});

describe("isGoogleCalendarTokenExpired", () => {
  it("treats a past expiry as expired", () => {
    expect(isGoogleCalendarTokenExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
  });

  it("treats a comfortably future expiry as not expired", () => {
    expect(isGoogleCalendarTokenExpired(new Date(Date.now() + 60 * 60 * 1000).toISOString())).toBe(false);
  });
});

describe("listUpcomingGoogleCalendarEvents", () => {
  it("maps Google Calendar API items into minimal read-only event fields", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          { id: "evt_1", summary: "Fellowship call", start: { dateTime: "2026-07-10T14:00:00Z" }, end: { dateTime: "2026-07-10T15:00:00Z" } },
          { id: "evt_2", start: { date: "2026-07-12" }, end: { date: "2026-07-13" } }
        ]
      })
    );
    const events = await listUpcomingGoogleCalendarEvents({ accessToken: "at", fetchImpl });
    expect(events).toEqual([
      { id: "evt_1", summary: "Fellowship call", start: "2026-07-10T14:00:00Z", end: "2026-07-10T15:00:00Z", isAllDay: false },
      { id: "evt_2", summary: "(untitled event)", start: "2026-07-12", end: "2026-07-13", isAllDay: true }
    ]);
  });

  it("throws when the events request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 401));
    await expect(listUpcomingGoogleCalendarEvents({ accessToken: "expired", fetchImpl })).rejects.toThrow(
      "Google Calendar events fetch failed"
    );
  });
});
