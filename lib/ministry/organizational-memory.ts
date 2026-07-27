import type { MinistryOverview } from "@/lib/data/ministry-repository";
import type { EventType } from "@/lib/types";

export type MinistryMemoryInsight = {
  title: string;
  detail: string;
  evidence: string;
  tone: "cyan" | "gold" | "green";
};

export type MinistryMemorySource = {
  label: string;
  detail: string;
};

export type MinistryMemoryDemo = {
  yearSpanLabel: string;
  historicalEventCount: number;
  currentEventCount: number;
  recordCount: number;
  eventFamilyCount: number;
  stubSourceCount: number;
  eventFamilies: Array<{ label: string; count: number }>;
  insights: MinistryMemoryInsight[];
  sources: MinistryMemorySource[];
  prompts: string[];
};

const eventTypeLabels: Record<EventType, string> = {
  sunday_morning_service: "Sunday mornings",
  sunday_evening_service: "Sunday evenings",
  middle_school_event: "Middle school",
  high_school_event: "High school",
  small_group_gathering: "Small groups",
  missions_trip: "Serve days",
  conference: "Retreats",
  combined_event: "Combined events",
  other: "Other ministry moments"
};

export function buildMinistryMemoryDemo(overview: MinistryOverview, generatedAt = new Date()): MinistryMemoryDemo {
  const nowMs = generatedAt.getTime();
  const historicalEvents = overview.events.filter((event) => event.archivedAt || new Date(event.endTime).getTime() < nowMs);
  const currentEvents = overview.events.filter((event) => !event.archivedAt && new Date(event.endTime).getTime() >= nowMs);
  const years = overview.events
    .map((event) => new Date(event.startTime).getFullYear())
    .filter((year) => Number.isFinite(year));
  const minYear = years.length ? Math.min(...years) : generatedAt.getFullYear();
  const maxYear = years.length ? Math.max(...years) : generatedAt.getFullYear();
  const familyCounts = historicalEvents.reduce<Map<EventType, number>>((counts, event) => {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
    return counts;
  }, new Map<EventType, number>());
  const eventFamilies = Array.from(familyCounts.entries())
    .map(([type, count]) => ({ label: eventTypeLabels[type], count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const retreatEvents = historicalEvents.filter((event) => event.type === "conference" || /retreat/i.test(event.title));
  const serveEvents = historicalEvents.filter((event) => event.type === "missions_trip" || /serve|service/i.test(event.title));
  const followUpTasks = overview.tasks.filter((task) => /follow.?up|debrief|retention|story/i.test(`${task.taskTitle} ${task.notes ?? ""}`));
  const expenseTotal = overview.expenses.reduce((total, expense) => total + expense.amount, 0);
  const stubSourceCount = overview.events.reduce((count, event) => {
    return count
      + (event.googleImportStatus ? 1 : 0)
      + (event.googleCalendarEventId ? 1 : 0)
      + (event.googleDriveFolderId ? 1 : 0)
      + (event.proPresenterPlaylistId ? 1 : 0);
  }, 0);

  return {
    yearSpanLabel: minYear === maxYear ? `${minYear}` : `${minYear}-${maxYear}`,
    historicalEventCount: historicalEvents.length,
    currentEventCount: currentEvents.length,
    recordCount: overview.events.length + overview.tasks.length + overview.expenses.length + overview.activity.length,
    eventFamilyCount: eventFamilies.length,
    stubSourceCount,
    eventFamilies,
    insights: [
      {
        title: "Retreat planning can start from a pattern, not a hunch.",
        detail: retreatEvents.length
          ? `${retreatEvents.length} archived retreat records connect budget, volunteer load, follow-up tasks, and communication previews before this year's retreat decisions are made.`
          : "Retreat records are ready to become a repeatable decision trail once historical data is connected.",
        evidence: `${retreatEvents.length} retreat records, ${overview.tasks.filter((task) => /retreat/i.test(task.taskTitle) || retreatEvents.some((event) => event.id === task.eventId)).length} related tasks`,
        tone: "gold"
      },
      {
        title: "Serve rhythms show where partner coordination creates pressure.",
        detail: serveEvents.length
          ? `${serveEvents.length} serve day memories expose the recurring need to confirm partners, transportation, and leader ratios before families are invited.`
          : "Serve-day history is modeled so leaders can see how external partner timing would shape future plans.",
        evidence: `${serveEvents.length} serve day records`,
        tone: "cyan"
      },
      {
        title: "Follow-up is visible as ministry work, not an afterthought.",
        detail: followUpTasks.length
          ? `${followUpTasks.length} debrief, story, and follow-up tasks make care after the event inspectable alongside the event itself.`
          : "The memory model reserves space for debrief and follow-up work so past ministry fruit can inform the next decision.",
        evidence: `${followUpTasks.length} follow-up signals`,
        tone: "green"
      },
      {
        title: "Budget memory makes sustainability easier to explain.",
        detail: `Seeded expenses total ${formatCurrency(expenseTotal)} across archived and current demo events, giving EMMA concrete budget context without connecting live finance tools.`,
        evidence: `${overview.expenses.length} expense records`,
        tone: "gold"
      }
    ],
    sources: [
      {
        label: "Planning Center attendance snapshots",
        detail: "Modeled check-in counts, first-time students, and space-owner notes. Not connected in public demo mode."
      },
      {
        label: "Google Calendar ministry cadence",
        detail: "Stub event IDs show how repeated rhythms could be reviewed without writing to a live calendar."
      },
      {
        label: "Google Drive planning folders",
        detail: "Fake folder IDs represent where debriefs, parent drafts, and leader docs would live after approval."
      },
      {
        label: "ProPresenter readiness",
        detail: "Modeled playlist IDs surface worship and room-readiness memory without calling ProPresenter."
      },
      {
        label: "Human-approved communication previews",
        detail: "Draft records stay preview-only, preserving the boundary that the platform does not send messages by itself."
      }
    ],
    prompts: [
      "Compare this year's retreat plan with the last four retreats.",
      "Which ministry rhythm keeps creating last-minute pressure?",
      "What should we stop, start, or sustain before adding another event?",
      "Which stub integrations would matter most if we connected Planning Center first?"
    ]
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}
