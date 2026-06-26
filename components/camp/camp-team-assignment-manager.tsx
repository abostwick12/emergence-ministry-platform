"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { CampStudentAvatar } from "@/components/camp/camp-student-card";
import type { CampVisibleStudent } from "@/lib/camp/types";

type CampTeamAssignmentManagerProps = {
  teamId: string;
  teamName: string;
  accentColor?: string;
  students: CampVisibleStudent[];
  onSaved: () => Promise<void>;
};

export function CampTeamAssignmentManager({ teamId, teamName, accentColor, students, onSaved }: CampTeamAssignmentManagerProps) {
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [savingStudentId, setSavingStudentId] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const teamRoster = useMemo(
    () => students.filter((student) => student.teamId === teamId).sort((a, b) => a.name.localeCompare(b.name)),
    [students, teamId]
  );
  const assignableStudents = useMemo(
    () => students.filter((student) => student.teamId !== teamId).sort((a, b) => a.name.localeCompare(b.name)),
    [students, teamId]
  );
  const selectedStudent = assignableStudents.find((student) => student.id === selectedStudentId);
  const busy = Boolean(savingStudentId);

  async function saveTeamAssignment(studentId: string, nextTeamId: string) {
    setMessage(null);
    setSavingStudentId(studentId);
    const response = await fetch("/api/camp/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, assignmentOnly: true, teamId: nextTeamId })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setSavingStudentId("");
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Team assignment could not be saved." });
      return;
    }
    await onSaved();
    setSelectedStudentId("");
    setMessage({ tone: "success", text: nextTeamId ? `${studentName(studentId)} assigned to ${teamName}.` : `${studentName(studentId)} removed from ${teamName}.` });
  }

  function studentName(studentId: string) {
    return students.find((student) => student.id === studentId)?.name ?? "Camper";
  }

  return (
    <section
      className="camp-team-assignment-manager"
      style={accentColor ? ({ "--camp-team-accent": accentColor } as CSSProperties) : undefined}
      aria-label={`${teamName} camper assignments`}
    >
      <div className="camp-team-assignment-head">
        <div>
          <strong>Camper assignments</strong>
          <p className="camp-cc-muted">Assign existing campers to this team without changing registration or medical fields.</p>
        </div>
        <span>{teamRoster.length}</span>
      </div>
      {message ? <p className={message.tone === "error" ? "camp-save-message error" : "camp-save-message success"} role="status">{message.text}</p> : null}
      <div className="camp-team-assignment-controls">
        <label className="field">
          <span>Camper to assign</span>
          <select className="input" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} disabled={busy || assignableStudents.length === 0}>
            <option value="">{assignableStudents.length ? "Choose a camper" : "No visible campers available"}</option>
            {assignableStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}{student.teamName ? ` - currently ${student.teamName}` : " - unassigned"}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button primary compact-button"
          type="button"
          disabled={busy || !selectedStudentId}
          onClick={() => void saveTeamAssignment(selectedStudentId, teamId)}
        >
          {savingStudentId && savingStudentId === selectedStudentId ? "Saving..." : `Assign to ${teamName}`}
        </button>
      </div>
      {selectedStudent?.teamName ? (
        <p className="camp-cc-muted">{selectedStudent.name} will move from {selectedStudent.teamName} to {teamName}.</p>
      ) : null}
      {teamRoster.length ? (
        <ul className="camp-team-assignment-list">
          {teamRoster.map((student) => (
            <li key={student.id}>
              <CampStudentAvatar student={student} size="sm" />
              <span>
                <strong>{student.name}</strong>
                {student.rosterType === "partner" ? (
                  <small>{student.sourceChurch ? `Partner Church: ${student.sourceChurch}` : "Partner Church"}</small>
                ) : null}
              </span>
              <button
                className="button compact-button"
                type="button"
                disabled={busy}
                onClick={() => void saveTeamAssignment(student.id, "")}
              >
                {savingStudentId === student.id ? "Saving..." : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="camp-cc-muted">No campers assigned to this team yet.</p>
      )}
    </section>
  );
}
