// Assembles read-only live integration context for SAGE chat: upcoming
// Google Calendar events and recent Gmail triage, only when each
// integration is actually connected. This is the only place SAGE chat
// touches an integration — it never writes anything and never triggers any
// integration action, the same read-only guarantee every integration
// module already enforces on its own.
//
// Each integration's fetch is isolated and best-effort: a failure or
// disconnection on one (expired token, network error, not connected) never
// blocks the other or the overall chat turn. If neither integration is
// connected or both fail, buildLiveIntegrationContext returns undefined and
// SAGE falls back to task-only context exactly as it did before this
// existed.

import type { AuthSession } from "@/lib/auth/server";
import { getIntegration } from "@/lib/command-center/repository";
import { listUpcomingGoogleCalendarEvents } from "@/lib/command-center/integrations/google-calendar";
import { getValidGoogleCalendarAccessToken } from "@/lib/command-center/integrations/google-calendar-token";
import { listRecentGmailMessages } from "@/lib/command-center/integrations/gmail";
import { getValidGmailAccessToken } from "@/lib/command-center/integrations/gmail-token";

const MAX_CALENDAR_EVENTS = 5;
const MAX_GMAIL_MESSAGES = 5;

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

export async function buildLiveIntegrationContext(session: AuthSession): Promise<string | undefined> {
  const [calendar, gmail] = await Promise.all([buildCalendarLiveContext(session), buildGmailLiveContext(session)]);
  const sections = [calendar, gmail].filter((section): section is string => Boolean(section));
  if (sections.length === 0) return undefined;
  return sections.join("\n\n");
}
