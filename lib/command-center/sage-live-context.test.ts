import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import type { PersonalIntegration } from "@/lib/command-center/types";
import {
  buildCalendarLiveContext,
  buildDriveLiveContext,
  buildFirecrawlLiveContext,
  buildGmailLiveContext,
  buildLiveIntegrationContext,
  buildMondayLiveContext
} from "@/lib/command-center/sage-live-context";

const getIntegration = vi.fn();
const getDailyBriefing = vi.fn();
const getValidGoogleCalendarAccessToken = vi.fn();
const listUpcomingGoogleCalendarEvents = vi.fn();
const getValidGmailAccessToken = vi.fn();
const listRecentGmailMessages = vi.fn();
const getValidGoogleDriveAccessToken = vi.fn();
const listRecentGoogleDriveFiles = vi.fn();
const listMondayBoards = vi.fn();

vi.mock("@/lib/command-center/repository", () => ({
  getIntegration: (...args: unknown[]) => getIntegration(...args),
  getDailyBriefing: (...args: unknown[]) => getDailyBriefing(...args)
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
vi.mock("@/lib/command-center/integrations/google-drive-token", () => ({
  getValidGoogleDriveAccessToken: (...args: unknown[]) => getValidGoogleDriveAccessToken(...args)
}));
vi.mock("@/lib/command-center/integrations/google-drive", () => ({
  listRecentGoogleDriveFiles: (...args: unknown[]) => listRecentGoogleDriveFiles(...args)
}));
vi.mock("@/lib/command-center/integrations/monday", () => ({
  listMondayBoards: (...args: unknown[]) => listMondayBoards(...args)
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

describe("buildDriveLiveContext", () => {
  it("returns null when Drive is not connected", async () => {
    getIntegration.mockResolvedValue(integration("google_drive", "disconnected"));
    expect(await buildDriveLiveContext(session())).toBeNull();
    expect(getValidGoogleDriveAccessToken).not.toHaveBeenCalled();
  });

  it("formats recently modified files, name and modifiedTime only", async () => {
    getIntegration.mockResolvedValue(integration("google_drive", "connected"));
    getValidGoogleDriveAccessToken.mockResolvedValue("at");
    listRecentGoogleDriveFiles.mockResolvedValue([
      { id: "file_1", name: "SOTF reflection outline", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-07-08T00:00:00.000Z" }
    ]);

    const context = await buildDriveLiveContext(session());
    expect(context).toContain("Read-only Google Drive context");
    expect(context).toContain("SOTF reflection outline");
    expect(context).toContain("2026-07-08T00:00:00.000Z");
  });

  it("reports no recent files plainly instead of an empty section", async () => {
    getIntegration.mockResolvedValue(integration("google_drive", "connected"));
    getValidGoogleDriveAccessToken.mockResolvedValue("at");
    listRecentGoogleDriveFiles.mockResolvedValue([]);

    expect(await buildDriveLiveContext(session())).toContain("no recently modified files found");
  });

  it("returns null (never throws) when the token has expired and cannot be refreshed", async () => {
    getIntegration.mockResolvedValue(integration("google_drive", "connected"));
    getValidGoogleDriveAccessToken.mockRejectedValue(new Error("Google Drive connection expired."));

    await expect(buildDriveLiveContext(session())).resolves.toBeNull();
  });
});

describe("buildFirecrawlLiveContext", () => {
  it("returns null when Firecrawl is not connected", async () => {
    getIntegration.mockResolvedValue(integration("firecrawl", "disconnected"));
    expect(await buildFirecrawlLiveContext(session())).toBeNull();
    expect(getDailyBriefing).not.toHaveBeenCalled();
  });

  it("formats cached briefing items when connected, title/source/summary only", async () => {
    getIntegration.mockResolvedValue(integration("firecrawl", "connected"));
    getDailyBriefing.mockResolvedValue([
      { id: "brief_1", title: "TAP program updates", url: "https://example.com", summary: "New transition dates announced.", source: "DOL", category: "military_transition" }
    ]);

    const context = await buildFirecrawlLiveContext(session());
    expect(context).toContain("Read-only Firecrawl daily resource feed context");
    expect(context).toContain("TAP program updates");
    expect(context).toContain("DOL");
  });

  it("reports no cached resources plainly instead of an empty section", async () => {
    getIntegration.mockResolvedValue(integration("firecrawl", "connected"));
    getDailyBriefing.mockResolvedValue([]);

    expect(await buildFirecrawlLiveContext(session())).toContain("no cached resources found");
  });

  it("returns null (never throws) when the cache read fails", async () => {
    getIntegration.mockResolvedValue(integration("firecrawl", "connected"));
    getDailyBriefing.mockRejectedValue(new Error("cache unavailable"));

    await expect(buildFirecrawlLiveContext(session())).resolves.toBeNull();
  });
});

describe("buildMondayLiveContext", () => {
  it("returns null when Monday.com is not connected", async () => {
    getIntegration.mockResolvedValue(integration("monday", "disconnected"));
    expect(await buildMondayLiveContext(session())).toBeNull();
    expect(listMondayBoards).not.toHaveBeenCalled();
  });

  it("formats board names when connected", async () => {
    getIntegration.mockResolvedValue(integration("monday", "connected"));
    listMondayBoards.mockResolvedValue([{ id: "board_1", name: "Job Search Pipeline" }]);

    const context = await buildMondayLiveContext(session());
    expect(context).toContain("Read-only Monday.com context");
    expect(context).toContain("Job Search Pipeline");
  });

  it("reports no boards plainly instead of an empty section", async () => {
    getIntegration.mockResolvedValue(integration("monday", "connected"));
    listMondayBoards.mockResolvedValue([]);

    expect(await buildMondayLiveContext(session())).toContain("no boards found");
  });

  it("returns null (never throws) when the Monday.com API call fails", async () => {
    getIntegration.mockResolvedValue(integration("monday", "connected"));
    listMondayBoards.mockRejectedValue(new Error("Monday.com boards fetch failed: 500"));

    await expect(buildMondayLiveContext(session())).resolves.toBeNull();
  });
});

describe("buildLiveIntegrationContext", () => {
  it("returns undefined when no integration is connected", async () => {
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
    getValidGoogleDriveAccessToken.mockRejectedValue(new Error("expired"));

    const context = await buildLiveIntegrationContext(session());
    expect(context).not.toContain("Google Calendar");
    expect(context).toContain("Gmail triage context");
  });

  it("joins all five sections when Calendar, Gmail, Drive, Firecrawl, and Monday.com are all connected", async () => {
    getIntegration.mockImplementation(async (_session: AuthSession, service: PersonalIntegration["service"]) =>
      integration(service, "connected")
    );
    getValidGoogleCalendarAccessToken.mockResolvedValue("at");
    listUpcomingGoogleCalendarEvents.mockResolvedValue([{ id: "evt_1", summary: "Fellowship call", start: "2026-07-10T14:00:00Z", isAllDay: false }]);
    getValidGmailAccessToken.mockResolvedValue("at");
    listRecentGmailMessages.mockResolvedValue([
      { id: "msg_1", threadId: "t1", subject: "Important ask", from: "vip@example.com", date: "", snippet: "s", labelIds: [] }
    ]);
    getValidGoogleDriveAccessToken.mockResolvedValue("at");
    listRecentGoogleDriveFiles.mockResolvedValue([
      { id: "file_1", name: "SOTF reflection outline", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-07-08T00:00:00.000Z" }
    ]);
    getDailyBriefing.mockResolvedValue([
      { id: "brief_1", title: "TAP program updates", url: "https://example.com", summary: "New transition dates announced.", source: "DOL", category: "military_transition" }
    ]);
    listMondayBoards.mockResolvedValue([{ id: "board_1", name: "Job Search Pipeline" }]);

    const context = await buildLiveIntegrationContext(session());
    expect(context).toContain("Google Calendar context");
    expect(context).toContain("Gmail triage context");
    expect(context).toContain("Google Drive context");
    expect(context).toContain("SOTF reflection outline");
    expect(context).toContain("Firecrawl daily resource feed context");
    expect(context).toContain("TAP program updates");
    expect(context).toContain("Monday.com context");
    expect(context).toContain("Job Search Pipeline");
  });
});
