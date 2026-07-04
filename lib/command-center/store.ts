// In-memory mock store for the Personal Command Center.
//
// Used when the session is a dev/mock session or Supabase is not configured,
// mirroring the pattern in lib/store.ts and lib/camp/store.ts. State lives for
// the lifetime of the server process only.

import type {
  BriefingItem,
  CaptureEntry,
  CommandCenterOverview,
  DomainTaskSummary,
  JobApplication,
  PersonalDomain,
  PersonalIntegration,
  PersonalTask,
  UpdateJobApplicationInput
} from "@/lib/command-center/types";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function seedTasks(): PersonalTask[] {
  return [
  {
    id: uid("task"),
    domain: "military_transition",
    title: "File VA disability claim via BDD program",
    description: "Submit before the 180-day pre-separation window closes.",
    status: "in_progress",
    priority: "critical",
    dueDate: daysFromNow(5),
    tags: ["va", "retirement"],
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("task"),
    domain: "military_transition",
    title: "Complete TAP program enrollment",
    status: "todo",
    priority: "high",
    dueDate: daysFromNow(14),
    tags: ["tap"],
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("task"),
    domain: "military_transition",
    title: "Elect Survivor Benefit Plan option",
    status: "todo",
    priority: "medium",
    dueDate: daysFromNow(60),
    tags: ["sbp", "finance"],
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("task"),
    domain: "sotf_fellowship",
    title: "Submit cohort reflection essay",
    status: "todo",
    priority: "high",
    dueDate: daysFromNow(3),
    tags: ["deliverable"],
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("task"),
    domain: "sotf_fellowship",
    title: "Schedule mentor check-in call",
    status: "todo",
    priority: "medium",
    dueDate: daysFromNow(10),
    tags: ["mentor"],
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("task"),
    domain: "sotf_fellowship",
    title: "Draft SOTF reflection outline",
    status: "in_progress",
    priority: "medium",
    dueDate: daysFromNow(7),
    tags: ["writing"],
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("task"),
    domain: "job_search",
    title: "Tailor resume for Director of Operations roles",
    status: "in_progress",
    priority: "high",
    dueDate: daysFromNow(2),
    tags: ["resume"],
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("task"),
    domain: "job_search",
    title: "Send 2 warm networking messages this week",
    status: "todo",
    priority: "medium",
    dueDate: daysFromNow(4),
    tags: ["networking"],
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("task"),
    domain: "job_search",
    title: "Update LinkedIn headline and About section",
    status: "blocked",
    priority: "medium",
    tags: ["linkedin"],
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("task"),
    domain: "life",
    title: "Schedule annual physical",
    status: "todo",
    priority: "low",
    dueDate: daysFromNow(21),
    tags: ["health"],
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("task"),
    domain: "life",
    title: "Renew passport",
    status: "todo",
    priority: "medium",
    dueDate: daysFromNow(45),
    tags: ["admin"],
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("task"),
    domain: "life",
    title: "Schedule weekly planning block",
    status: "todo",
    priority: "high",
    dueDate: daysFromNow(1),
    tags: ["planning"],
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
  ];
}

const briefingItems: BriefingItem[] = [
  {
    id: uid("brief"),
    title: "How to translate military leadership into civilian executive language",
    url: "https://example.com/military-to-executive",
    summary: "A practical framework for reframing command experience as P&L and org leadership on a resume.",
    source: "Hiring Our Heroes",
    category: "military_transition"
  },
  {
    id: uid("brief"),
    title: "Job market pulse: what's changed for leadership roles in the last 30 days",
    url: "https://example.com/job-market-pulse",
    summary: "Hiring for Director/COO-level roles is picking up in nonprofit and mission-driven organizations.",
    source: "LinkedIn Talent Insights",
    category: "job_market"
  },
  {
    id: uid("brief"),
    title: "The compounding value of fellowship relationships during a career transition",
    url: "https://example.com/fellowship-relationships",
    summary: "Why cohort relationships built during structured leadership programs often outlast the program itself.",
    source: "HBR",
    category: "leadership"
  }
];

function seedIntegrations(): PersonalIntegration[] {
  return [
    { id: uid("int"), service: "firecrawl", status: "disconnected", config: {} },
    { id: uid("int"), service: "slack", status: "disconnected", config: {} },
    { id: uid("int"), service: "google_calendar", status: "disconnected", config: {} },
    { id: uid("int"), service: "gmail", status: "disconnected", config: {} },
    { id: uid("int"), service: "google_drive", status: "disconnected", config: {} },
    { id: uid("int"), service: "linkedin", status: "disconnected", config: {} },
    { id: uid("int"), service: "monday", status: "disconnected", config: {} }
  ];
}

function seedJobApplications(): JobApplication[] {
  return [
  {
    id: uid("job"),
    company: "Hiring Our Heroes",
    role: "Director of Veteran Programs",
    status: "phone_screen",
    appliedDate: daysFromNow(-10),
    contactName: "Recruiting Team",
    nextFollowUpDate: daysFromNow(1),
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("job"),
    company: "Faithful Nonprofit Collective",
    role: "Chief Operating Officer",
    status: "applied",
    appliedDate: daysFromNow(-4),
    nextFollowUpDate: daysFromNow(6),
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: uid("job"),
    company: "Growth-Stage SaaS Co.",
    role: "VP of Operations",
    status: "researching",
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
  ];
}

function seedCaptures(): CaptureEntry[] {
  return [
    {
      id: uid("cap"),
      rawText: "Ask TAP counselor which retirement documents need signatures this week",
      status: "unprocessed",
      createdAt: nowIso()
    },
    {
      id: uid("cap"),
      rawText: "Follow up with fellowship mentor about next reflection prompt",
      status: "unprocessed",
      createdAt: nowIso()
    },
    {
      id: uid("cap"),
      rawText: "Add the nonprofit operations role to the job tracker",
      status: "unprocessed",
      createdAt: nowIso()
    }
  ];
}

// Next.js dev-mode note:
// The App Router compiles each route.ts as its own on-demand entry and can
// recompile/re-instantiate a route's module graph independently of sibling
// routes (e.g. after an idle eviction). A plain module-level `let` would then
// appear to "forget" state created via a different route file even though no
// file changed. Anchoring state on `globalThis` (the same pattern Next.js
// recommends for a dev-mode Prisma client) survives that re-instantiation
// because `globalThis` is the real Node.js global, not a webpack module.
type CommandCenterStoreState = {
  tasks: PersonalTask[];
  integrations: PersonalIntegration[];
  jobApplications: JobApplication[];
  captureInbox: CaptureEntry[];
};

declare global {
  // eslint-disable-next-line no-var
  var __commandCenterStore: CommandCenterStoreState | undefined;
}

function createInitialState(): CommandCenterStoreState {
  return {
    tasks: seedTasks(),
    integrations: seedIntegrations(),
    jobApplications: seedJobApplications(),
    captureInbox: seedCaptures()
  };
}

const state: CommandCenterStoreState = globalThis.__commandCenterStore ?? (globalThis.__commandCenterStore = createInitialState());

// Test-only: reinitializes all mutable module state to its seeded defaults.
// Mirrors __resetCampStoreForTests() in lib/camp/store.ts.
export function __resetCommandCenterStoreForTests(): void {
  state.tasks = seedTasks();
  state.integrations = seedIntegrations();
  state.jobApplications = seedJobApplications();
  state.captureInbox = seedCaptures();
}

export function listTasks(filter?: { domain?: PersonalDomain; status?: string }): PersonalTask[] {
  return state.tasks.filter((task) => {
    if (filter?.domain && task.domain !== filter.domain) return false;
    if (filter?.status && task.status !== filter.status) return false;
    return true;
  });
}

export function createTask(input: Omit<PersonalTask, "id" | "createdAt" | "updatedAt">): PersonalTask {
  const task: PersonalTask = { ...input, id: uid("task"), createdAt: nowIso(), updatedAt: nowIso() };
  state.tasks = [task, ...state.tasks];
  return task;
}

export function updateTask(id: string, input: Partial<PersonalTask>): PersonalTask | null {
  let updated: PersonalTask | null = null;
  state.tasks = state.tasks.map((task) => {
    if (task.id !== id) return task;
    updated = { ...task, ...input, id: task.id, updatedAt: nowIso() };
    return updated;
  });
  return updated;
}

export function deleteTask(id: string): void {
  state.tasks = state.tasks.filter((task) => task.id !== id);
}

export function getBriefing(): BriefingItem[] {
  return briefingItems;
}

export function listIntegrations(): PersonalIntegration[] {
  return state.integrations;
}

export function createCaptureEntry(rawText: string): CaptureEntry {
  const entry: CaptureEntry = { id: uid("cap"), rawText, status: "unprocessed", createdAt: nowIso() };
  state.captureInbox = [entry, ...state.captureInbox];
  return entry;
}

export function listUnprocessedCaptures(): CaptureEntry[] {
  return state.captureInbox.filter((entry) => entry.status === "unprocessed");
}

export function resolveCaptureEntry(id: string, input: Partial<CaptureEntry>): CaptureEntry | null {
  let updated: CaptureEntry | null = null;
  state.captureInbox = state.captureInbox.map((entry) => {
    if (entry.id !== id) return entry;
    updated = { ...entry, ...input, id: entry.id };
    return updated;
  });
  return updated;
}

export function listJobApplications(filter?: { status?: JobApplication["status"] }): JobApplication[] {
  return state.jobApplications.filter((application) => {
    if (filter?.status && application.status !== filter.status) return false;
    return true;
  });
}

export function createJobApplication(input: Omit<JobApplication, "id" | "createdAt" | "updatedAt">): JobApplication {
  const application: JobApplication = { ...input, id: uid("job"), createdAt: nowIso(), updatedAt: nowIso() };
  state.jobApplications = [application, ...state.jobApplications];
  return application;
}

export function updateJobApplication(id: string, input: UpdateJobApplicationInput): JobApplication | null {
  let updated: JobApplication | null = null;
  state.jobApplications = state.jobApplications.map((application) => {
    if (application.id !== id) return application;
    const next: JobApplication = { ...application, id: application.id, updatedAt: nowIso() };
    if (input.company !== undefined) next.company = input.company;
    if (input.role !== undefined) next.role = input.role;
    if (input.status !== undefined) next.status = input.status;
    if (input.appliedDate !== undefined) {
      if (input.appliedDate === null) delete next.appliedDate;
      else next.appliedDate = input.appliedDate;
    }
    if (input.contactName !== undefined) {
      if (input.contactName === null) delete next.contactName;
      else next.contactName = input.contactName;
    }
    if (input.contactNotes !== undefined) {
      if (input.contactNotes === null) delete next.contactNotes;
      else next.contactNotes = input.contactNotes;
    }
    if (input.nextFollowUpDate !== undefined) {
      if (input.nextFollowUpDate === null) delete next.nextFollowUpDate;
      else next.nextFollowUpDate = input.nextFollowUpDate;
    }
    if (input.compensationNotes !== undefined) {
      if (input.compensationNotes === null) delete next.compensationNotes;
      else next.compensationNotes = input.compensationNotes;
    }
    if (input.jobUrl !== undefined) {
      if (input.jobUrl === null) delete next.jobUrl;
      else next.jobUrl = input.jobUrl;
    }
    updated = next;
    return updated;
  });
  return updated;
}

const DOMAIN_ORDER: PersonalDomain[] = ["military_transition", "sotf_fellowship", "job_search", "life"];

const PRIORITY_WEIGHT: Record<PersonalTask["priority"], number> = { critical: 3, high: 2, medium: 1, low: 0 };
const DOMAIN_WEIGHT: Record<PersonalDomain, number> = { military_transition: 3, sotf_fellowship: 2, job_search: 1, life: 0 };

function dueWeight(task: PersonalTask, today: string): number {
  if (!task.dueDate) return 0;
  return task.dueDate <= today ? 2 : 1;
}

export function pickTodayPriorityFromTasks(allTasks: PersonalTask[]): PersonalTask | null {
  const openTasks = allTasks.filter((task) => task.status !== "done");
  if (openTasks.length === 0) return null;
  const today = nowIso().slice(0, 10);
  const sorted = [...openTasks].sort((a, b) => {
    const dueDiff = dueWeight(b, today) - dueWeight(a, today);
    if (dueDiff !== 0) return dueDiff;
    if (a.dueDate && b.dueDate) {
      const dueDateDiff = a.dueDate.localeCompare(b.dueDate);
      if (dueDateDiff !== 0) return dueDateDiff;
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    const domainDiff = DOMAIN_WEIGHT[b.domain] - DOMAIN_WEIGHT[a.domain];
    if (domainDiff !== 0) return domainDiff;
    return a.createdAt.localeCompare(b.createdAt);
  });
  return sorted[0];
}

export function computeTasksByDomain(allTasks: PersonalTask[]): Record<PersonalDomain, DomainTaskSummary> {
  return DOMAIN_ORDER.reduce<Record<PersonalDomain, DomainTaskSummary>>((acc, domain) => {
    const domainTasks = allTasks.filter((task) => task.domain === domain);
    const domainOpen = domainTasks.filter((task) => task.status !== "done");
    const withDueDate = [...domainOpen].filter((task) => task.dueDate).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
    acc[domain] = { total: domainTasks.length, open: domainOpen.length, nextDue: withDueDate[0] };
    return acc;
  }, {} as Record<PersonalDomain, DomainTaskSummary>);
}

export function countJobFollowUpsDue(applications: JobApplication[]): number {
  const today = nowIso().slice(0, 10);
  return applications.filter((app) => app.nextFollowUpDate && app.nextFollowUpDate <= today).length;
}

export function computeOverviewFromParts(parts: {
  tasks: PersonalTask[];
  briefingItems: BriefingItem[];
  integrations: PersonalIntegration[];
  jobApplications: JobApplication[];
  unprocessedCaptureCount: number;
}): CommandCenterOverview {
  return {
    todayPriority: pickTodayPriorityFromTasks(parts.tasks),
    tasksByDomain: computeTasksByDomain(parts.tasks),
    briefingItems: parts.briefingItems,
    integrations: parts.integrations,
    jobFollowUpsDueCount: countJobFollowUpsDue(parts.jobApplications),
    unprocessedCaptureCount: parts.unprocessedCaptureCount
  };
}

export function buildOverview(): CommandCenterOverview {
  return computeOverviewFromParts({
    tasks: state.tasks,
    briefingItems,
    integrations: state.integrations,
    jobApplications: state.jobApplications,
    unprocessedCaptureCount: listUnprocessedCaptures().length
  });
}
