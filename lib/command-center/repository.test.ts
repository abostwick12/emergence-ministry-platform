import { beforeEach, describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import {
  createCaptureEntry,
  createJobApplication,
  createPersonalTask,
  deletePersonalTask,
  getOverview,
  appendConversationMessage,
  listIntegrations,
  listConversationMessages,
  listJobApplications,
  listPersonalTasks,
  listUnprocessedCaptures,
  resolveCaptureEntry,
  updateJobApplication,
  updatePersonalTask
} from "@/lib/command-center/repository";
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
