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
    summary: `Guest EMMA simulation: ${focus}`,
    points: [
      upcoming.length ? `Fake events in view: ${upcoming.join(", ")}.` : "No fake events are currently in view.",
      `${openTasks} fake workflow task${openTasks === 1 ? "" : "s"} remain open in this sandbox.`,
      "This response is selected from curated stock guidance; no AI provider, workflow trigger, or database write ran."
    ],
    nextActions: [
      "Pick one fake event and check owner, budget, and communication readiness.",
      "Move or delete a sandbox task to feel the workflow update.",
      "Use Login when you are ready to work with real ministry data."
    ]
  };
}

export function guestAuditLabel() {
  return "Guest simulation / stock response / no external AI call / no audit write";
}
