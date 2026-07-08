"use client";

import { Bell } from "lucide-react";
import { CommandCenterClocks } from "@/components/command-center/command-center-clocks";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function CommandCenterHeader({
  fullName,
  devAuth,
  stubMode,
  notificationCount
}: {
  fullName: string;
  devAuth: boolean;
  stubMode: boolean;
  notificationCount: number;
}) {
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  return (
    <header className="cc-header">
      <div className="cc-header-greeting-row">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1 }}>
            Good {timeOfDayGreeting()}, <span className="cc-serif" style={{ fontStyle: "italic", fontWeight: 500 }}>{firstName(fullName)}</span>.
          </h1>
          <p style={{ marginTop: 8, fontSize: 11, color: "oklch(0.22 0.045 258 / 0.5)" }}>{dateStr}</p>
        </div>
        <div className="cc-divider-v" />
        <CommandCenterClocks />
        {stubMode || devAuth ? <div className="cc-divider-v" /> : null}
        {stubMode ? <span className="cc-pill">Stub Mode</span> : null}
        {devAuth ? <span className="cc-pill cc-configured">DEV AUTH</span> : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="cc-button" type="button" style={{ position: "relative" }} aria-label={`${notificationCount} notifications`}>
          <Bell size={15} />
          {notificationCount > 0 ? (
            <span
              className="cc-mono-tab"
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                fontSize: 9,
                fontWeight: 700,
                background: "var(--cc-brass)",
                color: "var(--cc-navy)",
                borderRadius: 999,
                minWidth: 15,
                height: 15,
                display: "grid",
                placeItems: "center",
                padding: "0 3px"
              }}
            >
              {notificationCount}
            </span>
          ) : null}
        </button>
        <div className="cc-avatar" aria-hidden="true">
          {initials(fullName)}
        </div>
      </div>
    </header>
  );
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
