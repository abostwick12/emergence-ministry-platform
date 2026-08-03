import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { MinistryOverview } from "@/lib/data/ministry-repository";
import {
  buildAuthenticatedMinistryNarrativeById,
  buildAuthenticatedMinistryNarratives,
  type AuthenticatedMinistryNarrativeContext
} from "@/lib/ministry/authenticated-narratives";
import type { ActiveTask, MinistryEvent, User } from "@/lib/types";

const now = new Date("2026-08-02T12:00:00.000Z");

describe("authenticated Ministry Hub narratives", () => {
  it("does not import guest fixtures or guest narrative context", () => {
    const source = readFileSync(join(process.cwd(), "lib/ministry/authenticated-narratives.ts"), "utf8");
    const repositorySource = readFileSync(join(process.cwd(), "lib/ministry/narrative-repository.ts"), "utf8");
    expect(`${source}\n${repositorySource}`).not.toMatch(/@\/lib\/guest|guest fixture|buildLeadEmergenceDemoContext/);
  });

  it("builds eight deterministic, ranked record-backed narratives without guest fixture content", () => {
    const context = fullContext();
    const first = buildAuthenticatedMinistryNarratives(context, now);
    const second = buildAuthenticatedMinistryNarratives(context, now);

    expect(first).toEqual(second);
    expect(first).toHaveLength(8);
    expect(first.every((item) => item.status === "supported")).toBe(true);
    expect(new Set(first.map((item) => item.id))).toEqual(new Set([
      "participation-rhythm", "participation-continuity", "shared-responsibility", "operational-follow-through",
      "volunteer-serving-rhythm", "volunteer-readiness", "relational-capacity", "relational-coverage"
    ]));

    const rendered = JSON.stringify(first);
    expect(rendered).not.toMatch(/guest_|Mason Bridge|Eli Fable|Marcus Bright|MS 6th Grade North/);
    expect(rendered).not.toMatch(/student-alpha|student-beta|student-gamma|student-delta/);
  });

  it("aggregates participation into early and recent windows without exposing people", () => {
    const narrative = buildAuthenticatedMinistryNarrativeById("participation-rhythm", fullContext(), now);

    expect(narrative.status).toBe("supported");
    expect(narrative.whatChanged).toContain("10 to 12");
    expect(narrative.evidence[0]?.calculation).toContain("distinct Planning Center person references");
    expect(JSON.stringify(narrative.evidence)).not.toContain("student-alpha");
  });

  it("describes ownership as record counts rather than effort or burnout", () => {
    const narrative = buildAuthenticatedMinistryNarrativeById("shared-responsibility", fullContext(), now);

    expect(narrative.status).toBe("supported");
    expect(narrative.headline).toContain("Alex Walker");
    expect(narrative.evidence[0]?.explanation).toContain("counted equally as visible ownership records");
    expect(narrative.unknowns.join(" ")).toContain("cannot establish burnout");
  });

  it("uses dated volunteer assignments and current group membership without claiming growth", () => {
    const context = fullContext();
    const serving = buildAuthenticatedMinistryNarrativeById("volunteer-serving-rhythm", context, now);
    const capacity = buildAuthenticatedMinistryNarrativeById("relational-capacity", context, now);

    expect(serving.status).toBe("supported");
    expect(serving.whatChanged).toContain("Jordan Leader");
    expect(capacity.status).toBe("supported");
    expect(capacity.whatChanged).toContain("12 linked memberships");
    expect(`${capacity.headline} ${capacity.whatChanged}`).not.toMatch(/grew|growing|growth/i);
  });

  it("turns disconnected, stale, sparse, and unavailable sources into explicit evidence gaps", () => {
    const sparse = fullContext();
    sparse.overview.events = [];
    sparse.overview.tasks = [];
    sparse.planningCenter.connectionStatus = "disconnected";
    sparse.planningCenter.lastSyncAt = undefined;
    sparse.planningCenter.attendance = [];
    sparse.planningCenter.peopleAvailable = false;
    sparse.planningCenter.people = [];
    sparse.volunteerHub = { available: false, assignmentsAvailable: false, groupsAvailable: false, readinessAvailable: false, followUpsAvailable: false, leaders: [], groups: [], members: [], assignments: [], requiredItems: [], itemProgress: [], followUps: [] };

    const gaps = buildAuthenticatedMinistryNarratives(sparse, now);
    expect(gaps.every((item) => item.status === "insufficient_evidence")).toBe(true);
    expect(gaps.every((item) => item.evidence.length === 0)).toBe(true);
    expect(gaps.map((item) => item.whatChanged).join(" ")).not.toMatch(/sample|guest_|Mason|Eli|Marcus/);

    const stale = fullContext();
    stale.planningCenter.lastSyncAt = "2026-05-01T00:00:00.000Z";
    expect(buildAuthenticatedMinistryNarrativeById("participation-rhythm", stale, now)).toMatchObject({
      status: "insufficient_evidence",
      action: { href: "/settings" }
    });
  });
});

