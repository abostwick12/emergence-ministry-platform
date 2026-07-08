import { describe, expect, it, vi } from "vitest";
import {
  buildGoogleCalendarAuthUrl,
  createGoogleCalendarEvent,
  exchangeGoogleCalendarCode,
  GoogleCalendarConfigError,
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  isGoogleCalendarTokenExpired,
  listUpcomingGoogleCalendarEvents,
  readGoogleCalendarConfig,
  refreshGoogleCalendarAccessToken,
  updateGoogleCalendarEvent
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

  it("builds a consent URL requesting only the calendar.events scope, with the CSRF state", () => {
    const url = new URL(buildGoogleCalendarAuthUrl({ state: "csrf-state", env: configuredEnv }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(configuredEnv.GOOGLE_REDIRECT_URI);
    expect(url.searchParams.get("scope")).toBe(GOOGLE_CALENDAR_EVENTS_SCOPE);
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
      jsonResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: GOOGLE_CALENDAR_EVENTS_SCOPE })
    );
    const tokens = await exchangeGoogleCalendarCode({ code: "auth-code", env: configuredEnv, fetchImpl });
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.scope).toBe(GOOGLE_CALENDAR_EVENTS_SCOPE);
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

describe("createGoogleCalendarEvent", () => {
  it("creates a timed event with the given timezone", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ id: "evt_new", summary: "Fellowship call", start: { dateTime: "2026-07-10T14:00:00" }, end: { dateTime: "2026-07-10T15:00:00" } })
    );
    const event = await createGoogleCalendarEvent({
      accessToken: "at",
      event: { summary: "Fellowship call", start: "2026-07-10T14:00:00", end: "2026-07-10T15:00:00", timeZone: "America/Chicago" },
      fetchImpl
    });

    expect(event).toEqual({ id: "evt_new", summary: "Fellowship call", start: "2026-07-10T14:00:00", end: "2026-07-10T15:00:00", isAllDay: false });
    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      summary: "Fellowship call",
      start: { dateTime: "2026-07-10T14:00:00", timeZone: "America/Chicago" },
      end: { dateTime: "2026-07-10T15:00:00", timeZone: "America/Chicago" }
    });
  });

  it("creates an all-day event using date instead of dateTime", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "evt_2", summary: "Retreat", start: { date: "2026-08-01" }, end: { date: "2026-08-03" } }));
    await createGoogleCalendarEvent({
      accessToken: "at",
      event: { summary: "Retreat", start: "2026-08-01", end: "2026-08-03", isAllDay: true },
      fetchImpl
    });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.start).toEqual({ date: "2026-08-01" });
    expect(body.end).toEqual({ date: "2026-08-03" });
  });

  it("throws when creation fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 400));
    await expect(
      createGoogleCalendarEvent({ accessToken: "at", event: { summary: "s", start: "2026-01-01T00:00:00", end: "2026-01-01T01:00:00" }, fetchImpl })
    ).rejects.toThrow("Google Calendar event creation failed");
  });
});

describe("updateGoogleCalendarEvent", () => {
  it("sends only the provided fields to the event's PATCH endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "evt_1", summary: "Updated title", start: { dateTime: "2026-07-10T14:00:00" }, end: { dateTime: "2026-07-10T15:00:00" } }));
    const event = await updateGoogleCalendarEvent({ accessToken: "at", eventId: "evt_1", patch: { summary: "Updated title" }, fetchImpl });

    expect(event.summary).toBe("Updated title");
    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events/evt_1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ summary: "Updated title" });
  });

  it("throws when the update fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 404));
    await expect(updateGoogleCalendarEvent({ accessToken: "at", eventId: "missing", patch: { summary: "x" }, fetchImpl })).rejects.toThrow(
      "Google Calendar event update failed"
    );
  });
});
