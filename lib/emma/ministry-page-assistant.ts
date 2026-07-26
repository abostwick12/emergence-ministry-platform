import type { ActiveTask, ActivityLog, EventExpense, MinistryEvent, User } from "@/lib/types";
import { defaultMinistryAlignmentProfile, type MinistryAlignmentProfile } from "@/lib/ministry/alignment";
import { money } from "@/lib/utils";

export type MinistryEmmaPage =
  | "dashboard"
  | "events"
  | "tasks"
  | "communications"
  | "people"
  | "budget"
  | "settings"
  | "files"
  | "worship";

export type MinistryEmmaOverview = {
  events: MinistryEvent[];
  tasks: ActiveTask[];
  users: User[];
  expenses: EventExpense[];
  activity: ActivityLog[];
};

export type MinistryEmmaResponse = {
  summary: string;
  points: string[];
  nextActions: string[];
};

export const ministryEmmaPageLabels: Record<MinistryEmmaPage, string> = {
  dashboard: "Dashboard",
  events: "Events",
  tasks: "Tasks",
  communications: "Communications",
  people: "People",
  budget: "Budget",
  settings: "Settings",
  files: "Files",
  worship: "Worship"
};

export const ministryEmmaUniversalPromptTemplates = [
  "Help me think through a ministry decision.",
  "What should our team prioritize this week?",
  "Where could we simplify without losing the ministry purpose?"
] as const;

export const ministryEmmaPromptTemplates: Record<MinistryEmmaPage, string[]> = {
  dashboard: ["What needs attention today?", "Summarize selected event", "Where are the workflow gaps?"],
  events: ["Summarize selected event", "What event information is missing?", "What should I open first?"],
  tasks: ["Which tasks need follow-up?", "Where is work blocked?", "Summarize selected event"],
  communications: ["Which drafts need review?", "What cannot be sent yet?", "Summarize selected event"],
  people: ["Who is carrying the most work?", "Where are coverage gaps?", "What needs reassignment?"],
  budget: ["Where are budget risks?", "What costs need review?", "Summarize selected event"],
  settings: ["What is live or protected?", "What should stay preview-only?", "Check EMMA review posture"],
  files: ["What file areas are planned?", "What should stay preview-only?", "Where would Drive help later?"],
  worship: ["What needs rehearsal attention?", "Which messages stay preview-only?", "What is ready for slides?"]
};

export function answerMinistryEmmaPrompt({
  alignmentProfile,
  overview,
  page,
  prompt,
  staticSignals = []
}: {
  alignmentProfile?: MinistryAlignmentProfile;
  overview?: MinistryEmmaOverview;
  page: MinistryEmmaPage;
  prompt: string;
  staticSignals?: string[];
}): MinistryEmmaResponse {
  const normalizedPrompt = prompt.toLowerCase();
  const profile = alignmentProfile ?? defaultMinistryAlignmentProfile;
  if (!overview) {
    return answerStaticPage(page, staticSignals);
  }

  if (page === "dashboard" || isAlignmentPrompt(normalizedPrompt)) {
    return answerAlignment(overview, profile, normalizedPrompt);
  }

  if (page === "files") {
    return answerFiles();
  }

  if (page === "worship") {
    return answerWorship();
  }

  if (page === "budget" || normalizedPrompt.includes("budget") || normalizedPrompt.includes("cost")) {
    return answerBudget(overview);
  }

  if (page === "people" || normalizedPrompt.includes("coverage") || normalizedPrompt.includes("reassign") || normalizedPrompt.includes("workload")) {
    return answerPeople(overview);
  }

  if (page === "tasks" || normalizedPrompt.includes("task") || normalizedPrompt.includes("blocked") || normalizedPrompt.includes("follow-up")) {
    return answerTasks(overview);
  }

  if (page === "communications" || normalizedPrompt.includes("draft") || normalizedPrompt.includes("send") || normalizedPrompt.includes("communication")) {
    return answerCommunications(overview);
  }

  if (page === "settings" || normalizedPrompt.includes("protected") || normalizedPrompt.includes("preview-only") || normalizedPrompt.includes("review posture")) {
    return answerSettings(overview);
  }

  return answerDashboard(overview);
}

