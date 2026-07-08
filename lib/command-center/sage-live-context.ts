// Assembles read-only live integration context for SAGE chat: upcoming
// Google Calendar events, recent Gmail triage, and recently modified
// Google Drive files, only when each integration is actually connected.
// This is the only place SAGE chat touches an integration — it never
// writes anything and never triggers any integration action, the same
// read-only guarantee every integration module already enforces on its
// own.
//
// Each integration's fetch is isolated and best-effort: a failure or
// disconnection on one (expired token, network error, not connected) never
// blocks the others or the overall chat turn. If none of the integrations
// are connected, or all fail, buildLiveIntegrationContext returns
// undefined and SAGE falls back to task-only context exactly as it did
// before this existed.
//
// Drive has no natural "ambient" content the way Calendar has upcoming
// events or Gmail has an inbox — search requires a query term. So Drive's
// context here is the most recently modified files instead, giving SAGE a
// sense of what Andrew has been working on without needing a search term.
// Firecrawl, Slack, Monday.com, and LinkedIn have no equivalent read-only
// ambient context (query-driven, write-only, or drafting-only) and stay
// chat-invisible.

import type { AuthSession } from "@/lib/auth/server";
import { getIntegration } from "@/lib/command-center/repository";
import { listUpcomingGoogleCalendarEvents } from "@/lib/command-center/integrations/google-calendar";
import { getValidGoogleCalendarAccessToken } from "@/lib/command-center/integrations/google-calendar-token";
import { listRecentGmailMessages } from "@/lib/command-center/integrations/gmail";
import { getValidGmailAccessToken } from "@/lib/command-center/integrations/gmail-token";
import { listRecentGoogleDriveFiles } from "@/lib/command-center/integrations/google-drive";
import { getValidGoogleDriveAccessToken } from "@/lib/command-center/integrations/google-drive-token";

const MAX_CALENDAR_EVENTS = 5;
const MAX_GMAIL_MESSAGES = 5;
const MAX_DRIVE_FILES = 5;

export async function buildCalendarLiveContext(session: AuthSession): Promise<string | null> {
  try {
    const integration = await getIntegration(session, "google_calendar");
    if (!integration || integration.status !== "connected") return null;

    const accessToken = await getValidGoogleCalendarAccessToken(session);
    const events = await listUpcomingGoogleCalendarEvents({ accessToken, maxResults: MAX_CALENDAR_EVENTS });
    if (events.length === 0) {
      return "Read-only Google Calendar context (as of this turn): no upcoming events found.";
    }
    const lines = events.map((event) => `- ${event.start ?? "unscheduled"}: ${event.summary}`);
    return ["Read-only Google Calendar context (as of this turn):", ...lines].join("\n");
  } catch {
    return null;
  }
}

export async function buildGmailLiveContext(session: AuthSession): Promise<string | null> {
  try {
    const integration = await getIntegration(session, "gmail");
    if (!integration || integration.status !== "connected") return null;

    const accessToken = await getValidGmailAccessToken(session);
    const messages = await listRecentGmailMessages({ accessToken, maxResults: MAX_GMAIL_MESSAGES });
    if (messages.length === 0) {
      return "Read-only Gmail triage context (as of this turn): inbox has no recent messages.";
    }
    const lines = messages.map((message) => `- "${message.subject}" from ${message.from} — ${message.snippet}`);
    return ["Read-only Gmail triage context (as of this turn):", ...lines].join("\n");
  } catch {
    return null;
  }
}

export async function buildDriveLiveContext(session: AuthSession): Promise<string | null> {
  try {
    const integration = await getIntegration(session, "google_drive");
    if (!integration || integration.status !== "connected") return null;

    const accessToken = await getValidGoogleDriveAccessToken(session);
    const files = await listRecentGoogleDriveFiles({ accessToken, maxResults: MAX_DRIVE_FILES });
    if (files.length === 0) {
      return "Read-only Google Drive context (as of this turn): no recently modified files found.";
    }
    const lines = files.map((file) => `- ${file.name}${file.modifiedTime ? ` (modified ${file.modifiedTime})` : ""}`);
    return ["Read-only Google Drive context (as of this turn) — recently modified files:", ...lines].join("\n");
  } catch {
    return null;
  }
}

export async function buildLiveIntegrationContext(session: AuthSession): Promise<string | undefined> {
  const [calendar, gmail, drive] = await Promise.all([
    buildCalendarLiveContext(session),
    buildGmailLiveContext(session),
    buildDriveLiveContext(session)
  ]);
  const sections = [calendar, gmail, drive].filter((section): section is string => Boolean(section));
  if (sections.length === 0) return undefined;
  return sections.join("\n\n");
}
