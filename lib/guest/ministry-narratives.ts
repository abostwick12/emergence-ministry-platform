import type { MinistryEmmaResponse } from "@/lib/emma/ministry-page-assistant";
import type {
  MinistryNarrative,
  MinistryNarrativeEvidence,
  MinistryNarrativeSourceRecord
} from "@/lib/ministry/narrative-types";
import { defaultNarrativeSignal } from "@/lib/ministry/narrative-ranking";
import {
  buildLeadEmergenceDemoContext,
  LEAD_EMERGENCE_DEMO_HISTORY_YEAR,
  type DemoOccurrence,
  type LeadEmergenceDemoContext
} from "@/lib/guest/lead-emergence-demo-context";

export const guestMinistryNarrativeIds = [
  "sunday-friday-shift",
  "staff-responsibility-concentration",
  "volunteer-serving-pattern",
  "small-group-growth"
] as const;

export type GuestMinistryNarrativeId = (typeof guestMinistryNarrativeIds)[number];

export type GuestNarrativeSourceRecord = MinistryNarrativeSourceRecord;
export type GuestNarrativeEvidence = MinistryNarrativeEvidence;
export type GuestMinistryNarrative = MinistryNarrative<GuestMinistryNarrativeId>;

export function buildGuestMinistryNarratives(
  context: LeadEmergenceDemoContext = buildLeadEmergenceDemoContext()
): GuestMinistryNarrative[] {
  return [
    buildAttendanceNarrative(context),
    buildStaffNarrative(context),
    buildVolunteerNarrative(context),
    buildGroupNarrative(context)
  ].map(withGuestSignal);
}

function withGuestSignal(narrative: GuestMinistryNarrative): GuestMinistryNarrative {
  const settings = {
    "sunday-friday-shift": { attention: "high" as const, confidence: "high" as const, coverage: "One complete synthetic year across Sunday and Friday occurrences", freshness: "Synthetic 2025 history", whySurfaced: "Opposing participation movements across ministry settings can be hidden by a single attendance total.", alignmentTags: ["participation", "students", "formation"] },
    "staff-responsibility-concentration": { attention: "high" as const, confidence: "high" as const, coverage: "All canonical guest tasks and event ownership records", freshness: "Synthetic 2025–2026 plan", whySurfaced: "Cross-domain ownership and recorded task effort are concentrated with one staff leader.", alignmentTags: ["leaders", "capacity", "care"] },
    "volunteer-serving-pattern": { attention: "watch" as const, confidence: "high" as const, coverage: "All canonical guest serving assignments", freshness: "Synthetic 2025 history", whySurfaced: "The full volunteer distribution reveals repeated service and unused rotation capacity.", alignmentTags: ["volunteers", "serve", "leaders", "care"] },
    "small-group-growth": { attention: "watch" as const, confidence: "high" as const, coverage: "Canonical guest group snapshots and membership outcomes", freshness: "Synthetic 2025 history", whySurfaced: "Group change becomes meaningful when membership and leader structure are examined together.", alignmentTags: ["groups", "belonging", "relationships"] }
  }[narrative.id];
  return { ...narrative, signal: defaultNarrativeSignal(narrative, settings) };
}

export function buildGuestMinistryNarrativeById(
  id: GuestMinistryNarrativeId,
  context: LeadEmergenceDemoContext = buildLeadEmergenceDemoContext()
): GuestMinistryNarrative {
  const narrative = buildGuestMinistryNarratives(context).find((item) => item.id === id);
  if (!narrative) throw new Error(`Unknown guest Ministry Hub narrative: ${id}`);
  return narrative;
}

export function buildGuestNarrativeEmmaContext(narrative: GuestMinistryNarrative): string {
  const evidence = narrative.evidence
    .map((item) => `- ${item.label}: ${item.value} [${item.sourceDateRange}]`)
    .join("\n");
  return [
    `Selected guest Ministry Hub narrative: ${narrative.headline}`,
    `Ministry and people: ${narrative.ministryArea}; ${narrative.people.join(", ")}.`,
    `Timeframe: ${narrative.timeframe}.`,
    "Approved canonical evidence:",
    evidence,
    `Known limits: ${narrative.unknowns.join(" ")}`,
    `Leadership discernment question: ${narrative.discernmentQuestion}`
  ].join("\n");
}

