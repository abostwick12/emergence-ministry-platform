"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  DollarSign,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Music,
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
import type { Role } from "@/lib/types";

const roleLabels: Record<Role, string> = {
  admin: "Admin",
  leader: "Leader",
  student: "Student",
  parent: "Parent"
};

const primaryLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/camp", label: "Camp" },
  { href: "/events", label: "Events" },
  { href: "/worship", label: "Worship" },
  { href: "/student", label: "Student Portal" },
  { href: "/tasks", label: "Tasks" },
  { href: "/communications", label: "Communications" },
  { href: "/people", label: "People" },
  { href: "/budget", label: "Budget" },
  { href: "/settings", label: "Settings" }
];

const leaderDiscipleshipLink = { href: "/discipleship", label: "Discipleship" };

const mobileLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/tasks", label: "Tasks" },
  { href: "/communications", label: "Communications" }
];

function mobileMoreLinksFor(links: { href: string; label: string }[]) {
  return links.filter((link) => !mobileLinks.some((mobileLink) => mobileLink.href === link.href));
}

function resolveDisplayName(user?: { name?: string; email?: string }): string {
  const name = user?.name?.trim();
  if (name) return name;
  const email = user?.email?.trim();
  if (email) return email.split("@")[0];
  return "Team Member";
}

function initialsForUser(displayName: string): string {
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const initials = parts.map((part) => part[0]).join("").slice(0, 2);
  return initials.toUpperCase();
}

const navIcons: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/camp": TentTree,
  "/events": CalendarDays,
  "/worship": Music,
  "/student": BookOpen,
  "/discipleship": BookOpen,
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
  "/camp": "Camp Command Center",
  "/events": "Events",
  "/worship": "Worship",
  "/student": "Student Portal",
  "/tasks": "Tasks",
  "/communications": "Communications",
  "/people": "People",
  "/files": "Files",
  "/budget": "Budget",
  "/settings": "Settings",
  "/discipleship": "Discipleship",
  "/command-center": "Command Center"
};

const pageSubtitles: Record<string, string> = {
  "/discipleship": "Move beyond attendance into formation - Scripture as a whole story, studied in community.",
  "/command-center": "Coordinate AI-supported ministry decisions with a clear audit trail."
};

function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getAppShellNavigation({
  campOnly,
  isStudentShell,
  showCommandCenter,
  showLeaderDiscipleship,
  showStudentPortal
}: {
  campOnly: boolean;
  isStudentShell: boolean;
  showCommandCenter: boolean;
  showLeaderDiscipleship: boolean;
  showStudentPortal: boolean;
}) {
  const studentAwareLinks = showStudentPortal ? primaryLinks : primaryLinks.filter((link) => link.href !== "/student");
  const discipleshipAwareLinks = showLeaderDiscipleship ? [...studentAwareLinks, leaderDiscipleshipLink] : studentAwareLinks;
  const allPrimaryLinks = showCommandCenter ? [...discipleshipAwareLinks, { href: "/command-center", label: "Command Center" }] : discipleshipAwareLinks;
  const studentPortalOnlyLinks = [{ href: "/student", label: "Student Portal" }];

  return {
    primaryLinks: isStudentShell ? studentPortalOnlyLinks : campOnly ? allPrimaryLinks.filter((link) => link.href === "/camp") : allPrimaryLinks,
    mobileLinks: isStudentShell ? studentPortalOnlyLinks : campOnly ? [{ href: "/camp", label: "Camp" }] : mobileLinks,
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
  user
}: {
  children: React.ReactNode;
  canManageEvents?: boolean;
  devAuth?: boolean;
  shellAccess?: AppShellAccessState;
  showCommandCenter?: boolean;
  showLeaderDiscipleship?: boolean;
  showStudentPortal?: boolean;
  sessionRole?: Role;
  user?: { name?: string; email?: string };
}) {
  const pathname = usePathname();
  const displayName = resolveDisplayName(user);
  const userInitials = initialsForUser(displayName);
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
    showStudentPortal
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
    ? `Welcome back, ${displayName.split(" ")[0]}! Here's what's going on across the ministry.`
    : pageSubtitles[pathname] ??
      (pathname.startsWith("/student")
        ? pageSubtitles["/student"]
        : pathname.startsWith("/discipleship")
          ? pageSubtitles["/discipleship"]
          : "");
  const isDashboard = pathname === "/dashboard";
  const isProductionLaunchPath = pathname.startsWith("/student") || pathname.startsWith("/discipleship");
  const shouldBlockEmergeChildren = !isCampRoute && !canUseEmergeShell;
  const shellAccessIssue = shellAccess.kind === "full" ? null : shellAccess;

  return (
    <div className={isCampRoute ? "app-shell app-shell-camp" : "app-shell"}>
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

                <button
                  className="button primary sidebar-add-event"
                  type="button"
                  aria-label="Add new event"
                  onClick={openCreate}
                >
                  + Add Event
                </button>
              </>
            ) : null}

            <div className="sidebar-profile">
              <span className="sidebar-avatar" aria-hidden="true">{userInitials}</span>
              <span className="sidebar-profile-text">
                <strong>{displayName}</strong>
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

      <main className={`main app-main app-main-shell${isCampRoute ? " app-main-shell-camp" : ""}`}>
        {!isCampRoute ? (
          <header className="app-header app-fixed-header">
            <div className="app-header-text">
              <h1 className={isDashboard ? "app-header-title" : "app-header-title app-header-title-compact"}>{title}</h1>
              {subtitle ? <p className="app-header-welcome">{subtitle}</p> : null}
            </div>

            <div className="app-header-right">
              <label className="app-search-pill" aria-label="Search coming soon">
                <Search className="app-search-icon" aria-hidden="true" />
                <input disabled placeholder="Search..." type="search" />
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
            <details className="mobile-more-menu">
              <summary className="mobile-nav-link">More</summary>
              <div className="mobile-more-panel" aria-label="More navigation">
                {canUseEmergeShell && canManageEvents ? (
                  <button
                    className="button primary mobile-add-event-btn"
                    type="button"
                    onClick={openCreate}
                  >
                    + Add Event
                  </button>
                ) : null}
                {visibleMobileMoreLinks.map((link) => (
                  <Link className="app-nav-link" href={link.href} key={link.href}>
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
