import { createHash } from "node:crypto";

import { searchFirecrawl, rankSearchHits, DailyIntelligenceFirecrawlConfigError } from "@/lib/daily-intelligence/firecrawl-research";
import type { MinistryIntelligenceData, ResearchResource, WeeklyContentDay } from "@/lib/daily-intelligence/types";
import { createGeminiProvider } from "@/lib/emma/providers/gemini-provider";
import { createGlooEmmaProvider, readGlooEmmaConfig } from "@/lib/emma/providers/gloo-provider";
import { DEFAULT_GEMINI_MODEL } from "@/lib/emma/providers/registry";
import { normalizeProviderError } from "@/lib/emma/providers/errors";
import type { EmmaProvider } from "@/lib/emma/providers/types";
import { buildAlignmentContextSummary, defaultMinistryAlignmentProfile } from "@/lib/ministry/alignment";
import type { ActiveTask, MinistryEvent, User } from "@/lib/types";
import type { LeaderDailyBrief, LeaderDailyBriefEvidence, LeaderDailyBriefSections } from "@/lib/leader-daily-brief/types";

const DAY_NAMES: WeeklyContentDay[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const GROUPME_MAX_CHARS = 1000;
const SEPARATOR = "━━━━━━━━━━━━━━";
const FINAL_ENCOURAGEMENT =
  "\"Thank you for creating space where students can encounter Jesus. Faithfulness in ordinary moments often becomes the foundation for extraordinary transformation.\"";

type PublishedResource = LeaderDailyBriefEvidence["publishedSermonResources"][number];

type BuildEvidenceInput = {
  data: MinistryIntelligenceData;
  now?: Date;
  eventFileHints?: LeaderDailyBriefEvidence["eventFileHints"];
  publishedSermonResources?: PublishedResource[];
  volunteerSignals?: Partial<LeaderDailyBriefEvidence["volunteerSignals"]>;
};

type ParsedAiBrief = Partial<{
  whyThisMatters: unknown;
  upcoming: unknown;
  prepareForSunday: unknown;
  studentsToNotice: unknown;
  leaderPractice: unknown;
  todaysPractice: unknown;
  prayer: unknown;
}>;

export async function buildLeaderDailyBrief(params: {
  evidence: LeaderDailyBriefEvidence;
  fetchImpl?: typeof fetch;
}): Promise<LeaderDailyBrief> {
  const warnings: string[] = [];
  const firecrawl = await findLeaderResource(params.evidence, params.fetchImpl);
  warnings.push(...firecrawl.warnings);

  const ai = await tryGenerateWithMeridian(params.evidence, firecrawl.resource);
  warnings.push(...ai.warnings);

  const sections = ai.sections ?? buildDeterministicSections(params.evidence, firecrawl.resource);
  const formatted = formatLeaderDailyBriefMessage(sections);
  const messageHash = createHash("sha256").update(formatted.message).digest("hex").slice(0, 16);

  return {
    evidence: params.evidence,
    sections,
    provider: ai.provider,
    model: ai.model,
    warnings: [...warnings, ...formatted.warnings],
    message: formatted.message,
    messageHash,
    sermonId: params.evidence.publishedSermonResources[0]?.id,
    eventIdsConsulted: params.evidence.upcomingEvents.map((event) => event.id),
    meridianContextUsed: params.evidence.meridian.contextUsed,
    firecrawl: {
      used: firecrawl.used,
      resourceUrl: firecrawl.resource?.url,
      warnings: firecrawl.warnings
    },
    duplicatePrevention: "not_checked"
  };
}

export function buildLeaderDailyBriefEvidence(input: BuildEvidenceInput): LeaderDailyBriefEvidence {
  const now = input.now ?? new Date();
  const today = startOfCentralDay(now);
  const nextFourteenDays = addDays(today, 14);
  const nextSevenDays = addDays(today, 7);
  const users = input.data.users;
  const events = input.data.events
    .filter((event) => isWithin(event.startTime, today, nextFourteenDays))
    .sort(byDate((event) => event.startTime))
    .slice(0, 8);
  const openTasks = input.data.tasks
    .filter((task) => task.status !== "done" && isWithin(task.dueDate, addDays(today, -1), nextSevenDays))
    .sort(byDate((task) => task.dueDate))
    .slice(0, 10)
    .map((task) => ({
      ...pickTask(task),
      eventTitle: events.find((event) => event.id === task.eventId)?.title,
      ownerName: displayName(users.find((user) => user.id === task.assignedUserId))
    }));

  const eventFileHints = (input.eventFileHints ?? [])
    .filter((hint) => events.some((event) => event.id === hint.eventId))
    .slice(0, 4);
  const volunteerNeeds = buildVolunteerNeeds(events, input.data.tasks);
  const leaderReminders = buildLeaderReminders(events, openTasks);

  return {
    generatedAt: now.toISOString(),
    contentDate: centralDateKey(now),
    day: DAY_NAMES[centralDayIndex(now)],
    ministryId: input.data.ministryId,
    upcomingEvents: events.map(pickEvent),
    openPreparationTasks: openTasks,
    volunteerNeeds,
    leaderReminders,
    scheduleChanges: buildScheduleChanges(input.data.activity),
    eventFileHints,
    publishedSermonResources: (input.publishedSermonResources ?? []).slice(0, 6),
    volunteerSignals: {
      guestsVisible: input.volunteerSignals?.guestsVisible ?? false,
      followUpVisible: input.volunteerSignals?.followUpVisible ?? false,
      quietStudentCareUseful: input.volunteerSignals?.quietStudentCareUseful ?? true,
      source: input.volunteerSignals?.source ?? "No live volunteer/student aggregate signal was available."
    },
    meridian: {
      profile: defaultMinistryAlignmentProfile,
      contextUsed: [
        ...buildAlignmentContextSummary(defaultMinistryAlignmentProfile),
        "Volunteer-facing boundary: do not expose staff-only planning, financial, personnel, counseling, medical, disciplinary, pastoral-care, or individual student data.",
        "Current voice: warm, conversational, practical, spiritually grounded, and phone-readable."
      ],
      groupMeVoiceContext: [
        "Short paragraphs and simple bullets work best.",
        "Sound like a ministry leader encouraging volunteer leaders, not a corporate report.",
        "Name only what leaders can act on this week."
      ],
      leaderCommunicationVoiceContext: [
        "Connect logistics to discipleship without exaggerating impact.",
        "Honor ordinary faithfulness.",
        "Keep sensitive details inside Lead Emergence."
      ]
    }
  };
}

export function formatLeaderDailyBriefMessage(sections: LeaderDailyBriefSections): { message: string; warnings: string[] } {
  const warnings: string[] = [];
  const lines = [
    "# LEADER DAILY BRIEF",
    "",
    "📖 Why This Matters This Week",
    ...paragraphLines(sections.whyThisMatters, 2),
    "",
    SEPARATOR,
    "",
    "📅 Upcoming",
    ...bulletLines(sections.upcoming, "• No volunteer-facing logistics are urgent right now.", 3),
    "",
    SEPARATOR,
    "",
    "📚 Prepare for Sunday",
    ...bulletLines(sections.prepareForSunday, "• Sermon preparation has not yet been published.", 4),
    "",
    SEPARATOR,
    "",
    "👀 Students to Notice",
    compactSentence(sections.studentsToNotice, 150),
    "",
    SEPARATOR,
    "",
    "🌱 Leader Practice",
    compactSentence(sections.leaderPractice, 125),
    "Today's Practice:",
    compactSentence(sections.todaysPractice, 100),
    "",
    SEPARATOR,
    "",
    "🙏 Today's Prayer",
    compactSentence(sections.prayer, 180),
    ...(sections.resource
      ? [
          "",
          SEPARATOR,
          "",
          "📚 Resource",
          compactSentence(`${sections.resource.title}: ${sections.resource.url}`, 170)
        ]
      : []),
    "",
    SEPARATOR,
    "",
    FINAL_ENCOURAGEMENT
  ];

  let message = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (message.length > GROUPME_MAX_CHARS) {
    warnings.push("Leader brief was shortened to fit GroupMe's 1,000 character bot message limit.");
    message = shrinkMessage(sections);
  }
  return { message, warnings };
}

function buildDeterministicSections(evidence: LeaderDailyBriefEvidence, resource?: ResearchResource): LeaderDailyBriefSections {
  const sermon = evidence.publishedSermonResources[0];
  const leaderDevelopment = leaderDevelopmentForDay(evidence.day);
  return {
    whyThisMatters: [
      whyThisMatters(evidence, sermon)
    ],
    upcoming: [
      ...evidence.upcomingEvents.slice(0, 2).map((event) => `${event.title} - ${formatShortDate(event.startTime)}${event.location ? ` at ${event.location}` : ""}`),
      ...evidence.leaderReminders.slice(0, 1),
      ...evidence.volunteerNeeds.slice(0, 1)
    ].filter(Boolean),
    prepareForSunday: sermon
      ? [
          `Published prep: ${sermon.title}`,
          sermon.description || "Review the published leader resource before group.",
          "Discussion tip: ask one observation question before moving to application.",
          "Likely questions: listen for confusion and answer only from the published sermon context."
        ]
      : [
          "Sermon preparation has not yet been published.",
          "Facilitation insight: start with one honest observation question and give students time to think before filling the silence."
        ],
    studentsToNotice: studentsToNotice(evidence),
    leaderPractice: leaderDevelopment.lesson,
    todaysPractice: leaderDevelopment.practice,
    prayer: prayerForDay(evidence.day),
    resource
  };
}

async function tryGenerateWithMeridian(
  evidence: LeaderDailyBriefEvidence,
  resource?: ResearchResource
): Promise<{ sections?: LeaderDailyBriefSections; provider: LeaderDailyBrief["provider"]; model: string; warnings: string[] }> {
  const providers = configuredProviders();
  const warnings: string[] = [];
  for (const candidate of providers) {
    try {
      const result = await candidate.provider.generate({
        model: candidate.model,
        systemPrompt: leaderBriefSystemPrompt(),
        userPrompt: JSON.stringify({
          evidence,
          resource,
          outputContract: {
            whyThisMatters: "array of 1-2 short paragraphs",
            upcoming: "array of 1-3 phone-friendly bullets",
            prepareForSunday: "array of 2-4 bullets",
            studentsToNotice: "one aggregated ministry-wide observation; no names",
            leaderPractice: "one practical insight under one minute",
            todaysPractice: "one concrete action",
            prayer: "one ministry prayer"
          }
        }),
        temperature: 0.28,
        maxOutputTokens: 900,
        timeoutMs: 20_000
      });
      const parsed = parseAiBrief(result.output, resource);
      if (parsed) return { sections: parsed, provider: candidate.id, model: result.model || candidate.model, warnings };
      warnings.push(`${candidate.id} returned an unusable leader daily brief.`);
    } catch (error) {
      const providerError = normalizeProviderError(error);
      warnings.push(`${candidate.id} failed safely with ${providerError.code}.`);
      console.warn("[leader-daily-brief] Meridian provider failure", {
        timestamp: new Date().toISOString(),
        provider: candidate.id,
        code: providerError.code,
        httpStatus: providerError.httpStatus
      });
    }
  }
  return { provider: "deterministic", model: "leader-daily-brief-deterministic", warnings };
}

function configuredProviders(): Array<{ id: "gloo" | "gemini"; model: string; provider: EmmaProvider }> {
  const providers: Array<{ id: "gloo" | "gemini"; model: string; provider: EmmaProvider }> = [];
  const glooConfig = readGlooEmmaConfig();
  if (glooConfig) providers.push({ id: "gloo", model: glooConfig.model, provider: createGlooEmmaProvider({ config: glooConfig }) });
  if (process.env.GEMINI_API_KEY?.trim()) {
    providers.push({
      id: "gemini",
      model: process.env.MERIDIAN_GEMINI_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
      provider: createGeminiProvider()
    });
  }
  return providers;
}

async function findLeaderResource(evidence: LeaderDailyBriefEvidence, fetchImpl?: typeof fetch) {
  const warnings: string[] = [];
  try {
    const topic = leaderDevelopmentForDay(evidence.day).topic;
    const hits = await searchFirecrawl({
      query: `youth ministry volunteer leader ${topic} practical training small group discipleship`,
      fetchImpl
    });
    const [resource] = rankSearchHits(hits, evidence.day, "Leader Development")
      .filter((hit) => !hit.rejected && hit.score >= 8)
      .slice(0, 1);
    return { used: Boolean(resource), resource, warnings };
  } catch (error) {
    if (error instanceof DailyIntelligenceFirecrawlConfigError) return { used: false, resource: undefined, warnings };
    warnings.push("Firecrawl resource search failed safely.");
    return { used: false, resource: undefined, warnings };
  }
}

function parseAiBrief(output: unknown, resource?: ResearchResource): LeaderDailyBriefSections | undefined {
  if (!output || typeof output !== "object") return undefined;
  const parsed = output as ParsedAiBrief;
  const whyThisMatters = textArray(parsed.whyThisMatters, 2, 360);
  const upcoming = textArray(parsed.upcoming, 4, 180);
  const prepareForSunday = textArray(parsed.prepareForSunday, 5, 180);
  const studentsToNotice = textValue(parsed.studentsToNotice, 240);
  const leaderPractice = textValue(parsed.leaderPractice, 240);
  const todaysPractice = textValue(parsed.todaysPractice, 160);
  const prayer = textValue(parsed.prayer, 260);
  if (!whyThisMatters.length || !studentsToNotice || !leaderPractice || !todaysPractice || !prayer) return undefined;
  return {
    whyThisMatters,
    upcoming,
    prepareForSunday,
    studentsToNotice,
    leaderPractice,
    todaysPractice,
    prayer,
    resource
  };
}

function leaderBriefSystemPrompt() {
  return [
    "You are Meridian shaping the Lead Emergence volunteer leader daily brief.",
    "Return only JSON with keys whyThisMatters, upcoming, prepareForSunday, studentsToNotice, leaderPractice, todaysPractice, prayer.",
    "Use only supplied evidence. Never invent sermon details, events, schedules, trends, attendance, assignments, statistics, student situations, or resources.",
    "Never identify students. Never expose budget, personnel, medical, disciplinary, counseling, pastoral-care, staff-only, or private planning details.",
    "Keep the voice warm, encouraging, conversational, practical, spiritually grounded, and phone-readable.",
    "This is ministry perspective and leader preparation, not a devotional, sermon, corporate report, or AI-sounding summary."
  ].join(" ");
}

function buildVolunteerNeeds(events: MinistryEvent[], tasks: ActiveTask[]) {
  return events.flatMap((event) => {
    const needed = event.volunteersNeeded ?? 0;
    if (needed <= 0) return [];
    const assigned = new Set(tasks.filter((task) => task.eventId === event.id && task.assignedUserId && task.status !== "done").map((task) => task.assignedUserId)).size;
    return assigned < needed ? [`${event.title}: ${needed - assigned} volunteer role${needed - assigned === 1 ? "" : "s"} still need clear ownership.`] : [];
  });
}

function buildLeaderReminders(events: MinistryEvent[], tasks: Array<{ taskTitle: string; dueDate: string; eventTitle?: string }>) {
  const deadlineReminders = events.flatMap((event) =>
    event.registrationDeadline ? [`${event.title}: registration deadline ${formatShortDate(event.registrationDeadline)}.`] : []
  );
  const taskReminders = tasks.slice(0, 3).map((task) => `${task.taskTitle}${task.eventTitle ? ` for ${task.eventTitle}` : ""} is due ${formatShortDate(task.dueDate)}.`);
  return [...deadlineReminders, ...taskReminders].slice(0, 5);
}

function buildScheduleChanges(activity: MinistryIntelligenceData["activity"]) {
  return activity
    .filter((item) => /\b(schedule|date|time|location|changed|updated|moved)\b/i.test(item.message))
    .slice(0, 3)
    .map((item) => item.message.replace(/\s+/g, " ").trim());
}

function studentsToNotice(evidence: LeaderDailyBriefEvidence) {
  if (evidence.volunteerSignals.guestsVisible) return "Welcome newer students intentionally and help them find a place in conversation without putting them on the spot.";
  if (evidence.volunteerSignals.followUpVisible) return "Some students may need steady encouragement; notice who seems disconnected and follow up through the normal leader process.";
  return "Be intentional to draw quieter students into discussion with patient, low-pressure questions.";
}

function whyThisMatters(evidence: LeaderDailyBriefEvidence, sermon?: PublishedResource) {
  const season = evidence.meridian.profile.currentSeason.title;
  const nextEvent = evidence.upcomingEvents[0]?.title;
  if (sermon && nextEvent) {
    return `${season} is still the larger frame: events like ${nextEvent} are not just logistics, they create space for Scripture-shaped discipleship. The published sermon prep gives leaders a shared center so ordinary conversations can become more attentive and faithful.`;
  }
  if (nextEvent) {
    return `${season} is still the larger frame this week. ${nextEvent} matters because clear preparation gives leaders more margin to notice students, welcome guests, and turn logistics into real discipleship presence.`;
  }
  return `${season} matters even when the visible calendar is light. This week is an opportunity for leaders to prepare faithfully, care for students attentively, and keep ordinary ministry connected to the mission.`;
}

function prayerForDay(day: WeeklyContentDay) {
  switch (day) {
    case "monday":
      return "Lord, give our ministry staff wisdom, unity, and clear direction as they prepare the week.";
    case "tuesday":
      return "Jesus, meet students in their schools and help them remember they are seen, loved, and invited to follow You.";
    case "wednesday":
      return "Lord, strengthen our volunteers and make small groups places of honest conversation and patient discipleship.";
    case "thursday":
      return "Father, encourage parents and families as they disciple students in everyday rhythms at home.";
    case "friday":
      return "Lord, give us readiness for the weekend: clear details, rested leaders, and hearts ready to welcome students.";
    case "saturday":
      return "Jesus, prepare our teachers, worship leaders, and message so students can hear truth with clarity and grace.";
    case "sunday":
      return "Lord, help students respond to Christ with honest faith, and help leaders notice Your work with humility.";
  }
}

function leaderDevelopmentForDay(day: WeeklyContentDay) {
  const topics: Record<WeeklyContentDay, { topic: string; lesson: string; practice: string }> = {
    monday: { topic: "asking better questions", lesson: "Good questions help students think before they perform. Ask what they notice before asking what they should do.", practice: "Ask one observation question before giving an explanation." },
    tuesday: { topic: "listening well", lesson: "Listening well communicates that students are not projects. Give their words enough space to become honest.", practice: "Repeat one student's answer back before adding your thought." },
    wednesday: { topic: "creating belonging", lesson: "Belonging grows through names, consistency, and small invitations. Students often join the group before they join the discussion.", practice: "Invite one quieter student into a low-pressure moment." },
    thursday: { topic: "relational discipleship", lesson: "Discipleship often moves through ordinary attention. Notice patterns, ask gentle follow-ups, and keep pointing students toward Jesus.", practice: "Ask one student how the week has really been." },
    friday: { topic: "healthy boundaries", lesson: "Healthy leaders serve faithfully without carrying what belongs to Jesus or the whole church. Boundaries protect care from becoming control.", practice: "Name one thing to hand back to Jesus in prayer." },
    saturday: { topic: "facilitating discussion", lesson: "A strong group is not leader airtime. Let silence do some work before you rescue the room.", practice: "Wait five seconds longer after your next question." },
    sunday: { topic: "Gospel conversations", lesson: "Gospel conversations are clearer when they stay personal, concrete, and hopeful. Help students name one next faithful response.", practice: "Ask: what is one step of trust Jesus is inviting today?" }
  };
  return topics[day];
}

function shrinkMessage(sections: LeaderDailyBriefSections) {
  const lines = [
    "# LEADER DAILY BRIEF",
    "",
    "📖 Why This Matters This Week",
    compactSentence(sections.whyThisMatters[0] ?? "This week matters because ordinary ministry preparation creates room for faithful discipleship.", 230),
    "",
    SEPARATOR,
    "",
    "📅 Upcoming",
    ...bulletLines(sections.upcoming, "• No urgent volunteer-facing logistics surfaced.", 2).map((line) => compactSentence(line, 105)),
    "",
    SEPARATOR,
    "",
    "📚 Prepare for Sunday",
    ...bulletLines(sections.prepareForSunday, "• Sermon preparation has not yet been published.", 2).map((line) => compactSentence(line, 105)),
    "",
    SEPARATOR,
    "",
    "👀 Students to Notice",
    compactSentence(sections.studentsToNotice, 115),
    "",
    SEPARATOR,
    "",
    "🌱 Leader Practice",
    compactSentence(sections.leaderPractice, 95),
    "Today's Practice:",
    compactSentence(sections.todaysPractice, 75),
    "",
    SEPARATOR,
    "",
    "🙏 Today's Prayer",
    compactSentence(sections.prayer, 130)
  ];
  return lines.join("\n").trim().slice(0, GROUPME_MAX_CHARS);
}

function paragraphLines(values: string[], maxItems: number) {
  return values.slice(0, maxItems).map((value) => compactSentence(value, 360)).filter(Boolean);
}

function bulletLines(values: string[], emptyLine: string, maxItems: number) {
  const items = values.map((value) => value.replace(/^[-•]\s*/, "").trim()).filter(Boolean).slice(0, maxItems);
  return items.length ? items.map((item) => `• ${item}`) : [emptyLine];
}

function compactSentence(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? compactSentence(value, maxLength) : "";
}

function textArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => textValue(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function pickEvent(event: MinistryEvent) {
  return {
    id: event.id,
    title: event.title,
    startTime: event.startTime,
    location: event.location,
    targetGroup: event.targetGroup,
    volunteersNeeded: event.volunteersNeeded,
    registrationDeadline: event.registrationDeadline
  };
}

function pickTask(task: ActiveTask) {
  return {
    id: task.id,
    eventId: task.eventId,
    taskTitle: task.taskTitle,
    dueDate: task.dueDate,
    assignedUserId: task.assignedUserId,
    status: task.status
  };
}

function displayName(user?: User) {
  return user ? `${user.firstName} ${user.lastName}`.trim() || user.email : undefined;
}

function isWithin(value: string, start: Date, end: Date) {
  const date = new Date(value);
  return date >= start && date < end;
}

function byDate<T>(read: (value: T) => string) {
  return (left: T, right: T) => new Date(read(left)).getTime() - new Date(read(right)).getTime();
}

function startOfCentralDay(date: Date) {
  const [year, month, day] = centralDateKey(date).split("-").map(Number);
  const offsetHours = centralOffsetHours(date);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offsetHours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function centralDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function centralDayIndex(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long" }).format(date).toLowerCase();
  return DAY_NAMES.indexOf(weekday as WeeklyContentDay);
}

function centralOffsetHours(date: Date) {
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    timeZoneName: "shortOffset",
    hour: "2-digit"
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  const match = offset?.match(/^GMT([+-]\d{1,2})(?::\d{2})?$/);
  return match ? Number(match[1]) : -6;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date TBD";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
}