export function buildGuestNarrativeEmmaResponse(
  narrative: GuestMinistryNarrative,
  leadershipPrompt: string
): MinistryEmmaResponse {
  void leadershipPrompt;
  return {
    summary: `${narrative.headline} This is a record-backed observation for leadership review, not a conclusion about spiritual health, motivation, or calling.`,
    points: [
      ...narrative.evidence.slice(0, 2).map((item) => `${item.label}: ${item.value}`),
      `What remains unknown: ${narrative.unknowns[0]}`
    ],
    nextActions: [
      narrative.discernmentQuestion,
      "Inspect the dated source records before deciding whether any ministry response is needed."
    ]
  };
}

function buildAttendanceNarrative(context: LeadEmergenceDemoContext): GuestMinistryNarrative {
  const historical = historicalOccurrences(context);
  const sunday = historical
    .filter((item) => item.kind === "sunday_service")
    .sort(byOccurrenceDate);
  const special = historical
    .filter((item) => item.kind === "special_event")
    .sort(byOccurrenceDate);
  const firstSundayQuarter = sunday.slice(0, 39);
  const lastSundayQuarter = sunday.slice(-39);
  const firstEventQuarter = special.slice(0, 3);
  const lastEventQuarter = special.slice(-3);
  const firstSundayAverage = average(firstSundayQuarter.map((item) => attendedCount(context, item)));
  const lastSundayAverage = average(lastSundayQuarter.map((item) => attendedCount(context, item)));
  const firstEventAverage = average(firstEventQuarter.map((item) => attendedCount(context, item)));
  const lastEventAverage = average(lastEventQuarter.map((item) => attendedCount(context, item)));
  const q4SundayStudents = attendedStudentIds(context, lastSundayQuarter);
  const q4EventStudents = attendedStudentIds(context, lastEventQuarter);
  const overlap = Array.from(q4EventStudents).filter((id) => q4SundayStudents.has(id)).length;
  const eventOnly = q4EventStudents.size - overlap;
  const firstEvent = special[0];
  const lastEvent = special.at(-1);

  return {
    id: "sunday-friday-shift",
    status: "supported",
    navigationLabel: "Participation rhythm",
    eyebrow: "Participation rhythm",
    headline: "Sunday participation fell while Friday event attendance grew.",
    ministryArea: "Middle School, High School, and NextGen Shared Events",
    timeframe: "January–December 2025, comparing the first and final 13 Sundays and the first and final three Friday events",
    people: ["middle school students", "high school students", "Sunday service leaders", "Friday event teams"],
    whatChanged: `Average attendance per Sunday service moved from ${oneDecimal(firstSundayAverage)} to ${oneDecimal(lastSundayAverage)}, while average Friday event attendance moved from ${oneDecimal(firstEventAverage)} to ${oneDecimal(lastEventAverage)}.`,
    whyItMayMatter: [
      "The records show students gathering in a changing mix of ministry settings. Leadership may want to understand what students encounter in the growing Friday rhythm and what has changed around regular Sunday participation.",
      "The overlap does not support a simple story that students replaced Sunday with Friday. Most fourth-quarter event participants also appeared on Sunday, while a smaller group appeared only in the Friday records."
    ],
    evidence: [
      {
        label: "Sunday service average",
        value: `${oneDecimal(firstSundayAverage)} → ${oneDecimal(lastSundayAverage)} per service (${signedPercent(lastSundayAverage, firstSundayAverage)})`,
        explanation: "The comparison includes both Middle School Sunday services and the High School Sunday night service.",
        calculation: "Mean attended count across 39 service occurrences in Jan 5–Mar 30 versus 39 service occurrences in Oct 5–Dec 28.",
        sourceDateRange: "2025-01-05–2025-12-28",
        sourceRecords: [...firstSundayQuarter, ...lastSundayQuarter].map(occurrenceSource)
      },
      {
        label: "Friday event average",
        value: `${oneDecimal(firstEventAverage)} → ${oneDecimal(lastEventAverage)} attendees (${signedPercent(lastEventAverage, firstEventAverage)})`,
        explanation: "The first-quarter comparison uses Winter Welcome Night, Serve Prep Lab, and Spring Rally; the fourth quarter uses Middle School Retreat, Friendsgiving Tables, and Christmas Serve Celebration.",
        calculation: "Mean attended count for the first three versus final three 2025 special-event outcomes.",
        sourceDateRange: "2025-01-17–2025-12-12",
        sourceRecords: [...firstEventQuarter, ...lastEventQuarter].flatMap((item) => [
          occurrenceSource(item),
          outcomeSource(context, item)
        ])
      },
      {
        label: "Bookend Friday events",
        value: `${firstEvent ? attendedCount(context, firstEvent) : 0} at Winter Welcome Night → ${lastEvent ? attendedCount(context, lastEvent) : 0} at Christmas Serve Celebration`,
        explanation: "Every recorded Friday event rises across the canonical 2025 sequence; the bookends make the scale visible without implying why it changed.",
        calculation: "Attended attendance rows linked to the first and last 2025 special-event occurrences.",
        sourceDateRange: "2025-01-17 and 2025-12-12",
        sourceRecords: [firstEvent, lastEvent].filter(isOccurrence).flatMap((item) => [
          occurrenceSource(item),
          outcomeSource(context, item)
        ])
      },
      {
        label: "Fourth-quarter overlap",
        value: `${overlap} of ${q4EventStudents.size} Friday participants also attended a Q4 Sunday service; ${eventOnly} did not`,
        explanation: "This distinguishes shared participation from event-only participation inside the same quarter.",
        calculation: "Unique student IDs with attended=true across Oct–Dec Friday events intersected with unique attended student IDs across Oct–Dec Sunday services.",
        sourceDateRange: "2025-10-05–2025-12-12",
        sourceRecords: [...lastSundayQuarter, ...lastEventQuarter].map(occurrenceSource)
      }
    ],
    unknowns: [
      "The records do not explain why attendance changed or what students experienced in either setting.",
      "They do not measure belonging, formation, family schedules, retention, or the quality of relationships.",
      "The comparison shows one synthetic year and cannot establish a long-term trend."
    ],
    discernmentQuestion: "What are students finding in the growing Friday rhythm, and what conversations would help leadership understand the Sunday decline without assuming the cause?"
  };
}