export function shouldRunAuditedEventSummary(prompt: string): boolean {
  const normalizedPrompt = prompt.toLowerCase();
  return (
    normalizedPrompt.includes("summarize selected event") ||
    normalizedPrompt.includes("event summary") ||
    normalizedPrompt.includes("audited summary")
  );
}

export function selectDefaultEmmaEvent(events: MinistryEvent[]): MinistryEvent | null {
  const now = Date.now();
  return (
    [...events]
      .filter((event) => new Date(event.startTime).getTime() >= now)
      .sort((first, second) => new Date(first.startTime).getTime() - new Date(second.startTime).getTime())[0] ??
    [...events].sort((first, second) => new Date(second.startTime).getTime() - new Date(first.startTime).getTime())[0] ??
    null
  );
}

function answerDashboard(overview: MinistryEmmaOverview): MinistryEmmaResponse {
  const upcomingEvents = upcoming(overview.events);
  const dueSoon = dueWithinDays(overview.tasks, 7).filter((task) => task.status !== "done");
  const blocked = overview.tasks.filter((task) => task.status === "blocked");
  const communicationGaps = overview.events.filter((event) => missingCommunicationFields(event).length > 0);

  return {
    summary: `EMMA sees ${upcomingEvents.length} upcoming events, ${dueSoon.length} tasks due soon, and ${blocked.length} blocked tasks.`,
    points: [
      communicationGaps.length
        ? `${communicationGaps.length} event${plural(communicationGaps.length)} still need communication fields before drafts are useful.`
        : "Communication source fields look ready for the events currently visible.",
      blocked.length
        ? `${blocked[0].taskTitle} is the first blocked task to resolve.`
        : "No blocked tasks are visible in this workspace.",
      upcomingEvents[0] ? `${upcomingEvents[0].title} is the next event on the calendar.` : "No upcoming event is currently scheduled."
    ],
    nextActions: ["Open the next event card.", "Resolve blocked task owners.", "Run an audited event summary for deeper context."]
  };
}

function answerAlignment(overview: MinistryEmmaOverview, profile: MinistryAlignmentProfile, normalizedPrompt: string): MinistryEmmaResponse {
  const upcomingEvents = upcoming(overview.events);
  const openTasks = overview.tasks.filter((task) => task.status !== "done");
  const blocked = openTasks.filter((task) => task.status === "blocked");
  const communicationGaps = overview.events.filter((event) => missingCommunicationFields(event).length > 0);
  const criterion = selectAlignmentCriterion(profile, normalizedPrompt);
  const eventLine = upcomingEvents[0] ? `${upcomingEvents[0].title} is the next visible event.` : "No upcoming event is visible.";
  const observableSignal = `${upcomingEvents.length} upcoming events, ${openTasks.length} open tasks, ${blocked.length} blocked tasks, and ${communicationGaps.length} event communication gaps are visible in the current overview.`;

  return {
    summary: `Leadership stated: ${criterion} Current observable signal: ${observableSignal}`,
    points: [
      `Evidence: ${eventLine} The snapshot includes event, task, budget, activity, and approved Scripture-flow boundaries available to this page.`,
      "Interpretation: EMMA can compare the evidence with leadership-authored criteria, but this is not a verdict or priority ranking.",
      "Evidence limit: spiritual maturity, love for Christ, and the work of the Holy Spirit cannot be measured directly by this data."
    ],
    nextActions: [
      "Review visible signals before changing direction.",
      "Name what evidence is missing or mixed.",
      "Take the question into leadership prayer and discussion."
    ]
  };
}

function isAlignmentPrompt(normalizedPrompt: string): boolean {
  return /\b(alignment|vision|mission|values|season|success|evidence|signals|consistent|priority|priorities|discernment)\b/.test(normalizedPrompt);
}

function selectAlignmentCriterion(profile: MinistryAlignmentProfile, normalizedPrompt: string): string {
  if (normalizedPrompt.includes("vision")) return profile.vision;
  if (normalizedPrompt.includes("mission")) return profile.mission;
  if (normalizedPrompt.includes("value")) return profile.values[0]?.title ?? profile.mission;
  if (normalizedPrompt.includes("season")) return `${profile.currentSeason.title}: ${profile.currentSeason.description}`;
  return profile.successLooksLike[0] ?? profile.mission;
}

