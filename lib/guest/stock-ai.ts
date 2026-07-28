import type { MinistryEmmaOverview, MinistryEmmaPage, MinistryEmmaResponse } from "@/lib/emma/ministry-page-assistant";

const pageFocus: Record<MinistryEmmaPage, string> = {
  dashboard: "Start with the blocked work, then use the calendar pressure to decide what needs a human today.",
  events: "Treat the event card as the source of truth: vision, owner, budget, tasks, and communication readiness should agree.",
  tasks: "Move the stuck and due-this-week tasks first, then assign clear owners before adding more work.",
  communications: "Keep every message in preview until a leader reviews audience, timing, and missing details.",
  people: "Use the people view to spot follow-up needs and make sure volunteers are not carrying invisible work.",
  budget: "Compare budget target against actual costs before promising families or leaders a next step.",
  settings: "Admins can shape access here, but guest mode never exposes real settings.",
  files: "Organize around events first, then forms, slides, receipts, and leader resources.",
  worship: "Line up people, songs, rehearsal notes, and presentation readiness before service day."
};

export function buildGuestEmmaResponse(input: {
  overview: MinistryEmmaOverview;
  page: MinistryEmmaPage;
  prompt: string;
}): MinistryEmmaResponse {
  const upcoming = input.overview.events.slice(0, 2).map((event) => event.title);
  const openTasks = input.overview.tasks.filter((task) => task.status !== "done").length;
  const focus = pageFocus[input.page] ?? "Use the safest visible snapshot and keep the next action reviewable.";

  return {
    summary: `Guest EMMA demo: ${focus}`,
    points: [
      upcoming.length ? `Demo events in view: ${upcoming.join(", ")}.` : "No demo events are currently in view.",
      `${openTasks} sandbox workflow task${openTasks === 1 ? "" : "s"} remain open for review.`,
      "Public guest mode keeps EMMA read-only: no writes, sends, workflow triggers, or external ministry data changes run."
    ],
    nextActions: [
      "Review whether another event would serve the current Scripture Practice priority.",
      "Check owner, budget, communication readiness, and leader capacity before adding more activity.",
      "Use the signed-in workspace when the ministry team is ready to work with real data."
    ]
  };
}

export function guestAuditLabel() {
  return "Guest demo response / read-only / no external AI call / no writes";
}