function buildStaffNarrative(context: LeadEmergenceDemoContext): GuestMinistryNarrative {
  const staffWork = context.staff.map((person) => {
    const tasks = context.tasks.filter((task) => (task.completedById ?? task.assignedOwnerId) === person.userId);
    return {
      id: person.userId,
      name: `${person.firstName} ${person.lastName}`,
      effort: tasks.reduce((total, task) => total + task.actualEffortHours, 0),
      tasks
    };
  });
  const mason = staffWork.find((item) => item.id === "guest_staff_ms");
  const totalEffort = staffWork.reduce((total, item) => total + item.effort, 0);
  const staffMedian = median(staffWork.map((item) => item.effort));
  const specialOccurrences = context.occurrences.filter((item) => item.kind === "special_event");
  const masonOwnedSpecial = specialOccurrences.filter((occurrence) => eventOwner(context, occurrence) === "guest_staff_ms");
  const communicationTasks = context.tasks.filter((task) =>
    task.assignedOwnerId === "guest_staff_ms"
    && task.title === "Prepare parent and leader communication preview"
  );
  const taskDates = context.tasks.map((task) => task.dueDate).sort();

  return {
    id: "staff-responsibility-concentration",
    status: "supported",
    navigationLabel: "Shared staff responsibility",
    eyebrow: "Shared responsibility",
    headline: "Shared ministry work is concentrated with Mason Bridge.",
    ministryArea: "Middle School operations and NextGen Shared Events",
    timeframe: `${taskDates[0]}–${taskDates.at(-1)} across recorded and planned 2025–2026 tasks`,
    people: ["Mason Bridge", "Hannah Vale", "Avery Northstar"],
    whatChanged: `Mason Bridge carries ${oneDecimal(percent(mason?.effort ?? 0, totalEffort))}% of the task-effort fields in the canonical two-year snapshot.`,
    whyItMayMatter: [
      "Shared events depend on preparation, communication, volunteer coordination, and follow-through that can become hard for a team to see when the work is distributed across records. The concentration may be intentional, but it deserves a named review because continuity currently depends heavily on one staff leader.",
      "These records show responsibility, not Mason’s internal experience or capacity. Leadership context is required before interpreting whether any change is appropriate."
    ],
    evidence: [
      {
        label: "Recorded effort share",
        value: `${oneDecimal(mason?.effort ?? 0)} of ${oneDecimal(totalEffort)} hours (${oneDecimal(percent(mason?.effort ?? 0, totalEffort))}%)`,
        explanation: "Effort is attributed to the recorded completer when present, otherwise to the assigned owner.",
        calculation: "Sum actualEffortHours for all 152 canonical tasks, grouped by completedById ?? assignedOwnerId.",
        sourceDateRange: `${taskDates[0]}–${taskDates.at(-1)}`,
        sourceRecords: (mason?.tasks ?? []).map((task) => taskSource(task))
      },
      {
        label: "Comparison with staff",
        value: `${oneDecimal(mason?.effort ?? 0)} hours versus a ${oneDecimal(staffMedian)}-hour staff median (${oneDecimal((mason?.effort ?? 0) / staffMedian)}×)`,
        explanation: "Hannah Vale has 119.75 recorded hours and Avery Northstar has 76; the median is 119.75.",
        calculation: "Mason’s attributed effort divided by the median of the three staff effort totals.",
        sourceDateRange: `${taskDates[0]}–${taskDates.at(-1)}`,
        sourceRecords: context.tasks.map(taskSource)
      },
      {
        label: "Shared-event ownership",
        value: `${masonOwnedSpecial.length} of ${specialOccurrences.length} Friday event records (${oneDecimal(percent(masonOwnedSpecial.length, specialOccurrences.length))}%)`,
        explanation: "Contact ownership places Mason on most shared-event records in both canonical years.",
        calculation: "Special-event occurrences whose linked event contactOwnerId is guest_staff_ms.",
        sourceDateRange: "2025-01-17–2026-12-11",
        sourceRecords: masonOwnedSpecial.map(occurrenceSource)
      },
      {
        label: "Communication preparation",
        value: `${communicationTasks.length} of ${specialOccurrences.length} parent-and-leader preview tasks assigned to Mason`,
        explanation: "These are preview-only communication tasks; no message was sent.",
        calculation: "Count tasks titled “Prepare parent and leader communication preview” with assignedOwnerId guest_staff_ms.",
        sourceDateRange: "2025-01-17–2026-12-11",
        sourceRecords: communicationTasks.map(taskSource)
      }
    ],
    unknowns: [
      "The records do not contain staff availability, role expectations, delegated work outside the platform, or self-reported capacity.",
      "The two-year snapshot does not establish that concentration is increasing; it only makes the current generated schedule visible.",
      "Recorded effort hours are deterministic planning fields, not a diagnosis of workload, stress, or burnout."
    ],
    discernmentQuestion: "Is Mason’s 82.5% share of recorded task effort intentional for this period, and what leadership context is needed before responsibilities are redistributed?"
  };
}

