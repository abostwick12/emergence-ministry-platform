// Google Calendar integration for the Personal Command Center: read
// upcoming events, and create/edit events — Andrew-triggered only, from the
// Calendar integration page itself. There is still no tool calling
// anywhere in this codebase, so SAGE chat cannot create or edit an event;
// it can only reference read-only event context (see
// lib/command-center/sage-live-context.ts).
//
// Mirrors the provider-config pattern in lib/command-center/sage.ts: config
// is read from env only, and every function throws GoogleCalendarConfigError
// (never a raw fetch failure) when GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or
// GOOGLE_REDIRECT_URI is missing, so callers can render a graceful
// "not configured" state exactly like SAGE chat does today.
//
// Uses raw fetch against Google's OAuth and Calendar REST APIs instead of
// adding the googleapis SDK dependency. Scope is calendar.events, which
// grants read/write on events only — not the broader `calendar` scope,
// which would also allow managing the calendar list and calendar settings
// this integration has no need for. There is still no delete-event
// function anywhere in this module.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
export const GOOGLE_CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const GOOGLE_CALENDAR_OAUTH_STATE_COOKIE = "cc_gcal_oauth_state";

type GoogleCalendarEnv = Record<string, string | undefined>;

export type GoogleCalendarConfig = {
  configured: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  missing: string[];
};

export type GoogleCalendarTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope: string;
};

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  start?: string;
  end?: string;
  isAllDay: boolean;
};

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readGoogleCalendarConfig(env: GoogleCalendarEnv = process.env): GoogleCalendarConfig {
  const clientId = cleanEnv(env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnv(env.GOOGLE_CLIENT_SECRET);
  const redirectUri = cleanEnv(env.GOOGLE_REDIRECT_URI);
  const required: Array<[string, string | undefined]> = [
    ["GOOGLE_CLIENT_ID", clientId],
    ["GOOGLE_CLIENT_SECRET", clientSecret],
    ["GOOGLE_REDIRECT_URI", redirectUri]
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  return { configured: missing.length === 0, clientId, clientSecret, redirectUri, missing };
}

export class GoogleCalendarConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("Google Calendar integration is not configured.");
    this.name = "GoogleCalendarConfigError";
    this.missing = missing;
  }
}

function requireConfig(env?: GoogleCalendarEnv): Required<Pick<GoogleCalendarConfig, "clientId" | "clientSecret" | "redirectUri">> {
  const config = readGoogleCalendarConfig(env);
  if (!config.configured || !config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new GoogleCalendarConfigError(config.missing);
  }
  return { clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri };
}

export function buildGoogleCalendarAuthUrl(params: { state: string; env?: GoogleCalendarEnv }): string {
  const config = requireConfig(params.env);
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_EVENTS_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", params.state);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
};

export async function exchangeGoogleCalendarCode(params: {
  code: string;
  env?: GoogleCalendarEnv;
  fetchImpl?: typeof fetch;
}): Promise<GoogleCalendarTokens> {
  const config = requireConfig(params.env);
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    })
  });
  if (!response.ok) throw new Error(`Google Calendar token exchange failed: ${response.status}`);
  const json = (await response.json()) as TokenResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    scope: json.scope
  };
}

export async function refreshGoogleCalendarAccessToken(params: {
  refreshToken: string;
  env?: GoogleCalendarEnv;
  fetchImpl?: typeof fetch;
}): Promise<{ accessToken: string; expiresAt: string }> {
  const config = requireConfig(params.env);
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: params.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) throw new Error(`Google Calendar token refresh failed: ${response.status}`);
  const json = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString() };
}

export function isGoogleCalendarTokenExpired(expiresAt: string, skewMs = 60_000): boolean {
  return new Date(expiresAt).getTime() - skewMs <= Date.now();
}

type CalendarEventsResponse = {
  items?: Array<{
    id: string;
    summary?: string;
    start?: { date?: string; dateTime?: string };
    end?: { date?: string; dateTime?: string };
  }>;
};

