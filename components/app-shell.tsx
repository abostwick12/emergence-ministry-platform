"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/components/role-context";
import { useEventCard } from "@/components/event-card-context";
import { UnifiedDashboardBrandArt } from "@/components/unified-dashboard-brand-art";
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
  { href: "/tasks", label: "Tasks" },
  { href: "/communications", label: "Communications" },
  { href: "/people", label: "People" },
  { href: "/budget", label: "Budget" },
  { href: "/settings", label: "Settings" }
];

const mobileLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/tasks", label: "Tasks" },
  { href: "/communications", label: "Communications" }
];

const mobileMoreLinks = primaryLinks.filter((link) => !mobileLinks.some((mobileLink) => mobileLink.href === link.href));

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M6 9a6 6 0 0112 0c0 5 1.5 6.5 2 7H4c.5-.5 2-2 2-7z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 20a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const navIconPaths: Record<string, React.ReactNode> = {
  "/dashboard": (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.4" />
      <rect x="14" y="3" width="7" height="5" rx="1.4" />
      <rect x="14" y="12" width="7" height="9" rx="1.4" />
      <rect x="3" y="16" width="7" height="5" rx="1.4" />
    </>
  ),
  "/camp": (
    <>
      <path d="M4 19V8.5l8-4 8 4V19" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 19v-5h8v5M8.5 9.5h7M10 12h4" strokeLinecap="round" />
    </>
  ),
  "/events": (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2.2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
    </>
  ),
  "/worship": (
    <>
      <path d="M9 18V5.5l9-1.8v12.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.8" cy="18" r="2.8" />
      <circle cx="15.8" cy="16.2" r="2.8" />
      <path d="M9 8.5l9-1.8" strokeLinecap="round" />
    </>
  ),
  "/tasks": (
    <>
      <path d="M4 6.5h12M4 12h12M4 17.5h8" strokeLinecap="round" />
      <path d="M19 5.5l1.4 1.4L23 4.3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "/communications": (
    <path d="M4 5.5h16a1 1 0 011 1v9a1 1 0 01-1 1H9l-4 3.2V16.5H4a1 1 0 01-1-1v-9a1 1 0 011-1z" strokeLinejoin="round" />
  ),
  "/people": (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3.2 3-5 5.5-5s4.9 1.8 5.5 5" strokeLinecap="round" />
      <path d="M16 5.4a3 3 0 010 5.4M17.5 19c-.3-2-1.1-3.6-2.3-4.6" strokeLinecap="round" />
    </>
  ),
  "/budget": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v10M9.5 9.2c0-1.1 1.1-1.8 2.5-1.8s2.5.7 2.5 1.8-1 1.6-2.5 1.9-2.5.8-2.5 1.9 1.1 1.8 2.5 1.8 2.5-.7 2.5-1.8" strokeLinecap="round" />
    </>
  ),
  "/settings": (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5l1.4 2.3 2.7-.5.6 2.7 2.5 1.1-1 2.6 1 2.6-2.5 1.1-.6 2.7-2.7-.5L12 21.5l-1.4-2.3-2.7.5-.6-2.7L4.8 16l1-2.6-1-2.6 2.5-1.1.6-2.7 2.7.5z" strokeLinejoin="round" />
    </>
  )
};

function NavIcon({ href }: { href: string }) {
  const paths = navIconPaths[href];
  if (!paths) return null;
  return (
    <svg className="app-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {paths}
    </svg>
  );
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/camp": "Camp Command Center",
  "/events": "Events",
  "/worship": "Worship",
  "/tasks": "Tasks",
  "/communications": "Communications",
  "/people": "People",
  "/files": "Files",
  "/budget": "Budget",
  "/settings": "Settings"
};

export function AppShell({ children, devAuth = false }: { children: React.ReactNode; devAuth?: boolean }) {
  const pathname = usePathname();
  const { activeRole, setActiveRole } = useRole();
  const { openCreate } = useEventCard();
  const isCampRoute = pathname.startsWith("/camp");
  const title = isCampRoute ? "Camp Command Center" : pageTitles[pathname] ?? "Dashboard";
  const isDashboard = pathname === "/dashboard";

  return (
    <div className="app-shell">
      <div className="app-shell-parchment" aria-hidden="true" />
      <div className="app-shell-night-sky" aria-hidden="true" />
      <div className="app-top-art-clip" aria-hidden="true">
        <UnifiedDashboardBrandArt />
      </div>

      <aside className="sidebar app-sidebar" aria-label="Primary navigation">
        <Link className="brand-lead" href="/dashboard" aria-label="Lead Emergence Automated Platform">
          <span className="brand-lead-name">
            <span className="brand-lead-light">Lead</span> <span className="brand-lead-bold">Emergence</span>
          </span>
          <span className="brand-lead-sub">Automated Platform</span>
        </Link>

        <nav className="app-nav-list" aria-label="Desktop navigation">
          {primaryLinks.map((link) => (
            <Link className={pathname === link.href ? "app-nav-link active" : "app-nav-link"} href={link.href} key={link.href}>
              <NavIcon href={link.href} />
              {link.label}
            </Link>
          ))}
        </nav>

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

        <div className="sidebar-profile">
          <span className="sidebar-avatar" aria-hidden="true">AW</span>
          <span className="sidebar-profile-text">
            <strong>Alex Walker</strong>
            <span className="muted">{roleLabels[activeRole]}</span>
          </span>
          <a className="sidebar-profile-logout" href="/api/auth/logout">
            Log out
          </a>
        </div>

        <div className="sidebar-wash-bottom" aria-hidden="true" />
      </aside>

      <main className={`main app-main app-main-shell${isCampRoute ? " app-main-shell-camp" : ""}`}>
        {!isCampRoute ? (
          <header className="app-header app-fixed-header">
            <div className="app-header-text">
              {isDashboard ? (
                <>
                  <h1 className="app-header-title">Dashboard</h1>
                  <p className="app-header-welcome">Welcome back, Alex! Here&apos;s what&apos;s going on across the ministry.</p>
                </>
              ) : (
                <h1 className="app-header-title app-header-title-compact">{title}</h1>
              )}
            </div>

            <div className="app-header-right">
              <span className="pill stub">Stub Mode</span>
              {devAuth ? <span className="pill dev-auth">DEV AUTH</span> : null}
              <span className="hub-bell" role="img" aria-label="2 notifications">
                <BellIcon />
                <span className="hub-bell-badge">2</span>
              </span>
            </div>
          </header>
        ) : null}

        <div className="app-content app-scroll-region">{children}</div>
      </main>

      {!isCampRoute ? (
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {mobileLinks.map((link) => (
            <Link className={pathname === link.href ? "mobile-nav-link active" : "mobile-nav-link"} href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
          <details className="mobile-more-menu">
            <summary className="mobile-nav-link">More</summary>
            <div className="mobile-more-panel" aria-label="More navigation">
              <button
                className="button primary mobile-add-event-btn"
                type="button"
                onClick={openCreate}
              >
                + Add Event
              </button>
              {mobileMoreLinks.map((link) => (
                <Link className="app-nav-link" href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </details>
        </nav>
      ) : null}
    </div>
  );
}