function buildVolunteerNarrative(context: LeadEmergenceDemoContext): GuestMinistryNarrative {
  const counts = context.volunteers.map((volunteer) => {
    const assignments = context.servingAssignments
      .filter((assignment) => assignment.volunteerId === volunteer.id)
      .sort((left, right) => left.date.localeCompare(right.date));
    return {
      id: volunteer.id,
      name: `${volunteer.firstName} ${volunteer.lastName}`,
      assignments,
      count: assignments.length,
      consecutiveSundayWeeks: longestConsecutiveSundayWeeks(context, assignments)
    };
  });
  const medianAssignments = median(counts.map((item) => item.count));
  const eli = counts.find((item) => item.id === "demo_vol_01");
  const marcus = counts.find((item) => item.id === "demo_vol_02");
  const underused = counts.filter((item) => item.count <= 6);
  const assignmentDates = context.servingAssignments.map((item) => item.date).sort();

  return {
    id: "volunteer-serving-pattern",
    status: "supported",
    navigationLabel: "Volunteer serving rhythm",
    eyebrow: "Serving rhythm",
    headline: "Eli Fable and Marcus Bright appear on far more assignments than four other group leaders.",
    ministryArea: "Middle School, High School, and NextGen Shared Events",
    timeframe: `${assignmentDates[0]}–${assignmentDates.at(-1)} across completed and planned serving records`,
    people: ["Eli Fable", "Marcus Bright", ...underused.map((item) => item.name)],
    whatChanged: `Eli appears on ${eli?.count ?? 0} assignments and Marcus on ${marcus?.count ?? 0}, compared with a volunteer median of ${medianAssignments}; four assigned small-group leaders appear only four times each.`,
    whyItMayMatter: [
      "Repeated assignments can provide continuity, but the gap may also conceal opportunities for rest, mentoring, and wider leader participation. Leadership may want to compare the schedule with actual availability and the intent behind each role.",
      "The assignment pattern cannot show whether Eli or Marcus want this rhythm, whether other leaders are available, or whether different roles require different levels of preparation."
    ],
    evidence: [
      {
        label: "Eli Fable’s assignments",
        value: `${eli?.count ?? 0} assignments (${oneDecimal((eli?.count ?? 0) / medianAssignments)}× the volunteer median)`,
        explanation: "Eli is assigned to core check-in, alternating second-service check-in, and every shared Friday event.",
        calculation: "Count serving_assignment rows with volunteerId demo_vol_01.",
        sourceDateRange: `${eli?.assignments[0]?.date}–${eli?.assignments.at(-1)?.date}`,
        sourceRecords: (eli?.assignments ?? []).map(servingSource)
      },
      {
        label: "Marcus Bright’s assignments",
        value: `${marcus?.count ?? 0} assignments (${oneDecimal((marcus?.count ?? 0) / medianAssignments)}× the volunteer median)`,
        explanation: "Marcus is assigned across check-in, high-school production and room leadership, and every shared Friday event.",
        calculation: "Count serving_assignment rows with volunteerId demo_vol_02.",
        sourceDateRange: `${marcus?.assignments[0]?.date}–${marcus?.assignments.at(-1)?.date}`,
        sourceRecords: (marcus?.assignments ?? []).map(servingSource)
      },
      {
        label: "Consecutive Sunday rhythm",
        value: `Eli appears in ${eli?.consecutiveSundayWeeks ?? 0} consecutive Sunday weeks; Marcus’s longest run is ${marcus?.consecutiveSundayWeeks ?? 0}`,
        explanation: "The sequence spans actual 2025 records and planned 2026 records, so it describes the schedule rather than verified service completion.",
        calculation: "Longest weekly run of distinct Sunday dates containing at least one serving assignment for each volunteer.",
        sourceDateRange: "2025-01-05–2026-12-27",
        sourceRecords: [...(eli?.assignments ?? []), ...(marcus?.assignments ?? [])].map(servingSource)
      },
      {
        label: "Qualified leaders with few assignments",
        value: `${underused.map((item) => item.name).join(", ")} each appear on 4 assignments`,
        explanation: "Each person is already assigned as a canonical small-group leader, but appears infrequently in the broader serving schedule.",
        calculation: "Volunteers with six or fewer serving assignments, cross-checked against small-group leaderIds.",
        sourceDateRange: "2025-03-14–2026-12-11",
        sourceRecords: underused.flatMap((item) => [
          volunteerSource(context, item.id),
          ...item.assignments.map(servingSource)
        ])
      }
    ],
    unknowns: [
      "No availability, preference, time-away, training, or role-capacity data exists in the canonical records.",
      "Assignments after July 30, 2026 are planned rather than evidence that service occurred.",
      "Assignment count alone cannot establish healthy or unhealthy service, rest, calling, or readiness."
    ],
    discernmentQuestion: "Do these assignment gaps reflect intentional availability and role design, or should the team review rest, rotation, and meaningful opportunities before carrying the schedule forward?"
  };
}

