import type {
  CampMedicationScheduleItem,
  CampOverviewPayload,
  CampScheduleBlock,
  CampVisibleStudent
} from "@/lib/camp/types";

export type CampEmmaMode = "finder" | "smart_search" | "ask_emma";
export type CampEmmaAccess = "leader" | "jaci" | "andrew_operations" | "andrew_medical";

export type CampEmmaAnswer = {
  answer: string;
  details: string[];
  actions: Array<{ label: string; href: string }>;
  uncertainty?: string;
};

export type CampMedicalCommandBlock = {
  id: string;
  medicationRecordId: string;
  studentId: string;
  studentName: string;
  timeWindow: string;
  parentHandoffOnFile: boolean;
  stateLabel: "Due" | "Completed" | "Needs Attention" | "Intake Missing";
  tone: "due" | "completed" | "attention" | "missing";
};

// Exported so the EMMA command/write path (lib/camp/emma-command.ts) can apply
// the same restricted-topic gate to natural-language room-change commands,
// independent of and in addition to the model's own classification.
export const restrictedNeedles = [
  "medication",
  "dose",
  "allergy details",
  "allergy",
  "allergic",
  "insurance",
  "parent phone",
  "parent contact",
  "guardian",
  "physician",
  "medical notes",
  "medical",
  "emergency contact",
  "prescription",
  "epipen",
  "inhaler"
];

export function buildCampEmmaAnswer(input: {
  overview: CampOverviewPayload;
  query: string;
  mode: CampEmmaMode;
  access: CampEmmaAccess;
  selectedDay?: string;
  medicalBlocks?: CampMedicalCommandBlock[];
}): CampEmmaAnswer {
  const query = input.query.trim();
  const normalized = query.toLowerCase();

  if (!query) {
    return {
      answer: input.access === "leader" ? "Search for a camper, team, room, vehicle, or schedule item." : "Search Camp records — campers, teams, rooms, vehicles, schedule, and safe status.",
      details: ["Answers use the current safe Camp data in this view."],
      actions: [{ label: "Open roster", href: "/camp/roster" }]
    };
  }

  if (input.access !== "andrew_medical" && restrictedNeedles.some((needle) => normalized.includes(needle))) {
    return {
      answer: "I can help with safe operational Camp information, but restricted medical details are not available in this mode.",
      details: ["Try asking for team, room, transportation, schedule, form, or safe status information."],
      actions: [{ label: "Open Leader Safety", href: "/camp/safety" }]
    };
  }

  if (input.access === "andrew_medical" && isMedicalQuestion(normalized)) {
    return answerMedical(input.medicalBlocks ?? []);
  }

  // Honest unsupported response — EMMA has no day-over-day delta tracking yet.
  if (isChangeOverTimeQuestion(normalized)) return answerUnsupportedChange();
  // "Briefing" must return a real briefing, not collide with the leader-roster intent.
  if (isBriefingQuestion(normalized)) return answerBriefing(input.overview, input.selectedDay);

  if (normalized.includes("shirt")) return answerShirts(input.overview, normalized);
  if (normalized.includes("van") || normalized.includes("vehicle") || normalized.includes("transport")) return answerTransportation(input.overview, normalized);
  if (normalized.includes("room") || normalized.includes("cabin")) return answerRooms(input.overview, normalized);
  if (normalized.includes("blue") || normalized.includes("red") || normalized.includes("yellow") || normalized.includes("green") || normalized.includes("orange") || normalized.includes("purple")) {
    return answerTeam(input.overview, normalized);
  }
  // "Which teams are short a leader?" → only teams missing a lead/co-lead, before the
  // generic leader-roster and missing-assignment intents.
  if (isLeaderGapQuestion(normalized)) return answerShortStaffedTeams(input.overview);
  if (normalized.includes("missing")) return answerMissing(input.overview, normalized);
  if (normalized.includes("next") || normalized.includes("schedule") || normalized.includes("time") || normalized.includes("dinner")) {
    return answerSchedule(input.overview.schedule, input.selectedDay);
  }
  if (normalized.includes("leader")) return answerLeaders(input.overview);
  if (normalized.includes("attention") || normalized.includes("urgent")) return answerBriefing(input.overview, input.selectedDay);

  const student = findStudent(input.overview.students, normalized);
  if (student) {
    return {
      answer: `${student.name} is on ${student.teamName || "an unassigned team"}${student.cabin ? ` in ${student.cabin}` : ""}.`,
      details: [
        student.grade ? `Grade: ${student.grade}` : "",
        student.vehicleName ? `Transportation: ${student.vehicleName}` : "",
        ...safeStudentTags(student).map((tag) => `Safe tag: ${tag}`)
      ].filter(Boolean),
      actions: [
        student.teamId ? { label: `Open ${student.teamName || "team"}`, href: `/camp/teams/${student.teamId}` } : { label: "Open roster", href: "/camp/roster" }
      ]
    };
  }

  return notFoundStudentAnswer(input.overview.students, normalized);
}

