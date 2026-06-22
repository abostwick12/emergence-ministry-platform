"use client";

import { useMemo, useState } from "react";
import { CampOperationDialog } from "@/components/camp/camp-operation-dialog";
import { useCamp } from "@/components/camp/camp-provider";
import { CampStudentCard } from "@/components/camp/camp-student-card";
import type { CampStudentInput, CampVisibleStudent } from "@/lib/camp/types";

function studentToInput(student?: CampVisibleStudent): CampStudentInput {
  return {
    id: student?.id,
    name: student?.name ?? "",
    grade: student?.grade ?? "",
    teamId: student?.teamId ?? "",
    vehicleId: student?.vehicleId ?? "",
    cabin: student?.cabin ?? "",
    shirtSize: student?.shirtSize ?? "",
    emergencyContactOnFile: student?.emergencyContactOnFile ?? false,
    hasMedicalAlert: student?.hasMedicalAlert ?? false,
    hasDietaryAlert: student?.hasDietaryAlert ?? false,
    limitedSafetyFlags: student?.limitedSafetyFlags ?? []
  };
}

export default function CampRosterPage() {
  const { role, overview, loading, refresh } = useCamp();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CampStudentInput | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function saveStudent() {
    if (!editing) return;
    setMessage(null);
    setSaving(true);
    const response = await fetch(`/api/camp/students?role=${role}`, {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing)
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Camper could not be saved." });
      return;
    }
    await refresh();
    setEditing(null);
    setMessage({ tone: "success", text: "Camper saved. Team and transportation views are refreshed." });
  }

  async function archiveStudent() {
    if (!editing?.id || !window.confirm("Archive this camper?")) return;
    setMessage(null);
    setSaving(true);
    const response = await fetch(`/api/camp/students?role=${role}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: editing.id, action: "archive", archiveReason: "Archived from Camp roster editor" })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Camper could not be archived." });
      return;
    }
    await refresh();
    setEditing(null);
    setMessage({ tone: "success", text: "Camper archived." });
  }

  return (
    <div className="camp-cc-page">
      <header className="camp-cc-page-head">
        <h1>Roster</h1>
        <p className="camp-cc-muted">{overview.students.length} campers in view</p>
      </header>
      <div className="camp-row-actions">
        <button className="button primary" type="button" onClick={() => setEditing(studentToInput())}>Add Camper</button>
      </div>
      {message ? <p className={message.tone === "error" ? "camp-save-message error" : "camp-save-message success"} role="status">{message.text}</p> : null}
      <input
        className="camp-cc-search"
        type="search"
        placeholder="Search name, team, vehicle, cabin"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search roster"
      />
      {loading && !overview.students.length ? (
        <p className="camp-cc-muted">Loading roster...</p>
      ) : filtered.length === 0 ? (
        <p className="camp-cc-muted">No campers match this search.</p>
      ) : (
        <div className="camp-student-list">
          {filtered.map((student) => (
            <button className="camp-inline-button" type="button" key={student.id} onClick={() => setEditing(studentToInput(student))}>
              <CampStudentCard student={student} />
            </button>
          ))}
        </div>
      )}
      {editing ? (
        <CampOperationDialog
          title={editing.id ? "Edit Camper" : "Add Camper"}
          description="Safe roster fields only. Detailed medical editing stays in Medical Command."
          onClose={() => setEditing(null)}
          footer={
            <>
              {editing.id ? <button className="button compact-button" type="button" disabled={saving} onClick={() => void archiveStudent()}>Archive</button> : null}
              <button className="button" type="button" disabled={saving} onClick={() => setEditing(null)}>Cancel</button>
              <button className="button primary" type="button" disabled={saving} onClick={() => void saveStudent()}>{saving ? "Saving..." : "Save"}</button>
            </>
          }
        >
          <div className="camp-field-grid">
            <label className="field"><span>Name</span><input className="input" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
            <label className="field"><span>Grade</span><input className="input" value={editing.grade} onChange={(event) => setEditing({ ...editing, grade: event.target.value })} /></label>
            <label className="field"><span>Team</span><select className="input" value={editing.teamId} onChange={(event) => setEditing({ ...editing, teamId: event.target.value })}><option value="">Unassigned</option>{overview.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label className="field"><span>Vehicle</span><select className="input" value={editing.vehicleId} onChange={(event) => setEditing({ ...editing, vehicleId: event.target.value })}><option value="">Unassigned</option>{overview.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>
            <label className="field"><span>Room / cabin</span><input className="input" value={editing.cabin} onChange={(event) => setEditing({ ...editing, cabin: event.target.value })} /></label>
            <label className="field"><span>Shirt size</span><input className="input" value={editing.shirtSize ?? ""} onChange={(event) => setEditing({ ...editing, shirtSize: event.target.value })} /></label>
          </div>
          <section className="camp-editor-card" aria-label="Safe care indicators">
            <strong>Safe operational indicators</strong>
            <label className="camp-checkbox-line"><input type="checkbox" checked={Boolean(editing.emergencyContactOnFile)} onChange={(event) => setEditing({ ...editing, emergencyContactOnFile: event.target.checked })} /><span>Emergency contact presence confirmed</span></label>
            <label className="camp-checkbox-line"><input type="checkbox" checked={Boolean(editing.hasMedicalAlert)} onChange={(event) => setEditing({ ...editing, hasMedicalAlert: event.target.checked })} /><span>Care plan on file</span></label>
            <label className="camp-checkbox-line"><input type="checkbox" checked={Boolean(editing.hasDietaryAlert)} onChange={(event) => setEditing({ ...editing, hasDietaryAlert: event.target.checked })} /><span>Dietary plan on file</span></label>
          </section>
        </CampOperationDialog>
      ) : null}
    </div>
  );
}
