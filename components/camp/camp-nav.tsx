"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CampEmmaSheet } from "@/components/camp/camp-emma-sheet";
import { EmmaWaveOrb } from "@/components/camp/emma-wave-orb";

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
  emma: (
    <path d="M12 4c3.4 0 6 2.5 6 5.7 0 2.2-1.1 4.1-3 5.1V19l-3-1.7L9 19v-4.2c-1.9-1-3-2.9-3-5.1C6 6.5 8.6 4 12 4Z" />
  ),
  more: (
    <path d="M5 7h14M5 12h14M5 17h14" />
  )
} as const;

const NAV_ITEMS: CampNavItem[] = [
  { href: "/camp", label: "Home", icon: ICONS.home },
  { href: "/camp/teams", label: "Teams", icon: ICONS.teams },
  { href: "#emma", label: "EMMA", icon: ICONS.emma },
  { href: "/camp/roster", label: "Roster", icon: ICONS.roster },
  { href: "/camp/more", label: "More", icon: ICONS.more }
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/camp") return pathname === "/camp";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CampNav() {
  const pathname = usePathname() ?? "/camp";
  const [emmaOpen, setEmmaOpen] = useState(false);

  useEffect(() => {
    setEmmaOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="camp-nav" aria-label="Camp sections">
        {NAV_ITEMS.map((item) => {
          if (item.label === "EMMA") {
            return (
              <button
                key={item.href}
                type="button"
                className={emmaOpen ? "camp-nav-link camp-nav-emma active" : "camp-nav-link camp-nav-emma"}
                aria-label="Open EMMA Camp Finder"
                aria-expanded={emmaOpen}
                onClick={() => setEmmaOpen(true)}
              >
                <EmmaWaveOrb active={emmaOpen} />
                <span>{item.label}</span>
              </button>
            );
          }

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
      <CampEmmaSheet open={emmaOpen} onClose={() => setEmmaOpen(false)} />
    </>
  );
}
