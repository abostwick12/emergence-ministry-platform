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
  const normalizedPrompt = input.prompt.toLowerCase();
  const upcoming = input.overview.events.slice(0, 2).map((event) => event.title);
  const openTasks = input.overview.tasks.filter((task) => task.status !== "done").length;
  const visibleVolunteerSlots = input.overview.events.reduce((sum, event) => sum + Number(event.volunteersNeeded ?? 0), 0);
  const focus = pageFocus[input.page] ?? "Use the safest visible snapshot and keep the next action reviewable.";

  if (isVolunteerCapacityPrompt(normalizedPrompt)) {
    return {
      summary: "Guest EMMA demo: for a Wednesday high-school Bible study, plan on 3-4 extra committed adults for a pilot unless existing Wednesday leaders can absorb the rhythm.",
      points: [
        "Minimum baseline: 2 consistent adults in the room before launch.",
        "Safer pilot coverage: add 1 backup or relational follow-up leader and 1 coordinator if no current owner can carry weekly setup and communication.",
        `${openTasks} sandbox workflow task${openTasks === 1 ? "" : "s"} and ${visibleVolunteerSlots} visible demo volunteer slot${visibleVolunteerSlots === 1 ? "" : "s"} are already in view, so leader margin needs a real check before announcing.`
      ],
      nextActions: [
        "Confirm expected attendance and whether the group needs breakouts.",
        "Ask current high-school leaders who has Wednesday margin.",
        "Use a four-week pilot before treating this as a permanent rhythm."
      ]
    };
  }

  if (isRecurringMinistryRhythmPrompt(normalizedPrompt)) {
    return {
      summary: "Guest EMMA demo: adding a Wednesday high-school Bible study is plausible for the Scripture Practice season, but the decision should be made as a capacity-and-discernment brief, not a quick calendar add.",
      points: [
        upcoming.length ? `Demo events in view: ${upcoming.join(", ")}.` : "No demo events are currently in view.",
        `${openTasks} sandbox workflow task${openTasks === 1 ? "" : "s"} and ${visibleVolunteerSlots} visible demo volunteer slot${visibleVolunteerSlots === 1 ? "" : "s"} are already in the public snapshot.`,
        "Evidence still missing: student interest, Wednesday conflicts, room availability, leader margin, curriculum plan, and follow-up path."
      ],
      nextActions: [
        "Frame the idea as a four-week Scripture-practice pilot.",
        "Confirm one owner, 2 in-room adults, and a backup/follow-up leader before announcing.",
        "Review whether the pilot creates more relational discipleship space or only adds activity."
      ]
    };
  }

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

function isRecurringMinistryRhythmPrompt(normalizedPrompt: string): boolean {
  return (
    /\b(add|adding|start|launch|create|begin|host)\b/.test(normalizedPrompt) &&
    /\b(weekly|every week|recurring|wednesday|weds|wed|bible study|small group|study)\b/.test(normalizedPrompt)
  );
}

function isVolunteerCapacityPrompt(normalizedPrompt: string): boolean {
  return /\b(volunteer|leader|adult|coverage|capacity|staff|staffing|how many|extra help|ratio)\b/.test(normalizedPrompt);
}
