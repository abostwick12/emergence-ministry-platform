"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  BookOpenText,
  Bot,
  CalendarDays,
  ClipboardPenLine,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  Library,
  ListChecks,
  MessageSquareText,
  Music,
  NotebookPen,
  PanelsTopLeft,
  Search,
  Settings,
  TentTree,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRole } from "@/components/role-context";
import { useEventCard } from "@/components/event-card-context";
import { UnifiedDashboardBrandArt } from "@/components/unified-dashboard-brand-art";
import type { AppShellAccessState } from "@/lib/camp/shell-access";
import { firstNameForPerson } from "@/lib/auth/display-name";
import type { Role } from "@/lib/types";
import type { PlatformPageKey } from "@/lib/platform/page-registry";

const roleLabels: Record<Role, string> = {
  admin: "Admin",
  leader: "Leader",
  student: "Student",
  parent: "Parent"
};

type AppNavLink = { href: string; label: string; pageKey?: PlatformPageKey };

const dashboardLinks: AppNavLink[] = [
  { href: "/dashboard", label: "Dashboard", pageKey: "dashboard" },
  { href: "/ministry", label: "Ministry Hub", pageKey: "ministry_hub" },
  { href: "/student", label: "Student Portal", pageKey: "student_portal" },
  { href: "/people", label: "Volunteer Hub", pageKey: "people" },
  { href: "/directors", label: "Directors Hub", pageKey: "directors_hub" },
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
  { href: "/people", label: "Volunteer Hub", pageKey: "people" }
];

const directorsHubLinks: AppNavLink[] = [
  { href: "/dashboard", label: "Dashboard", pageKey: "dashboard" },
  { href: "/directors", label: "Directors Hub", pageKey: "directors_hub" },
  { href: "/leader-prep", label: "Sermon Prep", pageKey: "leader_prep" },
  { href: "/directors/resources", label: "Resource Development", pageKey: "resource_development" },
  { href: "/discipleship", label: "Discipleship Dashboard", pageKey: "discipleship" },
  { href: "/directors/volunteers", label: "Volunteer Dashboard", pageKey: "volunteer_dashboard" }
];

const mobileLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ministry", label: "Ministry" },
  { href: "/student", label: "Student" },
  { href: "/people", label: "Volunteer" }
];

function mobileMoreLinksFor(links: { href: string; label: string }[]) {
  return links.filter((link) => !mobileLinks.some((mobileLink) => mobileLink.href === link.href));
}

function initialsForUser(displayName: string): string {
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const initials = parts.map((part) => part[0]).join("").slice(0, 2);
  return initials.toUpperCase();
}

const navIcons: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/ministry": PanelsTopLeft,
  "/directors": BarChart3,
  "/directors/resources": Library,
  "/directors/volunteers": Users,
  "/camp": TentTree,
  "/events": CalendarDays,
  "/leader-prep": ClipboardPenLine,
  "/worship": Music,
  "/student": GraduationCap,
  "/student/scripture/questions": NotebookPen,
  "/student/scripture/plans": CalendarDays,
  "/student/scripture/resources": BookOpen,
  "/student/scripture/how-to-read": Library,
  "/discipleship": BookOpenText,
  "/tasks": ListChecks,
  "/communications": MessageSquareText,
  "/people": Users,
  "/budget": DollarSign,
  "/settings": Settings,
  "/command-center": Bot
};

function NavIcon({ href }: { href: string }) {
  const Icon = navIcons[href];
  return Icon ? <Icon className="app-nav-icon" aria-hidden="true" /> : null;
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/ministry": "Ministry Hub",
  "/directors": "Directors Hub",
  "/directors/resources": "Resource Development",
  "/directors/volunteers": "Volunteer Dashboard",
  "/camp": "Camp Command Center",
  "/events": "Events",
  "/leader-prep": "Sermon Prep",
  "/worship": "Worship",
  "/student": "Student Portal",
  "/student/scripture/questions": "Journey Journal",
  "/student/scripture/resources": "Scripture",
  "/student/scripture/plans": "Reading Plans",
  "/student/scripture/how-to-read": "How to Read",
  "/tasks": "Tasks",
  "/communications": "Communications",
  "/people": "Volunteer Hub",
  "/files": "Files",
  "/budget": "Budget",
  "/settings": "Settings",
  "/discipleship": "Discipleship",
  "/command-center": "Command Center"
};

