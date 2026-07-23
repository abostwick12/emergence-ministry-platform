import type { PlatformPageKey } from "@/lib/platform/page-registry";

export type AppNavLink = { href: string; label: string; pageKey?: PlatformPageKey };
export type MobilePortalSection = {
  id: "ministry" | "volunteer" | "student" | "director" | "platform";
  label: string;
  href?: string;
  links: AppNavLink[];
};

const dashboardLinks: AppNavLink[] = [
  { href: "/dashboard", label: "Dashboard", pageKey: "dashboard" },
  { href: "/ministry", label: "Ministry Hub", pageKey: "ministry_hub" },
  { href: "/student", label: "Student Portal", pageKey: "student_portal" },
  { href: "/people", label: "Volunteer Hub", pageKey: "people" },
  { href: "/directors", label: "Leader Hub", pageKey: "directors_hub" },
  { href: "/camp", label: "Camp", pageKey: "camp" },
  { href: "/settings", label: "Settings", pageKey: "settings" }
];

const ministryHubLinks: AppNavLink[] = [
  { href: "/dashboard", label: "Dashboard", pageKey: "dashboard" },
  { href: "/ministry", label: "Ministry Hub", pageKey: "ministry_hub" },
  { href: "/events", label: "Events", pageKey: "events" },
  { href: "/worship", label: "Worship", pageKey: "worship" },
  { href: "/tasks", label: "Tasks", pageKey: "tasks" },
  { href: "/communications", label: "Communications", pageKey: "communications" },
  { href: "/budget", label: "Budget", pageKey: "budget" }
];

const studentPortalLinks: AppNavLink[] = [
  { href: "/dashboard", label: "Dashboard", pageKey: "dashboard" },
  { href: "/student", label: "Student Portal", pageKey: "student_portal" },
  { href: "/student/scripture/questions", label: "Journey Journal", pageKey: "journey_journal" },
  { href: "/student/scripture/resources", label: "Scripture", pageKey: "scripture_resources" },
  { href: "/student/scripture/plans", label: "Plans", pageKey: "reading_plans" },
  { href: "/student/scripture/how-to-read", label: "How to Read", pageKey: "how_to_read" }
];

const studentSessionLinks: AppNavLink[] = studentPortalLinks.filter((link) => link.href !== "/dashboard");

const volunteerHubLinks: AppNavLink[] = [
  { href: "/dashboard", label: "Dashboard", pageKey: "dashboard" },
  { href: "/people", label: "Volunteer Hub", pageKey: "people" },
  { href: "/directors/volunteers", label: "Volunteer Dashboard", pageKey: "volunteer_dashboard" }
];

const directorsHubLinks: AppNavLink[] = [
  { href: "/dashboard", label: "Dashboard", pageKey: "dashboard" },
  { href: "/directors", label: "Leader Hub", pageKey: "directors_hub" },
  { href: "/leader-prep", label: "Sermon Prep", pageKey: "leader_prep" },
  { href: "/directors/resources", label: "Resource Development", pageKey: "resource_development" },
  { href: "/discipleship", label: "Discipleship Dashboard", pageKey: "discipleship" },
  { href: "/directors/volunteers", label: "Volunteer Dashboard", pageKey: "volunteer_dashboard" }
];

const staffMobileLinks = [
  { href: "/dashboard", label: "Home" },
  { href: "/ministry", label: "Ministry" },
  { href: "/people", label: "People" }
];

const studentMobileLinks = [
  { href: "/student", label: "Home" },
  { href: "/student/scripture/questions", label: "Journey" },
  { href: "/student/scripture/resources", label: "Bible" }
];

function portalLinksForPathname(pathname: string): AppNavLink[] {
  if (pathname.startsWith("/student")) return studentPortalLinks;
  if (
    pathname.startsWith("/directors") ||
    pathname.startsWith("/leader-prep") ||
    pathname.startsWith("/discipleship")
  ) return directorsHubLinks;
  if (pathname.startsWith("/people")) return volunteerHubLinks;
  if (
    pathname.startsWith("/ministry") ||
    pathname.startsWith("/events") ||
    pathname.startsWith("/worship") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/communications") ||
    pathname.startsWith("/budget")
  ) return ministryHubLinks;
  return dashboardLinks;
}

