import type { MinistryOverview } from "@/lib/data/ministry-repository";
import type { ActiveTask, MinistryEvent, User } from "@/lib/types";
import type { DecisionCenterState, DecisionEvidence, DecisionSignal, JudgedIntegrationFlow, LeadershipAttentionItem } from "@/lib/decision-center/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildMinistryDecisionCenterState(
  overview: MinistryOverview,
  now: Date = new Date()
): DecisionCenterState {
  const activeEvents = overview.events.filter((event) => !event.archivedAt);
  const upcomingEvents = activeEvents
    .filter((event) => new Date(event.startTime).getTime() >= now.getTime())
    .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());
  const upcomingWindow = upcomingEvents.filter((event) => new Date(event.startTime).getTime() <= now.getTime() + 30 * DAY_MS);
  const openTasks = overview.tasks.filter((task) => task.status !== "done");
  const blockedTasks = openTasks.filter((task) => task.status === "blocked");
  const ownerGapEvents = upcomingWindow.filter((event) => !event.contactOwnerId);
  const readinessGapEvents = upcomingWindow.filter((event) => missingReadinessFields(event).length > 0);
  const budgetTarget = activeEvents.reduce((sum, event) => sum + Number(event.budgetTarget ?? 0), 0);
  const budgetActual = activeEvents.reduce((sum, event) => sum + Number(event.budgetActual ?? 0), 0);
  const recentActivity = overview.activity.slice(0, 6);

  const signals = [
    buildReadinessSignal(readinessGapEvents, upcomingWindow),
    buildTaskSignal(openTasks, blockedTasks, overview.tasks),
    buildOwnerSignal(ownerGapEvents, upcomingWindow, overview.users),
    buildBudgetSignal(budgetActual, budgetTarget, activeEvents),
    buildIntegrationSignal()
  ].filter((signal): signal is DecisionSignal => Boolean(signal));

  return {
    kind: "ministry",
    title: "Ministry Decision Center",
    direction: {
      emphasis: "Competition MVP stability while Architecture Evolution creates the long-term decision layer.",
      horizon: upcomingWindow.length ? "Next 30 days" : "No active 30-day event window",
      owner: primaryOwnerLabel(overview.users),
      reviewedAt: `Generated ${formatDate(now.toISOString())}`
    },
    metrics: [
      {
        id: "upcoming-events",
        label: "30-day events",
        value: String(upcomingWindow.length),
        detail: upcomingWindow.length ? `${upcomingEvents.length} total upcoming` : "No near-term events found",
        tone: "info"
      },
      {
        id: "readiness",
        label: "Readiness gaps",
        value: String(readinessGapEvents.length),
        detail: readinessGapEvents.length ? "Events missing core planning fields" : "Core fields are present",
        tone: readinessGapEvents.length ? "warning" : "success"
      },
      {
        id: "open-tasks",
        label: "Open tasks",
        value: String(openTasks.length),
        detail: blockedTasks.length ? `${blockedTasks.length} blocked` : "No blocked tasks detected",
        tone: blockedTasks.length ? "critical" : openTasks.length ? "gold" : "success"
      },
      {
        id: "budget-pressure",
        label: "Recorded spend",
        value: formatMoney(budgetActual),
        detail: budgetTarget ? `${Math.round((budgetActual / budgetTarget) * 100)}% of planned target` : "No budget target set",
        tone: budgetTarget && budgetActual > budgetTarget ? "critical" : "neutral"
      }
    ],
    signals,
    attention: buildAttention(signals, recentActivity),
    judgedIntegrationFlows: judgedIntegrationFlows()
  };
}

function buildReadinessSignal(eventsWithGaps: MinistryEvent[], upcomingWindow: MinistryEvent[]): DecisionSignal | undefined {
  if (!upcomingWindow.length) {
    return {
      id: "ministry.no-upcoming-window",
      title: "No near-term event window is active",
      summary: "The decision center cannot assess readiness until an upcoming event is scheduled.",
      confidence: "High",
      freshness: "Current overview",
      evidence: [{ id: "events.empty", sourceKind: "event", label: "Events", detail: "No events were found in the next 30 days." }],
      tone: "neutral",
      targetHref: "/events",
      targetLabel: "Create event"
    };
  }

  if (!eventsWithGaps.length) return undefined;

  return {
    id: "ministry.event-readiness-gaps",
    title: `${eventsWithGaps.length} event${eventsWithGaps.length === 1 ? "" : "s"} need readiness review`,
    summary: "Upcoming events are missing details that affect communication, budget, or volunteer preparation.",
    confidence: "High",
    freshness: "Current overview",
    evidence: eventsWithGaps.slice(0, 4).map((event) => ({
      id: `event.${event.id}.readiness`,
      sourceKind: "event",
      label: event.title,
      detail: `Missing ${missingReadinessFields(event).join(", ")} before this event can be treated as ready.`
    })),
    tone: "warning",
    targetHref: "/events",
    targetLabel: "Review events"
  };
}