function buildGroupNarrative(context: LeadEmergenceDemoContext): GuestMinistryNarrative {
  const group = context.smallGroups.find((item) => item.id === "demo_sg_ms_01");
  if (!group) throw new Error("Canonical group demo_sg_ms_01 is missing.");
  const occurrences = historicalOccurrences(context)
    .filter((item) => item.kind === "small_group")
    .sort(byOccurrenceDate);
  const weekly = occurrences.map((occurrence) => ({
    occurrence,
    count: context.attendance.filter((record) =>
      record.occurrenceId === occurrence.id
      && record.groupId === group.id
      && record.attended
    ).length
  }));
  const highlighted = weekly.slice(12, 19);
  const rosterSize = context.students.filter((student) => student.smallGroupId === group.id).length;
  const leaders = group.leaderIds.map((id) => volunteerName(context, id));
  const first = highlighted[0];
  const last = highlighted.at(-1);
  const historicalMax = Math.max(...weekly.map((item) => item.count));

  return {
    id: "small-group-growth",
    status: "supported",
    navigationLabel: "Small-group relational scale",
    eyebrow: "Relational scale",
    headline: "MS 6th Grade North grew from 10 to 16 students across seven Sundays.",
    ministryArea: "Middle School Bible Study",
    timeframe: `${first?.occurrence.date}–${last?.occurrence.date}, with later 2025 attendance reaching ${historicalMax}`,
    people: leaders,
    groupName: group.name,
    whatChanged: `${group.name} increased every week from ${first?.count ?? 0} to ${last?.count ?? 0} attendees and reached the group’s recorded size threshold.`,
    whyItMayMatter: [
      "Growth creates more opportunities for students to be known, but it can also change how much conversation and follow-up two leaders can hold. The records make the changing group size visible so leadership can watch relational depth rather than treating growth as a number to celebrate by itself.",
      "Attendance and roster size do not measure the quality of discussion, trust, retention, or spiritual formation. Relational capacity remains a question for Eli, Maya, and ministry leadership."
    ],
    evidence: [
      {
        label: "Seven-week attendance sequence",
        value: highlighted.map((item) => item.count).join(" → "),
        explanation: "Attendance increased by one student each Sunday across the highlighted sequence.",
        calculation: "Count attended=true rows for groupId demo_sg_ms_01 on each Middle School Bible Study occurrence.",
        sourceDateRange: `${first?.occurrence.date}–${last?.occurrence.date}`,
        sourceRecords: highlighted.map((item) => occurrenceSource(item.occurrence))
      },
      {
        label: "Recorded group threshold",
        value: `${last?.count ?? 0} attendees on ${last?.occurrence.date} against a threshold of ${group.sizeThreshold}`,
        explanation: "The threshold is a canonical planning field, not a software judgment about when a group must split.",
        calculation: "Final highlighted attendance count compared with smallGroup.sizeThreshold.",
        sourceDateRange: last?.occurrence.date ?? "",
        sourceRecords: [
          { id: group.id, type: "small_group", label: `${group.name} configuration` },
          ...(last ? [occurrenceSource(last.occurrence)] : [])
        ]
      },
      {
        label: "Students and leaders",
        value: `${rosterSize} rostered students, ${leaders.length} leaders (${oneDecimal(rosterSize / leaders.length)} rostered students per leader)`,
        explanation: `${leaders.join(" and ")} are the two assigned leaders in the canonical group record.`,
        calculation: "Rostered students with smallGroupId demo_sg_ms_01 divided by the group’s two leaderIds.",
        sourceDateRange: "Canonical 2025–2026 roster",
        sourceRecords: [
          { id: group.id, type: "small_group", label: group.name },
          ...group.leaderIds.map((id) => volunteerSource(context, id))
        ]
      },
      {
        label: "Later 2025 attendance",
        value: `The group later reached ${historicalMax} attendees`,
        explanation: "The later record shows that the seven-week increase was not immediately reversed.",
        calculation: "Maximum attended count for demo_sg_ms_01 across all 2025 weekly group occurrences.",
        sourceDateRange: "2025-01-05–2025-12-28",
        sourceRecords: weekly.filter((item) => item.count === historicalMax).map((item) => occurrenceSource(item.occurrence))
      }
    ],
    unknowns: [
      "The records contain no discussion-quality, follow-up, retention, participation, or student-relationship measures.",
      "The group threshold is leadership-authored planning context; it does not prove relational pressure.",
      "Roster-to-leader ratio does not show attendance mix, leader experience, room layout, or student support needs."
    ],
    discernmentQuestion: "As MS 6th Grade North reaches 16–19 students with Eli and Maya, what signs would tell leadership that another leader or group is needed to preserve relational depth?"
  };
}

