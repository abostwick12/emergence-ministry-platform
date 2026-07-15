import type { ActiveTask, MinistryEvent, User } from "@/lib/types";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";

export type AttentionTone = "neutral" | "info" | "gold" | "warning" | "critical" | "success";

export type DashboardAttentionItem = {
  id: string;
  title: string;
  summary: string;
  meta?: string;
  href: string;
  tone: AttentionTone;
};

export type DashboardAttention = {
  decisions: DashboardAttentionItem[];
  people: DashboardAttentionItem[];
  eventReadiness: DashboardAttentionItem[];
  emma: DashboardAttentionItem[];
  studentCare: { available: boolean; message: string };
};

type OverviewInput = {
  events: MinistryEvent[];
  tasks: ActiveTask[];
  users: User[];
};

export function buildDashboardAttention(
  overview: OverviewInput,
  discussion: DiscussionWorkflowState | null,
  now = new Date()
): DashboardAttention {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfWeek = startOfToday + 7 * 24 * 60 * 60 * 1000;
  const eventById = new Map(overview.events.map((event) => [event.id, event]));
  const userById = new Map(overview.users.map((user) => [user.id, user]));

  const decisions = overview.tasks
    .filter((task) => task.status !== "done")
    .flatMap<DashboardAttentionItem>((task) => {
      const due = new Date(task.dueDate).getTime();
      const isOverdue = Number.isFinite(due) && due < startOfToday;
      const needsAttention = task.status === "blocked" || isOverdue || due <= endOfWeek;
      if (!needsAttention) return [];
      const event = eventById.get(task.eventId);
      const owner = userById.get(task.assignedUserId);
      const ownerName = owner ? `${owner.firstName} ${owner.lastName}` : "Unassigned";
      const tone: AttentionTone = task.status === "blocked" ? "critical" : isOverdue ? "warning" : "gold";
      const state = task.status === "blocked" ? "Blocked" : isOverdue ? "Overdue" : "Due within seven days";
      return [{
        id: task.id,
        title: task.taskTitle,
        summary: `${state}${event ? ` for ${event.title}` : ""}.`,
        meta: `${ownerName} · ${formatDate(task.dueDate)}`,
        href: "/tasks",
        tone
      }];
    })
    .sort((first, second) => toneRank(first.tone) - toneRank(second.tone))
    .slice(0, 6);

  const eventReadiness = [...overview.events]
    .filter((event) => new Date(event.startTime).getTime() >= startOfToday)
    .sort((first, second) => new Date(first.startTime).getTime() - new Date(second.startTime).getTime())
    .slice(0, 4)
    .map((event) => {
      const tasks = overview.tasks.filter((task) => task.eventId === event.id);
      const blocked = tasks.filter((task) => task.status === "blocked").length;
      const open = tasks.filter((task) => task.status !== "done").length;
      const contextGaps = [event.location, event.targetGroup, event.contactOwnerId].filter((value) => !value).length;
      const tone: AttentionTone = blocked ? "critical" : open ? "info" : "success";
      const summary = blocked
        ? `${blocked} blocked task${blocked === 1 ? "" : "s"} need a decision before the event can move cleanly.`
        : open
          ? `${open} open task${open === 1 ? "" : "s"} remain in the current plan.`
          : "The tracked task plan is complete.";
      return {
        id: event.id,
        title: event.title,
        summary,
        meta: `${formatDate(event.startTime)}${contextGaps ? ` · ${contextGaps} planning detail${contextGaps === 1 ? "" : "s"} still open` : " · Core planning details present"}`,
        href: "/events",
        tone
      };
    });

  const carePrompts = discussion?.prompts.filter(
    (prompt) => prompt.safetyLabel === "needs_leader_care" || prompt.safetyLabel === "pastoral_escalation"
  ) ?? [];
  const people = carePrompts.slice(0, 5).map((prompt) => ({
    id: prompt.id,
    title: prompt.submittedByName.trim() || prompt.submittedByEmail,
    summary: prompt.safetyLabel === "pastoral_escalation"
      ? "Pastoral escalation is waiting for leader review."
      : "A student-care signal is waiting for leader review.",
    meta: `${prompt.scriptureReference || "Student question"} · ${formatDate(prompt.createdAt)}`,
    href: "/discipleship",
    tone: prompt.safetyLabel === "pastoral_escalation" ? "critical" as const : "warning" as const
  }));

  const studentCareAvailable = discussion !== null;
  return {
    decisions,
    people,
    eventReadiness,
    emma: [
      {
        id: "task-triage",
        title: "Triage ministry work",
        summary: `${decisions.length} current item${decisions.length === 1 ? "" : "s"} can be summarized into a follow-up brief.`,
        href: "/tasks",
        tone: decisions.length ? "info" : "success"
      },
      {
        id: "event-readiness",
        title: "Interpret event readiness",
        summary: `${eventReadiness.length} upcoming event${eventReadiness.length === 1 ? "" : "s"} have production-backed readiness context.`,
        href: "/events",
        tone: "gold"
      },
      {
        id: "student-care",
        title: "Prepare a care brief",
        summary: studentCareAvailable
          ? `${people.length} student-care signal${people.length === 1 ? "" : "s"} are available for human review.`
          : "Student-care signals are unavailable; ministry operations remain available.",
        href: "/discipleship",
        tone: studentCareAvailable ? "info" : "neutral"
      }
    ],
    studentCare: {
      available: studentCareAvailable,
      message: studentCareAvailable
        ? discussion.readiness.message
        : "Student-care signals are temporarily unavailable. Event and task operations are unaffected."
    }
  };
}

function toneRank(tone: AttentionTone) {
  return { critical: 0, warning: 1, gold: 2, info: 3, neutral: 4, success: 5 }[tone];
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString([], { month: "short", day: "numeric" });
}