function buildTaskSignal(openTasks: ActiveTask[], blockedTasks: ActiveTask[], allTasks: ActiveTask[]): DecisionSignal | undefined {
  if (!openTasks.length && allTasks.length) return undefined;

  if (!allTasks.length) {
    return {
      id: "ministry.no-task-evidence",
      title: "Task evidence is not available yet",
      summary: "Baseline tasks will give this decision center stronger evidence after event work is created.",
      confidence: "High",
      freshness: "Current overview",
      evidence: [{ id: "tasks.empty", sourceKind: "task", label: "Tasks", detail: "No task rows are available in the overview." }],
      tone: "neutral",
      targetHref: "/tasks",
      targetLabel: "Open tasks"
    };
  }

  const priorityTasks = blockedTasks.length ? blockedTasks : openTasks.slice(0, 4);
  return {
    id: "ministry.task-load",
    title: blockedTasks.length ? `${blockedTasks.length} blocked task${blockedTasks.length === 1 ? "" : "s"} need attention` : `${openTasks.length} task${openTasks.length === 1 ? "" : "s"} remain open`,
    summary: blockedTasks.length
      ? "Blocked work is the clearest operational constraint visible in current data."
      : "Open work is visible, but no task is currently marked blocked.",
    confidence: "High",
    freshness: "Current overview",
    evidence: priorityTasks.map((task) => ({
      id: `task.${task.id}`,
      sourceKind: "task",
      label: task.taskTitle,
      detail: `${task.status.replaceAll("_", " ")}; due ${formatDate(task.dueDate)}.`
    })),
    tone: blockedTasks.length ? "critical" : "gold",
    targetHref: "/tasks",
    targetLabel: "Work tasks"
  };
}

function buildOwnerSignal(ownerGapEvents: MinistryEvent[], upcomingWindow: MinistryEvent[], users: User[]): DecisionSignal | undefined {
  if (!ownerGapEvents.length) return undefined;

  return {
    id: "ministry.communication-ownership",
    title: `${ownerGapEvents.length} event${ownerGapEvents.length === 1 ? "" : "s"} need communication ownership`,
    summary: "Communication drafts are strongest when a real owner is attached before the preview step.",
    confidence: users.length ? "High" : "Moderate",
    freshness: "Current overview",
    evidence: ownerGapEvents.slice(0, 4).map((event) => ({
      id: `event.${event.id}.owner`,
      sourceKind: "event",
      label: event.title,
      detail: `No communication owner is attached for ${formatDate(event.startTime)}.`
    })),
    tone: ownerGapEvents.length >= Math.max(2, upcomingWindow.length) ? "critical" : "warning",
    targetHref: "/communications",
    targetLabel: "Review drafts"
  };
}

function buildBudgetSignal(budgetActual: number, budgetTarget: number, events: MinistryEvent[]): DecisionSignal | undefined {
  if (!budgetTarget && !budgetActual) return undefined;

  const overTarget = budgetTarget > 0 && budgetActual > budgetTarget;
  return {
    id: "ministry.budget-pressure",
    title: overTarget ? "Recorded spend is above planned target" : "Budget evidence is available for review",
    summary: overTarget
      ? "The recorded event spend is higher than the combined target and should be reviewed before new commitments are added."
      : "Budget data can now support event portfolio decisions, but it should not be treated as the only measure of ministry value.",
    confidence: budgetTarget ? "High" : "Moderate",
    freshness: "Current overview",
    evidence: [
      {
        id: "budget.totals",
        sourceKind: "budget",
        label: "Event budget totals",
        detail: `${formatMoney(budgetActual)} recorded against ${budgetTarget ? formatMoney(budgetTarget) : "no target"}.`
      },
      {
        id: "budget.events",
        sourceKind: "event",
        label: "Event count",
        detail: `${events.length} active event${events.length === 1 ? "" : "s"} contributed to this snapshot.`
      }
    ],
    tone: overTarget ? "critical" : "info",
    targetHref: "/budget",
    targetLabel: "Review budget"
  };
}