export function buildMedicalCommandBlocks(input: {
  schedule: CampMedicationScheduleItem[];
  loggedScheduleIds: Set<string>;
  intakeRecordIds: Set<string>;
  selectedDay?: string;
}): CampMedicalCommandBlock[] {
  return input.schedule
    .filter((block) => isScheduleItemForDay(block, input.selectedDay))
    .map((block) => {
      const completed = block.status === "Logged" || Boolean(block.lastLoggedAt) || input.loggedScheduleIds.has(block.id);
      const needsAttention = block.status === "Needs Parent Clarification";
      const intakeMissing = !input.intakeRecordIds.has(block.medicationRecordId);

      return {
        id: block.id,
        medicationRecordId: block.medicationRecordId,
        studentId: block.studentId,
        studentName: block.studentName,
        timeWindow: block.timeWindow,
        parentHandoffOnFile: !intakeMissing,
        stateLabel: completed ? "Completed" : needsAttention ? "Needs Attention" : intakeMissing ? "Intake Missing" : "Due",
        tone: completed ? "completed" : needsAttention ? "attention" : intakeMissing ? "missing" : "due"
      };
    });
}

function answerTeam(overview: CampOverviewPayload, normalized: string): CampEmmaAnswer {
  const team = overview.teams.find((item) => normalized.includes(item.name.toLowerCase()));
  if (!team) {
    return {
      answer: "I found the team question, but not a matching team color.",
      details: ["Available teams: Blue, Red, Yellow, Green, Orange, Purple."],
      actions: [{ label: "Open teams", href: "/camp/teams" }]
    };
  }
  const students = overview.students.filter((student) => student.teamId === team.id);
  return {
    answer: `${team.name} Team has ${students.length} ${students.length === 1 ? "camper" : "campers"} visible.`,
    details: [
      team.leader ? `Lead: ${team.leader}` : "Lead: unassigned",
      team.coLeader ? `Co-leader: ${team.coLeader}` : "Co-leader: unassigned",
      team.room ? `Room: ${team.room}` : "Room: unassigned",
      students.length ? `Roster: ${students.map((student) => student.name).join(", ")}` : "No visible campers assigned"
    ],
    actions: [{ label: `Open ${team.name} Team`, href: `/camp/teams/${team.id}` }]
  };
}

function answerRooms(overview: CampOverviewPayload, normalized: string): CampEmmaAnswer {
  const student = findStudent(overview.students, normalized);
  if (student) {
    return {
      answer: `${student.name}${student.cabin ? ` is assigned to ${student.cabin}` : " does not have a room assignment yet"}.`,
      details: [student.teamName ? `Team: ${student.teamName}` : "", student.vehicleName ? `Transportation: ${student.vehicleName}` : ""].filter(Boolean),
      actions: [{ label: "Open roster", href: "/camp/roster" }]
    };
  }

  // Only aggregate room questions ("which campers are missing a room") return a
  // roster list. A question about a specific, unmatched camper must NOT fall through
  // to the global missing-room list — it returns a not-found response instead.
  if (!isAggregateRosterQuestion(normalized)) {
    return notFoundStudentAnswer(overview.students, normalized);
  }

  const missing = overview.students.filter((student) => !student.cabin?.trim());
  return {
    answer: missing.length ? `${missing.length} campers are missing room assignments.` : "All visible campers have room assignments.",
    details: missing.map((student) => student.name),
    actions: [{ label: "Open roster", href: "/camp/roster" }]
  };
}

