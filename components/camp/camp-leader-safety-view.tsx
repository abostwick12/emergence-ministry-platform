"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import {
  LEADER_SAFETY_CONTACT_GUIDANCE,
  toLeaderSafetyRoster,
  type LeaderSafetyTone
} from "@/lib/camp/leader-safety";

const TONE_CLASS: Record<LeaderSafetyTone, string> = {
  food: "camp-cc-tag food",
  medical: "camp-cc-tag alert",
  followUp: "camp-cc-tag warn",
  info: "camp-cc-tag subtle"
};

// Leader Safety View: a mobile-first, supervision-only summary for approved
// leaders. Display decisions come from the pure mapper so JSX only renders the
// already-safe model for the current access tier.
export function CampLeaderSafetyView() {
  const { overview, capabilities, loading } = useCamp();
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");

  const roster = useMemo(
    () => toLeaderSafetyRoster(overview.students, { restrictedMedical: capabilities.restrictedMedical }),
    [overview.students, capabilities.restrictedMedical]
  );
  const teamOptions = useMemo(
    () => ["Unassigned", ...overview.teams.map((team) => team.name)].filter((teamName, index, values) => values.indexOf(teamName) === index),
    [overview.teams]
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return roster.filter((student) => {
      if (teamFilter !== "all" && student.teamName !== teamFilter) return false;
      if (!search) return true;
      return [student.name, student.meta, ...student.indicators.map((indicator) => indicator.label)]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [roster, query, teamFilter]);

  return (
    <div className="camp-cc-page">
      <Link href="/camp/more" className="camp-cc-back">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>More</span>
      </Link>
      <header className="camp-cc-page-head">
        <p className="camp-cc-eyebrow">Safety view</p>
        <h1>Leader Safety</h1>
        <p className="camp-cc-muted">
          Safety basics for supervising your campers. This is not a medical record - no medications, doses, contact details, or forms are shown here.
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
      <label className="field">
        <span>Filter by team</span>
        <select className="input" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} aria-label="Filter Leader Safety by team">
          <option value="all">All teams</option>
          {teamOptions.map((teamName) => (
            <option key={teamName} value={teamName}>{teamName}</option>
          ))}
        </select>
      </label>

      {loading && !roster.length ? (
        <p className="camp-cc-muted">Loading camper safety view...</p>
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