const pageSubtitles: Record<string, string> = {
  "/dashboard": "See what needs human attention, protect what can wait, and keep ministry moving with clarity.",
  "/ministry": "Plan events, worship, tasks, communication, and budget work from one ministry operations hub.",
  "/directors": "Monitor formation, sermon preparation, resource development, and volunteer readiness in one director view.",
  "/directors/resources": "Stage leader resources, training assets, and discipleship material before anything is published.",
  "/directors/volunteers": "Monitor volunteer coverage and resource readiness without bypassing human review.",
  "/events": "Plan every gathering around purpose, readiness, and the people it is meant to serve.",
  "/leader-prep": "Write the sermon. Then let EMMA equip your leaders with guides, questions, and slides.",
  "/worship": "Shape services where songs, people, rehearsal, and story move together with purpose.",
  "/tasks": "Turn ministry vision into visible next steps, clear ownership, and work that keeps moving.",
  "/communications": "Prepare thoughtful ministry communication with clear review boundaries before anything is sent.",
  "/people": "Know who is serving, where coverage is needed, and how each volunteer can take a meaningful next step.",
  "/budget": "Steward resources visibly so every dollar supports the ministry purpose it was given for.",
  "/settings": "Shape access, integrations, and safeguards so the platform serves people responsibly.",
  "/files": "Keep ministry resources connected to the work, people, and decisions they support.",

  "/student": "One step at a time. Ask honestly, read slowly, and keep walking the journey.",
  "/student/scripture/questions": "A quiet place to wrestle with questions, Scripture, practices, and the fruit forming over time.",
  "/student/scripture/resources": "Passages, story guides, and reading tools tied to where you are in the journey.",
  "/student/scripture/plans": "Guided reading paths with clear progress so students do not get lost in endless resources.",
  "/student/scripture/how-to-read": "Simple tools for reading Scripture carefully without rushing to an answer.",
  "/discipleship": "Move beyond attendance into formation - Scripture as a whole story, studied in community.",
  "/command-center": "Coordinate AI-supported ministry decisions with a clear audit trail."
};

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/student") return pathname === "/student";
  if (href === "/discipleship") return pathname === "/discipleship";
  if (href === "/people") return pathname === "/people";
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
  const allPrimaryLinks = showCommandCenter && !isStudentShell
    ? filterByPageAccess([...contextualLinks, { href: "/command-center", label: "Command Center", pageKey: "command_center" }])
    : contextualLinks;

  return {
    primaryLinks: isStudentShell ? studentSessionLinks : campOnly ? allPrimaryLinks.filter((link) => link.href === "/camp") : allPrimaryLinks,
    mobileLinks: isStudentShell ? studentSessionLinks.slice(0, 4) : campOnly ? [{ href: "/camp", label: "Camp" }] : filterByPageAccess(withFeatureVisibility(mobileLinks)),
    mobileMoreLinks: isStudentShell || campOnly ? [] : mobileMoreLinksFor(allPrimaryLinks)
  };
}

