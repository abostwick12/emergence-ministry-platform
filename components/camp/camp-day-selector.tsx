"use client";

import { useCamp } from "@/components/camp/camp-provider";

export function CampDaySelector() {
  const { days, selectedDay, setSelectedDay } = useCamp();

  if (!days.length) {
    return <p className="camp-cc-muted">No camp days scheduled yet.</p>;
  }

  return (
    <div className="camp-cc-days" role="tablist" aria-label="Camp day">
      {days.map((day) => {
        const active = day.key === selectedDay;
        return (
          <button
            key={day.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? "camp-cc-day active" : "camp-cc-day"}
            onClick={() => setSelectedDay(day.key)}
          >
            <span className="camp-cc-day-wd">{day.weekday}</span>
            <span className="camp-cc-day-dt">{day.date}</span>
          </button>
        );
      })}
    </div>
  );
}