function buildIntegrationSignal(): DecisionSignal {
  return {
    id: "ministry.judged-scripture-flow",
    title: "YouVersion and Gloo remain the judged Scripture flow",
    summary: "Decision-center architecture must keep the API-scored Scripture path visible instead of burying it behind generic intelligence UI.",
    confidence: "High",
    freshness: "Architecture Phase 1-3",
    evidence: [
      {
        id: "integration.youversion",
        sourceKind: "scripture",
        label: "YouVersion",
        detail: "Scripture grounding opens the Bible App reader and server lookup without storing licensed Bible text."
      },
      {
        id: "integration.gloo",
        sourceKind: "integration",
        label: "Gloo AI Studio",
        detail: "Discussion and reading-plan drafts route through Gloo first, with configured fallback providers only when needed."
      }
    ],
    tone: "info",
    targetHref: "/student/scripture/questions",
    targetLabel: "Open Journey Journal"
  };
}

function buildAttention(signals: DecisionSignal[], recentActivity: unknown[]): LeadershipAttentionItem[] {
  const attention = signals
    .filter((signal) => signal.tone === "critical" || signal.tone === "warning")
    .slice(0, 3)
    .map((signal) => ({
      id: `attention.${signal.id}`,
      title: signal.title,
      summary: signal.summary,
      owner: "Ministry leadership",
      status: signal.tone === "critical" ? "Review" : "Discuss",
      nextStepHref: signal.targetHref,
      nextStepLabel: signal.targetLabel,
      signalIds: [signal.id]
    } satisfies LeadershipAttentionItem));

  if (attention.length) return attention;

  return [
    {
      id: "attention.judged-flow",
      title: "Keep the judged integration path visible",
      summary: recentActivity.length
        ? "Operational data is present, so the next review should connect current ministry signals to the Scripture workflow narrative."
        : "Use the YouVersion and Gloo flow as the competition proof while operational data grows.",
      owner: "Architecture Evolution",
      status: "Prepare",
      nextStepHref: "/student/scripture/questions",
      nextStepLabel: "Open Journey Journal",
      signalIds: ["ministry.judged-scripture-flow"]
    }
  ];
}

function missingReadinessFields(event: MinistryEvent) {
  return [
    !event.description ? "description" : "",
    !event.location ? "location" : "",
    !event.targetGroup ? "audience" : "",
    !event.contactOwnerId ? "communication owner" : ""
  ].filter(Boolean);
}

function primaryOwnerLabel(users: User[]) {
  const admin = users.find((user) => user.role === "admin") ?? users[0];
  return admin ? `${admin.firstName} ${admin.lastName}`.trim() || admin.email : "Ministry leadership";
}

function judgedIntegrationFlows(): JudgedIntegrationFlow[] {
  return [
    {
      id: "youversion",
      provider: "YouVersion Platform API",
      visibleStep: "Scripture grounding",
      route: "/student/scripture/resources and /api/student/scripture/lookup",
      serverFlow: "lookupYouVersionPassage -> YouVersion passage endpoint; buildYouVersionReaderLink opens Bible.com reader links.",
      scoringPurpose: "Shows that students and leaders start from Scripture before AI-assisted discussion.",
      storageBoundary: "Bible text is transient; reader links and references are used without storing licensed passage content."
    },
    {
      id: "gloo-discussion",
      provider: "Gloo AI Studio",
      visibleStep: "Discussion prompt generation",
      route: "/api/student/scripture/discussion",
      serverFlow: "createStudentDiscussionPrompt -> generateMeridianDiscussionDraft -> Gloo chat completions.",
      scoringPurpose: "Shows Gloo as the primary ministry-aware generation provider for leader-reviewed discussion prompts.",
      storageBoundary: "Provider output is stored only as leader-review workflow data, with safety labels and review state."
    },
    {
      id: "gloo-reading-plan",
      provider: "Gloo AI Studio",
      visibleStep: "Reading-plan draft generation",
      route: "/api/student/scripture/reading-plan",
      serverFlow: "generateMeridianReadingPlanDraft -> Gloo first; Gemini/OpenAI fallback only when configured.",
      scoringPurpose: "Shows a concrete generation step for Scripture practice pathways and Meridian-assisted formation.",
      storageBoundary: "Drafts are preview-only until a leader reviews and publishes through a later Meridian workflow."
    }
  ];
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date unavailable";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