export async function listUpcomingGoogleCalendarEvents(params: {
  accessToken: string;
  maxResults?: number;
  fetchImpl?: typeof fetch;
}): Promise<GoogleCalendarEvent[]> {
  const doFetch = params.fetchImpl ?? fetch;
  const url = new URL(CALENDAR_EVENTS_URL);
  url.searchParams.set("timeMin", new Date().toISOString());
  url.searchParams.set("maxResults", String(params.maxResults ?? 10));
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  const response = await doFetch(url.toString(), {
    headers: { Authorization: `Bearer ${params.accessToken}` }
  });
  if (!response.ok) throw new Error(`Google Calendar events fetch failed: ${response.status}`);
  const json = (await response.json()) as CalendarEventsResponse;
  return (json.items ?? []).map((item) => ({
    id: item.id,
    summary: item.summary ?? "(untitled event)",
    start: item.start?.dateTime ?? item.start?.date,
    end: item.end?.dateTime ?? item.end?.date,
    isAllDay: Boolean(item.start?.date && !item.start?.dateTime)
  }));
}

// --- Create / edit events (Andrew-triggered only; no delete function) ----

// start/end are either an ISO date-time (timed event) or an ISO date
// YYYY-MM-DD (all-day event, when isAllDay is true) — matching how Google's
// Calendar API itself distinguishes the two. timeZone is an IANA name
// (e.g. "America/Chicago"); pair it with a timezone-less dateTime the same
// way an HTML datetime-local input produces one.
export type GoogleCalendarEventInput = {
  summary: string;
  description?: string;
  start: string;
  end: string;
  isAllDay?: boolean;
  timeZone?: string;
};

export type GoogleCalendarEventPatch = Partial<GoogleCalendarEventInput>;

function eventTimeField(value: string, isAllDay?: boolean, timeZone?: string): { date: string } | { dateTime: string; timeZone?: string } {
  if (isAllDay) return { date: value };
  return { dateTime: value, timeZone };
}

function buildEventBody(input: GoogleCalendarEventInput | GoogleCalendarEventPatch): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.summary !== undefined) body.summary = input.summary;
  if (input.description !== undefined) body.description = input.description;
  if (input.start !== undefined) body.start = eventTimeField(input.start, input.isAllDay, input.timeZone);
  if (input.end !== undefined) body.end = eventTimeField(input.end, input.isAllDay, input.timeZone);
  return body;
}

type CalendarEventResource = {
  id: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

function mapEventResource(item: CalendarEventResource): GoogleCalendarEvent {
  return {
    id: item.id,
    summary: item.summary ?? "(untitled event)",
    start: item.start?.dateTime ?? item.start?.date,
    end: item.end?.dateTime ?? item.end?.date,
    isAllDay: Boolean(item.start?.date && !item.start?.dateTime)
  };
}

// Andrew-triggered only — there is no scheduled/automatic caller anywhere,
// and no tool-calling path lets SAGE chat invoke this. Requires summary,
// start, and end; description and isAllDay are optional.
export async function createGoogleCalendarEvent(params: {
  accessToken: string;
  event: GoogleCalendarEventInput;
  fetchImpl?: typeof fetch;
}): Promise<GoogleCalendarEvent> {
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(CALENDAR_EVENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildEventBody(params.event))
  });
  if (!response.ok) throw new Error(`Google Calendar event creation failed: ${response.status}`);
  return mapEventResource((await response.json()) as CalendarEventResource);
}

// Partial update — only the fields provided are changed. There is no
// delete function anywhere in this module.
export async function updateGoogleCalendarEvent(params: {
  accessToken: string;
  eventId: string;
  patch: GoogleCalendarEventPatch;
  fetchImpl?: typeof fetch;
}): Promise<GoogleCalendarEvent> {
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(`${CALENDAR_EVENTS_URL}/${params.eventId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildEventBody(params.patch))
  });
  if (!response.ok) throw new Error(`Google Calendar event update failed: ${response.status}`);
  return mapEventResource((await response.json()) as CalendarEventResource);
}