function answerTasks(overview: MinistryEmmaOverview): MinistryEmmaResponse {
  const openTasks = overview.tasks.filter((task) => task.status !== "done");
  const blocked = openTasks.filter((task) => task.status === "blocked");
  const overdue = overview.tasks.filter((task) => task.status !== "done" && new Date(task.dueDate).getTime() < startOfToday().getTime());
  const unassigned = openTasks.filter((task) => !overview.users.some((user) => user.id === task.assignedUserId));

  return {
    summary: `EMMA found ${openTasks.length} open tasks, including ${blocked.length} blocked and ${overdue.length} overdue.`,
    points: [
      blocked[0] ? `Start with blocked task: ${blocked[0].taskTitle}.` : "No blocked task is visible.",
      overdue[0] ? `Oldest overdue task: ${overdue[0].taskTitle}.` : "No overdue open tasks are visible.",
      unassigned.length ? `${unassigned.length} task${plural(unassigned.length)} need a known profile owner.` : "Task ownership is mapped to known profiles."
    ],
    nextActions: ["Filter to stuck work.", "Assign owner gaps.", "Break the oldest overdue item into a clear next step."]
  };
}

function answerCommunications(overview: MinistryEmmaOverview): MinistryEmmaResponse {
  const upcomingEvents = upcoming(overview.events);
  const needsReview = upcomingEvents
    .map((event) => ({ event, missing: missingCommunicationFields(event) }))
    .filter((item) => item.missing.length > 0);
  const ownerGaps = upcomingEvents.filter((event) => !event.contactOwnerId);

  return {
    summary: `${needsReview.length} upcoming event${plural(needsReview.length)} need communication review before any draft is trustworthy.`,
    points: [
      needsReview[0] ? `${needsReview[0].event.title} needs ${needsReview[0].missing.join(", ")}.` : "Core communication fields are filled for visible upcoming events.",
      ownerGaps.length ? `${ownerGaps.length} event${plural(ownerGaps.length)} have no communication owner.` : "Communication ownership is assigned.",
      "Email, text, and GroupMe outputs remain preview-only."
    ],
    nextActions: ["Fill missing event fields.", "Assign communication owners.", "Run an audited summary for the event with the largest gap."]
  };
}

function answerPeople(overview: MinistryEmmaOverview): MinistryEmmaResponse {
  const owners = overview.users.filter((user) => user.role === "admin" || user.role === "leader");
  const openTasks = overview.tasks.filter((task) => task.status !== "done");
  const counts = owners
    .map((user) => ({
      user,
      count: openTasks.filter((task) => task.assignedUserId === user.id).length
    }))
    .sort((first, second) => second.count - first.count);
  const unassigned = openTasks.filter((task) => !overview.users.some((user) => user.id === task.assignedUserId));

  return {
    summary: `EMMA sees ${owners.length} staff profiles carrying ${openTasks.length} open tasks.`,
    points: [
      counts[0] ? `${displayName(counts[0].user)} has the largest visible load at ${counts[0].count} open task${plural(counts[0].count)}.` : "No staff load is visible.",
      unassigned.length ? `${unassigned.length} task${plural(unassigned.length)} are not tied to a known profile.` : "No unknown-owner task gaps are visible.",
      "Student and parent data should stay in the student portal or approved provider boundary."
    ],
    nextActions: ["Review the highest-load owner.", "Reassign uncovered tasks.", "Keep Planning Center data out of manual staff pages until approved."]
  };
}