function answerTransportation(overview: CampOverviewPayload, normalized: string): CampEmmaAnswer {
  const vehicle = overview.vehicles.find((item) => normalized.includes(item.name.toLowerCase()));
  const missing = overview.students.filter((student) => !student.vehicleId);
  if (!vehicle) {
    return {
      answer: missing.length ? `${missing.length} campers are missing transportation assignments.` : "All visible campers have transportation assignments.",
      details: missing.map((student) => student.name),
      actions: [{ label: "Open transportation", href: "/camp/vehicles" }]
    };
  }
  const riders = overview.students.filter((student) => student.vehicleId === vehicle.id);
  return {
    answer: `${vehicle.name} has ${riders.length} visible ${riders.length === 1 ? "rider" : "riders"}.`,
    details: [`Driver: ${vehicle.driver || "Unassigned"}`, ...riders.map((student) => student.name)],
    actions: [{ label: "Open transportation", href: "/camp/vehicles" }]
  };
}

function answerShirts(overview: CampOverviewPayload, normalized: string): CampEmmaAnswer {
  const team = overview.teams.find((item) => normalized.includes(item.name.toLowerCase()));
  const students = team ? overview.students.filter((student) => student.teamId === team.id) : overview.students;
  const counts = new Map<string, number>();
  for (const student of students) {
    const size = student.shirtSize?.trim() || "Unlisted";
    counts.set(size, (counts.get(size) ?? 0) + 1);
  }
  return {
    answer: team ? `${team.name} Team shirt counts are ready.` : "Camp shirt counts are ready.",
    details: Array.from(counts.entries()).map(([size, count]) => `${size}: ${count}`),
    actions: [{ label: team ? `Open ${team.name} Team` : "Open roster", href: team ? `/camp/teams/${team.id}` : "/camp/roster" }],
    uncertainty: counts.has("Unlisted") ? "Some campers do not have a shirt size listed." : undefined
  };
}

function answerSchedule(schedule: CampScheduleBlock[], selectedDay?: string): CampEmmaAnswer {
  const scoped = selectedDay ? schedule.filter((item) => item.day === selectedDay) : schedule;
  const next = scoped[0];
  if (!next) {
    return {
      answer: "There are no schedule items for the selected day.",
      details: [],
      actions: [{ label: "Open schedule", href: "/camp/schedule" }],
      uncertainty: "No schedule rows exist for this day."
    };
  }
  return {
    answer: `The first scheduled item for the selected day is ${next.title} at ${next.time}.`,
    details: [next.location ? `Location: ${next.location}` : "", `Audience: ${next.audience}`, ...scoped.slice(1, 3).map((item) => `Also scheduled: ${item.time} ${item.title}`)].filter(Boolean),
    actions: [{ label: "Open schedule", href: "/camp/schedule" }]
  };
}

function answerMissing(overview: CampOverviewPayload, normalized: string): CampEmmaAnswer {
  const missingRoom = overview.students.filter((student) => !student.cabin?.trim());
  const missingTransport = overview.students.filter((student) => !student.vehicleId);
  const missingTeam = overview.students.filter((student) => !student.teamId);
  const missingForms = overview.students.filter((student) => student.needsParentClarification);
  const picked = normalized.includes("transport") ? missingTransport : normalized.includes("team") ? missingTeam : normalized.includes("form") ? missingForms : missingRoom;
  return {
    answer: picked.length ? `${picked.length} visible campers need attention.` : "No visible campers match that missing-assignment check.",
    details: picked.map((student) => student.name),
    actions: [{ label: "Open roster", href: "/camp/roster" }]
  };
}

function answerLeaders(overview: CampOverviewPayload): CampEmmaAnswer {
  return {
    answer: "Leader assignments by team are listed below.",
    details: overview.teams.map((team) => `${team.name}: ${team.leader || "lead unassigned"}${team.coLeader ? `, ${team.coLeader}` : ", co-leader unassigned"}`),
    actions: [{ label: "Open teams", href: "/camp/teams" }]
  };
}

