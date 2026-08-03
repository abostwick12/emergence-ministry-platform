import type { MinistryOverview } from "@/lib/data/ministry-repository";
import type { MinistryEmmaResponse } from "@/lib/emma/ministry-page-assistant";
import type { MinistryNarrative, MinistryNarrativeSourceRecord } from "@/lib/ministry/narrative-types";

export const authenticatedMinistryNarrativeIds = [
  "participation-rhythm",
  "shared-responsibility",
  "volunteer-serving-rhythm",
  "relational-capacity"
] as const;

export type AuthenticatedMinistryNarrativeId = (typeof authenticatedMinistryNarrativeIds)[number];
export type AuthenticatedMinistryNarrative = MinistryNarrative<AuthenticatedMinistryNarrativeId>;

export type PlanningCenterAttendanceRecord = {
  id: string;
  externalPersonId: string | null;
  externalEventId: string | null;
  sessionLabel: string | null;
  locationLabel: string | null;
  checkedInAt: string | null;
};

export type MinistryVolunteerLeader = {
  id: string;
  name: string;
  roleLabel: string;
};

export type MinistryVolunteerGroup = {
  id: string;
  name: string;
  leaderId: string | null;
  coLeaderId: string | null;
  serviceTime: string;
};

export type MinistryVolunteerGroupMember = {
  groupId: string;
};

export type MinistryVolunteerEventAssignment = {
  eventId: string;
  leaderId: string;
  createdAt: string;
};

export type AuthenticatedMinistryNarrativeContext = {
  overview: MinistryOverview;
  planningCenter: {
    available: boolean;
    connectionStatus: "connected" | "disconnected" | "error" | "unavailable";
    lastSyncAt?: string;
    attendance: PlanningCenterAttendanceRecord[];
  };
  volunteerHub: {
    available: boolean;
    assignmentsAvailable: boolean;
    groupsAvailable: boolean;
    leaders: MinistryVolunteerLeader[];
    groups: MinistryVolunteerGroup[];
    members: MinistryVolunteerGroupMember[];
    assignments: MinistryVolunteerEventAssignment[];
  };
};

const DAY_MS = 86_400_000;
const PLANNING_CENTER_FRESH_DAYS = 45;

export function buildAuthenticatedMinistryNarratives(
  context: AuthenticatedMinistryNarrativeContext,
  now = new Date()
): AuthenticatedMinistryNarrative[] {
  return [
    buildParticipationNarrative(context, now),
    buildResponsibilityNarrative(context),
    buildVolunteerServingNarrative(context),
    buildRelationalCapacityNarrative(context)
  ];
}

export function buildAuthenticatedMinistryNarrativeById(
  id: AuthenticatedMinistryNarrativeId,
  context: AuthenticatedMinistryNarrativeContext,
  now = new Date()
) {
  const narrative = buildAuthenticatedMinistryNarratives(context, now).find((item) => item.id === id);
  if (!narrative) throw new Error(`Unknown authenticated Ministry Hub narrative: ${id}`);
  return narrative;
}

export function buildAuthenticatedNarrativeEmmaContext(narrative: AuthenticatedMinistryNarrative) {
  return {
    id: narrative.id,
    status: narrative.status,
    headline: narrative.headline,
    timeframe: narrative.timeframe,
    ministryArea: narrative.ministryArea,
    observation: narrative.whatChanged,
    evidence: narrative.evidence.map((item) => ({
      label: item.label,
      value: item.value,
      calculation: item.calculation,
      sourceDateRange: item.sourceDateRange
    })),
    unknowns: narrative.unknowns,
    discernmentQuestion: narrative.discernmentQuestion
  };
}

export function buildAuthenticatedNarrativeEmmaResponse(
  narrative: AuthenticatedMinistryNarrative
): MinistryEmmaResponse {
  return {
    summary: narrative.status === "supported"
      ? `${narrative.headline} This is a record-backed observation for leadership review, not a conclusion about spiritual health, motivation, or calling.`
      : `${narrative.headline} The current ministry records do not support a stronger conclusion, so the evidence gap remains explicit.`,
    points: narrative.evidence.length
      ? [
          ...narrative.evidence.slice(0, 2).map((item) => `${item.label}: ${item.value}`),
          `What remains unknown: ${narrative.unknowns[0]}`
        ]
      : [narrative.whatChanged, `What remains unknown: ${narrative.unknowns[0]}`],
    nextActions: [
      narrative.discernmentQuestion,
      narrative.action?.label ?? "Review the available source records before deciding whether a ministry response is needed."
    ]
  };
}

