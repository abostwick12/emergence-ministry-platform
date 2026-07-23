export type LandingVideoScene = {
  eyebrow: string;
  title: string;
  body: string;
  productArea: string;
  metric: string;
  accent: "cyan" | "blue" | "emerald" | "violet" | "amber" | "rose";
};

export type LandingRoleEntry = {
  audience: string;
  title: string;
  description: string;
  href: string;
  label: string;
};

export const landingVideoScenes: LandingVideoScene[] = [
  {
    eyebrow: "Dashboard",
    title: "See what needs attention before the week starts.",
    body: "Upcoming events, ministry pulse, calendar pressure, and blocked work move into one daily operating view.",
    productArea: "Ministry Leader View",
    metric: "5 events this week",
    accent: "cyan"
  },
  {
    eyebrow: "Events",
    title: "Turn ministry ideas into shared plans.",
    body: "Event vision, dates, budgets, owners, and readiness live together instead of being scattered across tabs and texts.",
    productArea: "Events Workspace",
    metric: "4 active event lanes",
    accent: "blue"
  },
  {
    eyebrow: "Tasks",
    title: "Make follow-through visible without more meetings.",
    body: "Baseline task generation, ownership, due dates, notes, and status changes give leaders the next right step.",
    productArea: "Task Workspace",
    metric: "26 tasks queued",
    accent: "emerald"
  },
  {
    eyebrow: "Communications",
    title: "Prepare the message before it goes out.",
    body: "Parent emails, GroupMe drafts, and communication readiness stay preview-only until a leader reviews them.",
    productArea: "Communication Review",
    metric: "Preview only",
    accent: "violet"
  },
  {
    eyebrow: "Discipleship",
    title: "Move from managing events to forming students.",
    body: "Volunteer leaders can review questions, prepare Scripture-grounded discussion, and guide group next steps.",
    productArea: "Leader Workspace",
    metric: "Leader reviewed",
    accent: "amber"
  },
  {
    eyebrow: "Student Portal",
    title: "Give students a clear path to Scripture and community.",
    body: "Students can ask questions, keep reading, and receive leader-reviewed next steps without needing the operations dashboard.",
    productArea: "Student Experience",
    metric: "Ask, read, grow",
    accent: "rose"
  }
];

export const landingRoleEntries: LandingRoleEntry[] = [
  {
    audience: "Ministry Leader",
    title: "Run ministry operations",
    description: "Open the dashboard for events, tasks, budget visibility, ministry pulse, and launch-readiness work.",
    href: "/login?next=/dashboard",
    label: "Go to dashboard"
  },
  {
    audience: "Volunteer Leader",
    title: "Disciple students well",
    description: "Open the discipleship workspace for student questions, leader review, and Scripture-guided next steps.",
    href: "/login?next=/discipleship",
    label: "Go to discipleship"
  },
  {
    audience: "Student",
    title: "Ask, read, and grow",
    description: "Open the Student Portal for Scripture tools, reading plans, resources, and group conversation.",
    href: "/login?next=/student",
    label: "Go to student portal"
  }
];

