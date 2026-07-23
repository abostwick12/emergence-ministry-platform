"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BarChart3,
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
  Settings,
  TentTree,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRole } from "@/components/role-context";
import { useEventCard } from "@/components/event-card-context";
import { UnifiedDashboardBrandArt } from "@/components/unified-dashboard-brand-art";
import { MobileFieldControls } from "@/components/mobile-field-controls";
import type { AppShellAccessState } from "@/lib/camp/shell-access";
import { firstNameForPerson } from "@/lib/auth/display-name";
import type { Role } from "@/lib/types";
import type { PlatformPageKey } from "@/lib/platform/page-registry";
import { getAppShellNavigation } from "@/lib/app-shell-navigation";

const roleLabels: Record<Role, string> = {
  admin: "Admin",
  leader: "Leader",
  student: "Student",
  parent: "Parent"
};

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
  "/directors": "Leader Hub",
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
  "/directors": "Monitor formation, sermon preparation, resource development, and volunteer readiness in one leader view.",
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
    mobilePortalSections
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
              <p className="mobile-field-header-kicker">Lead Emergence</p>
              <h1 className={isDashboard ? "app-header-title" : "app-header-title app-header-title-compact"}>{title}</h1>
              {subtitle ? <p className="app-header-welcome">{subtitle}</p> : null}
              <p className="mobile-field-header-copy">{isDashboard ? `Welcome back, ${firstName}.` : "Ministry field app"}</p>
            </div>

            <div className="app-header-right">
              {process.env.NODE_ENV === "development" && !isProductionLaunchPath ? (
                <>
                  <span className="pill stub">Preview Mode</span>
                  {devAuth ? <span className="pill dev-auth">DEV AUTH</span> : null}
                </>
              ) : null}
            </div>
          </header>
        ) : null}

        <div className="app-content app-scroll-region">
          {shouldBlockEmergeChildren && shellAccessIssue ? <ShellAccessStatePanel shellAccess={shellAccessIssue} /> : children}
        </div>
      </main>

      {!isCampRoute ? (
        <MobileFieldControls
          canManageEvents={canUseEmergeShell && canManageEvents}
          isStudentShell={isStudentShell}
          mobileLinks={visibleMobileLinks}
          onCreateEvent={openCreate}
          pathname={pathname}
          portalSections={mobilePortalSections}
        />
      ) : null}
    </div>
  );
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