function fullContext(): AuthenticatedMinistryNarrativeContext {
  const users: User[] = [
    { id: "user-alex", firstName: "Alex", lastName: "Walker", email: "alex@example.com", role: "admin" },
    { id: "user-riley", firstName: "Riley", lastName: "Stone", email: "riley@example.com", role: "leader" }
  ];
  const events: MinistryEvent[] = [
    event("event-1", "Sunday Gathering", "2026-06-07", "user-alex"),
    event("event-2", "Serve Night", "2026-06-14", "user-alex"),
    event("event-3", "Student Worship", "2026-06-21", "user-riley"),
    event("event-4", "Leader Lab", "2026-06-28", "user-riley")
  ];
  const tasks: ActiveTask[] = [
    task("task-1", "Prepare room", "event-1", "user-alex", "2026-06-06"),
    task("task-2", "Review leader notes", "event-2", "user-alex", "2026-06-13"),
    task("task-3", "Confirm volunteers", "event-3", "user-riley", "2026-06-20"),
    task("task-4", "Preview communication", "event-4", "user-riley", "2026-06-27")
  ];

  return {
    overview: { events, tasks, users, expenses: [], activity: [] } satisfies MinistryOverview,
    planningCenter: {
      available: true,
      peopleAvailable: true,
      syncHistoryAvailable: true,
      connectionStatus: "connected",
      lastSyncAt: "2026-08-01T10:00:00.000Z",
      attendance: attendanceRecords(),
      people: Array.from({ length: 12 }, (_, index) => ({ externalPersonId: `student-${index}`, grade: index < 6 ? "7" : "8", ageBand: "middle_school", lastSyncedAt: "2026-08-01T10:00:00.000Z" })),
      syncRuns: [{ status: "succeeded", peopleCount: 12, attendanceCount: 88, startedAt: "2026-08-01T09:00:00.000Z", completedAt: "2026-08-01T10:00:00.000Z" }]
    },
    volunteerHub: {
      available: true,
      assignmentsAvailable: true,
      groupsAvailable: true,
      readinessAvailable: true,
      followUpsAvailable: true,
      leaders: [
        { id: "leader-jordan", profileUserId: "user-alex", name: "Jordan Leader", roleLabel: "Leader", servingAreas: ["Students"], availability: "Sundays", skills: ["Groups"], backgroundCheckExpires: "2027-01-01" },
        { id: "leader-casey", profileUserId: "user-riley", name: "Casey Guide", roleLabel: "Volunteer", servingAreas: ["Students"], availability: "Sundays", skills: ["Welcome"], backgroundCheckExpires: "2027-02-01" }
      ],
      groups: [
        { id: "group-one", name: "Middle School Group", leaderId: "leader-jordan", coLeaderId: "leader-casey", serviceTime: "Sunday" }
      ],
      members: Array.from({ length: 12 }, (_, index) => ({ groupId: "group-one", studentSource: "planning_center" as const, studentRefId: `student-${index}`, createdAt: "2026-06-01" })),
      assignments: [
        { eventId: "event-1", leaderId: "leader-jordan", createdAt: "2026-05-01" },
        { eventId: "event-2", leaderId: "leader-jordan", createdAt: "2026-05-02" },
        { eventId: "event-3", leaderId: "leader-jordan", createdAt: "2026-05-03" },
        { eventId: "event-4", leaderId: "leader-casey", createdAt: "2026-05-04" }
      ],
      requiredItems: [{ id: "training-one", itemType: "training", title: "Safe ministry training", dueDate: "2026-07-01", required: true, blocksStudentContact: true }],
      itemProgress: [
        { itemId: "training-one", userId: "user-alex", completed: true, completedAt: "2026-06-01" },
        { itemId: "training-one", userId: "user-riley", completed: true, completedAt: "2026-06-02" }
      ],
      followUps: []
    }
  };
}

function attendanceRecords() {
  const weeks = ["2026-06-07", "2026-06-14", "2026-06-21", "2026-06-28", "2026-07-05", "2026-07-12", "2026-07-19", "2026-07-26"];
  return weeks.flatMap((date, weekIndex) => {
    const people = Array.from({ length: weekIndex < 4 ? 10 : 12 }, (_, index) => `student-${index}`);
    return people.map((externalPersonId, personIndex) => ({
      id: `attendance-${weekIndex}-${personIndex}`,
      externalPersonId,
      externalEventId: `pc-event-${weekIndex}`,
      sessionLabel: "Sunday Students",
      locationLabel: "Student Center",
      checkedInAt: `${date}T09:00:00.000Z`
    }));
  });
}

function event(id: string, title: string, date: string, contactOwnerId: string): MinistryEvent {
  return {
    id,
    title,
    description: `${title} description`,
    type: "other",
    startTime: `${date}T09:00:00.000Z`,
    endTime: `${date}T10:00:00.000Z`,
    status: "planning",
    contactOwnerId,
    autoGeneratedTimeline: [],
    createdAt: "2026-05-01T00:00:00.000Z"
  };
}

function task(id: string, taskTitle: string, eventId: string, assignedUserId: string, dueDate: string): ActiveTask {
  return {
    id,
    eventId,
    taskTitle,
    dueDate,
    assignedUserId,
    status: "todo",
    autoGenerated: false,
    timelineOffsetDays: 0
  };
}
