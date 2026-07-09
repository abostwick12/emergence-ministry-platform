"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  Compass,
  MessageSquareText,
  KanbanSquare,
  Briefcase,
  Plug,
  Rss,
  ArrowLeft,
  type LucideIcon
} from "lucide-react";
import { useCommandCenterSidebarOpen } from "@/components/command-center/command-center-mobile-nav";

type NavItem = { label: string; href: string; icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/command-center", icon: Compass },
  { label: "Ask SAGE", href: "/command-center/chat", icon: MessageSquareText },
  { label: "Tasks", href: "/command-center/tasks", icon: KanbanSquare },
  { label: "Job Search", href: "/command-center/job-search", icon: Briefcase },
  { label: "Integrations", href: "/command-center/integrations", icon: Plug },
  { label: "Feed", href: "/command-center/feed", icon: Rss }
];

export function CommandCenterSidebar({ connectedCount, totalCount }: { connectedCount: number; totalCount: number }) {
  const pathname = usePathname();
  const { open, close } = useCommandCenterSidebarOpen();

  useEffect(() => {
    close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <aside className={`cc-sidebar${open ? " cc-sidebar-open" : ""}`}>
      <div className="cc-sidebar-brand">
        <div className="cc-sidebar-mark" />
        <div>
          <p className="cc-serif" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1 }}>
            SAGE
          </p>
          <p className="cc-eyebrow" style={{ marginTop: 4, letterSpacing: "0.22em" }}>
            Command Center
          </p>
        </div>
      </div>

      <nav className="cc-sidebar-nav">
        <div>
          <h3 className="cc-eyebrow cc-nav-section-title">Workspace</h3>
          <ul className="cc-nav-list">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/command-center" ? pathname === item.href : pathname?.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} className={`cc-nav-item${active ? " cc-active" : ""}`}>
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="cc-sidebar-footer">
        <div className="cc-sidebar-status">
          <p className="cc-eyebrow" style={{ color: "oklch(0.985 0.006 85 / 0.5)", marginBottom: 8 }}>
            Integration Status
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="cc-dot" style={{ boxShadow: "0 0 8px var(--cc-brass)" }} />
            <p style={{ fontSize: 12, fontWeight: 500 }}>
              {connectedCount} of {totalCount} integrations connected
            </p>
          </div>
        </div>
        <Link href="/dashboard" className="cc-exit-link">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <ArrowLeft size={11} /> Back to main app
          </span>
        </Link>
      </div>
    </aside>
  );
}
