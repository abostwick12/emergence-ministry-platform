"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/components/role-context";
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
  const title = pageTitles[pathname] ?? "Dashboard";

  return (
    <div className="app-shell">
      <aside className="sidebar app-sidebar" aria-label="Primary navigation">
        <Link className="brand-link" href="/dashboard">
          <div className="brand-mark" aria-hidden="true">
            EM
          </div>
          <div>
            <strong>Emerge</strong>
            <div className="muted" style={{ color: "#cbd5e1" }}>
              Ministry Operations Hub
            </div>
          </div>
        </Link>

        <div className="visual-strip" aria-label="Ministry operations workspace visual">
          <span>Events, tasks, communication previews, budgets, and Stub Mode integrations in one workspace.</span>
        </div>

        <nav className="app-nav-list" aria-label="Desktop navigation">
          {primaryLinks.map((link) => (
            <Link className={pathname === link.href ? "app-nav-link active" : "app-nav-link"} href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="role-control">
          <p className="eyebrow" style={{ color: "#93c5fd" }}>
            Active MVP Roles
          </p>
          <div className="toolbar" role="group" aria-label="Switch active role">
            {(["admin", "leader"] as Role[]).map((role) => (
              <button
                className={activeRole === role ? "button primary" : "button"}
                key={role}
                type="button"
                onClick={() => setActiveRole(role)}
              >
                {roleLabels[role]}
              </button>
            ))}
          </div>
        </div>

        <div className="card future-role-card">
          <p className="eyebrow" style={{ color: "#93c5fd" }}>
            Future Roles
          </p>
          <p style={{ margin: 0, color: "#dbeafe" }}>Student and Parent roles are authorization placeholders only in MVP 1.</p>
        </div>

        <a className="button sidebar-logout" href="/api/auth/logout">
          Log out
        </a>
      </aside>

      <main className="main app-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">MVP 1 / Stub Mode</p>
            <h1 className="title">{title}</h1>
          </div>
          <span className="pill stub">Stub Mode</span>
        </header>

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
