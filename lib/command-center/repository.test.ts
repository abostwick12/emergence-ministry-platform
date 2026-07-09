import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import {
  createCaptureEntry,
  createJobApplication,
  createPersonalTask,
  deletePersonalTask,
  getDailyBriefing,
  getIntegration,
  getOverview,
  appendConversationMessage,
  listIntegrations,
  listConversationMessages,
  listJobApplications,
  listPersonalTasks,
  listUnprocessedCaptures,
  refreshDailyBriefing,
  resolveCaptureEntry,
  updateIntegration,
  updateJobApplication,
  updatePersonalTask
} from "@/lib/command-center/repository";
import { __resetCommandCenterStoreForTests } from "@/lib/command-center/store";
import { BRIEFING_SOURCES } from "@/lib/command-center/integrations/firecrawl-sources";

function mockSession(): AuthSession {
  return {
    isMock: true,
    user: { id: "usr_andrew", email: "andrew.w.bostwick12@gmail.com", fullName: "Andrew Bostwick", role: "admin" }
  };
}

beforeEach(() => {
  __resetCommandCenterStoreForTests();
});

describe("personal tasks", () => {
  it("lists seeded tasks across all domains in mock mode", async () => {
    const tasks = await listPersonalTasks(mockSession());
    const domains = new Set(tasks.map((task) => task.domain));
    expect(domains).toEqual(new Set(["military_transition", "sotf_fellowship", "job_search", "life"]));
  });

  it("filters tasks by domain and status", async () => {
    const session = mockSession();
    const jobTasks = await listPersonalTasks(session, { domain: "job_search" });
    expect(jobTasks.every((task) => task.domain === "job_search")).toBe(true);

    const blockedTasks = await listPersonalTasks(session, { status: "blocked" });
    expect(blockedTasks.every((task) => task.status === "blocked")).toBe(true);
  });

  it("creates a task and returns it in subsequent listings", async () => {
    const session = mockSession();
    const created = await createPersonalTask(session, {
      domain: "life",
      title: "Test task",
      status: "todo",
      priority: "medium",
      tags: []
    });
    expect(created.id).toBeTruthy();

    const tasks = await listPersonalTasks(session);
    expect(tasks.some((task) => task.id === created.id)).toBe(true);
  });

  it("updates a task's status", async () => {
    const session = mockSession();
    const created = await createPersonalTask(session, {
      domain: "life",
      title: "Mutable task",
      status: "todo",
      priority: "low",
      tags: []
    });

    const updated = await updatePersonalTask(session, created.id, { status: "done" });
    expect(updated?.status).toBe("done");
  });

  it("deletes a task", async () => {
    const session = mockSession();
    const created = await createPersonalTask(session, {
      domain: "life",
      title: "Disposable task",
      status: "todo",
      priority: "low",
      tags: []
    });

    await deletePersonalTask(session, created.id);
    const tasks = await listPersonalTasks(session);
    expect(tasks.some((task) => task.id === created.id)).toBe(false);
  });
});

describe("overview", () => {
  it("computes a today priority from open tasks", async () => {
    const overview = await getOverview(mockSession());
    expect(overview.todayPriority).not.toBeNull();
  });

  it("summarizes tasks per domain", async () => {
    const overview = await getOverview(mockSession());
    for (const domain of ["military_transition", "sotf_fellowship", "job_search", "life"] as const) {
      expect(overview.tasksByDomain[domain].total).toBeGreaterThan(0);
    }
  });

  it("counts job applications with a due or overdue follow-up", async () => {
    const session = mockSession();
    const today = new Date().toISOString().slice(0, 10);
    await createJobApplication(session, { company: "Overdue Co.", role: "Director", status: "applied", nextFollowUpDate: today });

    const overview = await getOverview(session);
    expect(overview.jobFollowUpsDueCount).toBeGreaterThanOrEqual(1);
  });
});

describe("job applications", () => {
  it("creates and updates a job application", async () => {
    const session = mockSession();
    const created = await createJobApplication(session, {
      company: "Acme Corp",
      role: "COO",
      status: "researching"
    });
    expect(created.company).toBe("Acme Corp");

    const updated = await updateJobApplication(session, created.id, { status: "applied" });
    expect(updated?.status).toBe("applied");

    const applications = await listJobApplications(session);
    expect(applications.some((app) => app.id === created.id)).toBe(true);
  });
});

