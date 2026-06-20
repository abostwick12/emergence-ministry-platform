"use client";

import { useMemo, useState } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import {
  LEADER_SAFETY_CONTACT_GUIDANCE,
  toLeaderSafetyRoster,
  type LeaderSafetyTone
} from "@/lib/camp/leader-safety";

// Tone -> chip classes. All reuse the existing .camp-cc-tag base; only the
// color modifier differs.
const TONE_CLASS: Record<LeaderSafetyTone, string> = {
  medical: "camp-cc-tag alert",
  followUp: "camp-cc-tag warn",
  info: "camp-cc-tag subtle"
};

// Leader Safety View: a mobile-first, supervision-only summary for approved
// leaders. It reads ONLY the general-leader-safe overview payload (via
// useCamp) and the pure mapper, so it cannot expose restricted medical data
// even when an authorized identity previews a different access role.
export function CampLeaderSafetyView() {
  const { overview, loading } = useCamp();
  const [query, setQuery] = useState("");

  const roster = useMemo(() => toLeaderSafetyRoster(overview.students), [overview.students]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return roster;
    return roster.filter((student) =>
      [student.name, student.meta, ...student.indicators.map((indicator) => indicator.label)]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }, [roster, query]);

  return (
    <div className="camp-cc-page">
      <header className="camp-cc-page-head">
        <p className="camp-cc-eyebrow">Safety view</p>
        <h1>Leader Safety</h1>
        <p className="camp-cc-muted">
          Safety basics for supervising your campers. This is not a medical record — no medications, doses, allergies,
          contact details, or forms are shown here.
        </p>
      </header>

      <section className="camp-safety-guidance" aria-label="Medical support guidance">
        <strong>{LEADER_SAFETY_CONTACT_GUIDANCE}</strong>
        <span className="camp-cc-muted">They hold every camper&rsquo;s medication, medical, and family details.</span>
      </section>

      <input
        className="camp-cc-search"
        type="search"
        placeholder="Search name, team, cabin"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search Leader Safety roster"
      />

      {loading && !roster.length ? (
        <p className="camp-cc-muted">Loading camper safety view…</p>
      ) : roster.length === 0 ? (
        <p className="camp-cc-muted">No campers in view yet.</p>
      ) : filtered.length === 0 ? (
        <p className="camp-cc-muted">No campers match this search.</p>
      ) : (
        <div className="camp-student-list">
          {filtered.map((student) => (
            <div key={student.id} className="camp-student-row">
              <span className="camp-student-avatar" aria-hidden="true">
                {student.photoInitials}
              </span>
              <div className="camp-student-info">
                <strong>{student.name}</strong>
                {student.meta ? <span className="camp-cc-muted">{student.meta}</span> : null}
                {student.indicators.length ? (
                  <span className="camp-student-tags">
                    {student.indicators.map((indicator) => (
                      <span key={indicator.label} className={TONE_CLASS[indicator.tone]}>
                        {indicator.label}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="camp-student-tags">
                    <span className="camp-cc-tag subtle">No safety flags on file</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
