"use client";

import { useMemo, useState } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import { CampStudentCard } from "@/components/camp/camp-student-card";

export default function CampRosterPage() {
  const { overview, loading } = useCamp();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return overview.students;
    return overview.students.filter((student) =>
      [student.name, student.teamName ?? "", student.vehicleName, student.cabin ?? "", ...(student.limitedSafetyFlags ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }, [overview.students, query]);

  return (
    <div className="camp-cc-page">
      <header className="camp-cc-page-head">
        <h1>Roster</h1>
        <p className="camp-cc-muted">{overview.students.length} campers in view</p>
      </header>
      <input
        className="camp-cc-search"
        type="search"
        placeholder="Search name, team, vehicle, cabin"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search roster"
      />
      {loading && !overview.students.length ? (
        <p className="camp-cc-muted">Loading roster…</p>
      ) : filtered.length === 0 ? (
        <p className="camp-cc-muted">No campers match this search.</p>
      ) : (
        <div className="camp-student-list">
          {filtered.map((student) => (
            <CampStudentCard key={student.id} student={student} />
          ))}
        </div>
      )}
    </div>
  );
}
