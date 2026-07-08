"use client";

import { useState } from "react";
import { Briefcase, Inbox, KanbanSquare, Radio, type LucideIcon } from "lucide-react";

export type ActivityItem = {
  id: string;
  source: "task" | "job_application" | "capture";
  title: string;
  detail: string;
  timestamp: string;
};

const SOURCE_META: Record<ActivityItem["source"], { label: string; icon: LucideIcon; tint: string }> = {
  task: { label: "Task", icon: KanbanSquare, tint: "var(--cc-teal)" },
  job_application: { label: "Job Search", icon: Briefcase, tint: "var(--cc-brass)" },
  capture: { label: "Capture", icon: Inbox, tint: "var(--cc-navy)" }
};

const FILTERS: { label: string; source: ActivityItem["source"] | "all" }[] = [
  { label: "All", source: "all" },
  { label: "Tasks", source: "task" },
  { label: "Job Search", source: "job_application" },
  { label: "Captures", source: "capture" }
];

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function DashboardFeedRail({ items }: { items: ActivityItem[] }) {
  const [active, setActive] = useState<ActivityItem["source"] | "all">("all");

  const filtered = items.filter((item) => active === "all" || item.source === active);
  const today = filtered.filter((item) => isToday(item.timestamp));
  const earlier = filtered.filter((item) => !isToday(item.timestamp));

  return (
    <aside className="cc-feed-rail">
      <div className="cc-feed-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Radio size={13} color="var(--cc-brass)" />
            <h2 className="cc-eyebrow">Recent Activity</h2>
          </div>
        </div>
        <div className="cc-feed-chips">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              className={`cc-feed-chip${active === filter.source ? " cc-active" : ""}`}
              onClick={() => setActive(filter.source)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cc-feed-body">
        {today.length > 0 ? (
          <>
            <div className="cc-feed-group-label">
              <span className="cc-eyebrow" style={{ fontSize: 9 }}>
                Today
              </span>
              <span className="cc-rule" />
            </div>
            {today.map((item) => (
              <FeedRailItem item={item} key={item.id} />
            ))}
          </>
        ) : null}
        {earlier.length > 0 ? (
          <>
            <div className="cc-feed-group-label">
              <span className="cc-eyebrow" style={{ fontSize: 9 }}>
                Earlier
              </span>
              <span className="cc-rule" />
            </div>
            {earlier.map((item) => (
              <FeedRailItem item={item} key={item.id} />
            ))}
          </>
        ) : null}
        {filtered.length === 0 ? <p className="muted" style={{ textAlign: "center", padding: "32px 0", fontSize: 11 }}>Nothing here yet.</p> : null}
      </div>
    </aside>
  );
}

function FeedRailItem({ item }: { item: ActivityItem }) {
  const meta = SOURCE_META[item.source];
  const Icon = meta.icon;
  return (
    <article className="cc-feed-item">
      <div className="cc-feed-item-icon" style={{ backgroundColor: `color-mix(in oklab, ${meta.tint} 14%, transparent)` }}>
        <Icon size={10} color={meta.tint} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
        <p className="cc-mono-tab" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em", color: meta.tint }}>
          {meta.label}
        </p>
        <span className="cc-mono-tab" style={{ fontSize: 9, color: "oklch(0.22 0.045 258 / 0.35)" }}>
          {relativeTime(item.timestamp)}
        </span>
      </div>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--cc-navy)", lineHeight: 1.3, marginBottom: 2 }}>{item.title}</p>
      <p style={{ fontSize: 11, color: "oklch(0.22 0.045 258 / 0.55)", lineHeight: 1.35 }}>{item.detail}</p>
    </article>
  );
}