function pageKeyForHref(href: string): PlatformPageKey | undefined {
  switch (href) {
    case "/dashboard": return "dashboard";
    case "/ministry": return "ministry_hub";
    case "/directors": return "directors_hub";
    case "/directors/resources": return "resource_development";
    case "/directors/volunteers": return "volunteer_dashboard";
    case "/events": return "events";
    case "/leader-prep": return "leader_prep";
    case "/worship": return "worship";
    case "/student": return "student_portal";
    case "/student/scripture/questions": return "journey_journal";
    case "/student/scripture/resources": return "scripture_resources";
    case "/student/scripture/plans": return "reading_plans";
    case "/student/scripture/how-to-read": return "how_to_read";
    case "/discipleship": return "discipleship";
    case "/camp": return "camp";
    case "/tasks": return "tasks";
    case "/communications": return "communications";
    case "/people": return "people";
    case "/budget": return "budget";
    case "/settings": return "settings";
    case "/command-center": return "command_center";
    default: return undefined;
  }
}

export function getAppShellNavigation({
  campOnly,
  isStudentShell,
  showCommandCenter,
  showLeaderDiscipleship,
  showStudentPortal,
  visiblePageKeys,
  pathname
}: {
  campOnly: boolean;
  isStudentShell: boolean;
  showCommandCenter: boolean;
  showLeaderDiscipleship: boolean;
  showStudentPortal: boolean;
  visiblePageKeys?: PlatformPageKey[];
  pathname?: string;
}) {
  const visibleKeySet = visiblePageKeys ? new Set<PlatformPageKey>(visiblePageKeys) : null;
  const filterByPageAccess = (links: AppNavLink[]) =>
    visibleKeySet ? links.filter((link) => {
      const pageKey = link.pageKey ?? pageKeyForHref(link.href);
      return !pageKey || visibleKeySet.has(pageKey);
    }) : links;
  const withFeatureVisibility = (links: AppNavLink[]) => links.filter((link) => {
    if (link.href.startsWith("/student")) return showStudentPortal;
    if (link.href === "/discipleship") return showLeaderDiscipleship;
    return true;
  });
  const contextualLinks = filterByPageAccess(withFeatureVisibility(portalLinksForPathname(pathname ?? "/dashboard")));
  const isVolunteerHubContext = pathname === "/people" || pathname?.startsWith("/people/") || pathname === "/directors/volunteers" || pathname?.startsWith("/directors/volunteers/");
  const allPrimaryLinks = showCommandCenter && !isStudentShell && !isVolunteerHubContext
    ? filterByPageAccess([...contextualLinks, { href: "/command-center", label: "Command Center", pageKey: "command_center" }])
    : contextualLinks;
  const staffMobilePortalSections: MobilePortalSection[] = [
    {
      id: "ministry",
      label: "Ministry",
      href: "/ministry",
      links: filterByPageAccess(withFeatureVisibility(ministryHubLinks.filter((link) => link.href !== "/dashboard")))
    },
    {
      id: "volunteer",
      label: "Volunteer",
      href: "/people",
      links: filterByPageAccess(withFeatureVisibility(volunteerHubLinks.filter((link) => link.href !== "/dashboard")))
    },
    {
      id: "student",
      label: "Student",
      href: "/student",
      links: filterByPageAccess(withFeatureVisibility(studentPortalLinks.filter((link) => link.href !== "/dashboard")))
    },
    {
      id: "director",
      label: "Leader",
      href: "/directors",
      links: filterByPageAccess(withFeatureVisibility(directorsHubLinks.filter((link) => link.href !== "/dashboard")))
    },
    {
      id: "platform",
      label: "More",
      links: filterByPageAccess(withFeatureVisibility([
        { href: "/camp", label: "Camp", pageKey: "camp" },
        { href: "/settings", label: "Settings", pageKey: "settings" },
        ...(showCommandCenter ? [{ href: "/command-center", label: "Command Center", pageKey: "command_center" as const }] : [])
      ]))
    }
  ];
  const mobilePortalSections: MobilePortalSection[] = isStudentShell
    ? [{
        id: "student",
        label: "Student",
        href: "/student",
        links: filterByPageAccess(withFeatureVisibility(studentSessionLinks))
      }]
    : staffMobilePortalSections.filter((section) => section.links.length > 0);

  return {
    primaryLinks: isStudentShell ? studentSessionLinks : campOnly ? allPrimaryLinks.filter((link) => link.href === "/camp") : allPrimaryLinks,
    mobileLinks: isStudentShell
      ? filterByPageAccess(withFeatureVisibility(studentMobileLinks))
      : campOnly
        ? [{ href: "/camp", label: "Camp" }]
        : filterByPageAccess(withFeatureVisibility(staffMobileLinks)),
    mobileMoreLinks: isStudentShell || campOnly
      ? []
      : allPrimaryLinks.filter((link) => !staffMobileLinks.some((mobileLink) => mobileLink.href === link.href)),
    mobilePortalSections: campOnly
      ? []
      : mobilePortalSections
  };
}
