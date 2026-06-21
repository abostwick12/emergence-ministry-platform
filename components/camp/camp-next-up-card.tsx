"use client";

import Link from "next/link";
import { useCamp } from "@/components/camp/camp-provider";

export function CampNextUpCard() {
  const { scheduleForSelectedDay, days, selectedDay } = useCamp();
  const next = scheduleForSelectedDay[0];
  const dayLabel = days.find((day) => day.key === selectedDay)?.key ?? "this day";

  if (!next) {
    return (
      <section className="camp-cc-nextup empty" aria-label="Next up">
        <p className="camp-cc-nextup-label">NEXT UP</p>
        <p className="camp-cc-nextup-title">Nothing scheduled</p>
        <p className="camp-cc-muted">No remaining events for {dayLabel}.</p>
        <Link href="/camp/schedule" className="camp-cc-nextup-cta">View full schedule</Link>
      </section>
    );
  }

  const remaining = scheduleForSelectedDay.length - 1;
  const instruction = next.audience === "Medical Team"
    ? "Medical leads should stage supplies and keep details in restricted workflows."
    : next.audience === "Leaders"
      ? "Leaders should arrive early and check their assignments."
      : "Keep students with their team and confirm the next transition.";

  return (
    <section className="camp-cc-nextup" aria-label="Next up">
      <p className="camp-cc-nextup-label">NEXT UP</p>
      <h2 className="camp-cc-nextup-title">{next.title}</h2>
      <div className="camp-cc-nextup-meta">
        <span className="camp-cc-nextup-time">{next.time}</span>
        {next.location ? <span className="camp-cc-nextup-loc">{next.location}</span> : null}
      </div>
      <p className="camp-cc-nextup-note">{instruction}</p>
      <div className="camp-cc-nextup-foot">
        <Link href="/camp/schedule" className="camp-cc-nextup-cta">
          Open full schedule{remaining > 0 ? ` (+${remaining} more)` : ""}
        </Link>
      </div>
    </section>
  );
}
