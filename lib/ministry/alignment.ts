import type { MinistryOverview } from "@/lib/data/ministry-repository";
import type { ActiveTask, MinistryEvent, User } from "@/lib/types";

export type MinistryAlignmentValue = {
  id: string;
  title: string;
  description: string;
  displayOrder: number;
};

export type MinistryAlignmentSeason = {
  title: string;
  description: string;
  startDate: string;
  endDate: string | null;
  owner: string;
  reviewDate: string | null;
  status: "draft" | "active" | "review" | "completed";
};

export type MinistryAlignmentProfile = {
  vision: string;
  mission: string;
  values: MinistryAlignmentValue[];
  currentSeason: MinistryAlignmentSeason;
  successLooksLike: string[];
  owner: string;
  lastUpdated: string;
  reviewDate: string | null;
};

export type ResponsibilityVisibility = {
  id: string;
  area: string;
  status: "assigned" | "shared ownership" | "unassigned" | "concentrated ownership";
  ownerLabel: string;
  nextMilestone: string;
  source: string;
};

export const MINISTRY_ALIGNMENT_STORAGE_KEY = "lead-emergence:ministry-alignment-profile:v1";

export const MINISTRY_ALIGNMENT_CHAIN = [
  "Identity",
  "Vision",
  "Mission",
  "Values",
  "Current Season",
  "Success Looks Like",
  "Meridian",
  "Objective Ministry Signals",
  "Evidence Interpretation",
  "EMMA",
  "Leadership Prayer and Discussion",
  "Leadership Decisions",
  "Operational Work",
  "Outcomes",
  "Meridian learns"
] as const;

export const defaultMinistryAlignmentProfile: MinistryAlignmentProfile = {
  vision: "Students become lifelong disciples of Jesus who love Scripture, live in community, and serve with courage.",
  mission: "Reduce administrative friction so ministry leaders can spend more time forming students as disciples.",
  values: [
    {
      id: "value-scripture",
      title: "Scripture first",
      description: "Teaching, discussion, and decision support begin with Scripture rather than generic inspiration.",
      displayOrder: 1
    },
    {
      id: "value-formation",
      title: "Formation over activity",
      description: "Events and workflows matter because they create space for spiritual formation.",
      displayOrder: 2
    },
    {
      id: "value-leader-care",
      title: "Care for leaders",
      description: "Volunteer preparation, clarity, and sustainability are part of faithful ministry operations.",
      displayOrder: 3
    }
  ],
  currentSeason: {
    title: "Scripture Practice",
    description: "Foreground student Scripture engagement, small-group preparation, and leader readiness before adding new activity.",
    startDate: "2026-07-26",
    endDate: null,
    owner: "Ministry leadership",
    reviewDate: "2026-08-15",
    status: "active"
  },
  successLooksLike: [
    "Students engage Scripture outside scheduled programs.",
    "Small groups move from discussion into spiritual practice.",
    "Leaders report deeper and more consistent discipleship conversations.",
    "Families reinforce spiritual rhythms at home."
  ],
  owner: "Ministry leadership",
  lastUpdated: "2026-07-26",
  reviewDate: "2026-08-15"
};

export function normalizeMinistryAlignmentProfile(input: unknown): MinistryAlignmentProfile {
  if (!input || typeof input !== "object" || Array.isArray(input)) return defaultMinistryAlignmentProfile;
  const record = input as Record<string, unknown>;
  const seasonRecord = objectRecord(record.currentSeason);

  const values = arrayRecord(record.values)
    .map((item, index) => ({
      id: cleanText(item.id, 80) || `value-${index + 1}`,
      title: cleanText(item.title, 80),
      description: cleanText(item.description, 260),
      displayOrder: cleanNumber(item.displayOrder, index + 1)
    }))
    .filter((item) => item.title || item.description)
    .slice(0, 7)
    .map((item, index) => ({ ...item, displayOrder: index + 1 }));

  const successLooksLike = stringArray(record.successLooksLike, 5, 180);

  return {
    vision: cleanText(record.vision, 600) || defaultMinistryAlignmentProfile.vision,
    mission: cleanText(record.mission, 600) || defaultMinistryAlignmentProfile.mission,
    values: values.length ? values : defaultMinistryAlignmentProfile.values,
    currentSeason: {
      title: cleanText(seasonRecord.title, 120) || defaultMinistryAlignmentProfile.currentSeason.title,
      description: cleanText(seasonRecord.description, 420) || defaultMinistryAlignmentProfile.currentSeason.description,
      startDate: cleanDate(seasonRecord.startDate) || defaultMinistryAlignmentProfile.currentSeason.startDate,
      endDate: cleanDate(seasonRecord.endDate),
      owner: cleanText(seasonRecord.owner, 120) || cleanText(record.owner, 120) || defaultMinistryAlignmentProfile.currentSeason.owner,
      reviewDate: cleanDate(seasonRecord.reviewDate) || cleanDate(record.reviewDate),
      status: cleanSeasonStatus(seasonRecord.status)
    },
    successLooksLike: successLooksLike.length ? successLooksLike : defaultMinistryAlignmentProfile.successLooksLike,
    owner: cleanText(record.owner, 120) || defaultMinistryAlignmentProfile.owner,
    lastUpdated: cleanDate(record.lastUpdated) || defaultMinistryAlignmentProfile.lastUpdated,
    reviewDate: cleanDate(record.reviewDate) || cleanDate(seasonRecord.reviewDate)
  };
}

