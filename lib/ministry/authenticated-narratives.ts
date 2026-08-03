import type { MinistryOverview } from "@/lib/data/ministry-repository";
import type { MinistryEmmaResponse } from "@/lib/emma/ministry-page-assistant";
import { defaultNarrativeSignal, rankMinistryNarratives } from "@/lib/ministry/narrative-ranking";
import type { MinistryNarrative, MinistryNarrativeSourceRecord, MinistryNarrativeSignal } from "@/lib/ministry/narrative-types";

export const authenticatedMinistryNarrativeIds = [
  "participation-rhythm",
  "participation-continuity",
  "shared-responsibility",
  "operational-follow-through",
  "volunteer-serving-rhythm",
  "volunteer-readiness",
  "relational-capacity",
  "relational-coverage"
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

export type PlanningCenterPersonSnapshot = {
  externalPersonId: string;
  grade: string | null;
  ageBand: string | null;
  lastSyncedAt: string;
};

export type PlanningCenterSyncSnapshot = {
  status: "succeeded" | "failed";
  peopleCount: number;
  attendanceCount: number;
  startedAt: string;
  completedAt: string;
};

export type MinistryVolunteerLeader = {
  id: string;
  profileUserId: string | null;
  name: string;
  roleLabel: string;
  servingAreas: string[];
  availability: string;
  skills: string[];
  backgroundCheckExpires: string | null;
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
  studentSource: "planning_center" | "camp_clc";
  studentRefId: string;
  createdAt: string;
};

export type MinistryVolunteerEventAssignment = { eventId: string; leaderId: string; createdAt: string };
export type MinistryVolunteerRequiredItem = {
  id: string;
  itemType: "task" | "resource" | "training" | "onboarding";
  title: string;
  dueDate: string | null;
  required: boolean;
  blocksStudentContact: boolean;
};
export type MinistryVolunteerItemProgress = { itemId: string; userId: string; completed: boolean; completedAt: string | null };
export type MinistryVolunteerFollowUp = { id: string; volunteerLeaderId: string | null; status: "assigned" | "completed"; createdAt: string; updatedAt: string };

export type AuthenticatedMinistryNarrativeContext = {
  overview: MinistryOverview;
  planningCenter: {
    available: boolean;
    peopleAvailable: boolean;
    syncHistoryAvailable: boolean;
    connectionStatus: "connected" | "disconnected" | "error" | "unavailable";
    lastSyncAt?: string;
    attendance: PlanningCenterAttendanceRecord[];
    people: PlanningCenterPersonSnapshot[];
    syncRuns: PlanningCenterSyncSnapshot[];
  };
  volunteerHub: {
    available: boolean;
    assignmentsAvailable: boolean;
    groupsAvailable: boolean;
    readinessAvailable: boolean;
    followUpsAvailable: boolean;
    leaders: MinistryVolunteerLeader[];
    groups: MinistryVolunteerGroup[];
    members: MinistryVolunteerGroupMember[];
    assignments: MinistryVolunteerEventAssignment[];
    requiredItems: MinistryVolunteerRequiredItem[];
    itemProgress: MinistryVolunteerItemProgress[];
    followUps: MinistryVolunteerFollowUp[];
  };
};

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const PLANNING_CENTER_FRESH_DAYS = 45;

export function buildAuthenticatedMinistryNarratives(context: AuthenticatedMinistryNarrativeContext, now = new Date()) {
  return rankMinistryNarratives([
    buildParticipationNarrative(context, now),
    buildParticipationContinuityNarrative(context, now),
    buildResponsibilityNarrative(context),
    buildOperationalFollowThroughNarrative(context, now),
    buildVolunteerServingNarrative(context, now),
    buildVolunteerReadinessNarrative(context, now),
    buildRelationalCapacityNarrative(context),
    buildRelationalCoverageNarrative(context, now)
  ] satisfies AuthenticatedMinistryNarrative[]);
}

export function buildAuthenticatedMinistryNarrativeById(id: AuthenticatedMinistryNarrativeId, context: AuthenticatedMinistryNarrativeContext, now = new Date()) {
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
    signal: narrative.signal ? {
      attention: narrative.signal.attention,
      confidence: narrative.signal.confidence,
      coverage: narrative.signal.coverage,
      freshness: narrative.signal.freshness,
      whySurfaced: narrative.signal.whySurfaced
    } : undefined,
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

export function buildAuthenticatedNarrativeEmmaResponse(narrative: AuthenticatedMinistryNarrative): MinistryEmmaResponse {
  return {
    summary: narrative.status === "supported"
      ? `${narrative.headline} This is a record-backed observation for leadership review, not a conclusion about spiritual health, motivation, or calling.`
      : `${narrative.headline} The current ministry records do not support a stronger conclusion, so the evidence gap remains explicit.`,
    points: narrative.evidence.length
      ? [...narrative.evidence.slice(0, 2).map((item) => `${item.label}: ${item.value}`), `Evidence boundary: ${narrative.unknowns[0]}`]
      : [narrative.whatChanged, `Evidence boundary: ${narrative.unknowns[0]}`],
    nextActions: [narrative.discernmentQuestion, narrative.action?.label ?? "Review the source records before deciding whether a response is needed."]
  };
}

function buildParticipationNarrative(context: AuthenticatedMinistryNarrativeContext, now: Date): AuthenticatedMinistryNarrative {
  const state = attendanceState(context, now);
  if (state.reason || state.completeWeeks.length < 8) {
    return evidenceGap({
      id: "participation-rhythm", navigationLabel: "Participation rhythm", eyebrow: "Participation rhythm",
      headline: "Participation rhythm needs eight recent complete weeks.", ministryArea: "Planning Center attendance",
      timeframe: context.planningCenter.lastSyncAt ? `Last synced ${formatDate(context.planningCenter.lastSyncAt)}` : "No current sync window",
      whatChanged: state.reason ?? `${state.completeWeeks.length} complete attendance weeks are available; eight are required.`,
      whyItMayMatter: "A trustworthy rhythm comparison needs a recent, bounded window so an old season or partial current week does not masquerade as a trend.",
      unknown: "The records cannot yet establish whether current weekly participation is changing.",
      question: "What attendance history should leadership review before interpreting current participation?",
      action: { href: "/settings", label: "Review Planning Center" }, tags: ["participation", "students", "formation"]
    });
  }

  const window = state.completeWeeks.slice(-8);
  const early = window.slice(0, 4);
  const recent = window.slice(4);
  const earlyAverage = average(early.map((week) => week.attendeeCount));
  const recentAverage = average(recent.map((week) => week.attendeeCount));
  const absoluteChange = recentAverage - earlyAverage;
  const change = earlyAverage > 0 ? (absoluteChange / earlyAverage) * 100 : null;
  const direction = absoluteChange > 0.25 ? "increased" : absoluteChange < -0.25 ? "decreased" : "remained broadly steady";
  const coverage = weekCoverage(window);

  return supported({
    id: "participation-rhythm", navigationLabel: "Participation rhythm", eyebrow: "Participation rhythm",
    headline: `Weekly participation ${direction} across the latest complete eight-week window.`,
    ministryArea: "Planning Center attendance", timeframe: `${formatDate(early[0]?.weekStart)}–${formatDate(recent.at(-1)?.weekStart)}`,
    people: ["students represented in aggregated check-in records"],
    whatChanged: `Average unique weekly check-ins moved from ${oneDecimal(earlyAverage)} to ${oneDecimal(recentAverage)}${change === null ? ` (an absolute change of ${signedNumber(absoluteChange)})` : ` (${signedPercent(change)})`}.`,
    whyItMayMatter: [
      "A changing weekly rhythm can direct leadership toward the ministry settings and conversations that deserve closer listening.",
      "Check-ins show presence, not belonging, discipleship, family context, or relationship quality."
    ],
    evidence: [
      evidence("Early four-week average", `${oneDecimal(earlyAverage)} unique weekly check-ins`, "The first four weeks in the latest complete eight-week window.", "Mean count of distinct Planning Center person references for each complete week.", rangeForWeeks(early), attendanceSourceRecords(early)),
      evidence("Recent four-week average", `${oneDecimal(recentAverage)} unique weekly check-ins${change === null ? "" : ` (${signedPercent(change)})`}`, "The four most recent complete weeks; the current partial week is excluded.", "Mean count of distinct Planning Center person references for each complete week, compared with the preceding four.", rangeForWeeks(recent), attendanceSourceRecords(recent))
    ],
    unknowns: ["Attendance does not explain why participation changed or what students experienced.", "The aggregate cannot establish belonging, formation, or movement between programs.", "Missing check-ins can affect the comparison."],
    discernmentQuestion: "What ministry, family, and relational context belongs beside this participation rhythm before leadership responds?",
    action: { href: "/people", label: "Review related people rhythms" },
    signal: signal(Math.abs(change ?? absoluteChange) >= 15 ? "high" : "watch", coverage >= 0.9 ? "high" : "medium", `${window.length} complete weeks; ${Math.round(coverage * 100)}% weekly continuity`, syncFreshness(context, now), "The latest four complete weeks differ from the preceding four.", ["participation", "students", "formation"])
  });
}

function buildParticipationContinuityNarrative(context: AuthenticatedMinistryNarrativeContext, now: Date): AuthenticatedMinistryNarrative {
  const state = attendanceState(context, now);
  const weeks = state.completeWeeks.slice(-8);
  const identifiable = weeks.flatMap((week) => week.records.filter((record) => record.externalPersonId));
  const all = weeks.flatMap((week) => week.records);
  const identifiedCoverage = all.length ? identifiable.length / all.length : 0;
  const byPerson = countBy(identifiable, (record) => record.externalPersonId!);
  if (state.reason || weeks.length < 8 || byPerson.size < 10 || identifiedCoverage < 0.7) {
    return evidenceGap({
      id: "participation-continuity", navigationLabel: "Participation continuity", eyebrow: "Relational continuity",
      headline: "Repeat participation needs a stronger identifiable attendance window.", ministryArea: "Planning Center attendance",
      timeframe: context.planningCenter.lastSyncAt ? `Last synced ${formatDate(context.planningCenter.lastSyncAt)}` : "No current sync window",
      whatChanged: state.reason ?? `${weeks.length} complete weeks, ${byPerson.size} identifiable participants, and ${Math.round(identifiedCoverage * 100)}% identifiable check-in coverage are available. Eight weeks, ten people, and 70% coverage are required.`,
      whyItMayMatter: "Weekly totals can look stable while the students participating change. Aggregate continuity helps leadership notice that hidden difference without exposing names.",
      unknown: "The available records cannot yet distinguish repeat participation from one-time check-ins.",
      question: "What attendance identification and relational context are needed to review continuity responsibly?",
      action: { href: "/settings", label: "Review Planning Center" }, tags: ["belonging", "students", "relationships"]
    });
  }
  const oneTime = Array.from(byPerson.values()).filter((count) => count === 1).length;
  const returning = Array.from(byPerson.values()).filter((count) => count >= 2).length;
  const consistent = Array.from(byPerson.values()).filter((count) => count >= 4).length;
  const returnShare = (returning / byPerson.size) * 100;
  return supported({
    id: "participation-continuity", navigationLabel: "Participation continuity", eyebrow: "Relational continuity",
    headline: `${oneDecimal(returnShare)}% of identifiable participants returned within the latest eight complete weeks.`,
    ministryArea: "Planning Center attendance", timeframe: rangeForWeeks(weeks), people: ["students represented by anonymous external references"],
    whatChanged: `${returning} of ${byPerson.size} identifiable participants appeared in at least two weeks; ${consistent} appeared in four or more and ${oneTime} appeared once.`,
    whyItMayMatter: ["Stable totals can conceal changing faces. Continuity can help leaders ask whether ministry rhythms are creating repeated opportunities for relationship.", "Repeat attendance is not proof of belonging or spiritual formation."],
    evidence: [
      evidence("Returning participation", `${returning} of ${byPerson.size} (${oneDecimal(returnShare)}%)`, "Only anonymized person-reference frequency is used; no identities reach the narrative.", "Count unique person references present in at least two of the latest eight complete weeks.", rangeForWeeks(weeks), attendanceSourceRecords(weeks)),
      evidence("Continuity distribution", `${consistent} in 4+ weeks; ${returning - consistent} in 2–3; ${oneTime} once`, "Frequency bands reveal churn that a weekly average can hide.", "Group unique person references by number of distinct complete weeks attended.", rangeForWeeks(weeks), attendanceSourceRecords(weeks))
    ],
    unknowns: ["Repeat check-ins cannot establish relationship quality, belonging, or formation.", "A person may attend an untracked setting or be missing because of check-in practice.", "The records do not explain one-time participation."],
    discernmentQuestion: "Where do leaders see strong relational continuity, and where should they listen before assuming why participation is occasional?",
    action: { href: "/people", label: "Review relational follow-up" },
    signal: signal(oneTime / byPerson.size >= 0.4 ? "high" : "watch", identifiedCoverage >= 0.9 ? "high" : "medium", `${byPerson.size} identifiable participants; ${Math.round(identifiedCoverage * 100)}% check-in identification`, syncFreshness(context, now), "Continuity shows whether stable totals represent recurring relationships or changing participants.", ["belonging", "students", "relationships"])
  });
}

function buildResponsibilityNarrative(context: AuthenticatedMinistryNarrativeContext): AuthenticatedMinistryNarrative {
  const events = context.overview.events.filter((event) => !event.archivedAt && event.status !== "completed");
  const tasks = context.overview.tasks.filter((task) => task.status !== "done");
  const names = new Map(context.overview.users.map((user) => [user.id, displayUser(user)]));
  const assignedEvents = events.filter((event) => event.contactOwnerId);
  const assignedTasks = tasks.filter((task) => task.assignedUserId);
  const owners = new Set([...assignedEvents.map((event) => event.contactOwnerId!), ...assignedTasks.map((task) => task.assignedUserId)]);
  const assignedCount = assignedEvents.length + assignedTasks.length;
  if (assignedCount < 4 || owners.size < 2) {
    return evidenceGap({ id: "shared-responsibility", navigationLabel: "Shared responsibility", eyebrow: "Shared responsibility", headline: "Responsibility patterns need more assigned records.", ministryArea: "Events and open tasks", timeframe: "Current active records", whatChanged: `${assignedCount} assigned records are visible across ${owners.size} owners; four records and two owners are required.`, whyItMayMatter: "Leadership cannot review shared responsibility honestly until current work has clear ownership.", unknown: "The records cannot show whether responsibility is intentionally shared, concentrated, or incomplete.", question: "Which responsibilities need clearer ownership before leadership reviews capacity?", action: { href: "/tasks", label: "Review task ownership" }, tags: ["leaders", "capacity", "shared"] });
  }
  const eventCounts = countBy(assignedEvents, (event) => event.contactOwnerId!);
  const taskCounts = countBy(assignedTasks, (task) => task.assignedUserId);
  const distribution = Array.from(owners).map((ownerId) => ({ ownerId, name: names.get(ownerId) ?? "Unknown owner", events: eventCounts.get(ownerId) ?? 0, tasks: taskCounts.get(ownerId) ?? 0 })).sort((a, b) => (b.events + b.tasks) - (a.events + a.tasks) || a.name.localeCompare(b.name));
  const top = distribution[0]!;
  const totalRecords = events.length + tasks.length;
  const topCount = top.events + top.tasks;
  const topShare = totalRecords ? (topCount / totalRecords) * 100 : 0;
  const unassigned = totalRecords - assignedCount;
  const sources = [...assignedEvents.filter((event) => event.contactOwnerId === top.ownerId).map(eventSource), ...assignedTasks.filter((task) => task.assignedUserId === top.ownerId).map(taskSource)];
  return supported({
    id: "shared-responsibility", navigationLabel: "Shared responsibility", eyebrow: "Shared responsibility",
    headline: `${top.name} holds the largest visible share of current ownership.`, ministryArea: "Current events and open tasks", timeframe: dateRange([...events.map((event) => event.startTime), ...tasks.map((task) => task.dueDate)]), people: distribution.map((item) => item.name),
    whatChanged: `${top.name} owns ${top.events} event${top.events === 1 ? "" : "s"} and ${top.tasks} open task${top.tasks === 1 ? "" : "s"}; ${unassigned} of ${totalRecords} current records are unassigned.`,
    whyItMayMatter: ["Separating event ownership from task assignment helps leadership see where continuity depends on the same person across domains.", "Counts describe recorded ownership, not effort, difficulty, performance, stress, or burnout."],
    evidence: [
      evidence("Largest ownership share", `${topCount} of ${totalRecords} current records (${oneDecimal(topShare)}%)`, "Events and tasks are counted equally as visible ownership records, while the denominator includes unassigned records so missing ownership remains visible.", "Count current event owners and open-task assignees separately, then divide the top combined count by all current records.", dateRange([...events.map((event) => event.startTime), ...tasks.map((task) => task.dueDate)]), sources),
      evidence("Ownership by domain", distribution.map((item) => `${item.name}: ${item.events} events, ${item.tasks} tasks`).join("; "), `${unassigned} records have no named owner.`, "Group event contact owners and open-task assignees independently by canonical user ID.", "Current active records", [...assignedEvents.map(eventSource), ...assignedTasks.map(taskSource)])
    ],
    unknowns: ["Records do not contain availability, role expectations, delegated work outside the platform, or self-reported capacity.", "One event or task can require substantially more effort than another.", "Ownership concentration may be intentional and cannot establish burnout."],
    discernmentQuestion: "Is this cross-domain ownership pattern intentional for the current season, and where would shared context reduce fragility?",
    action: { href: "/tasks", label: "Review current ownership" },
    signal: signal(topShare >= 55 || unassigned / totalRecords >= 0.25 ? "high" : "watch", "high", `${assignedCount} assigned and ${unassigned} unassigned current records`, "Current operational snapshot", "One person leads the combined ownership distribution or a material share lacks ownership.", ["leaders", "capacity", "shared", "care"])
  });
}

function buildOperationalFollowThroughNarrative(context: AuthenticatedMinistryNarrativeContext, now: Date): AuthenticatedMinistryNarrative {
  const open = context.overview.tasks.filter((task) => task.status !== "done");
  const overdue = open.filter((task) => validDate(task.dueDate) && new Date(task.dueDate).getTime() < now.getTime());
  const blocked = open.filter((task) => task.status === "blocked");
  const upcoming = context.overview.events.filter((event) => !event.archivedAt && validDate(event.startTime) && new Date(event.startTime).getTime() >= now.getTime() && new Date(event.startTime).getTime() <= now.getTime() + 45 * DAY_MS);
  if (open.length < 4 && upcoming.length < 2) {
    return evidenceGap({ id: "operational-follow-through", navigationLabel: "Follow-through pressure", eyebrow: "Operational follow-through", headline: "Follow-through pressure needs more current work records.", ministryArea: "Tasks and upcoming events", timeframe: "Next 45 days", whatChanged: `${open.length} open tasks and ${upcoming.length} upcoming events are visible.`, whyItMayMatter: "Hidden execution pressure often appears where overdue work and near-term events overlap.", unknown: "The current records cannot support a meaningful follow-through comparison.", question: "Which upcoming work should be recorded before leadership reviews execution pressure?", action: { href: "/tasks", label: "Review current tasks" }, tags: ["capacity", "clarity", "events"] });
  }
  const overdueShare = open.length ? (overdue.length / open.length) * 100 : 0;
  const upcomingIds = new Set(upcoming.map((event) => event.id));
  const nearEventOpen = open.filter((task) => upcomingIds.has(task.eventId));
  return supported({
    id: "operational-follow-through", navigationLabel: "Follow-through pressure", eyebrow: "Operational follow-through", headline: `${overdue.length + blocked.length} open-task pressure signals sit beside ${upcoming.length} events in the next 45 days.`, ministryArea: "Tasks and upcoming events", timeframe: `Through ${formatDate(new Date(now.getTime() + 45 * DAY_MS).toISOString())}`, people: ["staff and leaders assigned to current work"],
    whatChanged: `${overdue.length} of ${open.length} open tasks are overdue (${oneDecimal(overdueShare)}%), ${blocked.length} are blocked, and ${nearEventOpen.length} open tasks are linked to near-term events.`,
    whyItMayMatter: ["Overdue or blocked work becomes more consequential when its event date is close, revealing coordination pressure a task total alone can hide.", "Status fields cannot show task complexity, informal progress, or whether dates were intentionally deferred."],
    evidence: [
      evidence("Overdue and blocked work", `${overdue.length} overdue; ${blocked.length} blocked`, "A task can appear in both groups, so these are pressure indicators rather than a combined unique-person score.", "Filter current non-done tasks by due date before today and status=blocked.", dateRange(open.map((task) => task.dueDate)), uniqueSources([...overdue.map(taskSource), ...blocked.map(taskSource)])),
      evidence("Near-term event linkage", `${nearEventOpen.length} open tasks across ${upcoming.length} upcoming events`, "Only events in the next 45 days are included.", "Join open tasks to non-archived events whose start time is within 45 days.", dateRange(upcoming.map((event) => event.startTime)), [...upcoming.map(eventSource), ...nearEventOpen.map(taskSource)])
    ],
    unknowns: ["Task records do not show informal progress, complexity, or all work performed outside the platform.", "An overdue date does not establish negligence or ministry risk.", "Upcoming event readiness also depends on people, communications, budget, and pastoral context."],
    discernmentQuestion: "Which overdue or blocked items threaten shared clarity for the next 45 days, and which dates should simply be corrected?",
    action: { href: "/tasks", label: "Review follow-through" },
    signal: signal(overdueShare >= 30 || blocked.length >= 2 ? "high" : "watch", "high", `${open.length} open tasks linked against ${upcoming.length} near-term events`, "Current operational snapshot", "Overdue or blocked work overlaps the near-term event calendar.", ["capacity", "clarity", "events", "leaders"])
  });
}

function buildVolunteerServingNarrative(context: AuthenticatedMinistryNarrativeContext, now: Date): AuthenticatedMinistryNarrative {
  const eventById = new Map(context.overview.events.map((event) => [event.id, event]));
  const leaderById = new Map(context.volunteerHub.leaders.map((leader) => [leader.id, leader]));
  const dated = context.volunteerHub.assignments.map((assignment) => ({ assignment, event: eventById.get(assignment.eventId), leader: leaderById.get(assignment.leaderId) })).filter((item): item is typeof item & { event: NonNullable<typeof item.event>; leader: NonNullable<typeof item.leader> } => Boolean(item.event && item.leader && validDate(item.event.startTime) && new Date(item.event.startTime).getTime() <= now.getTime()));
  const counts = countBy(dated, (item) => item.leader.id);
  if (!context.volunteerHub.assignmentsAvailable || dated.length < 4 || context.volunteerHub.leaders.length < 2) {
    return evidenceGap({ id: "volunteer-serving-rhythm", navigationLabel: "Volunteer serving rhythm", eyebrow: "Serving rhythm", headline: "Serving rhythm needs more completed-date assignment evidence.", ministryArea: "Volunteer Hub assignments", timeframe: "Past dated ministry events", whatChanged: context.volunteerHub.assignmentsAvailable ? `${dated.length} past dated assignments are visible across ${counts.size} leaders.` : "Volunteer assignment storage is not available.", whyItMayMatter: "A serving-rhythm review needs dated history and the full active leader roster, including leaders with no assignments.", unknown: "The records cannot yet support a comparison of rotation, continuity, or rest.", question: "What serving assignments and availability context should leadership record before reviewing rotation?", action: { href: "/people", label: "Review volunteer assignments" }, tags: ["volunteers", "leaders", "care", "serve"] });
  }
  const distribution = context.volunteerHub.leaders.map((leader) => ({ leader, count: counts.get(leader.id) ?? 0 })).sort((a, b) => b.count - a.count || a.leader.name.localeCompare(b.leader.name));
  const top = distribution[0]!;
  const medianCount = median(distribution.map((item) => item.count));
  const topAssignments = dated.filter((item) => item.leader.id === top.leader.id);
  const zeroAssigned = distribution.filter((item) => item.count === 0).length;
  const share = dated.length ? (top.count / dated.length) * 100 : 0;
  return supported({
    id: "volunteer-serving-rhythm", navigationLabel: "Volunteer serving rhythm", eyebrow: "Serving rhythm", headline: `${top.leader.name} appears most often in the completed-date assignment history.`, ministryArea: "Volunteer Hub assignments", timeframe: dateRange(dated.map((item) => item.event.startTime)), people: distribution.map((item) => item.leader.name),
    whatChanged: `${top.leader.name} appears on ${top.count} of ${dated.length} past assignments (${oneDecimal(share)}%); the active-leader median is ${oneDecimal(medianCount)} and ${zeroAssigned} active leaders have no recorded assignment.`,
    whyItMayMatter: ["Including zero-assignment leaders makes rotation opportunities visible while repeated assignments may reveal continuity or a need for support.", "Frequency cannot show preference, availability, cancellations, role complexity, or actual service completion."],
    evidence: [
      evidence(`${top.leader.name} assignment share`, `${top.count} of ${dated.length} (${oneDecimal(share)}%)`, "Future events are excluded and only assignments joined to a dated ministry event are counted.", "Count past event assignments by active leader ID.", dateRange(topAssignments.map((item) => item.event.startTime)), topAssignments.map((item) => assignmentSource(item.assignment, item.event.title, item.event.startTime))),
      evidence("Active-leader distribution", distribution.map((item) => `${item.leader.name}: ${item.count}`).join("; "), "The median includes active leaders with zero recorded assignments.", "Count past dated assignments for every active volunteer leader, inserting zero when no assignment exists.", dateRange(dated.map((item) => item.event.startTime)), dated.map((item) => assignmentSource(item.assignment, item.event.title, item.event.startTime)))
    ],
    unknowns: ["Availability, preferences, substitutions, and actual service completion are not represented.", "Assignments can require different preparation and relational energy.", "Frequency alone cannot establish overuse, readiness, calling, or need for rest."],
    discernmentQuestion: "Does this assignment rhythm reflect intentional continuity and availability, or should leadership review rotation, mentoring, and rest?",
    action: { href: "/people", label: "Open Volunteer Hub" },
    signal: signal(share >= 50 || zeroAssigned >= 2 ? "high" : "watch", "medium", `${dated.length} past assignments across ${context.volunteerHub.leaders.length} active leaders`, "Past dated events only", "The complete active roster reveals concentration and unused capacity that assigned-only counts hide.", ["volunteers", "leaders", "care", "serve"])
  });
}

function buildVolunteerReadinessNarrative(context: AuthenticatedMinistryNarrativeContext, now: Date): AuthenticatedMinistryNarrative {
  const hub = context.volunteerHub;
  const linked = hub.leaders.filter((leader) => leader.profileUserId);
  const required = hub.requiredItems.filter((item) => item.required);
  if (!hub.readinessAvailable || linked.length < 2 || required.length < 1) {
    return evidenceGap({ id: "volunteer-readiness", navigationLabel: "Volunteer readiness", eyebrow: "Readiness and care", headline: "Volunteer readiness needs linked leaders and required-item records.", ministryArea: "Volunteer Hub readiness", timeframe: "Current requirements", whatChanged: hub.readinessAvailable ? `${linked.length} active leaders are linked to user profiles and ${required.length} required items are visible.` : "Volunteer readiness tables are not available.", whyItMayMatter: "Serving frequency alone misses training, onboarding, availability, and safeguarding preparation.", unknown: "The current records cannot show whether active leaders are ready for their assigned ministry contexts.", question: "Which readiness requirements should leadership clarify before reviewing volunteer deployment?", action: { href: "/people", label: "Review volunteer readiness" }, tags: ["volunteers", "training", "onboarding", "care"] });
  }
  const completed = new Set(hub.itemProgress.filter((item) => item.completed).map((item) => `${item.userId}:${item.itemId}`));
  const missing = linked.flatMap((leader) => required.filter((item) => !completed.has(`${leader.profileUserId}:${item.id}`)).map((item) => ({ leader, item })));
  const expiring = hub.leaders.filter((leader) => leader.backgroundCheckExpires && validDate(leader.backgroundCheckExpires) && new Date(leader.backgroundCheckExpires).getTime() <= now.getTime() + 45 * DAY_MS);
  const availabilityUnknown = hub.leaders.filter((leader) => !leader.availability.trim() || /not synced|unknown/i.test(leader.availability)).length;
  const agedFollowUps = hub.followUps.filter((item) => item.status === "assigned" && validDate(item.createdAt) && now.getTime() - new Date(item.createdAt).getTime() > 14 * DAY_MS);
  const totalRequirements = linked.length * required.length;
  const completionShare = totalRequirements ? ((totalRequirements - missing.length) / totalRequirements) * 100 : 0;
  return supported({
    id: "volunteer-readiness", navigationLabel: "Volunteer readiness", eyebrow: "Readiness and care", headline: `${missing.length} required volunteer-readiness records remain incomplete across linked active leaders.`, ministryArea: "Volunteer Hub readiness", timeframe: "Current requirements and next 45 days", people: ["active volunteer leaders represented by aggregate readiness records"],
    whatChanged: `${oneDecimal(completionShare)}% of required leader-item combinations are complete; ${expiring.length} background-check dates are expired or within 45 days, ${availabilityUnknown} availability profiles are unknown, and ${agedFollowUps.length} assigned follow-ups are older than 14 days.`,
    whyItMayMatter: ["Readiness combines training, onboarding, safeguarding dates, availability, and follow-through rather than treating assignment frequency as the whole volunteer story.", "An incomplete record may reflect missing documentation rather than a leader who is unprepared."],
    evidence: [
      evidence("Required-item completion", `${totalRequirements - missing.length} of ${totalRequirements} (${oneDecimal(completionShare)}%)`, "Calculated only for active leaders linked to authenticated user profiles.", "Cross join linked active leaders with required unarchived items, then subtract completed progress rows.", "Current snapshot", uniqueSources(required.map((item) => ({ id: item.id, type: "volunteer_readiness" as const, label: item.title, date: item.dueDate ?? undefined })))),
      evidence("Readiness boundaries", `${expiring.length} check dates; ${availabilityUnknown} availability gaps; ${agedFollowUps.length} aged follow-ups`, "No follow-up notes, student references, emails, or personal attendance histories are included.", "Aggregate leader readiness fields and count assigned follow-ups older than 14 days.", "Current snapshot", [...expiring.map(volunteerSource), ...agedFollowUps.map((item) => ({ id: item.id, type: "follow_up" as const, label: "Assigned follow-up", date: item.createdAt }))])
    ],
    unknowns: ["Missing progress may reflect incomplete documentation rather than actual unreadiness.", "Readiness fields do not measure calling, spiritual maturity, or relational fit.", "Follow-up counts omit the pastoral content and student identity by design."],
    discernmentQuestion: "Which readiness gaps require support or documentation before leaders are asked to carry more relational responsibility?",
    action: { href: "/people", label: "Review readiness records" },
    signal: signal(completionShare < 75 || expiring.length > 0 || agedFollowUps.length > 0 ? "high" : "watch", hub.followUpsAvailable ? "high" : "medium", `${linked.length} linked leaders × ${required.length} requirements`, "Current readiness snapshot", "Training, safeguarding, availability, and follow-up records reveal capacity constraints that assignments alone cannot show.", ["volunteers", "training", "onboarding", "care", "leaders"])
  });
}

function buildRelationalCapacityNarrative(context: AuthenticatedMinistryNarrativeContext): AuthenticatedMinistryNarrative {
  const hub = context.volunteerHub;
  if (!hub.groupsAvailable || hub.groups.length < 1 || hub.members.length < 4) {
    return evidenceGap({ id: "relational-capacity", navigationLabel: "Relational capacity", eyebrow: "Relational capacity", headline: "Relational capacity needs current group and membership records.", ministryArea: "Volunteer Hub small groups", timeframe: "Current membership snapshot", whatChanged: hub.groupsAvailable ? `${hub.groups.length} groups and ${hub.members.length} linked members are visible.` : "Small-group records are not available.", whyItMayMatter: "Current group membership can support a capacity snapshot, but not a growth claim without history.", unknown: "The records cannot yet support a meaningful current student-to-leader comparison.", question: "Which group and leader records need attention before leadership reviews relational capacity?", action: { href: "/people", label: "Review small groups" }, tags: ["groups", "relationships", "leaders", "belonging"] });
  }
  const leaderIds = new Set(hub.leaders.map((leader) => leader.id));
  const groups = hub.groups.map((group) => {
    const members = hub.members.filter((member) => member.groupId === group.id).length;
    const leaderCount = new Set([group.leaderId, group.coLeaderId].filter((id): id is string => Boolean(id && leaderIds.has(id)))).size;
    return { group, members, leaderCount, ratio: leaderCount ? members / leaderCount : Number.POSITIVE_INFINITY };
  }).sort((a, b) => b.ratio - a.ratio || b.members - a.members || a.group.name.localeCompare(b.group.name));
  const highest = groups[0]!;
  const leaderless = groups.filter((item) => item.leaderCount === 0).length;
  const empty = groups.filter((item) => item.members === 0).length;
  const totalMembers = groups.reduce((sum, item) => sum + item.members, 0);
  const activeGroupLeaders = new Set(groups.flatMap((item) => [item.group.leaderId, item.group.coLeaderId]).filter((id): id is string => Boolean(id && leaderIds.has(id)))).size;
  return supported({
    id: "relational-capacity", navigationLabel: "Relational capacity", eyebrow: "Relational capacity", headline: leaderless ? `${leaderless} current groups have members but no active recorded leader.` : `${highest.group.name} has the highest current student-to-leader ratio.`, ministryArea: "Volunteer Hub small groups", timeframe: "Current membership snapshot; no historical growth claim", people: ["students represented by group membership links", "active small-group leaders"], groupName: highest.group.name,
    whatChanged: `${totalMembers} linked memberships sit across ${groups.length} groups and ${activeGroupLeaders} active group leaders; ${highest.group.name} has ${highest.members} members and ${highest.leaderCount} active recorded leaders.`,
    whyItMayMatter: ["Comparing every group makes leaderless groups, empty groups, and uneven relational load visible instead of showing only the largest group.", "Membership and leader counts describe current structure, not belonging quality, discipleship depth, or growth."],
    evidence: [
      evidence("Highest current ratio", highest.leaderCount ? `${oneDecimal(highest.ratio)} students per active recorded leader` : `${highest.members} students with no active recorded leader`, "Ratios use only active Volunteer Hub leader references.", "Count current member rows divided by distinct active leader and co-leader IDs for each group.", "Current snapshot", [groupSource(highest.group)]),
      evidence("Group balance", `${leaderless} leaderless; ${empty} empty; ${groups.length} total groups`, groups.map((item) => `${item.group.name}: ${item.members} students / ${item.leaderCount} leaders`).join("; "), "Compare membership and active leader coverage for every current group.", "Current snapshot", groups.map((item) => groupSource(item.group)))
    ],
    unknowns: ["Membership records do not measure belonging, discipleship depth, leader availability, or relationship quality.", "Current records cannot establish growth because historical membership snapshots do not exist.", "Some relationships may occur outside formal small groups."],
    discernmentQuestion: "Where does the current group structure invite more leader support, smaller relational circles, or correction of missing records?",
    action: { href: "/people", label: "Review small groups" },
    signal: signal(leaderless > 0 || (Number.isFinite(highest.ratio) && highest.ratio >= 10) ? "high" : "watch", "high", `${totalMembers} memberships across ${groups.length} current groups`, "Current snapshot only", "Comparing every group reveals leaderless and uneven structures hidden by the largest-group view.", ["groups", "relationships", "leaders", "belonging"])
  });
}

function buildRelationalCoverageNarrative(context: AuthenticatedMinistryNarrativeContext, now: Date): AuthenticatedMinistryNarrative {
  const pc = context.planningCenter;
  const lastSync = pc.lastSyncAt && validDate(pc.lastSyncAt) ? new Date(pc.lastSyncAt) : null;
  const peopleStale = !lastSync || now.getTime() - lastSync.getTime() > PLANNING_CENTER_FRESH_DAYS * DAY_MS;
  const eligible = pc.people.filter((person) => Boolean(person.grade || person.ageBand));
  const grouped = new Set(context.volunteerHub.members.filter((member) => member.studentSource === "planning_center").map((member) => member.studentRefId));
  if (!pc.peopleAvailable || pc.connectionStatus !== "connected" || peopleStale || !context.volunteerHub.groupsAvailable || eligible.length < 10) {
    const reason = !pc.peopleAvailable ? "Planning Center people references are unavailable." : pc.connectionStatus !== "connected" ? "Planning Center is not connected." : peopleStale ? "The Planning Center people snapshot is too old for a current coverage comparison." : !context.volunteerHub.groupsAvailable ? "Current Volunteer Hub group membership is unavailable." : `${eligible.length} age- or grade-identified people are available; ten are required for an aggregate comparison.`;
    return evidenceGap({ id: "relational-coverage", navigationLabel: "Relational coverage", eyebrow: "Relational coverage", headline: "Relational coverage needs a current Planning Center people snapshot.", ministryArea: "Planning Center people and Volunteer Hub groups", timeframe: pc.lastSyncAt ? `Last synced ${formatDate(pc.lastSyncAt)}` : "No current people snapshot", whatChanged: reason, whyItMayMatter: "Attendance and group capacity answer different questions. Joining anonymous references can reveal how much of the eligible ministry population has a recorded small-group connection.", unknown: "The records cannot yet estimate formal small-group coverage.", question: "Which people and group records should be reconciled before leadership reviews relational coverage?", action: { href: "/settings", label: "Review Planning Center" }, tags: ["groups", "belonging", "students", "relationships"] });
  }
  const assigned = eligible.filter((person) => grouped.has(person.externalPersonId)).length;
  const unassigned = eligible.length - assigned;
  const coverage = (assigned / eligible.length) * 100;
  const grades = countBy(eligible, (person) => person.grade ?? person.ageBand ?? "Unknown");
  return supported({
    id: "relational-coverage", navigationLabel: "Relational coverage", eyebrow: "Relational coverage", headline: `${oneDecimal(coverage)}% of the current age- or grade-identified Planning Center snapshot has a recorded small-group membership.`, ministryArea: "Planning Center people and Volunteer Hub groups", timeframe: pc.lastSyncAt ? `Current snapshot synced ${formatDate(pc.lastSyncAt)}` : "Current snapshot", people: ["students represented by anonymous Planning Center references"],
    whatChanged: `${assigned} of ${eligible.length} eligible people references are linked to a current group; ${unassigned} have no recorded group link.`,
    whyItMayMatter: ["Crossing the people snapshot with group membership reveals a relational coverage gap that attendance totals and group ratios cannot show alone.", "No student names, households, contact details, or raw reference lists are exposed."],
    evidence: [
      evidence("Recorded group coverage", `${assigned} of ${eligible.length} (${oneDecimal(coverage)}%)`, "Only anonymous external person references are intersected on the server.", "Count age- or grade-identified Planning Center people whose external reference appears in a current planning_center group-member row.", pc.lastSyncAt ? formatDate(pc.lastSyncAt) : "Current snapshot", [{ id: "planning-center-people-snapshot", type: "people_snapshot", label: `${eligible.length} anonymous eligible people references`, date: pc.lastSyncAt }]),
      evidence("Snapshot composition", Array.from(grades.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => `${label}: ${count}`).join("; "), "Composition helps leadership see whether a coverage rate may be skewed toward one age or grade band.", "Group current Planning Center people references by grade, falling back to age band.", pc.lastSyncAt ? formatDate(pc.lastSyncAt) : "Current snapshot", [{ id: "planning-center-people-composition", type: "people_snapshot", label: "Aggregated grade and age-band composition", date: pc.lastSyncAt }])
    ],
    unknowns: ["A missing formal group link does not mean a student lacks ministry relationships.", "Current people records may include people outside the intended small-group population.", "Coverage does not measure belonging quality, formation, or family context."],
    discernmentQuestion: "Which unlinked portion reflects a real invitation into relationship, and which portion reflects scope or record-quality differences?",
    action: { href: "/people", label: "Review group membership" },
    signal: signal(coverage < 60 ? "high" : "watch", "medium", `${eligible.length} eligible anonymous people references`, syncFreshness(context, now), "Anonymous cross-source reconciliation reveals formal relationship coverage hidden from attendance totals.", ["groups", "belonging", "students", "relationships"])
  });
}

type NarrativeInput = Omit<AuthenticatedMinistryNarrative, "status">;
function supported(input: NarrativeInput): AuthenticatedMinistryNarrative { return { status: "supported", ...input }; }
function evidenceGap(input: { id: AuthenticatedMinistryNarrativeId; navigationLabel: string; eyebrow: string; headline: string; ministryArea: string; timeframe: string; whatChanged: string; whyItMayMatter: string; unknown: string; question: string; action: { href: string; label: string }; tags: string[] }): AuthenticatedMinistryNarrative {
  const base: AuthenticatedMinistryNarrative = { id: input.id, status: "insufficient_evidence", navigationLabel: input.navigationLabel, eyebrow: input.eyebrow, headline: input.headline, ministryArea: input.ministryArea, timeframe: input.timeframe, people: ["authenticated ministry records only"], whatChanged: input.whatChanged, whyItMayMatter: [input.whyItMayMatter, "No sample values or guest records are substituted when evidence is missing."], evidence: [], unknowns: [input.unknown, "The absence of a record is not evidence that ministry activity or relationships are absent."], discernmentQuestion: input.question, action: input.action };
  return { ...base, signal: defaultNarrativeSignal(base, { alignmentTags: input.tags, whySurfaced: "This missing source prevents a trustworthy leadership signal.", coverage: "Evidence requirement not met", freshness: input.timeframe }) };
}

function signal(attention: MinistryNarrativeSignal["attention"], confidence: MinistryNarrativeSignal["confidence"], coverage: string, freshness: string, whySurfaced: string, alignmentTags: string[]): MinistryNarrativeSignal { return { attention, confidence, coverage, freshness, whySurfaced, alignmentTags }; }
function evidence(label: string, value: string, explanation: string, calculation: string, sourceDateRange: string, sourceRecords: MinistryNarrativeSourceRecord[]) { return { label, value, explanation, calculation, sourceDateRange, sourceRecords }; }

type AttendanceWeek = { weekStart: string; attendeeCount: number; records: PlanningCenterAttendanceRecord[] };
function attendanceState(context: AuthenticatedMinistryNarrativeContext, now: Date) {
  const pc = context.planningCenter;
  const lastSync = pc.lastSyncAt && validDate(pc.lastSyncAt) ? new Date(pc.lastSyncAt) : null;
  const reason = !pc.available ? "Planning Center attendance storage is unavailable." : pc.connectionStatus !== "connected" ? "Planning Center is not connected for this ministry." : !lastSync || now.getTime() - lastSync.getTime() > PLANNING_CENTER_FRESH_DAYS * DAY_MS ? "The latest Planning Center sync is too old to support a current comparison." : undefined;
  const currentWeek = startOfWeek(now.toISOString());
  const completeWeeks = attendanceByWeek(pc.attendance).filter((week) => week.weekStart < currentWeek).slice(-12);
  return { reason, completeWeeks };
}
function attendanceByWeek(records: PlanningCenterAttendanceRecord[]): AttendanceWeek[] {
  const weeks = new Map<string, PlanningCenterAttendanceRecord[]>();
  records.filter((record) => record.checkedInAt && validDate(record.checkedInAt)).forEach((record) => { const key = startOfWeek(record.checkedInAt!); weeks.set(key, [...(weeks.get(key) ?? []), record]); });
  return Array.from(weeks.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, weekRecords]) => ({ weekStart, records: weekRecords, attendeeCount: new Set(weekRecords.map((record) => record.externalPersonId ?? record.id)).size }));
}
function attendanceSourceRecords(weeks: AttendanceWeek[]): MinistryNarrativeSourceRecord[] { return weeks.map((week) => ({ id: `attendance-week-${week.weekStart}`, type: "attendance_session", label: `${week.attendeeCount} aggregated unique check-ins`, date: week.weekStart })); }
function weekCoverage(weeks: AttendanceWeek[]) { if (weeks.length < 2) return weeks.length ? 1 : 0; const span = Math.round((new Date(weeks.at(-1)!.weekStart).getTime() - new Date(weeks[0]!.weekStart).getTime()) / WEEK_MS) + 1; return weeks.length / span; }
function syncFreshness(context: AuthenticatedMinistryNarrativeContext, now: Date) { const value = context.planningCenter.lastSyncAt; if (!value || !validDate(value)) return "No usable sync timestamp"; const days = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / DAY_MS)); return `Synced ${days} day${days === 1 ? "" : "s"} ago`; }
function assignmentSource(assignment: MinistryVolunteerEventAssignment, title: string, date: string): MinistryNarrativeSourceRecord { return { id: `${assignment.eventId}:${assignment.leaderId}`, type: "serving_assignment", label: title, date }; }
function groupSource(group: MinistryVolunteerGroup): MinistryNarrativeSourceRecord { return { id: group.id, type: "small_group", label: group.name }; }
function volunteerSource(leader: MinistryVolunteerLeader): MinistryNarrativeSourceRecord { return { id: leader.id, type: "volunteer", label: `${leader.name} readiness record`, date: leader.backgroundCheckExpires ?? undefined }; }
function eventSource(event: MinistryOverview["events"][number]): MinistryNarrativeSourceRecord { return { id: event.id, type: "event", label: event.title, date: event.startTime }; }
function taskSource(task: MinistryOverview["tasks"][number]): MinistryNarrativeSourceRecord { return { id: task.id, type: "task", label: task.taskTitle, date: task.dueDate }; }
function uniqueSources(records: MinistryNarrativeSourceRecord[]) { return Array.from(new Map(records.map((record) => [`${record.type}:${record.id}`, record])).values()); }
function startOfWeek(value: string) { const date = new Date(value); const day = date.getUTCDay(); date.setUTCDate(date.getUTCDate() - day); date.setUTCHours(0, 0, 0, 0); return date.toISOString().slice(0, 10); }
function rangeForWeeks(weeks: AttendanceWeek[]) { return weeks.length ? `${formatDate(weeks[0]?.weekStart)}–${formatDate(weeks.at(-1)?.weekStart)}` : "No dated weeks"; }
function dateRange(values: string[]) { const dates = values.filter(validDate).sort(); return dates.length ? `${formatDate(dates[0])}–${formatDate(dates.at(-1))}` : "No dated records"; }
function displayUser(user: MinistryOverview["users"][number]) { return `${user.firstName} ${user.lastName}`.trim() || "Unnamed owner"; }
function countBy<T>(items: T[], key: (item: T) => string) { const counts = new Map<string, number>(); items.forEach((item) => { const value = key(item); counts.set(value, (counts.get(value) ?? 0) + 1); }); return counts; }
function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function median(values: number[]) { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle]! : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2; }
function signedPercent(value: number) { return `${value > 0 ? "+" : ""}${oneDecimal(value)}%`; }
function signedNumber(value: number) { return `${value > 0 ? "+" : ""}${oneDecimal(value)}`; }
function oneDecimal(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(1); }
function formatDate(value: string | undefined) { if (!value || !validDate(value)) return "Unknown date"; return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value)); }
function validDate(value: string) { return !Number.isNaN(new Date(value).getTime()); }