export function AppShell({
  children,
  canManageEvents = true,
  devAuth = false,
  shellAccess = { kind: "full" },
  sessionRole,
  showCommandCenter = false,
  showLeaderDiscipleship = false,
  showStudentPortal = false,
  visiblePageKeys,
  user
}: {
  children: React.ReactNode;
  canManageEvents?: boolean;
  devAuth?: boolean;
  shellAccess?: AppShellAccessState;
  showCommandCenter?: boolean;
  showLeaderDiscipleship?: boolean;
  showStudentPortal?: boolean;
  visiblePageKeys?: PlatformPageKey[];
  sessionRole?: Role;
  user?: { name?: string; email?: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const mobileMoreRef = useRef<HTMLDetailsElement>(null);
  const firstName = firstNameForPerson(user?.name, user?.email);
  const userInitials = initialsForUser(firstName);
  const { activeRole, setActiveRole } = useRole();
  const { openCreate } = useEventCard();
  const isCampRoute = pathname.startsWith("/camp");
  const isStudentShell = sessionRole === "student";
  const canUseEmergeShell = shellAccess.kind === "full";
  const campOnly = !canUseEmergeShell;
  const {
    primaryLinks: visiblePrimaryLinks,
    mobileLinks: visibleMobileLinks,
    mobileMoreLinks: visibleMobileMoreLinks
  } = getAppShellNavigation({
    campOnly,
    isStudentShell,
    showCommandCenter,
    showLeaderDiscipleship,
    showStudentPortal,
    visiblePageKeys,
    pathname
  });
  const title = isCampRoute
    ? "Camp Command Center"
    : pageTitles[pathname] ??
      (pathname.startsWith("/student")
        ? "Student Portal"
        : pathname.startsWith("/command-center")
          ? "Command Center"
          : "Dashboard");
  const subtitle = pathname === "/dashboard"
    ? `Welcome back, ${firstName}. ${pageSubtitles["/dashboard"]}`
    : pageSubtitles[pathname] ??
      (pathname.startsWith("/student")
        ? pageSubtitles["/student"]
        : pathname.startsWith("/discipleship")
          ? pageSubtitles["/discipleship"]
          : "");
  const isDashboard = pathname === "/dashboard";
  const isProductionLaunchPath = pathname.startsWith("/student") || pathname.startsWith("/discipleship");
  const pageShellClass = pathname === "/leader-prep" ? " app-main-shell-leader-prep" : "";
  const shouldBlockEmergeChildren = !isCampRoute && !canUseEmergeShell;
  const shellAccessIssue = shellAccess.kind === "full" ? null : shellAccess;

  useEffect(() => {
    if (shellAccess.kind === "camp_only" && !isCampRoute) router.replace("/camp");
  }, [isCampRoute, router, shellAccess.kind]);

  return (
    <div className={isCampRoute ? "app-shell app-shell-camp" : "app-shell app-shell-platform"}>
      {!isCampRoute ? (
        <>
          <div className="app-shell-parchment" aria-hidden="true" />
          <div className="app-shell-night-sky" aria-hidden="true" />
          <div className="app-top-art-clip" aria-hidden="true">
            <UnifiedDashboardBrandArt />
          </div>

          <aside className="sidebar app-sidebar" aria-label="Primary navigation">
            <Link className="brand-lead" href={isStudentShell ? "/student" : "/dashboard"} aria-label="Lead Emergence Automated Platform">
              <span className="brand-lead-name">
                <span className="brand-lead-light">Lead</span> <span className="brand-lead-bold">Emergence</span>
              </span>
              <span className="brand-lead-sub">Automated Platform</span>
            </Link>

            <nav className="app-nav-list" aria-label="Desktop navigation">
              {visiblePrimaryLinks.map((link) => (
                <Link className={isLinkActive(pathname, link.href) ? "app-nav-link active" : "app-nav-link"} href={link.href} key={link.href}>
                  <NavIcon href={link.href} />
                  {link.label}
                </Link>
              ))}
            </nav>

            {canUseEmergeShell && canManageEvents && !isStudentShell ? (
              <>
                <div className="role-control" role="group" aria-label="Switch active role">
                  {(["admin", "leader"] as Role[]).map((role) => (
                    <button
                      className={activeRole === role ? "role-pill active" : "role-pill"}
                      key={role}
                      type="button"
                      onClick={() => setActiveRole(role)}
                    >
                      {roleLabels[role]}
                    </button>
                  ))}
                </div>

                <div className="sidebar-context-divider" aria-hidden="true" />

                <button
                  className="button primary sidebar-add-event"
                  type="button"
                  aria-label="Add new event"
                  onClick={openCreate}
                >
                  + Add Event
                </button>
                <div className="sidebar-context-divider" aria-hidden="true" />
              </>
            ) : null}

            <div className="sidebar-profile">
              <span className="sidebar-avatar" aria-hidden="true">{userInitials}</span>
              <span className="sidebar-profile-text">
                <strong>{firstName}</strong>
                <span className="muted">{roleLabels[sessionRole ?? activeRole]}</span>
              </span>
              <a className="sidebar-profile-logout" href="/api/auth/logout">
                Log out
              </a>
            </div>

            <div className="sidebar-wash-bottom" aria-hidden="true" />
          </aside>
        </>
      ) : null}

      <main className={`main app-main app-main-shell${pageShellClass}${isCampRoute ? " app-main-shell-camp" : ""}`}>
        {!isCampRoute ? (
          <header className="app-header app-fixed-header">
            <div className="app-header-text">
              <h1 className={isDashboard ? "app-header-title" : "app-header-title app-header-title-compact"}>{title}</h1>
              {subtitle ? <p className="app-header-welcome">{subtitle}</p> : null}
            </div>

            <div className="app-header-right">
              <label className="app-search-pill" aria-label="Search coming soon">
                <Search className="app-search-icon" aria-hidden="true" />
                <input disabled placeholder="Search..." suppressHydrationWarning type="search" />
              </label>
              {process.env.NODE_ENV === "development" && !isProductionLaunchPath ? (
                <>
                  <span className="pill stub">Preview Mode</span>
                  {devAuth ? <span className="pill dev-auth">DEV AUTH</span> : null}
                </>
              ) : null}
              <span className="hub-bell" role="img" aria-label="2 notifications">
                <Bell className="hub-bell-icon" aria-hidden="true" />
                <span className="hub-bell-badge">2</span>
              </span>
            </div>
          </header>
        ) : null}

        <div className="app-content app-scroll-region">
          {shouldBlockEmergeChildren && shellAccessIssue ? <ShellAccessStatePanel shellAccess={shellAccessIssue} /> : children}
        </div>
      </main>

      {!isCampRoute ? (
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {visibleMobileLinks.map((link) => (
            <Link className={isLinkActive(pathname, link.href) ? "mobile-nav-link active" : "mobile-nav-link"} href={link.href} key={link.href}>
              <NavIcon href={link.href} />
              {link.label}
            </Link>
          ))}
          {!isStudentShell ? (
            <details className="mobile-more-menu" ref={mobileMoreRef}>
              <summary className="mobile-nav-link">More</summary>
              <div className="mobile-more-panel" aria-label="More navigation">
                {canUseEmergeShell && canManageEvents ? (
                  <button
                    className="button primary mobile-add-event-btn"
                    type="button"
                    onClick={() => {
                      mobileMoreRef.current?.removeAttribute("open");
                      openCreate();
                    }}
                  >
                    + Add Event
                  </button>
                ) : null}
                {visibleMobileMoreLinks.map((link) => (
                  <Link className="app-nav-link" href={link.href} key={link.href} onClick={() => mobileMoreRef.current?.removeAttribute("open")}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
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

function ShellAccessStatePanel({ shellAccess }: { shellAccess: Exclude<AppShellAccessState, { kind: "full" }> }) {
  const isUnresolved = shellAccess.kind === "unresolved";
  return (
    <div className="grid workspace-page">
      <section className="panel">
        <p className="eyebrow">{isUnresolved ? "Camp Readiness" : "Camp Access"}</p>
        <h2 className="section-title flush">
          {isUnresolved ? "Camp access needs attention" : "Camp-only access"}
        </h2>
        <p className="muted">
          {isUnresolved
            ? shellAccess.message
            : "This account is limited to Camp. General ministry management tools are not available for this session."}
        </p>
        <div className="toolbar">
          <Link className="button primary" href="/camp">
            Open Camp
          </Link>
          <a className="button" href="/api/auth/logout">
            Log out
          </a>
        </div>
      </section>
    </div>
  );
}