function answerBriefing(overview: CampOverviewPayload, selectedDay?: string): CampEmmaAnswer {
  const missingRooms = overview.students.filter((student) => !student.cabin?.trim()).length;
  const missingTransport = overview.students.filter((student) => !student.vehicleId).length;
  const needsClarification = overview.students.filter((student) => student.needsParentClarification).length;
  const shortTeams = overview.teams.filter((team) => !team.leader?.trim() || !team.coLeader?.trim());
  const next = selectedDay ? overview.schedule.find((item) => item.day === selectedDay) : overview.schedule[0];
  return {
    answer: "Quick Camp briefing for the selected Camp day, from current safe data.",
    details: [
      next ? `First scheduled item: ${next.time} ${next.title}` : "No schedule item for the selected day",
      `${needsClarification} campers need parent/form clarification`,
      `${missingRooms} campers missing room assignments`,
      `${missingTransport} campers missing transportation assignments`,
      shortTeams.length
        ? `Teams needing a lead or co-leader: ${shortTeams.map((team) => team.name).join(", ")}`
        : "All teams have a lead and co-leader"
    ],
    actions: [
      { label: "Open schedule", href: "/camp/schedule" },
      { label: "Open roster", href: "/camp/roster" }
    ]
  };
}

function answerMedical(blocks: CampMedicalCommandBlock[]): CampEmmaAnswer {
  const due = blocks.filter((block) => block.tone === "due").length;
  const missing = blocks.filter((block) => block.tone === "missing").length;
  const attention = blocks.filter((block) => block.tone === "attention").length;
  return {
    answer: blocks.length
      ? `${blocks.length} medication ${blocks.length === 1 ? "block is" : "blocks are"} scheduled for the selected Camp day in Medical Command.`
      : "No medication blocks are scheduled for the selected Camp day.",
    details: [`Due (per parent schedule): ${due}`, `Intake missing: ${missing}`, `Needs attention: ${attention}`, ...blocks.map((block) => `${block.timeWindow}: ${block.studentName} (${block.stateLabel})`)],
    actions: [{ label: "Administer Medicine", href: "/camp/medical-command/administer" }]
  };
}

function findStudent(students: CampVisibleStudent[], normalized: string) {
  return students.find((student) => normalized.includes(student.name.toLowerCase()) || student.name.toLowerCase().split(/\s+/).some((part) => part.length > 2 && normalized.includes(part)));
}

function safeStudentTags(student: CampVisibleStudent): string[] {
  const tags: string[] = [];
  if (student.hasMedicationPlan) tags.push("Medication on file");
  if (student.hasDietaryAlert) tags.push("Food allergy");
  if (student.needsParentClarification) tags.push("Missing form");
  for (const flag of student.limitedSafetyFlags ?? []) {
    if (flag && !tags.includes(flag)) tags.push(flag);
  }
  return tags;
}

function isMedicalQuestion(normalized: string): boolean {
  return normalized.includes("medicine") || normalized.includes("medication") || normalized.includes("dose") || normalized.includes("intake") || normalized.includes("due");
}

function isScheduleItemForDay(block: CampMedicationScheduleItem, selectedDay?: string): boolean {
  if (!selectedDay) return true;
  const normalizedDay = selectedDay.toLowerCase();
  const normalizedWindow = block.timeWindow.toLowerCase();
  if (normalizedWindow.includes(normalizedDay)) return true;
  const weekday = normalizedDay.split(",")[0];
  if (weekday && normalizedWindow.includes(weekday)) return true;
  // Current records do not carry a camp-day column; keep them visible rather
  // than hiding critical medication work behind an unsupported filter.
  return !/\b(mon|tue|wed|thu|fri|sat|sun)\b/i.test(block.timeWindow);
}

const ROSTER_STOP_WORDS = new Set([
  "what", "which", "who", "whom", "where", "when", "whose", "the", "and", "for", "with", "does", "need",
  "needs", "camper", "campers", "student", "students", "kid", "kids", "room", "cabin", "team", "teams",
  "van", "vans", "vehicle", "vehicles", "transport", "transportation", "assignment", "assignments",
  "assigned", "missing", "have", "has", "this", "that", "into", "from", "tonight", "today", "now",
  "please", "tell", "give", "show", "list", "about", "still", "before", "any", "all", "are", "was",
  "were", "is", "in", "on", "of", "at", "to", "a", "an", "my", "our", "their"
]);

