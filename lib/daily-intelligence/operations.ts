import { getMissingInformation } from "@/lib/missing-info";
import { formatDate, formatDateTime, money } from "@/lib/utils";
import type { ActiveTask, MinistryEvent } from "@/lib/types";
import type {
  DailyBriefItem,
  DailyBriefPriority,
  DailyBriefSectionKey,
  DailyBriefSections,
  DailyContentBlock,
  DailyIntelligenceBrief,
  MinistryIntelligenceData,
  ResearchResource,
  WeeklyContentDay
} from "@/lib/daily-intelligence/types";

const SECTION_KEYS: DailyBriefSectionKey[] = [
  "needsAttentionToday",
  "nextSevenDays",
  "daysEightToFourteen",
  "communications",
  "studentVolunteerCare",
  "decisionsNeeded",
  "recentProgress",
  "systemHealth"
];

const PRIORITY_WEIGHT: Record<DailyBriefPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const DAY_NAMES: WeeklyContentDay[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function buildDailyIntelligenceBrief(params: {
  data: MinistryIntelligenceData;
  now?: Date;
  resources?: ResearchResource[];
  warnings?: string[];
}): DailyIntelligenceBrief {
  const now = params.now ?? new Date();
  const windowStart = startOfDay(now);
  const windowEnd = addDays(windowStart, 14);
  const day = DAY_NAMES[now.getDay()];
  const sections = emptySections();
  const upcomingEvents = params.data.events.filter((event) => isWithin(event.startTime, windowStart, windowEnd));
  const openTasks = params.data.tasks.filter((task) => task.status !== "done");

  addTodayAttention(sections, params.data, openTasks, upcomingEvents, windowStart);
  addPlanningWindows(sections, params.data, openTasks, upcomingEvents, windowStart);
  addCommunications(sections, params.data, upcomingEvents, windowStart);
  addCare(sections, params.data, openTasks, upcomingEvents, windowStart);
  addDecisions(sections, params.data, openTasks, upcomingEvents);
  addProgress(sections, params.data, windowStart);
  addSystemHealth(sections, params.data);

  return {
    generatedAt: now.toISOString(),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    day,
    sections: sortSections(sections),
    content: buildDailyContentBlock(day, params.resources ?? [], params.data, windowStart),
    warnings: params.warnings ?? []
  };
}

function addTodayAttention(
  sections: DailyBriefSections,
  data: MinistryIntelligenceData,
  openTasks: ActiveTask[],
  upcomingEvents: MinistryEvent[],
  today: Date
) {
  const todayEnd = addDays(today, 1);
  for (const task of openTasks.filter((item) => new Date(item.dueDate) < todayEnd)) {
    sections.needsAttentionToday.push(taskItem(task, data, new Date(task.dueDate) < today ? "critical" : "high", "This task is due now or overdue."));
  }

  for (const task of openTasks.filter((item) => item.status === "blocked").slice(0, 6)) {
    sections.needsAttentionToday.push(taskItem(task, data, "high", "Blocked work can stall the next ministry step if nobody clears the dependency."));
  }

  for (const event of upcomingEvents.filter((item) => isWithin(item.startTime, today, addDays(today, 2)))) {
    const missing = getMissingInformation(event, data.expenses.filter((expense) => expense.eventId === event.id));
    if (missing.length > 0) {
      sections.needsAttentionToday.push(eventItem(event, "high", `${missing.length} planning detail${missing.length === 1 ? "" : "s"} still need confirmation before this event is ready.`));
    }
  }
}

function addPlanningWindows(
  sections: DailyBriefSections,
  data: MinistryIntelligenceData,
  openTasks: ActiveTask[],
  upcomingEvents: MinistryEvent[],
  today: Date
) {
  for (const event of upcomingEvents) {
    const days = daysBetween(today, new Date(event.startTime));
    const eventTasks = openTasks.filter((task) => task.eventId === event.id);
    const missing = getMissingInformation(event, data.expenses.filter((expense) => expense.eventId === event.id));
    const section = days <= 7 ? sections.nextSevenDays : sections.daysEightToFourteen;
    section.push(
      eventItem(
        event,
        eventTasks.some((task) => task.status === "blocked") || missing.some((item) => item.severity === "required") ? "high" : "medium",
        `${eventTasks.length} open task${eventTasks.length === 1 ? "" : "s"} and ${missing.length} planning gap${missing.length === 1 ? "" : "s"} are visible in the 14-day window.`
      )
    );
  }

  for (const task of openTasks.filter((item) => isWithin(item.dueDate, addDays(today, 1), addDays(today, 14))).slice(0, 12)) {
    const days = daysBetween(today, new Date(task.dueDate));
    const section = days <= 7 ? sections.nextSevenDays : sections.daysEightToFourteen;
    section.push(taskItem(task, data, task.status === "blocked" ? "high" : "medium", "Upcoming task pressure affects event readiness."));
  }
}

function addCommunications(sections: DailyBriefSections, data: MinistryIntelligenceData, upcomingEvents: MinistryEvent[], today: Date) {
  for (const communication of data.communications.filter((item) => item.status === "preview")) {
    sections.communications.push({
      id: `comm-${communication.id}`,
      priority: "medium",
      title: communication.payload.subject,
      why: "This communication draft is still a preview and has not been sent.",
      action: "Review the draft inside Lead Emerge before any real send.",
      date: communication.createdAt,
      recordType: "communication",
      recordId: communication.id,
      recordUrl: `/events?event=${communication.eventId}`
    });
  }

  const neededTypes = ["parent_email", "leader_brief", "student_announcement"];
  for (const event of upcomingEvents) {
    const eventComms = data.communications.filter((item) => item.eventId === event.id);
    const missingTypes = neededTypes.filter((type) => !eventComms.some((item) => item.type === type));
    if (missingTypes.length > 0 && daysBetween(today, new Date(event.startTime)) <= 14) {
      sections.communications.push(
        eventItem(
          event,
          daysBetween(today, new Date(event.startTime)) <= 7 ? "high" : "medium",
          `Missing ${missingTypes.length} communication preview${missingTypes.length === 1 ? "" : "s"} for an upcoming event.`
        )
      );
    }
  }
}

function addCare(
  sections: DailyBriefSections,
  data: MinistryIntelligenceData,
  openTasks: ActiveTask[],
  upcomingEvents: MinistryEvent[],
  today: Date
) {
  for (const event of upcomingEvents) {
    const assignedOpenTasks = openTasks.filter((task) => task.eventId === event.id && task.assignedUserId).length;
    if ((event.volunteersNeeded ?? 0) > assignedOpenTasks) {
      sections.studentVolunteerCare.push(
        eventItem(
          event,
          "high",
          `${event.volunteersNeeded} volunteer slot${event.volunteersNeeded === 1 ? "" : "s"} are planned, but only ${assignedOpenTasks} open task owner${assignedOpenTasks === 1 ? "" : "s"} are visible.`
        )
      );
    }
  }

  const studentCareTasks = openTasks.filter(isStudentCareTask);
  for (const task of studentCareTasks.slice(0, 5)) {
    sections.studentVolunteerCare.push({
      id: `student-care-${task.id}`,
      priority: new Date(task.dueDate) < addDays(today, 2) ? "high" : "medium",
      title: "Student follow-up task needs review",
      why: "A task appears to involve student care. Details stay inside Lead Emerge and are not posted to Slack.",
      action: "Open the task record and review privately.",
      date: task.dueDate,
      recordType: "task",
      recordId: task.id,
      recordUrl: `/tasks?task=${task.id}`
    });
  }
}

function addDecisions(sections: DailyBriefSections, data: MinistryIntelligenceData, openTasks: ActiveTask[], upcomingEvents: MinistryEvent[]) {
  for (const event of upcomingEvents) {
    if (!event.contactOwnerId) {
      sections.decisionsNeeded.push(eventItem(event, "high", "No communication or planning owner is assigned."));
    }
    if (!event.budgetTarget) {
      sections.decisionsNeeded.push(eventItem(event, "medium", "Budget target is missing, so spending health cannot be evaluated."));
    }
    if ((event.budgetActual ?? 0) > (event.budgetTarget ?? Number.POSITIVE_INFINITY)) {
      sections.decisionsNeeded.push(
        eventItem(event, "high", `Recorded spending ${money(event.budgetActual ?? 0)} is above the planned ${money(event.budgetTarget ?? 0)} target.`)
      );
    }
  }

  for (const task of openTasks.filter((item) => !item.assignedUserId).slice(0, 6)) {
    sections.decisionsNeeded.push(taskItem(task, data, "medium", "This task has no visible owner."));
  }
}

function addProgress(sections: DailyBriefSections, data: MinistryIntelligenceData, today: Date) {
  const recent = data.activity.filter((item) => new Date(item.timestamp) >= addDays(today, -7)).slice(0, 8);
  for (const activity of recent) {
    sections.recentProgress.push({
      id: `progress-${activity.id}`,
      priority: "low",
      title: activity.message,
      why: "Recent ministry progress from the activity log.",
      date: activity.timestamp,
      recordType: activity.taskId ? "task" : activity.eventId ? "event" : "system",
      recordId: activity.taskId ?? activity.eventId,
      recordUrl: activity.eventId ? `/events?event=${activity.eventId}` : undefined
    });
  }
}

function addSystemHealth(sections: DailyBriefSections, data: MinistryIntelligenceData) {
  const failures = data.integrationLogs.filter((log) => log.status !== "stub_mode");
  for (const failure of failures) {
    sections.systemHealth.push({
      id: `integration-${failure.id}`,
      priority: "high",
      title: `${failure.integrationType} needs attention`,
      why: failure.details.message,
      date: failure.timestamp,
      recordType: "system",
      recordId: failure.eventId,
      recordUrl: `/events?event=${failure.eventId}`
    });
  }

  if (failures.length === 0) {
    sections.systemHealth.push({
      id: "system-no-live-failures",
      priority: "low",
      title: "No live integration failures surfaced",
      why: "Lead Emerge only found normal adapter/stub activity in the current operational data.",
      recordType: "system"
    });
  }
}

export function buildDailyContentBlock(
  day: WeeklyContentDay,
  resources: ResearchResource[],
  data: MinistryIntelligenceData,
  today: Date
): DailyContentBlock {
  if (day === "sunday") {
    const todayEvents = data.events.filter((event) => isWithin(event.startTime, today, addDays(today, 1)));
    return {
      day,
      title: "Sunday - Ministry Execution",
      focus: "Today only: schedule, leader assignments, worship reminders, last-minute changes, intentional welcome, and immediate action items.",
      items: todayEvents.map((event) => eventItem(event, "high", "This event is on today's ministry schedule."))
    };
  }

  if (day === "saturday") {
    return {
      day,
      title: "Saturday - Sunday Readiness",
      focus: "One practical Sunday idea, one conversation starter, one volunteer encouragement, and unresolved Sunday operational issues.",
      items: [
        resourceIdea("Practical Sunday idea", "Give one leader the first-five-minutes ownership: greeting, seating, and naming new students before worship starts."),
        resourceIdea("Conversation starter", "Ask: What is one place you noticed God at work this week, even if it was small?"),
        resourceIdea("Volunteer encouragement", "Thank leaders for consistency before asking for more help; name the ministry value of showing up.")
      ]
    };
  }

  if (day === "tuesday") {
    const games = resources.filter((resource) => resource.day === "tuesday" || resource.type === "game");
    return {
      day,
      title: "Tuesday - Game Lab",
      focus: "Exactly two quick Sunday icebreakers and one longer event game.",
      items: [
        gameItem(games[0], "Quick Sunday Icebreaker 1", "5-12 minutes, nearly everyone participates, minimal setup, Sunday-morning friendly, no embarrassment."),
        gameItem(games[1], "Quick Sunday Icebreaker 2", "5-12 minutes, nearly everyone participates, minimal setup, Sunday-morning friendly, no embarrassment."),
        gameItem(games[2], "Longer Event Game", "15-45 minutes for Midweek, high school, middle school, camp, or special events with clear safety and cleanup notes.")
      ]
    };
  }

  const byDay = resources.filter((resource) => resource.day === day).slice(0, 3);
  return {
    day,
    title: contentTitle(day),
    focus: contentFocus(day),
    items: byDay.length
      ? byDay.map((resource) => ({
          id: `resource-${resource.id}`,
          priority: "low",
          title: resource.title,
          why: resource.whyIncluded,
          action: resource.summary,
          recordType: "resource",
          recordId: resource.id,
          recordUrl: resource.url
        }))
      : [resourceIdea("Research queue pending", "No vetted Firecrawl resource is available for today's rhythm yet.")]
  };
}

function taskItem(task: ActiveTask, data: MinistryIntelligenceData, priority: DailyBriefPriority, why: string): DailyBriefItem {
  const event = data.events.find((item) => item.id === task.eventId);
  const studentCare = isStudentCareTask(task);
  return {
    id: `task-${task.id}-${priority}`,
    priority,
    title: studentCare ? "Student follow-up task needs review" : task.taskTitle,
    why: studentCare
      ? "A task appears to involve student care. Details stay inside Lead Emerge and are not posted to Slack."
      : event
        ? `${why} Event: ${event.title}.`
        : why,
    action: task.status === "blocked" ? "Clear the blocker or reassign ownership." : "Update the task status or owner in Lead Emerge.",
    date: task.dueDate,
    recordType: "task",
    recordId: task.id,
    recordUrl: `/tasks?task=${task.id}`
  };
}

function isStudentCareTask(task: ActiveTask): boolean {
  return /student|follow.?up|welcome|care|check.?in|prayer/i.test(task.taskTitle);
}

function eventItem(event: MinistryEvent, priority: DailyBriefPriority, why: string): DailyBriefItem {
  return {
    id: `event-${event.id}-${priority}-${why.slice(0, 20)}`,
    priority,
    title: event.title,
    why,
    action: "Open the event workspace in Lead Emerge.",
    date: event.startTime,
    recordType: "event",
    recordId: event.id,
    recordUrl: `/events?event=${event.id}`
  };
}

function gameItem(resource: ResearchResource | undefined, title: string, requirements: string): DailyBriefItem {
  return {
    id: `game-${title.toLowerCase().replace(/\W+/g, "-")}`,
    priority: "low",
    title: resource?.title ?? title,
    why: resource ? `${requirements} Demo/source: ${resource.url}` : requirements,
    action:
      resource?.summary ??
      "Add supplies, setup, instructions, accessibility notes, safety/cleanup where relevant, and an EMERGE adaptation before using.",
    recordType: "resource",
    recordId: resource?.id,
    recordUrl: resource?.url
  };
}

function resourceIdea(title: string, why: string): DailyBriefItem {
  return { id: `idea-${title.toLowerCase().replace(/\W+/g, "-")}`, priority: "low", title, why, recordType: "resource" };
}

function contentTitle(day: WeeklyContentDay): string {
  switch (day) {
    case "monday":
      return "Monday - Leadership & Ministry Systems";
    case "wednesday":
      return "Wednesday - Discipleship";
    case "thursday":
      return "Thursday - Student Culture";
    case "friday":
      return "Friday - Leadership Development";
    default:
      return "Daily Ministry Insight";
  }
}

function contentFocus(day: WeeklyContentDay): string {
  switch (day) {
    case "monday":
      return "Ministry leadership, volunteer systems, parent partnership, event planning, team culture, operations, and best practices.";
    case "wednesday":
      return "Biblical literacy, small groups, spiritual formation, student questions, teaching methods, and student-led Bible study.";
    case "thursday":
      return "Teen culture, technology, social media, school life, identity, parent communication, and pastoral awareness.";
    case "friday":
      return "Volunteers, student leaders, worship leaders, communication, team development, and leadership pipelines.";
    default:
      return "A focused daily ministry learning rhythm.";
  }
}

function emptySections(): DailyBriefSections {
  return SECTION_KEYS.reduce((acc, key) => ({ ...acc, [key]: [] }), {} as DailyBriefSections);
}

function sortSections(sections: DailyBriefSections): DailyBriefSections {
  return SECTION_KEYS.reduce((acc, key) => {
    acc[key] = [...sections[key]].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || (a.date ?? "").localeCompare(b.date ?? ""));
    return acc;
  }, {} as DailyBriefSections);
}

function isWithin(value: string, start: Date, end: Date): boolean {
  const date = new Date(value);
  return date >= start && date < end;
}

function daysBetween(start: Date, end: Date): number {
  return Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatBriefDate(value?: string): string {
  if (!value) return "";
  return value.includes("T") ? formatDateTime(value) : formatDate(value);
}
