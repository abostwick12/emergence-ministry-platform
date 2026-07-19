export type PlatformPageKey =
  | "dashboard"
  | "ministry_hub"
  | "directors_hub"
  | "resource_development"
  | "volunteer_dashboard"
  | "events"
  | "leader_prep"
  | "worship"
  | "tasks"
  | "communications"
  | "people"
  | "files"
  | "budget"
  | "discipleship"
  | "student_portal"
  | "journey_journal"
  | "scripture_resources"
  | "reading_plans"
  | "how_to_read"
  | "settings"
  | "camp"
  | "command_center";

export type PlatformPageDefinition = {
  key: PlatformPageKey;
  label: string;
  path: string;
  description: string;
  guestEligible: boolean;
  defaultGuestPublic: boolean;
  defaultRoles: string[];
};

export const platformPages: PlatformPageDefinition[] = [
  page("dashboard", "Dashboard", "/dashboard", "Ministry metrics, calendar, and priority signals.", true, true, ["admin", "leader"]),
  page("ministry_hub", "Ministry Hub", "/ministry", "Grouped event, worship, task, communication, and budget work.", true, true, ["admin", "leader"]),
  page("directors_hub", "Directors Hub", "/directors", "Director-level sermon, discipleship, resource, and volunteer monitoring.", true, true, ["admin", "leader"]),
  page("resource_development", "Resource Development", "/directors/resources", "Resource development planning and upload boundaries.", true, true, ["admin", "leader"]),
  page("volunteer_dashboard", "Volunteer Dashboard", "/directors/volunteers", "Volunteer monitoring and resource readiness.", true, true, ["admin", "leader"]),
  page("events", "Events", "/events", "Event plans, readiness, task trees, and workspaces.", true, true, ["admin", "leader"]),
  page("leader_prep", "Leader Prep", "/leader-prep", "Sermon and leader-guide preparation.", true, true, ["admin", "leader"]),
  page("worship", "Worship", "/worship", "Service, rehearsal, and presentation planning.", true, true, ["admin", "leader"]),
  page("tasks", "Tasks", "/tasks", "Task ownership, status, and due dates.", true, true, ["admin", "leader"]),
  page("communications", "Communications", "/communications", "Preview-only communication preparation.", true, true, ["admin", "leader"]),
  page("people", "People", "/people", "People operations and follow-up visibility.", true, true, ["admin", "leader"]),
  page("files", "Files", "/files", "File organization placeholders and Drive-ready planning.", true, true, ["admin", "leader"]),
  page("budget", "Budget", "/budget", "Budget targets and ministry expense visibility.", true, true, ["admin", "leader"]),
  page("discipleship", "Discipleship", "/discipleship", "Leader-facing student formation review.", true, true, ["admin", "leader"]),
  page("student_portal", "Student Portal", "/student", "Student Scripture and formation home.", true, true, ["admin", "leader", "student"]),
  page("journey_journal", "Journey Journal", "/student/scripture/questions", "Student questions and leader review.", true, true, ["admin", "leader", "student"]),
  page("scripture_resources", "Scripture Resources", "/student/scripture/resources", "Curated Scripture resources.", true, true, ["admin", "leader", "student"]),
  page("reading_plans", "Reading Plans", "/student/scripture/plans", "Guided Scripture reading plans.", true, true, ["admin", "leader", "student"]),
  page("how_to_read", "How to Read", "/student/scripture/how-to-read", "Scripture reading guidance.", true, true, ["admin", "leader", "student"]),
  page("settings", "Settings", "/settings", "Access, integrations, and platform safeguards.", false, false, ["admin"]),
  page("camp", "Camp", "/camp", "Camp Oakwood operations and restricted workflows.", false, false, ["admin", "leader"]),
  page("command_center", "Command Center", "/command-center", "Personal command center and live integrations.", false, false, ["admin"])
];

export const platformPageKeys = platformPages.map((item) => item.key);
export const defaultGuestPublicPageKeys = platformPages.filter((item) => item.defaultGuestPublic).map((item) => item.key);

const pagesByKey = new Map(platformPages.map((item) => [item.key, item]));

export function getPlatformPage(key: string | null | undefined): PlatformPageDefinition | undefined {
  return key ? pagesByKey.get(key as PlatformPageKey) : undefined;
}

export function isPlatformPageKey(value: string | null | undefined): value is PlatformPageKey {
  return Boolean(getPlatformPage(value));
}

export function findPlatformPageByPath(pathname: string): PlatformPageDefinition | undefined {
  const normalized = normalizePathname(pathname);
  return [...platformPages]
    .sort((first, second) => second.path.length - first.path.length)
    .find((pageDef) => normalized === pageDef.path || normalized.startsWith(`${pageDef.path}/`));
}

export function defaultPageAccessForRole(pageKey: PlatformPageKey, role: string): boolean {
  const pageDef = getPlatformPage(pageKey);
  if (!pageDef) return false;
  const normalizedRole = role.trim().toLowerCase();
  return pageDef.defaultRoles.includes(normalizedRole);
}

function page(
  key: PlatformPageKey,
  label: string,
  path: string,
  description: string,
  guestEligible: boolean,
  defaultGuestPublic: boolean,
  defaultRoles: string[]
): PlatformPageDefinition {
  return { key, label, path, description, guestEligible, defaultGuestPublic, defaultRoles };
}

function normalizePathname(pathname: string) {
  if (!pathname.startsWith("/")) return `/${pathname}`;
  return pathname === "/" ? "/dashboard" : pathname;
}