// Aggregate roster questions (e.g. "which campers are missing a room") may return a
// list; anything else asking about a specific camper should resolve to that camper or
// a not-found response, never a global list.
function isAggregateRosterQuestion(normalized: string): boolean {
  return [
    "missing", "which", "who ", "whose", "everyone", "unassigned", "without", "need",
    "no room", "no cabin", "no assignment", "list", "each ", "every ", "any "
  ].some((token) => normalized.includes(token));
}

function isChangeOverTimeQuestion(normalized: string): boolean {
  if (
    normalized.includes("since yesterday") ||
    normalized.includes("since last") ||
    normalized.includes("what's new") ||
    normalized.includes("whats new") ||
    normalized.includes("day over day") ||
    normalized.includes("day-over-day")
  ) {
    return true;
  }
  // Match change/changed/changes as whole words so a camper named e.g. "Chang" never triggers it.
  return /\b(change|changed|changes|changing)\b/.test(normalized);
}

function isBriefingQuestion(normalized: string): boolean {
  return normalized.includes("brief");
}

function isLeaderGapQuestion(normalized: string): boolean {
  // "lead" covers lead / leader / co-lead / co-leader.
  if (!normalized.includes("lead")) return false;
  return [
    "short", "missing", "need", "without", "unassigned", "which", "any",
    "no lead", "don't have", "dont have", "vacant", "open", "gap"
  ].some((token) => normalized.includes(token));
}

function answerUnsupportedChange(): CampEmmaAnswer {
  return {
    answer: "Day-over-day change tracking isn't available yet.",
    details: [
      "I can report current Camp status — teams, rooms, transportation, schedule, and safe flags — but I can't compare against a previous day yet."
    ],
    actions: [{ label: "Open roster", href: "/camp/roster" }],
    uncertainty: "Change/delta tracking is not implemented."
  };
}

function answerShortStaffedTeams(overview: CampOverviewPayload): CampEmmaAnswer {
  const short = overview.teams.filter((team) => !team.leader?.trim() || !team.coLeader?.trim());
  if (!short.length) {
    return {
      answer: "Every team has both a lead and a co-leader assigned.",
      details: [],
      actions: [{ label: "Open teams", href: "/camp/teams" }]
    };
  }
  return {
    answer: `${short.length} ${short.length === 1 ? "team needs" : "teams need"} a lead or co-leader.`,
    details: short.map((team) => {
      const gaps: string[] = [];
      if (!team.leader?.trim()) gaps.push("lead");
      if (!team.coLeader?.trim()) gaps.push("co-leader");
      return `${team.name}: needs ${gaps.join(" + ")}`;
    }),
    actions: [{ label: "Open teams", href: "/camp/teams" }]
  };
}

function notFoundStudentAnswer(students: CampVisibleStudent[], normalized: string): CampEmmaAnswer {
  const likely = findLikelyStudents(students, normalized);
  return {
    answer: "I couldn't find a camper matching that name in the current Camp view.",
    details: likely.length
      ? [`Did you mean: ${likely.join(", ")}?`]
      : ["Try a full camper name, a team color, a vehicle, a room, or a schedule question."],
    actions: [{ label: "Open roster", href: "/camp/roster" }],
    uncertainty: "No matching Camp record was found."
  };
}

function findLikelyStudents(students: CampVisibleStudent[], normalized: string): string[] {
  const tokens = normalized.split(/[^a-z]+/).filter((token) => token.length >= 3 && !ROSTER_STOP_WORDS.has(token));
  if (!tokens.length) return [];
  return students
    .map((student) => {
      const nameTokens = student.name.toLowerCase().split(/\s+/);
      let score = 0;
      for (const queryToken of tokens) {
        for (const nameToken of nameTokens) {
          if (nameToken === queryToken) score += 3;
          else if (nameToken.startsWith(queryToken.slice(0, 3)) || queryToken.startsWith(nameToken.slice(0, 3))) score += 1;
        }
      }
      return { name: student.name, score };
    })
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((scored) => scored.name);
}
