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
  { href: "/files", label: "Files" },
  { href: "/budget", label: "Budget" },
  { href: "/settings", label: "Settings" }
];

const mobileLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/tasks", label: "Tasks" },
  { href: "/communications", label: "Communications" }
];

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
        {!isDashboard ? (
          <header className="topbar">
            <span className="topbar-wash" aria-hidden="true" />
            <div>
              <p className="eyebrow">MVP 1 / Stub Mode</p>
              <h1 className="title">{title}</h1>
            </div>
            <span className="pill stub">Stub Mode</span>
          </header>
        ) : null}

        {children}
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
