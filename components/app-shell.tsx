"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/components/role-context";
import { useEventCard } from "@/components/event-card-context";
import type { Role } from "@/lib/types";

const roleLabels: Record<Role, string> = {
  admin: "Admin",
  leader: "Leader",
  student: "Student",
  parent: "Parent"
};

const primaryLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
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

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/events": "Events",
  "/tasks": "Tasks",
  "/communications": "Communications",
  "/people": "People",
  "/files": "Files",
  "/budget": "Budget",
  "/settings": "Settings"
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeRole, setActiveRole } = useRole();
  const { openCreate } = useEventCard();
  const title = pageTitles[pathname] ?? "Dashboard";
  const isDashboard = pathname === "/dashboard";

  return (
    <div className="app-shell">
      <aside className="sidebar app-sidebar" aria-label="Primary navigation">
        <div className="sidebar-wash" aria-hidden="true">
          <svg className="sidebar-curve" viewBox="0 0 260 240" fill="none" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sidebarAqua" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
                <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#a5f3fc" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M-30,72 C50,122 150,22 300,92" stroke="url(#sidebarAqua)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M-30,98 C60,150 160,42 300,122" stroke="url(#sidebarAqua)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          </svg>
        </div>
        <Link className="brand-lead" href="/dashboard" aria-label="Lead Emergence Automated Platform">
          <span className="brand-lead-name">
            <span className="brand-lead-light">Lead</span> <span className="brand-lead-bold">Emergence</span>
          </span>
          <span className="brand-lead-sub">Automated Platform</span>
        </Link>

        <button
          className="button primary sidebar-add-event"
          type="button"
          aria-label="Add new event"
          onClick={openCreate}
        >
          + Add Event
        </button>

        <nav className="app-nav-list" aria-label="Desktop navigation">
          {primaryLinks.map((link) => (
            <Link className={pathname === link.href ? "app-nav-link active" : "app-nav-link"} href={link.href} key={link.href}>
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

      <main className="main app-main">
        <header className="app-header">
          <div className="app-header-decor" aria-hidden="true">
            <svg className="app-header-arch" viewBox="0 0 960 110" preserveAspectRatio="none" fill="none">
              <defs>
                <linearGradient id="appArch" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.62" />
                  <stop offset="18%" stopColor="#7dd3fc" stopOpacity="0.38" />
                  <stop offset="42%" stopColor="#bae6fd" stopOpacity="0.14" />
                  <stop offset="70%" stopColor="#e0f2fe" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#f0f9ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M-10,108 C55,22 200,10 420,28 C600,44 780,50 980,42" stroke="url(#appArch)" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M-10,116 C65,32 220,20 440,38 C625,54 805,60 980,52" stroke="url(#appArch)" strokeWidth="1.4" strokeLinecap="round" opacity="0.48" />
            </svg>
          </div>

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
            <span className="hub-bell" role="img" aria-label="2 notifications">
              <BellIcon />
              <span className="hub-bell-badge">2</span>
            </span>
          </div>
        </header>

        <div className="app-content">{children}</div>
      </main>

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
            {primaryLinks.slice(4).map((link) => (
              <Link className="app-nav-link" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </details>
      </nav>
    </div>
  );
}
