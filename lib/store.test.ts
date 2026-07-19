import { describe, expect, it } from "vitest";
import { DEFAULT_MINISTRY_ID } from "@/lib/ministry/constants";
import { createEvent, createTask, listActivity, listEvents, listTasks, listUsers } from "@/lib/store";

// Mock/Stub Mode is the deterministic path used by local dev and Playwright.
// These tests verify every seeded and newly created record carries the default
// ministry scope. Cross-ministry isolation itself is enforced by Postgres RLS
// (see supabase/migrations/005_ministry_scope.sql) and is exercised against a
// real Supabase project rather than the in-memory store.

describe("mock store ministry scope", () => {
  it("scopes all seeded profiles to the default ministry", () => {
    const users = listUsers();
    expect(users.length).toBeGreaterThan(0);
    for (const user of users) {
      expect(user.ministryId).toBe(DEFAULT_MINISTRY_ID);
    }
  });

  it("scopes all seeded events to the default ministry", () => {
    const events = listEvents();
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.ministryId).toBe(DEFAULT_MINISTRY_ID);
    }
  });

  it("scopes generated tasks to the default ministry", () => {
    const tasks = listTasks();
    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      expect(task.ministryId).toBe(DEFAULT_MINISTRY_ID);
    }
  });

  it("scopes activity log entries to the default ministry", () => {
    const activity = listActivity();
    expect(activity.length).toBeGreaterThan(0);
    for (const entry of activity) {
      expect(entry.ministryId).toBe(DEFAULT_MINISTRY_ID);
    }
  });

  it("assigns ministry scope when creating a new event, its tasks, and activity", () => {
    const workspace = createEvent({
      title: "Scope Test Event",
      description: "Ensures new events are scoped.",
      type: "small_group_gathering",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString()
    });

    expect(workspace?.event.ministryId).toBe(DEFAULT_MINISTRY_ID);
    expect(workspace?.tasks.length ?? 0).toBeGreaterThan(0);
    for (const task of workspace?.tasks ?? []) {
      expect(task.ministryId).toBe(DEFAULT_MINISTRY_ID);
    }

    const created = listActivity().find(
      (entry) => entry.eventId === workspace?.event.id && entry.type === "event_created"
    );
    expect(created?.ministryId).toBe(DEFAULT_MINISTRY_ID);
  });

  it("assigns ministry scope when creating a new task", () => {
    const event = listEvents()[0];
    const task = createTask({
      eventId: event.id,
      taskTitle: "Scope Test Task",
      dueDate: new Date().toISOString(),
      assignedUserId: listUsers()[0].id
    });

    expect(task.ministryId).toBe(DEFAULT_MINISTRY_ID);
  });
});
