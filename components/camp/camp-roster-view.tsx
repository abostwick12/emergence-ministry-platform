"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CampOperationDialog } from "@/components/camp/camp-operation-dialog";
import { useCamp } from "@/components/camp/camp-provider";
import { CampStudentAvatar, CampStudentCard } from "@/components/camp/camp-student-card";
import { prepareCampImageFile } from "@/lib/camp/client-image";
import { visibleOperationalFlags } from "@/lib/camp/partner-roster";
import type { CampStudentInput, CampVisibleStudent } from "@/lib/camp/types";

type RosterViewMode = "emerge" | "partner" | "all";

function withOperationalFlags(input: CampStudentInput, value: string): CampStudentInput {
  const notes = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return { ...input, limitedSafetyFlags: notes };
}

function studentToInput(student: CampVisibleStudent | undefined, fallbackRosterType: CampStudentInput["rosterType"]): CampStudentInput {
  return {
    id: student?.id,
    name: student?.name ?? "",
    profilePhotoUrl: student?.profilePhotoUrl,
    grade: student?.grade ?? "",
    teamId: student?.teamId ?? "",
    vehicleId: student?.vehicleId ?? "",
    cabin: student?.cabin ?? "",
    shirtSize: student?.shirtSize ?? "",
    sourceChurch: student?.sourceChurch ?? "",
    rosterType: student?.rosterType ?? fallbackRosterType,
    emergencyContactOnFile: student?.emergencyContactOnFile ?? false,
    hasMedicalAlert: student?.hasMedicalAlert ?? false,
    hasDietaryAlert: student?.hasDietaryAlert ?? false,
    limitedSafetyFlags: visibleOperationalFlags(student?.limitedSafetyFlags ?? [])
  };
}

function sameStudentInput(left: CampStudentInput, right: CampStudentInput) {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.grade === right.grade &&
    left.teamId === right.teamId &&
    left.vehicleId === right.vehicleId &&
    left.cabin === right.cabin &&
    left.shirtSize === right.shirtSize &&
    left.sourceChurch === right.sourceChurch &&
    left.rosterType === right.rosterType &&
    left.emergencyContactOnFile === right.emergencyContactOnFile &&
    left.hasMedicalAlert === right.hasMedicalAlert &&
    left.hasDietaryAlert === right.hasDietaryAlert &&
    JSON.stringify(left.limitedSafetyFlags ?? []) === JSON.stringify(right.limitedSafetyFlags ?? [])
  );
}