function buildParticipationNarrative(
  context: AuthenticatedMinistryNarrativeContext,
  now: Date
): AuthenticatedMinistryNarrative {
  const { planningCenter } = context;
  const lastSync = planningCenter.lastSyncAt ? new Date(planningCenter.lastSyncAt) : null;
  const stale = !lastSync || Number.isNaN(lastSync.getTime()) || now.getTime() - lastSync.getTime() > PLANNING_CENTER_FRESH_DAYS * DAY_MS;
  const datedAttendance = planningCenter.attendance
    .filter((item) => item.checkedInAt && !Number.isNaN(new Date(item.checkedInAt).getTime()))
    .sort((left, right) => (left.checkedInAt ?? "").localeCompare(right.checkedInAt ?? ""));
  const weekly = attendanceByWeek(datedAttendance);

  if (!planningCenter.available || planningCenter.connectionStatus !== "connected" || stale || weekly.length < 8) {
    const reason = !planningCenter.available
      ? "Planning Center attendance storage is not available for this ministry."
      : planningCenter.connectionStatus !== "connected"
        ? "Planning Center is not connected for this ministry."
        : stale
          ? "The latest Planning Center sync is too old to support a current participation comparison."
          : `${weekly.length} distinct attendance week${weekly.length === 1 ? " is" : "s are"} available; at least eight are needed.`;
    return evidenceGap({
      id: "participation-rhythm",
      navigationLabel: "Participation rhythm",
      eyebrow: "Participation rhythm",
      headline: "Participation patterns need more current attendance evidence.",
      ministryArea: "Planning Center attendance",
      timeframe: planningCenter.lastSyncAt ? `Last synced ${formatDate(planningCenter.lastSyncAt)}` : "No current sync window",
      whatChanged: reason,
      whyItMayMatter: "A trustworthy participation story needs enough dated records to compare ministry rhythms without turning a partial snapshot into a trend.",
      unknown: "The available records cannot yet establish whether participation is increasing, decreasing, or shifting between ministry settings.",
      question: "What attendance history should leadership review before interpreting changes in participation?",
      action: { href: "/settings", label: "Review Planning Center" }
    });
  }

  const earlyWeeks = weekly.slice(0, 4);
  const recentWeeks = weekly.slice(-4);
  const earlyAverage = average(earlyWeeks.map((item) => item.attendeeCount));
  const recentAverage = average(recentWeeks.map((item) => item.attendeeCount));
  const change = percentChange(recentAverage, earlyAverage);
  const direction = change > 2 ? "increased" : change < -2 ? "decreased" : "remained broadly steady";
  const sourceRecords = attendanceSourceRecords([...earlyWeeks, ...recentWeeks]);

  return {
    id: "participation-rhythm",
    status: "supported",
    navigationLabel: "Participation rhythm",
    eyebrow: "Participation rhythm",
    headline: `Weekly participation ${direction} across the synced comparison window.`,
    ministryArea: "Planning Center attendance",
    timeframe: `${formatDate(earlyWeeks[0]?.weekStart)}–${formatDate(recentWeeks.at(-1)?.weekStart)}`,
    people: ["students represented in aggregated check-in records"],
    whatChanged: `Average unique weekly check-ins moved from ${oneDecimal(earlyAverage)} to ${oneDecimal(recentAverage)} (${signedPercent(change)}).`,
    whyItMayMatter: [
      "A changing attendance rhythm can help leadership ask where students are connecting and which ministry settings deserve closer listening.",
      "Check-ins show presence, not belonging, discipleship, family context, or the quality of relationships."
    ],
    evidence: [
      {
        label: "Early four-week average",
        value: `${oneDecimal(earlyAverage)} unique weekly check-ins`,
        explanation: "The earliest four complete weeks in the available comparison window were averaged without exposing student identities.",
        calculation: "Mean weekly count of distinct Planning Center person references across the earliest four of at least eight dated weeks.",
        sourceDateRange: rangeForWeeks(earlyWeeks),
        sourceRecords: attendanceSourceRecords(earlyWeeks)
      },
      {
        label: "Recent four-week average",
        value: `${oneDecimal(recentAverage)} unique weekly check-ins (${signedPercent(change)})`,
        explanation: "The most recent four available weeks were compared with the early window from the same synced record set.",
        calculation: "Mean weekly count of distinct Planning Center person references across the latest four dated weeks.",
        sourceDateRange: rangeForWeeks(recentWeeks),
        sourceRecords
      }
    ],
    unknowns: [
      "Attendance records do not explain why participation changed or what students experienced.",
      "The aggregate does not establish retention, formation, belonging, or movement between specific programs.",
      "A connected sync can still omit ministry activity that Planning Center does not record."
    ],
    discernmentQuestion: "What ministry, family, and relational context should leadership place beside this attendance pattern before responding?",
    action: { href: "/people", label: "Open Volunteer Hub" }
  };
}

