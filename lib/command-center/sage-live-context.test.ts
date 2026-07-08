import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import type { PersonalIntegration } from "@/lib/command-center/types";
import { buildCalendarLiveContext, buildGmailLiveContext, buildLiveIntegrationContext } from "@/lib/command-center/sage-live-context";

const getIntegration = vi.fn();
const getValidGoogleCalendarAccessToken = vi.fn();
const listUpcomingGoogleCalendarEvents = vi.fn();
const getValidGmailAccessToken = vi.fn();
const listRecentGmailMessages = vi.fn();

vi.mock("@/lib/command-center/repository", () => ({
  getIntegration: (...args: unknown[]) => getIntegration(...args)
}));
vi.mock("@/lib/command-center/integrations/google-calendar-token", () => ({
  getValidGoogleCalendarAccessToken: (...args: unknown[]) => getValidGoogleCalendarAccessToken(...args)
}));
vi.mock("@/lib/command-center/integrations/google-calendar", () => ({
  listUpcomingGoogleCalendarEvents: (...args: unknown[]) => listUpcomingGoogleCalendarEvents(...args)
}));
vi.mock("@/lib/command-center/integrations/gmail-token", () => ({
  getValidGmailAccessToken: (...args: unknown[]) => getValidGmailAccessToken(...args)
}));
vi.mock("@/lib/command-center/integrations/gmail", () => ({
  listRecentGmailMessages: (...args: unknown[]) => listRecentGmailMessages(...args)
}));

function session(): AuthSession {
  return { isMock: true, user: { id: "usr_andrew", email: "andrew.w.bostwick12@gmail.com", fullName: "Andrew Bostwick", role: "admin" } };
}

function integration(service: PersonalIntegration["service"], status: PersonalIntegration["status"]): PersonalIntegration {
  return { id: "int_1", service, status, config: {} };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildCalendarLiveContext", () => {
  it("returns null when Calendar is not connected", async () => {
    getIntegration.mockResolvedValue(integration("google_calendar", "disconnected"));
    expect(await buildCalendarLiveContext(session())).toBeNull();
    expect(getValidGoogleCalendarAccessToken).not.toHaveBeenCalled();
  });

  it("formats upcoming events when connected", async () => {
    getIntegration.mockResolvedValue(integration("google_calendar", "connected"));
    getValidGoogleCalendarAccessToken.mockResolvedValue("at");
    listUpcomingGoogleCalendarEvents.mockResolvedValue([{ id: "evt_1", summary: "Fellowship call", start: "2026-07-10T14:00:00Z", isAllDay: false }]);

    const context = await buildCalendarLiveContext(session());
    expect(context).toContain("Read-only Google Calendar context");
    expect(context).toContain("Fellowship call");
  });

  it("reports no upcoming events plainly instead of an empty section", async () => {
    getIntegration.mockResolvedValue(integration("google_calendar", "connected"));
    getValidGoogleCalendarAccessToken.mockResolvedValue("at");
    listUpcomingGoogleCalendarEvents.mockResolvedValue([]);

    expect(await buildCalendarLiveContext(session())).toContain("no upcoming events found");
  });

  it("returns null (never throws) when the token has expired and cannot be refreshed", async () => {
    getIntegration.mockResolvedValue(integration("google_calendar", "connected"));
    getValidGoogleCalendarAccessToken.mockRejectedValue(new Error("Google Calendar connection expired."));

    await expect(buildCalendarLiveContext(session())).resolves.toBeNull();
  });
});

describe("buildGmailLiveContext", () => {
  it("returns null when Gmail is not connected", async () => {
    getIntegration.mockResolvedValue(integration("gmail", "disconnected"));
    expect(await buildGmailLiveContext(session())).toBeNull();
    expect(getValidGmailAccessToken).not.toHaveBeenCalled();
  });

  it("formats recent messages when connected, subject/from/snippet only", async () => {
    getIntegration.mockResolvedValue(integration("gmail", "connected"));
    getValidGmailAccessToken.mockResolvedValue("at");
    listRecentGmailMessages.mockResolvedValue([
      { id: "msg_1", threadId: "t1", subject: "Fellowship reflection", from: "mentor@example.com", date: "", snippet: "Quick check-in", labelIds: [] }
    ]);

    const context = await buildGmailLiveContext(session());
    expect(context).toContain("Read-only Gmail triage context");
    expect(context).toContain("Fellowship reflection");
    expect(context).toContain("mentor@example.com");
  });
});

describe("buildLiveIntegrationContext", () => {
  it("returns undefined when neither integration is connected", async () => {
    getIntegration.mockResolvedValue(null);
    expect(await buildLiveIntegrationContext(session())).toBeUndefined();
  });

  it("isolates a Calendar failure from a working Gmail context", async () => {
    getIntegration.mockImplementation(async (_session: AuthSession, service: PersonalIntegration["service"]) =>
      integration(service, "connected")
    );
    getValidGoogleCalendarAccessToken.mockRejectedValue(new Error("expired"));
    getValidGmailAccessToken.mockResolvedValue("at");
    listRecentGmailMessages.mockResolvedValue([
      { id: "msg_1", threadId: "t1", subject: "Important ask", from: "vip@example.com", date: "", snippet: "s", labelIds: [] }
    ]);

    const context = await buildLiveIntegrationContext(session());
    expect(context).not.toContain("Google Calendar");
    expect(context).toContain("Gmail triage context");
  });

  it("joins both sections when both integrations are connected", async () => {
    getIntegration.mockImplementation(async (_session: AuthSession, service: PersonalIntegration["service"]) =>
      integration(service, "connected")
    );
    getValidGoogleCalendarAccessToken.mockResolvedValue("at");
    listUpcomingGoogleCalendarEvents.mockResolvedValue([{ id: "evt_1", summary: "Fellowship call", start: "2026-07-10T14:00:00Z", isAllDay: false }]);
    getValidGmailAccessToken.mockResolvedValue("at");
    listRecentGmailMessages.mockResolvedValue([
      { id: "msg_1", threadId: "t1", subject: "Important ask", from: "vip@example.com", date: "", snippet: "s", labelIds: [] }
    ]);

    const context = await buildLiveIntegrationContext(session());
    expect(context).toContain("Google Calendar context");
    expect(context).toContain("Gmail triage context");
  });
});
