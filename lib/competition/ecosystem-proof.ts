export type CompetitionEcosystemLayer = {
  detail: string;
  label: string;
  value: string;
};

export type CompetitionBoundaryGroup = {
  items: string[];
  label: string;
};

export type CompetitionVerificationRoute = {
  href: string;
  label: string;
};

export const competitionEcosystemProof: CompetitionEcosystemLayer[] = [
  {
    label: "Operational hub",
    value: "Built",
    detail: "Dashboard, events, tasks, communication previews, budget visibility, activity logs, and guest sandbox flows."
  },
  {
    label: "Meridian context",
    value: "Visible",
    detail: "Ministry Alignment, organizational memory, evidence stacks, and EMMA prompts use leadership-authored direction."
  },
  {
    label: "YouVersion grounding",
    value: "Server-seamed",
    detail: "Reader links and lookup routes ground Scripture without storing licensed Bible text as permanent memory."
  },
  {
    label: "Gloo AI Studio",
    value: "Governed",
    detail: "Primary draft provider for discussions and reading plans, with local guest previews and server diagnostics."
  },
  {
    label: "Leader approval",
    value: "Required",
    detail: "AI drafts are candidate outputs; sharing, promotion, and sensitive follow-up stay under human review."
  }
];

export const competitionBoundaryGroups: CompetitionBoundaryGroup[] = [
  {
    label: "Works in the demo",
    items: ["Guest dashboard sandbox", "Ministry Hub alignment", "Journey Journal", "Leader review", "Provider diagnostics"]
  },
  {
    label: "Provider-backed seams",
    items: ["YouVersion lookup route", "Gloo discussion draft route", "Gloo reading-plan route", "Meridian retrieval wrappers"]
  },
  {
    label: "Intentionally governed",
    items: ["No autonomous verdicts", "No automatic sending", "No stored Bible text", "No pastoral-care automation"]
  }
];

export const competitionVerificationRoutes: CompetitionVerificationRoute[] = [
  { href: "/login", label: "Guest login" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ministry", label: "Ministry Hub" },
  { href: "/student/scripture/resources?reference=John%203%3A16", label: "YouVersion reader" },
  { href: "/student/scripture/questions", label: "Journey Journal" },
  { href: "/discipleship", label: "Discipleship review" }
];