export function buildAlignmentContextSummary(profile: MinistryAlignmentProfile): string[] {
  return [
    `Vision: ${profile.vision}`,
    `Mission: ${profile.mission}`,
    `Current Season: ${profile.currentSeason.title} - ${profile.currentSeason.description}`,
    `Success Looks Like: ${profile.successLooksLike.join(" | ")}`
  ];
}

export function buildResponsibilityVisibility(overview: MinistryOverview): ResponsibilityVisibility[] {
  const activeEvents = overview.events.filter((event) => !event.archivedAt);
  const openTasks = overview.tasks.filter((task) => task.status !== "done");
  const communications = activeEvents.filter((event) => event.contactOwnerId || missingCommunicationFields(event).length > 0);
  const budgetEvents = activeEvents.filter((event) => Number(event.budgetTarget ?? 0) > 0 || Number(event.budgetActual ?? 0) > 0);

  return [
    buildEventResponsibility("events", "Events", activeEvents, overview.users),
    buildTaskResponsibility("tasks", "Tasks", openTasks, overview.users),
    buildEventResponsibility("communications", "Communications", communications, overview.users),
    buildEventResponsibility("budget", "Budget", budgetEvents, overview.users)
  ];
}

export function shouldForegroundScripture(profile: MinistryAlignmentProfile): boolean {
  return /\b(scripture|bible|reading|word)\b/i.test(`${profile.currentSeason.title} ${profile.currentSeason.description} ${profile.successLooksLike.join(" ")}`);
}

export function shouldForegroundVolunteerSignals(profile: MinistryAlignmentProfile): boolean {
  return /\b(volunteer|leader|training|onboarding|serve|service)\b/i.test(`${profile.currentSeason.title} ${profile.currentSeason.description} ${profile.values.map((value) => value.title).join(" ")}`);
}

function buildEventResponsibility(id: string, area: string, events: MinistryEvent[], users: User[]): ResponsibilityVisibility {
  const ownerCounts = countOwners(events.map((event) => event.contactOwnerId).filter((item): item is string => Boolean(item)), users);
  const unassignedCount = events.filter((event) => !event.contactOwnerId).length;
  return {
    id,
    area,
    status: responsibilityStatus(ownerCounts, unassignedCount),
    ownerLabel: ownerLabel(ownerCounts, unassignedCount),
    nextMilestone: nextEventMilestone(events),
    source: events.length ? `${events.length} visible event record${events.length === 1 ? "" : "s"}` : "No visible source records"
  };
}

function buildTaskResponsibility(id: string, area: string, tasks: ActiveTask[], users: User[]): ResponsibilityVisibility {
  const ownerCounts = countOwners(tasks.map((task) => task.assignedUserId).filter(Boolean), users);
  const unassignedCount = tasks.filter((task) => !task.assignedUserId).length;
  return {
    id,
    area,
    status: responsibilityStatus(ownerCounts, unassignedCount),
    ownerLabel: ownerLabel(ownerCounts, unassignedCount),
    nextMilestone: nextTaskMilestone(tasks),
    source: tasks.length ? `${tasks.length} open task record${tasks.length === 1 ? "" : "s"}` : "No visible source records"
  };
}

function countOwners(ownerIds: string[], users: User[]) {
  const counts = new Map<string, number>();
  ownerIds.forEach((ownerId) => counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([ownerId, count]) => ({
      ownerId,
      count,
      label: displayName(users.find((user) => user.id === ownerId)) || "Unknown owner"
    }))
    .sort((left, right) => right.count - left.count);
}

function responsibilityStatus(ownerCounts: Array<{ count: number }>, unassignedCount: number): ResponsibilityVisibility["status"] {
  if (unassignedCount > 0 || !ownerCounts.length) return "unassigned";
  if (ownerCounts.length > 1) return "shared ownership";
  if (ownerCounts[0]?.count && ownerCounts[0].count > 3) return "concentrated ownership";
  return "assigned";
}

function ownerLabel(ownerCounts: Array<{ label: string; count: number }>, unassignedCount: number) {
  if (unassignedCount > 0) return `${unassignedCount} unassigned`;
  if (!ownerCounts.length) return "No owner visible";
  if (ownerCounts.length === 1) return ownerCounts[0]?.label ?? "Assigned";
  return ownerCounts.slice(0, 2).map((item) => `${item.label} (${item.count})`).join(", ");
}

function nextEventMilestone(events: MinistryEvent[]) {
  const next = [...events].sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime())[0];
  return next ? `${next.title} on ${formatDate(next.startTime)}` : "No milestone visible";
}

function nextTaskMilestone(tasks: ActiveTask[]) {
  const next = [...tasks].sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())[0];
  return next ? `${next.taskTitle} due ${formatDate(next.dueDate)}` : "No milestone visible";
}

function missingCommunicationFields(event: MinistryEvent): string[] {
  return [!event.description ? "description" : "", !event.location ? "location" : "", !event.targetGroup ? "audience" : "", !event.contactOwnerId ? "owner" : ""].filter(Boolean);
}

function displayName(user?: User) {
  return user ? `${user.firstName} ${user.lastName}`.trim() || user.email : "";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date unavailable";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayRecord(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(objectRecord) : [];
}

function stringArray(value: unknown, maxItems: number, maxChars: number): string[] {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, maxChars)).filter(Boolean).slice(0, maxItems)
    : [];
}

function cleanText(value: unknown, maxChars: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxChars) : "";
}

function cleanNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function cleanSeasonStatus(value: unknown): MinistryAlignmentSeason["status"] {
  return value === "draft" || value === "review" || value === "completed" ? value : "active";
}