describe("integrations", () => {
  it("returns disconnected planned integrations in mock mode", async () => {
    const integrations = await listIntegrations(mockSession());

    expect(integrations.map((integration) => integration.service)).toEqual([
      "firecrawl",
      "slack",
      "google_calendar",
      "gmail",
      "google_drive",
      "linkedin",
      "monday"
    ]);
    expect(integrations.every((integration) => integration.status === "disconnected")).toBe(true);
  });

  it("gets a single integration by service", async () => {
    const integration = await getIntegration(mockSession(), "google_calendar");
    expect(integration?.service).toBe("google_calendar");
    expect(integration?.status).toBe("disconnected");
  });

  it("returns null for a service with no stored row", async () => {
    const integration = await getIntegration(mockSession(), "gmail");
    expect(integration).not.toBeNull();
  });

  it("updates an integration's status and config, and never leaks config into unrelated services", async () => {
    const session = mockSession();
    const updated = await updateIntegration(session, "google_calendar", {
      status: "connected",
      config: { accessToken: "at", refreshToken: "rt", expiresAt: "2026-01-01T00:00:00.000Z", scope: "calendar.readonly" }
    });
    expect(updated?.status).toBe("connected");
    expect(updated?.config.accessToken).toBe("at");

    const reread = await getIntegration(session, "google_calendar");
    expect(reread?.status).toBe("connected");

    const untouched = await getIntegration(session, "gmail");
    expect(untouched?.status).toBe("disconnected");
    expect(untouched?.config).toEqual({});
  });
});

describe("quick capture", () => {
  it("creates an unprocessed entry and resolves it as processed", async () => {
    const session = mockSession();
    const entry = await createCaptureEntry(session, "Call the VA about claim status");
    expect(entry.status).toBe("unprocessed");

    const unprocessed = await listUnprocessedCaptures(session);
    expect(unprocessed.some((item) => item.id === entry.id)).toBe(true);

    const resolved = await resolveCaptureEntry(session, entry.id, { status: "processed", routedDomain: "military_transition" });
    expect(resolved?.status).toBe("processed");

    const stillUnprocessed = await listUnprocessedCaptures(session);
    expect(stillUnprocessed.some((item) => item.id === entry.id)).toBe(false);
  });
});

describe("SAGE conversations", () => {
  it("persists and lists mock conversation messages in order", async () => {
    const session = mockSession();
    await appendConversationMessage(session, { sessionId: "sage-test", role: "user", content: "What should I focus on?" });
    await appendConversationMessage(session, { sessionId: "sage-test", role: "assistant", content: "Start with the highest-risk deadline." });

    const messages = await listConversationMessages(session, "sage-test");
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(messages[0].content).toContain("focus");
  });
});

describe("daily briefing", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.FIRECRAWL_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = originalApiKey;
  });

  it("falls back to static seed content when Firecrawl is not configured", async () => {
    delete process.env.FIRECRAWL_API_KEY;
    const items = await getDailyBriefing(mockSession());
    expect(items.length).toBeGreaterThan(0);
  });

  it("refuses to refresh without an API key instead of silently no-oping", async () => {
    delete process.env.FIRECRAWL_API_KEY;
    await expect(refreshDailyBriefing(mockSession())).rejects.toThrow();
  });

  it("scrapes every curated source and caches the result for later reads", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { markdown: "# Real content from the source", metadata: { title: "Real Source" } } })
    }) as unknown as typeof fetch;

    const items = await refreshDailyBriefing(mockSession());
    expect(items.length).toBe(BRIEFING_SOURCES.length);
    expect(items[0].title).toBe("Real Source");
    expect(items[0].summary).toContain("Real content from the source");

    const cached = await getDailyBriefing(mockSession());
    expect(cached).toEqual(items);
  });

  it("keeps whatever sources succeed when some scrapes fail", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test-key";
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ success: true, data: { markdown: "content", metadata: { title: "OK" } } }) };
    }) as unknown as typeof fetch;

    const items = await refreshDailyBriefing(mockSession());
    expect(items.length).toBe(BRIEFING_SOURCES.length - 1);
  });

  it("throws instead of caching an empty feed when every source fails", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test-key";
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as unknown as typeof fetch;

    await expect(refreshDailyBriefing(mockSession())).rejects.toThrow("All Firecrawl sources failed");
  });
});