function answerBudget(overview: MinistryEmmaOverview): MinistryEmmaResponse {
  const target = overview.events.reduce((sum, event) => sum + Number(event.budgetTarget ?? 0), 0);
  const spent = overview.expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const eventsWithoutTarget = overview.events.filter((event) => !event.budgetTarget);
  const highestSpend = [...overview.events]
    .map((event) => ({
      event,
      spent: overview.expenses.filter((expense) => expense.eventId === event.id).reduce((sum, expense) => sum + expense.amount, 0)
    }))
    .sort((first, second) => second.spent - first.spent)[0];

  return {
    summary: `EMMA sees ${money(spent)} recorded against ${money(target)} in event targets.`,
    points: [
      target && spent > target ? `Recorded spend is ${money(spent - target)} over target.` : `Remaining target balance is ${money(target - spent)}.`,
      eventsWithoutTarget.length ? `${eventsWithoutTarget.length} event${plural(eventsWithoutTarget.length)} need a budget target.` : "All visible events have budget targets.",
      highestSpend?.spent ? `${highestSpend.event.title} has the highest recorded spend at ${money(highestSpend.spent)}.` : "No event spend has been recorded yet."
    ],
    nextActions: ["Add missing budget targets.", "Review the highest-spend event.", "Keep accounting integrations stubbed until approved."]
  };
}

function answerSettings(overview: MinistryEmmaOverview): MinistryEmmaResponse {
  return {
    summary: "EMMA settings posture is audit-first: operational reads are live, provider writes remain bounded, and external sends stay off.",
    points: [
      `${overview.events.length} event record${plural(overview.events.length)} are available to ministry workspaces.`,
      "EMMA proposals are inert review records until application code and human approval allow a workflow to execute.",
      "Provider secrets, live sends, and student-sensitive contexts are not exposed through ministry pages."
    ],
    nextActions: ["Review pending EMMA proposals.", "Keep preview-only labels on communication outputs.", "Verify provider readiness before enabling live integrations."]
  };
}

function answerFiles(): MinistryEmmaResponse {
  return {
    summary: "EMMA sees Files as a preview-only organization surface until Google Drive actions are explicitly approved.",
    points: [
      "Event folders, forms, slides, receipts, and leader resources are the planned file lanes.",
      "Drive folder creation and file movement should stay behind the adapter boundary.",
      "EMMA can recommend organization steps without creating or moving files."
    ],
    nextActions: ["Name the needed event folder structure.", "Attach file needs to event workspaces.", "Keep Drive actions disabled until approved."]
  };
}

function answerWorship(): MinistryEmmaResponse {
  return {
    summary: "EMMA sees Worship as a rehearsal-prep workspace with assignments, slides, and message drafts kept preview-only.",
    points: [
      "Student worship assignments can be reviewed without sending live messages.",
      "GroupMe copy remains a draft until a human sends it outside EMMA.",
      "ProPresenter updates stay behind the stub adapter."
    ],
    nextActions: ["Resolve students who still need confirmation.", "Review slide items marked not ready.", "Keep GroupMe and ProPresenter actions preview-only."]
  };
}

function answerStaticPage(page: MinistryEmmaPage, staticSignals: string[]): MinistryEmmaResponse {
  const fallbackSignals = staticSignals.length
    ? staticSignals
    : [
        `${ministryEmmaPageLabels[page]} is available as a ministry workspace surface.`,
        "Live external execution remains behind approved provider boundaries."
      ];

  return {
    summary: `EMMA is available for ${ministryEmmaPageLabels[page].toLowerCase()} planning support.`,
    points: fallbackSignals.slice(0, 4),
    nextActions: ["Review preview outputs.", "Keep live sends disabled.", "Move approved follow-up into the relevant workspace."]
  };
}

function upcoming(events: MinistryEvent[]): MinistryEvent[] {
  const now = Date.now();
  return [...events]
    .filter((event) => new Date(event.startTime).getTime() >= now)
    .sort((first, second) => new Date(first.startTime).getTime() - new Date(second.startTime).getTime());
}

function dueWithinDays(tasks: ActiveTask[], days: number): ActiveTask[] {
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(start.getDate() + days);
  return tasks.filter((task) => {
    const due = new Date(task.dueDate);
    return due >= start && due <= end;
  });
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function missingCommunicationFields(event: MinistryEvent): string[] {
  return [
    !event.description ? "description" : "",
    !event.location ? "location" : "",
    !event.targetGroup ? "audience" : "",
    !event.contactOwnerId ? "owner" : ""
  ].filter(Boolean);
}

function displayName(user: User): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function plural(count: number): string {
  return count === 1 ? "" : "s";
}