function buildResponsibilityNarrative(context: AuthenticatedMinistryNarrativeContext): AuthenticatedMinistryNarrative {
  const activeEvents = context.overview.events.filter((event) => !event.archivedAt);
  const openTasks = context.overview.tasks.filter((task) => task.status !== "done");
  const userNames = new Map(context.overview.users.map((user) => [user.id, displayUser(user)]));
  const owned = [
    ...activeEvents.filter((event) => event.contactOwnerId).map((event) => ({
      ownerId: event.contactOwnerId!,
      date: event.startTime,
      source: { id: event.id, type: "event" as const, label: event.title, date: event.startTime }
    })),
    ...openTasks.filter((task) => task.assignedUserId).map((task) => ({
      ownerId: task.assignedUserId,
      date: task.dueDate,
      source: { id: task.id, type: "task" as const, label: task.taskTitle, date: task.dueDate }
    }))
  ];
  const counts = countBy(owned, (item) => item.ownerId);

  if (owned.length < 4 || counts.size < 2) {
    return evidenceGap({
      id: "shared-responsibility",
      navigationLabel: "Shared responsibility",
      eyebrow: "Shared responsibility",
      headline: "Responsibility patterns need more assigned operational records.",
      ministryArea: "Events and tasks",
      timeframe: "Current active records",
      whatChanged: `${owned.length} assigned event or open-task record${owned.length === 1 ? " is" : "s are"} visible across ${counts.size} named owner${counts.size === 1 ? "" : "s"}.`,
      whyItMayMatter: "Leadership cannot review shared responsibility honestly until enough current work has clear ownership.",
      unknown: "The current records cannot show whether responsibility is intentionally shared, concentrated, or incomplete.",
      question: "Which current ministry responsibilities need clearer ownership before leadership reviews team capacity?",
      action: { href: "/tasks", label: "Review task ownership" }
    });
  }

  const distribution = Array.from(counts.entries())
    .map(([ownerId, count]) => ({ ownerId, count, name: userNames.get(ownerId) ?? "Unknown owner" }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  const top = distribution[0]!;
  const topSources = owned.filter((item) => item.ownerId === top.ownerId).map((item) => item.source);
  const share = (top.count / owned.length) * 100;
  const unassigned = activeEvents.filter((event) => !event.contactOwnerId).length + openTasks.filter((task) => !task.assignedUserId).length;

  return {
    id: "shared-responsibility",
    status: "supported",
    navigationLabel: "Shared responsibility",
    eyebrow: "Shared responsibility",
    headline: `${top.name} holds the largest share of visible event and task ownership.`,
    ministryArea: "Current events and open tasks",
    timeframe: dateRange(owned.map((item) => item.date)),
    people: distribution.map((item) => item.name),
    whatChanged: `${top.name} owns ${top.count} of ${owned.length} assigned operational records (${oneDecimal(share)}%).`,
    whyItMayMatter: [
      "Visible ownership helps leadership discuss continuity, delegation, and where shared context may be needed before work becomes urgent.",
      "Record counts are units of ownership, not hours, difficulty, performance, stress, or a diagnosis of capacity."
    ],
    evidence: [
      {
        label: "Largest recorded ownership share",
        value: `${top.count} of ${owned.length} records (${oneDecimal(share)}%)`,
        explanation: "Active event ownership and open-task assignments are counted equally as visible ownership records.",
        calculation: "Count active events by communication owner plus open tasks by assigned user; divide the largest owner count by all assigned records.",
        sourceDateRange: dateRange(owned.map((item) => item.date)),
        sourceRecords: topSources
      },
      {
        label: "Visible ownership distribution",
        value: distribution.map((item) => `${item.name}: ${item.count}`).join("; "),
        explanation: unassigned ? `${unassigned} additional active record${unassigned === 1 ? " has" : "s have"} no named owner.` : "Every included record has a named owner.",
        calculation: "Group current assigned event and open-task records by canonical user ID.",
        sourceDateRange: dateRange(owned.map((item) => item.date)),
        sourceRecords: owned.map((item) => item.source)
      }
    ],
    unknowns: [
      "The records do not contain role expectations, availability, delegated work outside the platform, or self-reported capacity.",
      "One event or task can require substantially more effort than another.",
      "Ownership concentration may be intentional and cannot establish burnout or performance."
    ],
    discernmentQuestion: "Is this distribution of visible ownership intentional for the current season, and what context should leadership review before changing it?",
    action: { href: "/tasks", label: "Review current work" }
  };
}

function buildVolunteerServingNarrative(context: AuthenticatedMinistryNarrativeContext): AuthenticatedMinistryNarrative {
  const eventById = new Map(context.overview.events.map((event) => [event.id, event]));
  const leaderById = new Map(context.volunteerHub.leaders.map((leader) => [leader.id, leader]));
  const dated = context.volunteerHub.assignments
    .map((assignment) => ({ assignment, event: eventById.get(assignment.eventId), leader: leaderById.get(assignment.leaderId) }))
    .filter((item): item is typeof item & { event: NonNullable<typeof item.event>; leader: NonNullable<typeof item.leader> } => Boolean(item.event && item.leader));
  const counts = countBy(dated, (item) => item.leader.id);

  if (!context.volunteerHub.assignmentsAvailable || dated.length < 4 || counts.size < 2) {
    return evidenceGap({
      id: "volunteer-serving-rhythm",
      navigationLabel: "Volunteer serving rhythm",
      eyebrow: "Serving rhythm",
      headline: "Volunteer serving rhythms need more dated assignment evidence.",
      ministryArea: "Volunteer Hub event assignments",
      timeframe: "Current authenticated records",
      whatChanged: context.volunteerHub.assignmentsAvailable
        ? `${dated.length} dated event assignment${dated.length === 1 ? " is" : "s are"} visible across ${counts.size} leader${counts.size === 1 ? "" : "s"}.`
        : "Volunteer Hub assignment storage is not available for this ministry.",
      whyItMayMatter: "A serving-rhythm conversation needs enough dated assignments to distinguish a real scheduling pattern from a partial roster.",
      unknown: "The records cannot yet support a comparison of volunteer rotation, continuity, or opportunities for rest.",
      question: "What serving assignments and availability context should leadership record before reviewing volunteer rhythm?",
      action: { href: "/people", label: "Review volunteer assignments" }
    });
  }

  const distribution = Array.from(counts.entries())
    .map(([leaderId, count]) => ({ leader: leaderById.get(leaderId)!, count }))
    .sort((left, right) => right.count - left.count || left.leader.name.localeCompare(right.leader.name));
  const top = distribution[0]!;
  const medianCount = median(distribution.map((item) => item.count));
  const topAssignments = dated.filter((item) => item.leader.id === top.leader.id);

  return {
    id: "volunteer-serving-rhythm",
    status: "supported",
    navigationLabel: "Volunteer serving rhythm",
    eyebrow: "Serving rhythm",
    headline: `${top.leader.name} appears most often in the current event assignment history.`,
    ministryArea: "Volunteer Hub event assignments",
    timeframe: dateRange(dated.map((item) => item.event.startTime)),
    people: distribution.map((item) => item.leader.name),
    whatChanged: `${top.leader.name} appears on ${top.count} assignments compared with a leader median of ${oneDecimal(medianCount)}.`,
    whyItMayMatter: [
      "Repeated assignments can support continuity while also creating a useful conversation about rotation, preparation, mentoring, and rest.",
      "Assignment frequency cannot show preference, availability, actual attendance, role complexity, or whether the rhythm is healthy."
    ],
    evidence: [
      {
        label: `${top.leader.name} assignments`,
        value: `${top.count} dated assignments`,
        explanation: "Only assignments joined to an existing dated ministry event are included.",
        calculation: "Count volunteer_hub_event_leader_assignments rows by leader ID after joining each row to its ministry event.",
        sourceDateRange: dateRange(topAssignments.map((item) => item.event.startTime)),
        sourceRecords: topAssignments.map((item) => assignmentSource(item.assignment, item.event.title, item.event.startTime))
      },
      {
        label: "Leader assignment distribution",
        value: distribution.map((item) => `${item.leader.name}: ${item.count}`).join("; "),
        explanation: "The median provides a descriptive comparison without defining a healthy serving threshold.",
        calculation: "Count dated assignments per leader and calculate the median of visible leader totals.",
        sourceDateRange: dateRange(dated.map((item) => item.event.startTime)),
        sourceRecords: dated.map((item) => assignmentSource(item.assignment, item.event.title, item.event.startTime))
      }
    ],
    unknowns: [
      "Availability, preferences, cancellations, substitutions, and actual service completion are not represented.",
      "Different assignments may require very different preparation and relational energy.",
      "Frequency alone cannot establish overuse, readiness, calling, or need for rest."
    ],
    discernmentQuestion: "Does this assignment rhythm reflect intentional continuity and volunteer availability, or does leadership need a conversation about rotation and support?",
    action: { href: "/people", label: "Open Volunteer Hub" }
  };
}

function buildRelationalCapacityNarrative(context: AuthenticatedMinistryNarrativeContext): AuthenticatedMinistryNarrative {
  const memberCounts = countBy(context.volunteerHub.members, (member) => member.groupId);
  const leaderById = new Map(context.volunteerHub.leaders.map((leader) => [leader.id, leader]));
  const groups = context.volunteerHub.groups
    .map((group) => {
      const leaderIds = [group.leaderId, group.coLeaderId].filter((id): id is string => Boolean(id));
      return { group, memberCount: memberCounts.get(group.id) ?? 0, leaderIds };
    })
    .filter((item) => item.memberCount > 0 && item.leaderIds.length > 0)
    .sort((left, right) => right.memberCount - left.memberCount || left.group.name.localeCompare(right.group.name));

  if (!context.volunteerHub.groupsAvailable || !groups.length) {
    return evidenceGap({
      id: "relational-capacity",
      navigationLabel: "Relational capacity",
      eyebrow: "Relational capacity",
      headline: "Small-group relational capacity needs connected roster evidence.",
      ministryArea: "Volunteer Hub small groups",
      timeframe: "Current authenticated roster",
      whatChanged: context.volunteerHub.groupsAvailable
        ? "No active group currently has both linked members and a named leader in the available records."
        : "Volunteer Hub group storage is not available for this ministry.",
      whyItMayMatter: "Current group size and named leadership provide a starting point for discussing whether students can be known and followed up with well.",
      unknown: "The current records cannot support a relational-capacity observation or any claim about group growth.",
      question: "Which groups need current membership and leader assignments before leadership reviews relational capacity?",
      action: { href: "/people", label: "Review small groups" }
    });
  }

  const largest = groups[0]!;
  const leaderNames = largest.leaderIds.map((id) => leaderById.get(id)?.name ?? "Named leader");
  const ratio = largest.memberCount / largest.leaderIds.length;

  return {
    id: "relational-capacity",
    status: "supported",
    navigationLabel: "Relational capacity",
    eyebrow: "Relational capacity",
    headline: `${largest.group.name} is the largest currently rostered small group.`,
    ministryArea: largest.group.name,
    timeframe: "Current authenticated roster snapshot",
    people: leaderNames,
    groupName: largest.group.name,
    whatChanged: `${largest.group.name} has ${largest.memberCount} linked students and ${largest.leaderIds.length} named leader${largest.leaderIds.length === 1 ? "" : "s"} (${oneDecimal(ratio)} students per leader).`,
    whyItMayMatter: [
      "A current roster-to-leader ratio can help leadership ask whether each student has space to be known, heard, and followed up with.",
      "This is a present snapshot only. It does not claim the group is growing or measure discussion quality, trust, or formation."
    ],
    evidence: [
      {
        label: "Current roster and leadership",
        value: `${largest.memberCount} students, ${largest.leaderIds.length} leaders (${oneDecimal(ratio)} per leader)`,
        explanation: `${leaderNames.join(" and ")} are the named leaders on the current group record. Student identities are not included in this narrative.`,
        calculation: "Count current volunteer_hub_small_group_members rows for the group and divide by its named leader and co-leader count.",
        sourceDateRange: "Current roster snapshot",
        sourceRecords: [
          { id: largest.group.id, type: "small_group", label: largest.group.name },
          ...largest.leaderIds.map((id) => ({ id, type: "volunteer" as const, label: leaderById.get(id)?.name ?? "Named leader" }))
        ]
      },
      {
        label: "Visible group comparison",
        value: groups.map((item) => `${item.group.name}: ${item.memberCount}`).join("; "),
        explanation: "Only active groups with both linked members and named leadership are compared.",
        calculation: "Sort eligible current small groups by linked membership count, descending.",
        sourceDateRange: "Current roster snapshot",
        sourceRecords: groups.map((item) => ({ id: item.group.id, type: "small_group", label: item.group.name }))
      }
    ],
    unknowns: [
      "The records do not show attendance consistency, discussion quality, trust, follow-up, room dynamics, or leader experience.",
      "Current membership does not establish that a group is growing or shrinking.",
      "A ratio is context for leadership conversation, not a software-defined capacity limit."
    ],
    discernmentQuestion: `What would ${leaderNames.join(" and ")} say about whether ${largest.group.name} still has room for every student to be known well?`,
    action: { href: "/people", label: "Review small groups" }
  };
}

function evidenceGap(input: {
  id: AuthenticatedMinistryNarrativeId;
  navigationLabel: string;
  eyebrow: string;
  headline: string;
  ministryArea: string;
  timeframe: string;
  whatChanged: string;
  whyItMayMatter: string;
  unknown: string;
  question: string;
  action: { href: string; label: string };
}): AuthenticatedMinistryNarrative {
  return {
    id: input.id,
    status: "insufficient_evidence",
    navigationLabel: input.navigationLabel,
    eyebrow: input.eyebrow,
    headline: input.headline,
    ministryArea: input.ministryArea,
    timeframe: input.timeframe,
    people: ["ministry leadership"],
    whatChanged: input.whatChanged,
    whyItMayMatter: [input.whyItMayMatter],
    evidence: [],
    unknowns: [input.unknown],
    discernmentQuestion: input.question,
    action: input.action
  };
}

type AttendanceWeek = {
  weekStart: string;
  attendeeCount: number;
  records: PlanningCenterAttendanceRecord[];
};

function attendanceByWeek(records: PlanningCenterAttendanceRecord[]): AttendanceWeek[] {
  const weeks = new Map<string, PlanningCenterAttendanceRecord[]>();
  for (const record of records) {
    const week = startOfWeek(record.checkedInAt!);
    weeks.set(week, [...(weeks.get(week) ?? []), record]);
  }
  return Array.from(weeks.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([weekStart, weekRecords]) => ({
      weekStart,
      attendeeCount: new Set(weekRecords.map((item) => item.externalPersonId ?? item.id)).size,
      records: weekRecords
    }));
}

function attendanceSourceRecords(weeks: AttendanceWeek[]): MinistryNarrativeSourceRecord[] {
  const sources = new Map<string, MinistryNarrativeSourceRecord>();
  for (const week of weeks) {
    for (const record of week.records) {
      const date = record.checkedInAt?.slice(0, 10) ?? week.weekStart;
      const id = record.externalEventId || `${record.sessionLabel ?? "attendance"}-${date}`;
      if (!sources.has(id)) {
        sources.set(id, {
          id,
          type: "attendance_session",
          label: [record.sessionLabel, record.locationLabel].filter(Boolean).join(" · ") || `Attendance session for ${formatDate(date)}`,
          date
        });
      }
    }
  }
  return Array.from(sources.values()).sort((left, right) => `${left.date}-${left.id}`.localeCompare(`${right.date}-${right.id}`));
}

function assignmentSource(
  assignment: MinistryVolunteerEventAssignment,
  eventTitle: string,
  eventDate: string
): MinistryNarrativeSourceRecord {
  return {
    id: `${assignment.eventId}:${assignment.leaderId}`,
    type: "serving_assignment",
    label: eventTitle,
    date: eventDate
  };
}

function startOfWeek(value: string) {
  const date = new Date(value);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - day);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function rangeForWeeks(weeks: AttendanceWeek[]) {
  return `${formatDate(weeks[0]?.weekStart)}–${formatDate(weeks.at(-1)?.weekStart)}`;
}

function dateRange(values: string[]) {
  const dates = values.filter(Boolean).sort();
  return dates.length ? `${formatDate(dates[0])}–${formatDate(dates.at(-1))}` : "Date range unavailable";
}

function displayUser(user: MinistryOverview["users"][number]) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function countBy<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function percentChange(value: number, baseline: number) {
  return baseline ? ((value - baseline) / baseline) * 100 : 0;
}

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${oneDecimal(value)}%`;
}

function oneDecimal(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatDate(value: string | undefined) {
  if (!value) return "date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
