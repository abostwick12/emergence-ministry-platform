"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import { CampDaySelector } from "@/components/camp/camp-day-selector";

export default function CampSchedulePage() {
  const { scheduleForSelectedDay, selectedDay, loading, overview } = useCamp();

  const items = useMemo(() => scheduleForSelectedDay, [scheduleForSelectedDay]);

  return (
    <div className="camp-cc-page">
      <Link href="/camp/more" className="camp-cc-back">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>More</span>
      </Link>
      <header className="camp-cc-page-head">
        <h1>Schedule</h1>
        <p className="camp-cc-muted">{selectedDay || "Select a day"}</p>
      </header>

      <CampDaySelector />

      {loading && !overview.schedule.length ? (
        <p className="camp-cc-muted">Loading schedule…</p>
      ) : items.length === 0 ? (
        <p className="camp-cc-muted">No events scheduled for this day.</p>
      ) : (
        <ol className="camp-schedule-list">
          {items.map((item) => (
            <li key={item.id} className="camp-schedule-item">
              <span className="camp-schedule-time">{item.time}</span>
              <div className="camp-schedule-body">
                <strong>{item.title}</strong>
                {item.location ? <span className="camp-cc-muted">{item.location}</span> : null}
                <span className="camp-cc-tag subtle">{item.audience}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