export function CampRosterView({ mode = "emerge" }: { mode?: RosterViewMode }) {
  const { overview, loading, refresh, updateStudentProfilePhoto, capabilities } = useCamp();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CampStudentInput | null>(null);
  const [editingHasMedicationPlan, setEditingHasMedicationPlan] = useState(false);
  const [editingProfilePhotoUrl, setEditingProfilePhotoUrl] = useState("");
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState("");
  const [removeProfilePhoto, setRemoveProfilePhoto] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [photoUpload, setPhotoUpload] = useState<{
    status: "idle" | "uploading" | "uploaded" | "failed";
    studentId?: string;
    file?: File;
    remove?: boolean;
    error?: string;
  }>({ status: "idle" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profilePhotoFile) {
      setProfilePhotoPreviewUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(profilePhotoFile);
    setProfilePhotoPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [profilePhotoFile]);

  const studentsInView = useMemo(() => {
    if (mode === "partner") return overview.students.filter((student) => student.rosterType === "partner");
    if (mode === "all") return overview.students;
    return overview.students.filter((student) => student.rosterType !== "partner");
  }, [mode, overview.students]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return studentsInView;
    return studentsInView.filter((student) =>
      [student.name, student.sourceChurch ?? "", student.teamName ?? "", student.vehicleName, student.cabin ?? "", ...(student.limitedSafetyFlags ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }, [studentsInView, query]);

  function startEditing(student?: CampVisibleStudent) {
    setEditing(studentToInput(student, mode === "partner" ? "partner" : "emerge"));
    setEditingHasMedicationPlan(Boolean(student?.hasMedicationPlan));
    setEditingProfilePhotoUrl(student?.profilePhotoUrl ?? "");
    setProfilePhotoFile(null);
    setRemoveProfilePhoto(false);
    setMessage(null);
  }

  function closeEditor() {
    setEditing(null);
    setEditingHasMedicationPlan(false);
    setEditingProfilePhotoUrl("");
    setProfilePhotoFile(null);
    setRemoveProfilePhoto(false);
  }

  function selectProfilePhoto(file: File | null) {
    setProfilePhotoFile(file);
    setRemoveProfilePhoto(false);
    if (file) setPhotoUpload({ status: "idle" });
  }

  async function saveStudent() {
    if (!editing) return;
    const hasPhotoChange = Boolean(profilePhotoFile || removeProfilePhoto);
    const existingStudent = editing.id ? overview.students.find((student) => student.id === editing.id) : undefined;
    const detailsChanged = !editing.id || !existingStudent || !sameStudentInput(editing, studentToInput(existingStudent, editing.rosterType ?? "emerge"));
    const canSavePhotoOnly = Boolean(editing.id && hasPhotoChange && !detailsChanged);

    setMessage(null);
    setSaving(true);
    let studentId = editing.id;

    if (!canSavePhotoOnly) {
      const response = await fetch("/api/camp/students", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing)
      });
      const body = await response.json().catch(() => ({})) as { error?: string; student?: { id: string } };
      if (!response.ok) {
        setSaving(false);
        setMessage({ tone: "error", text: body.error ?? "Camper could not be saved." });
        return;
      }
      studentId = body.student?.id ?? editing.id;
    }

    if (studentId && hasPhotoChange) {
      const photoFile = profilePhotoFile;
      const shouldRemovePhoto = removeProfilePhoto;
      setSaving(false);
      closeEditor();
      setMessage({ tone: "success", text: "Saved." });
      if (!canSavePhotoOnly) void refresh();
      void runProfilePhotoUpload(studentId, photoFile, shouldRemovePhoto);
      return;
    }

    await refresh();
    setSaving(false);
    closeEditor();
    setMessage({ tone: "success", text: "Camper saved. Team and transportation views are refreshed." });
  }

  async function uploadProfilePhoto(studentId: string, file: File) {
    const preparedFile = await prepareCampImageFile(file, "camperProfile");
    const formData = new FormData();
    formData.set("studentId", studentId);
    formData.set("photo", preparedFile);
    return fetch("/api/camp/students/photo", { method: "POST", body: formData });
  }

  async function runProfilePhotoUpload(studentId: string, file: File | null, remove: boolean) {
    setPhotoUpload({ status: "uploading", studentId, file: file ?? undefined, remove });
    setMessage({ tone: "success", text: file ? "Saved. Photo uploading..." : "Saved. Removing photo..." });
    try {
      const response = file
        ? await uploadProfilePhoto(studentId, file)
        : remove
          ? await fetch(`/api/camp/students/photo?studentId=${encodeURIComponent(studentId)}`, { method: "DELETE" })
          : null;
      if (!response) {
        setPhotoUpload({ status: "idle" });
        return;
      }
      const body = await response.json().catch(() => ({})) as { error?: string; student?: { profilePhotoUrl?: string } };
      if (!response.ok) {
        setPhotoUpload({ status: "failed", studentId, file: file ?? undefined, remove, error: body.error ?? "Photo upload failed." });
        setMessage({ tone: "error", text: body.error ?? "Saved, but photo upload failed." });
        return;
      }
      updateStudentProfilePhoto(studentId, body.student?.profilePhotoUrl);
      setPhotoUpload({ status: "uploaded" });
      setMessage({ tone: "success", text: file ? "Photo uploaded." : "Photo removed." });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Photo upload failed.";
      setPhotoUpload({ status: "failed", studentId, file: file ?? undefined, remove, error: text });
      setMessage({ tone: "error", text: `Saved, but ${text}` });
    }
  }

  function retryProfilePhotoUpload() {
    if (!photoUpload.studentId) return;
    void runProfilePhotoUpload(photoUpload.studentId, photoUpload.file ?? null, Boolean(photoUpload.remove));
  }

  async function archiveStudent() {
    if (!editing?.id || !window.confirm("Archive this camper?")) return;
    setMessage(null);
    setSaving(true);
    const response = await fetch("/api/camp/students", {
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
    closeEditor();
    setMessage({ tone: "success", text: "Camper archived." });
  }

  const visibleProfilePhotoUrl = profilePhotoPreviewUrl || (!removeProfilePhoto ? editingProfilePhotoUrl : "");
  const editingAvatar = {
    name: editing?.name ?? "Camper",
    photoInitials: editing?.name ? editing.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "C" : "C",
    profilePhotoUrl: visibleProfilePhotoUrl
  };
  const title = mode === "partner" ? "Partner Church Campers" : mode === "all" ? "All Campers" : "Roster";
  const subtitle = mode === "partner"
    ? `${studentsInView.length} partner church ${studentsInView.length === 1 ? "camper" : "campers"} in view`
    : mode === "all"
      ? `${studentsInView.length} total ${studentsInView.length === 1 ? "camper" : "campers"} in view`
      : `${studentsInView.length} Emerge/CLC ${studentsInView.length === 1 ? "camper" : "campers"} in view`;
  const emptyText = mode === "partner" ? "No partner church campers match this search." : "No campers match this search.";

  if (mode === "all" && !capabilities.medicalCommand) {
    return (
      <div className="camp-cc-page">
        <header className="camp-cc-page-head">
          <h1>All Campers</h1>
          <p className="camp-cc-muted">This combined view is limited to authorized Camp Admin access.</p>
        </header>
        <Link className="button compact-button" href="/camp/roster">Back to Roster</Link>
      </div>
    );
  }

  return (
    <div className="camp-cc-page">
      <header className="camp-cc-page-head">
        <h1>{title}</h1>
        <p className="camp-cc-muted">{subtitle}</p>
      </header>
      <nav className="camp-row-actions" aria-label="Roster views">
        <Link className={mode === "emerge" ? "button primary compact-button" : "button compact-button"} href="/camp/roster">Emerge/CLC only</Link>
        <Link className={mode === "partner" ? "button primary compact-button" : "button compact-button"} href="/camp/partner-campers">Partner Church only</Link>
        {capabilities.medicalCommand ? <Link className={mode === "all" ? "button primary compact-button" : "button compact-button"} href="/camp/all-campers">All Campers</Link> : null}
      </nav>
      <div className="camp-row-actions">
        <button className="button primary" type="button" onClick={() => startEditing()}>{mode === "partner" ? "Add Partner Camper" : "Add Camper"}</button>
      </div>
      {message ? <p className={message.tone === "error" ? "camp-save-message error" : "camp-save-message success"} role="status">{message.text}</p> : null}
      {photoUpload.status === "failed" ? (
        <div className="camp-save-message error" role="status">
          <span>Photo upload failed. The camper record is saved.</span>
          <button className="button compact-button" type="button" onClick={retryProfilePhotoUpload}>Retry upload</button>
        </div>
      ) : null}
      <input
        className="camp-cc-search"
        type="search"
        placeholder="Search name, team, vehicle, cabin"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search roster"
      />
      {loading && !studentsInView.length ? (
        <p className="camp-cc-muted">Loading roster...</p>
      ) : filtered.length === 0 ? (
        <p className="camp-cc-muted">{emptyText}</p>
      ) : (
        <div className="camp-student-list">
          {filtered.map((student) => (
            <button className="camp-inline-button" type="button" key={student.id} onClick={() => startEditing(student)}>
              <CampStudentCard student={student} />
            </button>
          ))}
        </div>
      )}
      {editing ? (
        <CampOperationDialog
          title={editing.id ? "Edit Camper" : "Add Camper"}
          description="Safe roster fields only. Detailed medical editing stays in Medical Command."
          onClose={closeEditor}
          footer={
            <>
              {editing.id ? <button className="button danger compact-button" type="button" disabled={saving} onClick={() => void archiveStudent()}>Archive</button> : null}
              <button className="button" type="button" disabled={saving} onClick={closeEditor}>Cancel</button>
              <button className="button primary" type="button" disabled={saving} onClick={() => void saveStudent()}>{saving ? "Saving..." : "Save"}</button>
            </>
          }
        >
          <section className="camp-editor-card camp-profile-photo-editor" aria-label="Camper photo">
            <div>
              <strong>Camper photo</strong>
              <p className="camp-cc-muted">Optional roster photo for authorized Camp views.</p>
            </div>
            <div className="camp-profile-photo-row">
              <CampStudentAvatar student={editingAvatar} />
              <div className="camp-photo-actions">
                <label className="button compact-button">
                  <span>Take photo</span>
                  <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => selectProfilePhoto(event.target.files?.[0] ?? null)} />
                </label>
                <label className="button compact-button">
                  <span>Upload photo</span>
                  <input className="sr-only" type="file" accept="image/*" onChange={(event) => selectProfilePhoto(event.target.files?.[0] ?? null)} />
                </label>
                {visibleProfilePhotoUrl ? (
                  <>
                    <label className="button compact-button">
                      <span>Replace photo</span>
                      <input className="sr-only" type="file" accept="image/*" onChange={(event) => selectProfilePhoto(event.target.files?.[0] ?? null)} />
                    </label>
                    <button className="button compact-button" type="button" onClick={() => { setProfilePhotoFile(null); setRemoveProfilePhoto(true); }}>Remove photo</button>
                  </>
                ) : null}
              </div>
            </div>
          </section>
          <section className="camp-editor-card" aria-label="Roster fields">
            <div>
              <strong>Roster fields</strong>
              <p className="camp-cc-muted">Spreadsheet-safe details for cards, teams, and transportation.</p>
            </div>
            <div className="camp-field-grid">
              <label className="field"><span>Name</span><input className="input" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
              <label className="field"><span>Grade</span><input className="input" value={editing.grade} onChange={(event) => setEditing({ ...editing, grade: event.target.value })} /></label>
              <label className="field"><span>Roster type</span><select className="input" value={editing.rosterType ?? "emerge"} onChange={(event) => setEditing({ ...editing, rosterType: event.target.value as CampStudentInput["rosterType"] })}><option value="emerge">Emerge/CLC</option><option value="partner">Partner Church</option></select></label>
              <label className="field"><span>Partner/source church</span><input className="input" value={editing.sourceChurch ?? ""} onChange={(event) => setEditing({ ...editing, sourceChurch: event.target.value })} /></label>
              <label className="field"><span>Shirt size</span><input className="input" value={editing.shirtSize ?? ""} onChange={(event) => setEditing({ ...editing, shirtSize: event.target.value })} /></label>
              <label className="field"><span>Team</span><select className="input" value={editing.teamId} onChange={(event) => setEditing({ ...editing, teamId: event.target.value })}><option value="">Unassigned</option>{overview.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
              <label className="field"><span>Vehicle</span><select className="input" value={editing.vehicleId} onChange={(event) => setEditing({ ...editing, vehicleId: event.target.value })}><option value="">Unassigned</option>{overview.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>
              <label className="field"><span>Room / cabin</span><input className="input" value={editing.cabin} onChange={(event) => setEditing({ ...editing, cabin: event.target.value })} /></label>
            </div>
          </section>
          <section className="camp-editor-card" aria-label="Safe care indicators">
            <strong>Safe operational indicators</strong>
            <label className="camp-checkbox-line"><input type="checkbox" checked={Boolean(editing.emergencyContactOnFile)} onChange={(event) => setEditing({ ...editing, emergencyContactOnFile: event.target.checked })} /><span>Emergency contact presence confirmed</span></label>
            <label className="camp-checkbox-line"><input type="checkbox" checked={Boolean(editing.hasDietaryAlert)} onChange={(event) => setEditing({ ...editing, hasDietaryAlert: event.target.checked })} /><span>Food allergy indicator</span></label>
            <label className="camp-checkbox-line"><input type="checkbox" checked={Boolean(editing.hasMedicalAlert)} onChange={(event) => setEditing({ ...editing, hasMedicalAlert: event.target.checked })} /><span>Medical concern indicator</span></label>
            <label className="camp-checkbox-line"><input type="checkbox" checked={editingHasMedicationPlan} disabled readOnly /><span>Medication-on-file indicator</span></label>
            <label className="field">
              <span>Leader-safe notes</span>
              <textarea
                className="input"
                rows={3}
                value={visibleOperationalFlags(editing.limitedSafetyFlags ?? []).join("\n")}
                onChange={(event) => setEditing(withOperationalFlags(editing, event.target.value))}
                placeholder="Allergy: Peanuts&#10;Diet: Gluten-free&#10;Medical: Asthma"
              />
            </label>
            <p className="camp-cc-muted">Use short leader-safe labels such as Allergy, Diet, Medical, Supervision, or Physical. Do not enter medication names, doses, insurance, guardian contact details, or private notes here.</p>
          </section>
        </CampOperationDialog>
      ) : null}
    </div>
  );
}
