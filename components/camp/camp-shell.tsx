"use client";

import Link from "next/link";
import { CampProvider, useCamp } from "@/components/camp/camp-provider";
import { CampNav } from "@/components/camp/camp-nav";
import { CampBottomSafeArea } from "@/components/camp/camp-ui";

function formatRange(startsOn: string, lastDayLabel: string): string {
  if (!startsOn) return "";
  const start = new Date(`${startsOn}T00:00:00`);
  const startLabel = Number.isNaN(start.getTime())
    ? startsOn
    : start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  // lastDayLabel is the final schedule day, e.g. "Fri, Jul 3" -> use its date part.
  const end = lastDayLabel.includes(", ") ? lastDayLabel.split(", ").slice(1).join(", ") : lastDayLabel;
  if (!end || end === startLabel) return startLabel;
  return `${startLabel} – ${end}`;
}

function CampShellChrome({ children, campOnly = false }: { children: React.ReactNode; campOnly?: boolean }) {
  const { overview, days } = useCamp();
  const range = formatRange(overview.campStartsOn, days[days.length - 1]?.key ?? "");

  return (
    <div className="camp-cc">
      <header className="camp-cc-header">
        {campOnly ? null : (
          <Link href="/dashboard" className="camp-cc-back" aria-label="Back to EMERGE">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>EMERGE</span>
          </Link>
        )}
        <div className="camp-cc-header-titles">
          <span className="camp-cc-name">{overview.campName || "Camp"}</span>
          {range ? <span className="camp-cc-dates">{range}</span> : null}
        </div>
        <CampNav />
      </header>
      <main className="camp-cc-main">
        {children}
        <CampBottomSafeArea />
      </main>
    </div>
  );
}

export function CampShell({ children, campOnly = false }: { children: React.ReactNode; campOnly?: boolean }) {
  return (
    <CampProvider>
      <CampShellChrome campOnly={campOnly}>{children}</CampShellChrome>
    </CampProvider>
  );
}
