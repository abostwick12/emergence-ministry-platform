"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type CampNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const ICONS = {
  home: (
    <path d="M3 10.5 12 3l9 7.5M5 9.5V20h5v-5h4v5h5V9.5" />
  ),
  teams: (
    <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9 0a3 3 0 1 0 0-6M3 20v-1a5 5 0 0 1 5-5h0a5 5 0 0 1 5 5v1m3-6a5 5 0 0 1 5 5v1" />
  ),
  roster: (
    <path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h4" />
  ),
  schedule: (
    <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />
  ),
  more: (
    <path d="M5 7h14M5 12h14M5 17h14" />
  )
} as const;

const NAV_ITEMS: CampNavItem[] = [
  { href: "/camp", label: "Home", icon: ICONS.home },
  { href: "/camp/teams", label: "Teams", icon: ICONS.teams },
  { href: "/camp/roster", label: "Roster", icon: ICONS.roster },
  { href: "/camp/schedule", label: "Schedule", icon: ICONS.schedule },
  { href: "/camp/more", label: "More", icon: ICONS.more }
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/camp") return pathname === "/camp";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CampNav() {
  const pathname = usePathname() ?? "/camp";

  return (
    <nav className="camp-nav" aria-label="Camp sections">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "camp-nav-link active" : "camp-nav-link"}
            aria-current={active ? "page" : undefined}
          >
            <svg className="camp-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {item.icon}
            </svg>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