function historicalOccurrences(context: LeadEmergenceDemoContext) {
  return context.occurrences.filter((item) => item.date.startsWith(`${LEAD_EMERGENCE_DEMO_HISTORY_YEAR}-`));
}

function attendedCount(context: LeadEmergenceDemoContext, occurrence: DemoOccurrence) {
  return context.attendance.filter((record) => record.occurrenceId === occurrence.id && record.attended).length;
}

function attendedStudentIds(context: LeadEmergenceDemoContext, occurrences: DemoOccurrence[]) {
  const ids = new Set(occurrences.map((item) => item.id));
  return new Set(context.attendance.filter((record) => ids.has(record.occurrenceId) && record.attended).map((record) => record.studentId));
}

function eventOwner(context: LeadEmergenceDemoContext, occurrence: DemoOccurrence) {
  return context.overview.events.find((event) => event.id === occurrence.eventId)?.contactOwnerId;
}

function occurrenceSource(occurrence: DemoOccurrence): GuestNarrativeSourceRecord {
  return { id: occurrence.id, type: "attendance_session", label: occurrence.title, date: occurrence.date };
}

function outcomeSource(context: LeadEmergenceDemoContext, occurrence: DemoOccurrence): GuestNarrativeSourceRecord {
  const outcome = context.eventOutcomes.find((item) => item.eventId === occurrence.eventId);
  return {
    id: outcome?.id ?? `missing-outcome-${occurrence.eventId}`,
    type: "event_outcome",
    label: `${occurrence.title} outcome`,
    date: occurrence.date
  };
}

function taskSource(task: LeadEmergenceDemoContext["tasks"][number]): GuestNarrativeSourceRecord {
  return { id: task.id, type: "task", label: task.title, date: task.dueDate };
}

function servingSource(assignment: LeadEmergenceDemoContext["servingAssignments"][number]): GuestNarrativeSourceRecord {
  return { id: assignment.id, type: "serving_assignment", label: assignment.role, date: assignment.date };
}

function volunteerSource(context: LeadEmergenceDemoContext, id: string): GuestNarrativeSourceRecord {
  return { id, type: "volunteer", label: volunteerName(context, id) };
}

function volunteerName(context: LeadEmergenceDemoContext, id: string) {
  const volunteer = context.volunteers.find((item) => item.id === id);
  return volunteer ? `${volunteer.firstName} ${volunteer.lastName}` : id;
}

function longestConsecutiveSundayWeeks(
  context: LeadEmergenceDemoContext,
  assignments: LeadEmergenceDemoContext["servingAssignments"]
) {
  const occurrenceById = new Map(context.occurrences.map((item) => [item.id, item]));
  const dates = Array.from(new Set(assignments
    .filter((assignment) => occurrenceById.get(assignment.occurrenceId)?.dayOfWeek === "Sunday")
    .map((assignment) => assignment.date))).sort();
  let longest = dates.length ? 1 : 0;
  let current = dates.length ? 1 : 0;
  for (let index = 1; index < dates.length; index += 1) {
    const previous = new Date(`${dates[index - 1]}T00:00:00.000Z`).getTime();
    const next = new Date(`${dates[index]}T00:00:00.000Z`).getTime();
    current = (next - previous) / 86_400_000 === 7 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
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

function percent(value: number, total: number) {
  return total ? (value / total) * 100 : 0;
}

function signedPercent(value: number, baseline: number) {
  const change = baseline ? ((value - baseline) / baseline) * 100 : 0;
  return `${change >= 0 ? "+" : ""}${oneDecimal(change)}%`;
}

function oneDecimal(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

function byOccurrenceDate(left: DemoOccurrence, right: DemoOccurrence) {
  return `${left.date}-${left.localStartTime}`.localeCompare(`${right.date}-${right.localStartTime}`);
}

function isOccurrence(value: DemoOccurrence | undefined): value is DemoOccurrence {
  return Boolean(value);
}
