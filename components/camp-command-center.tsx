"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  campAccessLabels,
  campAccessRoles,
  getDefaultCampAccessScope,
  isRestrictedCampMedicalRole
} from "@/lib/camp/access";
import type {
  CampAccessRole,
  CampMedicationAdministrationLog,
  CampMedicationIntakeInput,
  CampMedicationIntakeRecord,
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
  CampOverviewPayload,
  CampRegistrationImportPreview,
  CampRestrictedMedicalRecord,
  CampStudentInput,
  CampStudentPublic,
  CampVisibleStudent
} from "@/lib/camp/types";

type RestrictedState = {
  medical: CampRestrictedMedicalRecord[];
  medication: {
    checkIn: CampMedicationRecord[];
    schedule: CampMedicationScheduleItem[];
    administrationLog: CampMedicationAdministrationLog[];
    returnChecklist: CampMedicationReturnItem[];
    intakeHistory: CampMedicationIntakeRecord[];
  };
};

type StudentForm = CampStudentInput & { id?: string; limitedSafetyFlagsText: string };
type MedicationForm = {
  id?: string;
  studentId: string;
  medicationName: string;
  medicinePhotoStatus: CampMedicationRecord["medicinePhotoStatus"];
  parentProvidedInstructions: string;
  checkInStatus: CampMedicationRecord["checkInStatus"];
  clarificationStatus: CampMedicationRecord["clarificationStatus"];
};
type ScheduleForm = {
  medicationRecordId: string;
  timeWindow: string;
  parentProvidedInstructions: string;
  status: CampMedicationScheduleItem["status"];
};
type AdministrationForm = {
  scheduleItemId: string;
  loggedBy: string;
  status: CampMedicationAdministrationLog["status"];
  notes: string;
};
type IntakeForm = Omit<CampMedicationIntakeInput, "guardianSignatureData" | "confirmationAcknowledged"> & {
  guardianSignatureData: CampMedicationIntakeInput["guardianSignatureData"];
  confirmationAcknowledged: boolean;
};

function emptySignatureData(): CampMedicationIntakeInput["guardianSignatureData"] {
  return { width: 640, height: 220, strokes: [] };
}

const emptyOverview: CampOverviewPayload = {
  campStartsOn: "2026-06-29",
  teams: [],
  vehicles: [],
  schedule: [],
  documents: [],
  students: []
};

function daysUntilCamp(startDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const today = new Date();
  const diff = start.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function statusClass(status: string) {
  if (status.includes("Clarification") || status.includes("Review") || status.includes("Needed")) return "camp-status warn";
  if (status.includes("Checked") || status.includes("Ready") || status.includes("Received") || status.includes("Returned") || status.includes("Logged")) return "camp-status ready";
  return "camp-status";
}

function flagsFromText(value: string) {
  return value.split(",").map((flag) => flag.trim()).filter(Boolean);
}

function textFromFlags(flags?: string[]) {
  return (flags ?? []).join(", ");
}

function hasSignature(signature: CampMedicationIntakeInput["guardianSignatureData"]) {
  return signature.strokes.some((stroke) => stroke.length > 0);
}

export function CampCommandCenter() {
  const [accessRole, setAccessRole] = useState<CampAccessRole>("general_leader");
  const [driverVehicleId, setDriverVehicleId] = useState(getDefaultCampAccessScope("driver").vehicleId ?? "van-2");
  const [query, setQuery] = useState("");
  const [overview, setOverview] = useState<CampOverviewPayload>(emptyOverview);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [restrictedState, setRestrictedState] = useState<RestrictedState | null>(null);
  const [restrictedError, setRestrictedError] = useState<string | null>(null);
  const [restrictedLoading, setRestrictedLoading] = useState(false);
  const [archivedStudents, setArchivedStudents] = useState<CampStudentPublic[]>([]);
  const [archiveReason, setArchiveReason] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [importCsv, setImportCsv] = useState("");
  const [importPreview, setImportPreview] = useState<CampRegistrationImportPreview | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [studentForm, setStudentForm] = useState<StudentForm>({
    name: "",
    grade: "",
    teamId: "",
    vehicleId: "",
    cabin: "",
    limitedSafetyFlags: [],
    limitedSafetyFlagsText: ""
  });
  const [medicalForm, setMedicalForm] = useState<CampRestrictedMedicalRecord>({
    studentId: "",
    studentName: "",
    medicalFormStatus: "Received",
    restrictedNotes: "",
    allergyNotes: "",
    insuranceStatus: "",
    parentMedicalNotes: ""
  });
  const [medicationForm, setMedicationForm] = useState<MedicationForm>({
    studentId: "",
    medicationName: "",
    medicinePhotoStatus: "Photo Needed",
    parentProvidedInstructions: "",
    checkInStatus: "Not Checked In",
    clarificationStatus: "Clear"
  });
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({
    medicationRecordId: "",
    timeWindow: "",
    parentProvidedInstructions: "",
    status: "Pending"
  });
  const [administrationForm, setAdministrationForm] = useState<AdministrationForm>({
    scheduleItemId: "",
    loggedBy: "Andrew",
    status: "Logged",
    notes: ""
  });
  const [intakeForm, setIntakeForm] = useState<IntakeForm>({
    studentId: "",
    medicationRecordId: "",
    medicationName: "",
    dose: "",
    scheduleText: "",
    parentInstructions: "",
    staffNotes: "",
    quantityReceived: "",
    containerStatus: "",
    receivedByName: "Andrew",
    receivedAt: new Date().toISOString().slice(0, 16),
    guardianName: "",
    guardianRelationship: "",
    guardianSignatureData: emptySignatureData(),
    clarificationStatus: "Clear",
    confirmationAcknowledged: false,
    supersedesIntakeId: "",
    correctionNote: ""
  });

  const canSeeRestrictedMedical = isRestrictedCampMedicalRole(accessRole);
  const canEditRoster = accessRole !== "driver";
  const filteredStudents = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return overview.students;
    return overview.students.filter((student) => {
      return [
        student.name,
        student.teamName ?? "",
        student.vehicleName,
        student.cabin ?? "",
        ...(student.limitedSafetyFlags ?? [])
      ].join(" ").toLowerCase().includes(search);
    });
  }, [overview.students, query]);

  const loadOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    const params = new URLSearchParams({ role: accessRole });
    if (accessRole === "driver") params.set("vehicleId", driverVehicleId);
    const response = await fetch(`/api/camp?${params.toString()}`, { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as CampOverviewPayload;
      setOverview(payload);
      setStudentForm((current) => ({
        ...current,
        teamId: current.teamId || payload.teams[0]?.id || "",
        vehicleId: current.vehicleId || payload.vehicles[0]?.id || ""
      }));
      setMedicalForm((current) => ({ ...current, studentId: current.studentId || payload.students[0]?.id || "" }));
      setMedicationForm((current) => ({ ...current, studentId: current.studentId || payload.students[0]?.id || "" }));
      setIntakeForm((current) => ({ ...current, studentId: current.studentId || payload.students[0]?.id || "" }));
    }
    setIsLoadingOverview(false);
  }, [accessRole, driverVehicleId]);

  const loadRestrictedData = useCallback(async () => {
    if (!canSeeRestrictedMedical) {
      setRestrictedState(null);
      setRestrictedError(null);
      setRestrictedLoading(false);
      return;
    }

    setRestrictedLoading(true);
    setRestrictedError(null);

    try {
      const [medicalResponse, medicationResponse] = await Promise.all([
        fetch(`/api/camp/restricted-medical?role=${accessRole}`, { cache: "no-store" }),
        fetch(`/api/camp/medication?role=${accessRole}`, { cache: "no-store" })
      ]);

      if (!medicalResponse.ok || !medicationResponse.ok) throw new Error("Restricted camp data could not be loaded.");

      const [medical, medication] = await Promise.all([
        medicalResponse.json() as Promise<{ records: CampRestrictedMedicalRecord[] }>,
        medicationResponse.json() as Promise<RestrictedState["medication"]>
      ]);
      setRestrictedState({ medical: medical.records, medication });
      setScheduleForm((current) => ({
        ...current,
        medicationRecordId: current.medicationRecordId || medication.checkIn[0]?.id || ""
      }));
      setAdministrationForm((current) => ({
        ...current,
        scheduleItemId: current.scheduleItemId || medication.schedule[0]?.id || ""
      }));
      setIntakeForm((current) => ({
        ...current,
        medicationRecordId: current.medicationRecordId || medication.checkIn[0]?.id || ""
      }));
    } catch (error) {
      setRestrictedState(null);
      setRestrictedError(error instanceof Error ? error.message : "Restricted camp data could not be loaded.");
    } finally {
      setRestrictedLoading(false);
    }
  }, [accessRole, canSeeRestrictedMedical]);

  const loadArchivedStudents = useCallback(async () => {
    if (!canSeeRestrictedMedical) {
      setArchivedStudents([]);
      return;
    }

    const response = await fetch(`/api/camp/students?role=${accessRole}`, { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as { students: CampStudentPublic[] };
      setArchivedStudents(payload.students);
    }
  }, [accessRole, canSeeRestrictedMedical]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadRestrictedData();
  }, [loadRestrictedData]);

  useEffect(() => {
    void loadArchivedStudents();
  }, [loadArchivedStudents]);

  function editStudent(student: CampVisibleStudent) {
    setStudentForm({
      id: student.id,
      name: student.name,
      grade: student.grade ?? "",
      teamId: student.teamId ?? overview.teams[0]?.id ?? "",
      vehicleId: student.vehicleId,
      cabin: student.cabin ?? "",
      limitedSafetyFlags: student.limitedSafetyFlags ?? [],
      limitedSafetyFlagsText: textFromFlags(student.limitedSafetyFlags)
    });
  }

  async function saveStudent() {
    if (!studentForm.name.trim()) return;
    const method = studentForm.id ? "PATCH" : "POST";
    const response = await fetch(`/api/camp/students?role=${accessRole}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: studentForm.id,
        name: studentForm.name,
        grade: studentForm.grade,
        teamId: studentForm.teamId,
        vehicleId: studentForm.vehicleId,
        cabin: studentForm.cabin,
        limitedSafetyFlags: flagsFromText(studentForm.limitedSafetyFlagsText)
      })
    });
    setSaveMessage(response.ok ? "Camper saved." : "Camper could not be saved.");
    if (response.ok) {
      setStudentForm({
        name: "",
        grade: "",
        teamId: overview.teams[0]?.id ?? "",
        vehicleId: overview.vehicles[0]?.id ?? "",
        cabin: "",
        limitedSafetyFlags: [],
        limitedSafetyFlagsText: ""
      });
      await loadOverview();
      await loadRestrictedData();
    }
  }

  async function archiveStudent() {
    if (!studentForm.id) return;
    const confirmed = window.confirm("Archived campers are removed from active Camp views but retained for recordkeeping.");
    if (!confirmed) return;

    const response = await fetch(`/api/camp/students?role=${accessRole}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", studentId: studentForm.id, archiveReason })
    });
    setSaveMessage(response.ok ? "Camper archived." : "Camper could not be archived.");
    if (response.ok) {
      setStudentForm({ name: "", grade: "", teamId: overview.teams[0]?.id ?? "", vehicleId: overview.vehicles[0]?.id ?? "", cabin: "", limitedSafetyFlags: [], limitedSafetyFlagsText: "" });
      setArchiveReason("");
      await loadOverview();
      await loadRestrictedData();
      await loadArchivedStudents();
    }
  }

  async function restoreStudent(studentId: string) {
    const response = await fetch(`/api/camp/students?role=${accessRole}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", studentId })
    });
    setSaveMessage(response.ok ? "Camper restored." : "Camper could not be restored.");
    if (response.ok) {
      await loadOverview();
      await loadRestrictedData();
      await loadArchivedStudents();
    }
  }

  async function saveAssignment(studentId: string, teamId: string, vehicleId: string) {
    const response = await fetch(`/api/camp/students?role=${accessRole}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentOnly: true, studentId, teamId, vehicleId })
    });
    setSaveMessage(response.ok ? "Assignment updated." : "Assignment could not be updated.");
    if (response.ok) await loadOverview();
  }

  async function saveMedicalRecord() {
    if (!medicalForm.studentId) return;
    const response = await fetch(`/api/camp/restricted-medical?role=${accessRole}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(medicalForm)
    });
    setSaveMessage(response.ok ? "Restricted medical record saved." : "Restricted medical record could not be saved.");
    if (response.ok) {
      await loadOverview();
      await loadRestrictedData();
    }
  }

  async function saveMedicationRecord() {
    if (!medicationForm.studentId) return;
    const response = await fetch(`/api/camp/medication?role=${accessRole}`, {
      method: medicationForm.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(medicationForm)
    });
    setSaveMessage(response.ok ? "Medication check-in saved." : "Medication check-in could not be saved.");
    if (response.ok) {
      await loadOverview();
      await loadRestrictedData();
      setMedicationForm((current) => ({ ...current, id: undefined, medicationName: "", parentProvidedInstructions: "" }));
    }
  }

  async function saveMedicationIntake() {
    if (!intakeForm.studentId || !intakeForm.medicationName.trim() || !intakeForm.guardianName.trim()) return;
    const response = await fetch(`/api/camp/medication?role=${accessRole}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "intake",
        ...intakeForm,
        receivedAt: intakeForm.receivedAt ? new Date(intakeForm.receivedAt).toISOString() : undefined
      })
    });
    setSaveMessage(response.ok ? "Medication intake saved." : "Medication intake could not be saved.");
    if (response.ok) {
      await loadOverview();
      await loadRestrictedData();
      setIntakeForm((current) => ({
        ...current,
        medicationName: "",
        dose: "",
        scheduleText: "",
        parentInstructions: "",
        staffNotes: "",
        quantityReceived: "",
        containerStatus: "",
        guardianName: "",
        guardianRelationship: "",
        guardianSignatureData: emptySignatureData(),
        confirmationAcknowledged: false,
        supersedesIntakeId: "",
        correctionNote: ""
      }));
    }
  }

  async function saveScheduleItem() {
    if (!scheduleForm.medicationRecordId || !scheduleForm.timeWindow.trim()) return;
    const response = await fetch(`/api/camp/medication?role=${accessRole}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "schedule", ...scheduleForm })
    });
    setSaveMessage(response.ok ? "Medication schedule saved." : "Medication schedule could not be saved.");
    if (response.ok) {
      await loadRestrictedData();
      setScheduleForm((current) => ({ ...current, timeWindow: "", parentProvidedInstructions: "" }));
    }
  }

  async function saveAdministrationLog() {
    if (!administrationForm.scheduleItemId) return;
    const response = await fetch(`/api/camp/medication?role=${accessRole}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "administrationLog", ...administrationForm })
    });
    setSaveMessage(response.ok ? "Administration log saved." : "Administration log could not be saved.");
    if (response.ok) {
      await loadRestrictedData();
      setAdministrationForm((current) => ({ ...current, notes: "" }));
    }
  }

  async function saveReturnStatus(id: string, returnStatus: CampMedicationReturnItem["returnStatus"]) {
    const response = await fetch(`/api/camp/medication?role=${accessRole}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "return", id, returnStatus, returnedBy: campAccessLabels[accessRole] })
    });
    setSaveMessage(response.ok ? "Return checklist updated." : "Return checklist could not be updated.");
    if (response.ok) await loadRestrictedData();
  }

  async function uploadMedicationPhoto(record: CampMedicationRecord, file: File | null) {
    if (!file) {
      setPhotoMessage("Medication photo capture cancelled.");
      return;
    }

    setPhotoMessage("Uploading medication photo...");
    const formData = new FormData();
    formData.set("medicationRecordId", record.id);
    formData.set("photo", file);
    const response = await fetch(`/api/camp/medication/photos?role=${accessRole}`, {
      method: "POST",
      body: formData
    });
    setPhotoMessage(response.ok ? "Medication photo uploaded." : "Medication photo could not be uploaded.");
    if (response.ok) await loadRestrictedData();
  }

  async function viewMedicationPhoto(record: CampMedicationRecord) {
    const response = await fetch(`/api/camp/medication/photos?role=${accessRole}&medicationRecordId=${encodeURIComponent(record.id)}`, { cache: "no-store" });
    if (!response.ok) {
      setPhotoMessage("Medication photo could not be opened.");
      return;
    }
    const payload = (await response.json()) as { signedUrl: string };
    window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function previewImport() {
    const response = await fetch(`/api/camp/import?role=${accessRole}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", csv: importCsv })
    });
    if (!response.ok) {
      setImportMessage("Import preview could not be created.");
      return;
    }
    const payload = (await response.json()) as { preview: CampRegistrationImportPreview };
    setImportPreview(payload.preview);
    setImportMessage("Import preview ready. Review before saving.");
  }

  async function commitImport() {
    if (!importPreview) return;
    const response = await fetch(`/api/camp/import?role=${accessRole}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "commit", preview: importPreview })
    });
    if (!response.ok) {
      setImportMessage("Import could not be saved.");
      return;
    }
    setImportMessage("Import saved.");
    setImportCsv("");
    setImportPreview(null);
    await loadOverview();
    await loadRestrictedData();
  }

  const campDays = daysUntilCamp(overview.campStartsOn);

  return (
    <div className="camp-command-center">
      <section className="camp-hero" aria-labelledby="camp-home">
        <div>
          <p className="eyebrow">Camp Home</p>
          <h2 id="camp-home" className="camp-title">Camp Command Center</h2>
          <p className="camp-lede">Fast operational access for Emerge adult leaders before camp begins on June 29.</p>
        </div>
        <div className="camp-countdown" aria-label={`${campDays} days until camp`}>
          <strong>{campDays}</strong>
          <span>days out</span>
        </div>
      </section>

      <section className="panel camp-controls" aria-label="Camp access controls">
        <div>
          <p className="eyebrow">Access View</p>
          <h3 className="section-title">Operational role</h3>
          <p className="muted">Public roster data is server-filtered. Restricted medical and medication tools only load for Andrew, Jaci, and Joel.</p>
        </div>
        <div className="camp-role-tabs" role="group" aria-label="Camp access role">
          {campAccessRoles.map((role) => (
            <button className={role === accessRole ? "camp-role-tab active" : "camp-role-tab"} key={role} type="button" onClick={() => setAccessRole(role)}>
              {campAccessLabels[role]}
            </button>
          ))}
        </div>
        {accessRole === "driver" ? (
          <label className="field camp-driver-filter">
            <span>Driver Vehicle</span>
            <select className="input" value={driverVehicleId} onChange={(event) => setDriverVehicleId(event.target.value)}>
              {overview.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.name} - {vehicle.driver}</option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      {saveMessage ? <p className="camp-save-message" role="status">{saveMessage}</p> : null}

      <section className="panel" aria-labelledby="student-lookup">
        <div className="camp-section-header">
          <div>
            <p className="eyebrow">Student Quick Lookup</p>
            <h3 id="student-lookup" className="section-title">Students</h3>
          </div>
          <input className="input camp-search" type="search" placeholder="Search name, team, vehicle, cabin, flag" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {isLoadingOverview ? <p className="muted">Loading camp roster...</p> : null}
        <div className="camp-student-grid">
          {filteredStudents.map((student) => (
            <button className="camp-student-card camp-student-button" key={student.id} type="button" onClick={() => canEditRoster && editStudent(student)}>
              <span className="camp-avatar" aria-hidden="true">{student.photoInitials}</span>
              <span>
                <strong>{student.name}</strong>
                <span className="muted">
                  {student.teamName ? `${student.teamName} team - ` : ""}
                  {student.vehicleName}
                  {student.cabin ? ` - ${student.cabin}` : ""}
                </span>
                {student.limitedSafetyFlags?.length ? (
                  <span className="camp-flag-row">
                    {student.limitedSafetyFlags.map((flag) => <span className="camp-status warn" key={flag}>{flag}</span>)}
                  </span>
                ) : null}
                {canEditRoster ? <span className="button compact-button camp-card-action">Edit Camper</span> : null}
              </span>
            </button>
          ))}
        </div>
      </section>

      {canEditRoster ? (
        <section className="panel" aria-labelledby="camp-student-entry">
          <p className="eyebrow">Camper Entry</p>
          <h3 id="camp-student-entry" className="section-title">{studentForm.id ? "Edit camper" : "Add camper"}</h3>
          <div className="camp-form-grid">
            <label className="field"><span>Name</span><input className="input" value={studentForm.name} onChange={(event) => setStudentForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="field"><span>Grade</span><input className="input" value={studentForm.grade} onChange={(event) => setStudentForm((current) => ({ ...current, grade: event.target.value }))} /></label>
            <label className="field"><span>Team</span><select className="input" value={studentForm.teamId} onChange={(event) => setStudentForm((current) => ({ ...current, teamId: event.target.value }))}>{overview.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label className="field"><span>Vehicle</span><select className="input" value={studentForm.vehicleId} onChange={(event) => setStudentForm((current) => ({ ...current, vehicleId: event.target.value }))}>{overview.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} - {vehicle.driver}</option>)}</select></label>
            <label className="field"><span>Cabin</span><input className="input" value={studentForm.cabin} onChange={(event) => setStudentForm((current) => ({ ...current, cabin: event.target.value }))} /></label>
            <label className="field"><span>Limited safety flags</span><input className="input" value={studentForm.limitedSafetyFlagsText} onChange={(event) => setStudentForm((current) => ({ ...current, limitedSafetyFlagsText: event.target.value }))} placeholder="Comma separated public flags only" /></label>
          </div>
          <div className="toolbar">
            <button className="button primary" type="button" onClick={() => void saveStudent()}>{studentForm.id ? "Save camper" : "Add camper"}</button>
            {studentForm.id ? <button className="button" type="button" onClick={() => setStudentForm({ name: "", grade: "", teamId: overview.teams[0]?.id ?? "", vehicleId: overview.vehicles[0]?.id ?? "", cabin: "", limitedSafetyFlags: [], limitedSafetyFlagsText: "" })}>Clear form</button> : null}
          </div>
          {canSeeRestrictedMedical && studentForm.id ? (
            <div className="camp-archive-box">
              <label className="field camp-wide-field">
                <span>Archive reason</span>
                <input className="input" value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder="Optional recordkeeping note" />
              </label>
              <button className="button danger" type="button" onClick={() => void archiveStudent()}>Archive Camper</button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="camp-grid">
        <TeamAssignments students={overview.students} teams={overview.teams} canEdit={canEditRoster} onSave={saveAssignment} />
        <VehicleAssignments students={overview.students} vehicles={overview.vehicles} canEdit={canEditRoster} onSave={saveAssignment} />
      </div>

      <div className="camp-grid">
        <SchedulePanel accessRole={accessRole} schedule={overview.schedule} />
        <DocumentsPanel documents={overview.documents} />
      </div>

      {!canSeeRestrictedMedical ? (
        <section className="panel camp-search-placeholder" aria-label="Restricted camp data unavailable">
          <p className="eyebrow">Restricted Medical and Medication</p>
          <h3 className="section-title">Not available for this access view</h3>
          <p className="muted">General leaders and drivers do not receive medication names, parent medical notes, insurance details, diagnoses, dosages, or full medical forms.</p>
        </section>
      ) : (
        <RestrictedCampTools
          accessRole={accessRole}
          overview={overview}
          restrictedState={restrictedState}
          restrictedLoading={restrictedLoading}
          restrictedError={restrictedError}
          medicalForm={medicalForm}
          setMedicalForm={setMedicalForm}
          medicationForm={medicationForm}
          setMedicationForm={setMedicationForm}
          intakeForm={intakeForm}
          setIntakeForm={setIntakeForm}
          scheduleForm={scheduleForm}
          setScheduleForm={setScheduleForm}
          administrationForm={administrationForm}
          setAdministrationForm={setAdministrationForm}
          onSaveMedical={saveMedicalRecord}
          onSaveMedication={saveMedicationRecord}
          onSaveMedicationIntake={saveMedicationIntake}
          onSaveSchedule={saveScheduleItem}
          onSaveAdministrationLog={saveAdministrationLog}
          onSaveReturnStatus={saveReturnStatus}
          archivedStudents={archivedStudents}
          archiveReason={archiveReason}
          setArchiveReason={setArchiveReason}
          showArchived={showArchived}
          setShowArchived={setShowArchived}
          onArchiveStudent={archiveStudent}
          onRestoreStudent={restoreStudent}
          onUploadMedicationPhoto={uploadMedicationPhoto}
          onViewMedicationPhoto={viewMedicationPhoto}
          photoMessage={photoMessage}
          importCsv={importCsv}
          setImportCsv={setImportCsv}
          importPreview={importPreview}
          importMessage={importMessage}
          onPreviewImport={previewImport}
          onCommitImport={commitImport}
        />
      )}

      <section className="panel camp-search-placeholder" aria-label="Future camp quick search">
        <p className="eyebrow">Future Camp Quick Search</p>
        <h3 className="section-title">Placeholder only</h3>
        <p className="muted">Future concept for searching approved camp records. No AI calls, external sending, OCR, sync, or autonomous action is wired in this workflow.</p>
      </section>
    </div>
  );
}

function TeamAssignments({ students, teams, canEdit, onSave }: { students: CampVisibleStudent[]; teams: CampOverviewPayload["teams"]; canEdit: boolean; onSave: (studentId: string, teamId: string, vehicleId: string) => Promise<void> }) {
  return (
    <section className="panel" aria-labelledby="camp-teams">
      <p className="eyebrow">Teams</p>
      <h3 id="camp-teams" className="section-title">Team assignments</h3>
      <div className="camp-list">
        {students.map((student) => (
          <div className="camp-list-row" key={student.id}>
            <div><strong>{student.name}</strong><p className="muted">{student.teamName ?? "No team"}</p></div>
            {canEdit ? <select className="input camp-inline-select" value={student.teamId} onChange={(event) => void onSave(student.id, event.target.value, student.vehicleId)}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function VehicleAssignments({ students, vehicles, canEdit, onSave }: { students: CampVisibleStudent[]; vehicles: CampOverviewPayload["vehicles"]; canEdit: boolean; onSave: (studentId: string, teamId: string, vehicleId: string) => Promise<void> }) {
  return (
    <section className="panel" aria-labelledby="camp-transportation">
      <p className="eyebrow">Car Roster / Transportation</p>
      <h3 id="camp-transportation" className="section-title">Vehicle rosters</h3>
      <div className="camp-list">
        {vehicles.map((vehicle) => {
          const riders = students.filter((student) => student.vehicleId === vehicle.id);
          return (
            <div className="camp-list-row align-start" key={vehicle.id}>
              <div>
                <strong>{vehicle.name}</strong>
                <p className="muted">{vehicle.driver} - {vehicle.departureWindow} - {riders.length}/{vehicle.capacity}</p>
                <p className="camp-mini-list">{riders.map((rider) => rider.name).join(", ") || "No visible riders for this access view."}</p>
              </div>
            </div>
          );
        })}
        {canEdit ? students.map((student) => (
          <div className="camp-list-row" key={`vehicle-${student.id}`}>
            <div><strong>{student.name}</strong><p className="muted">{student.vehicleName}</p></div>
            <select className="input camp-inline-select" value={student.vehicleId} onChange={(event) => void onSave(student.id, student.teamId ?? "", event.target.value)}>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select>
          </div>
        )) : null}
      </div>
    </section>
  );
}

function SchedulePanel({ accessRole, schedule }: { accessRole: CampAccessRole; schedule: CampOverviewPayload["schedule"] }) {
  return (
    <section className="panel" aria-labelledby="camp-schedule">
      <p className="eyebrow">Schedule</p>
      <h3 id="camp-schedule" className="section-title">Critical timeline</h3>
      <div className="camp-list">
        {schedule.filter((item) => accessRole !== "driver" || item.audience === "All Camp").map((item) => (
          <div className="camp-list-row align-start" key={item.id}>
            <time className="camp-time">{item.day}<br />{item.time}</time>
            <div><strong>{item.title}</strong><p className="muted">{item.location} - {item.audience}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DocumentsPanel({ documents }: { documents: CampOverviewPayload["documents"] }) {
  return (
    <section className="panel" aria-labelledby="camp-documents">
      <p className="eyebrow">Documents</p>
      <h3 id="camp-documents" className="section-title">Leader packets</h3>
      <div className="camp-list">
        {documents.map((doc) => (
          <div className="camp-list-row" key={doc.id}>
            <div><strong>{doc.title}</strong><p className="muted">{doc.owner} - {doc.audience}</p></div>
            <span className={statusClass(doc.status)}>{doc.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RestrictedCampTools(props: {
  accessRole: CampAccessRole;
  overview: CampOverviewPayload;
  restrictedState: RestrictedState | null;
  restrictedLoading: boolean;
  restrictedError: string | null;
  medicalForm: CampRestrictedMedicalRecord;
  setMedicalForm: React.Dispatch<React.SetStateAction<CampRestrictedMedicalRecord>>;
  medicationForm: MedicationForm;
  setMedicationForm: React.Dispatch<React.SetStateAction<MedicationForm>>;
  intakeForm: IntakeForm;
  setIntakeForm: React.Dispatch<React.SetStateAction<IntakeForm>>;
  scheduleForm: ScheduleForm;
  setScheduleForm: React.Dispatch<React.SetStateAction<ScheduleForm>>;
  administrationForm: AdministrationForm;
  setAdministrationForm: React.Dispatch<React.SetStateAction<AdministrationForm>>;
  onSaveMedical: () => Promise<void>;
  onSaveMedication: () => Promise<void>;
  onSaveMedicationIntake: () => Promise<void>;
  onSaveSchedule: () => Promise<void>;
  onSaveAdministrationLog: () => Promise<void>;
  onSaveReturnStatus: (id: string, status: CampMedicationReturnItem["returnStatus"]) => Promise<void>;
  archivedStudents: CampStudentPublic[];
  archiveReason: string;
  setArchiveReason: React.Dispatch<React.SetStateAction<string>>;
  showArchived: boolean;
  setShowArchived: React.Dispatch<React.SetStateAction<boolean>>;
  onArchiveStudent: () => Promise<void>;
  onRestoreStudent: (studentId: string) => Promise<void>;
  onUploadMedicationPhoto: (record: CampMedicationRecord, file: File | null) => Promise<void>;
  onViewMedicationPhoto: (record: CampMedicationRecord) => Promise<void>;
  photoMessage: string;
  importCsv: string;
  setImportCsv: React.Dispatch<React.SetStateAction<string>>;
  importPreview: CampRegistrationImportPreview | null;
  importMessage: string;
  onPreviewImport: () => Promise<void>;
  onCommitImport: () => Promise<void>;
}) {
  const medication = props.restrictedState?.medication;

  if (props.restrictedLoading) return <section className="panel"><p className="muted">Loading restricted tools...</p></section>;
  if (props.restrictedError) return <section className="panel"><p className="camp-error">{props.restrictedError}</p></section>;

  return (
    <>
      <section className="panel camp-restricted-panel" aria-labelledby="camp-medical">
        <div className="camp-section-header"><div><p className="eyebrow">Restricted Medical Info</p><h3 id="camp-medical" className="section-title">Medical binder lookup</h3></div><span className="camp-status ready">Restricted Access</span></div>
        <div className="camp-medical-grid">
          {props.restrictedState?.medical.map((record) => (
            <button className="camp-secure-card camp-secure-button" key={record.studentId} type="button" onClick={() => props.setMedicalForm(record)}>
              <strong>{record.studentName}</strong><span className={statusClass(record.medicalFormStatus)}>{record.medicalFormStatus}</span><p>{record.restrictedNotes}</p><p className="muted">{record.allergyNotes}</p><p className="muted">{record.insuranceStatus}</p><p className="muted">{record.parentMedicalNotes}</p>
            </button>
          ))}
        </div>
        <div className="camp-form-grid camp-form-spaced">
          <label className="field"><span>Student</span><select className="input" value={props.medicalForm.studentId} onChange={(event) => props.setMedicalForm((current) => ({ ...current, studentId: event.target.value }))}>{props.overview.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
          <label className="field"><span>Form Status</span><select className="input" value={props.medicalForm.medicalFormStatus} onChange={(event) => props.setMedicalForm((current) => ({ ...current, medicalFormStatus: event.target.value as CampRestrictedMedicalRecord["medicalFormStatus"] }))}><option>Received</option><option>Needs Parent Clarification</option></select></label>
          <label className="field camp-wide-field"><span>Restricted Notes</span><textarea className="input" rows={2} value={props.medicalForm.restrictedNotes} onChange={(event) => props.setMedicalForm((current) => ({ ...current, restrictedNotes: event.target.value }))} /></label>
          <label className="field"><span>Allergy Notes</span><textarea className="input" rows={2} value={props.medicalForm.allergyNotes} onChange={(event) => props.setMedicalForm((current) => ({ ...current, allergyNotes: event.target.value }))} /></label>
          <label className="field"><span>Insurance Status</span><input className="input" value={props.medicalForm.insuranceStatus} onChange={(event) => props.setMedicalForm((current) => ({ ...current, insuranceStatus: event.target.value }))} /></label>
          <label className="field camp-wide-field"><span>Parent Medical Notes</span><textarea className="input" rows={2} value={props.medicalForm.parentMedicalNotes} onChange={(event) => props.setMedicalForm((current) => ({ ...current, parentMedicalNotes: event.target.value }))} /></label>
        </div>
        <button className="button primary" type="button" onClick={() => void props.onSaveMedical()}>Save restricted medical record</button>
      </section>

      <section className="panel" aria-labelledby="camp-archived">
        <div className="camp-section-header">
          <div>
            <p className="eyebrow">Archived Campers</p>
            <h3 id="camp-archived" className="section-title">Recordkeeping view</h3>
          </div>
          <button className="button compact-button" type="button" onClick={() => props.setShowArchived((current) => !current)}>
            {props.showArchived ? "Hide archived" : "Include archived"}
          </button>
        </div>
        {props.showArchived ? (
          <div className="camp-list">
            {props.archivedStudents.length ? props.archivedStudents.map((student) => (
              <div className="camp-list-row align-start" key={student.id}>
                <div>
                  <strong>{student.name}</strong>
                  <p className="muted">Archived {student.archivedAt ? new Date(student.archivedAt).toLocaleString() : "for recordkeeping"}. {student.archiveReason || "No archive reason recorded."}</p>
                </div>
                <button className="button" type="button" onClick={() => void props.onRestoreStudent(student.id)}>Restore Camper</button>
              </div>
            )) : <p className="muted">No archived campers.</p>}
          </div>
        ) : (
          <p className="muted">Archived campers are hidden from active roster, assignment, and medication workflows by default.</p>
        )}
      </section>

      <div className="camp-grid camp-medication-sections">
        <section className="panel" aria-labelledby="camp-import">
          <p className="eyebrow">Registration Import</p><h3 id="camp-import" className="section-title">Preview spreadsheet rows</h3>
          <label className="field camp-wide-field"><span>CSV rows</span><textarea className="input" rows={5} value={props.importCsv} onChange={(event) => props.setImportCsv(event.target.value)} placeholder="Student Name,Grade,Team,Vehicle,Cabin,Medication Name,Medication Instructions" /></label>
          <div className="toolbar">
            <button className="button" type="button" onClick={() => void props.onPreviewImport()}>Preview import</button>
            <button className="button primary" type="button" disabled={!props.importPreview || props.importPreview.summary.blockedRows > 0} onClick={() => void props.onCommitImport()}>Save reviewed import</button>
          </div>
          {props.importMessage ? <p className="camp-save-message" role="status">{props.importMessage}</p> : null}
          {props.importPreview ? (
            <div className="camp-list camp-form-spaced">
              <div className="camp-list-row"><strong>{props.importPreview.summary.totalRows} rows</strong><span className="camp-status">{props.importPreview.summary.readyRows} ready</span><span className="camp-status warn">{props.importPreview.summary.clarificationRows} needs clarification</span></div>
              {props.importPreview.rows.slice(0, 6).map((row) => (
                <div className="camp-list-row align-start" key={`${row.rowNumber}-${row.camper.name}`}>
                  <div><strong>Row {row.rowNumber}: {row.camper.name}</strong><p className="muted">{row.warnings.join(" ") || "Ready to save after review."}</p></div>
                  <span className={statusClass(row.status)}>{row.status}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel" aria-labelledby="med-intake">
          <p className="eyebrow">Medication Intake / Parent Handoff</p>
          <h3 id="med-intake" className="section-title">Drop-off intake</h3>
          <div className="camp-form-grid camp-form-spaced">
            <label className="field"><span>Student</span><select className="input" value={props.intakeForm.studentId} onChange={(event) => props.setIntakeForm((current) => ({ ...current, studentId: event.target.value }))}>{props.overview.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
            <label className="field"><span>Existing Medication</span><select className="input" value={props.intakeForm.medicationRecordId ?? ""} onChange={(event) => {
              const record = (medication?.checkIn ?? []).find((item) => item.id === event.target.value);
              props.setIntakeForm((current) => ({
                ...current,
                medicationRecordId: event.target.value,
                studentId: record?.studentId ?? current.studentId,
                medicationName: record?.medicationName ?? current.medicationName,
                parentInstructions: record?.parentProvidedInstructions ?? current.parentInstructions,
                clarificationStatus: record?.clarificationStatus ?? current.clarificationStatus
              }));
            }}><option value="">New intake record</option>{(medication?.checkIn ?? []).map((record) => <option key={record.id} value={record.id}>{record.studentName} - {record.medicationName}</option>)}</select></label>
            <label className="field"><span>Medication Name / Type</span><input className="input" value={props.intakeForm.medicationName} onChange={(event) => props.setIntakeForm((current) => ({ ...current, medicationName: event.target.value }))} /></label>
            <label className="field"><span>Dose</span><input className="input" value={props.intakeForm.dose} onChange={(event) => props.setIntakeForm((current) => ({ ...current, dose: event.target.value }))} placeholder="Parent-provided label text" /></label>
            <label className="field"><span>Schedule / When Given</span><input className="input" value={props.intakeForm.scheduleText} onChange={(event) => props.setIntakeForm((current) => ({ ...current, scheduleText: event.target.value }))} /></label>
            <label className="field"><span>Quantity Received</span><input className="input" value={props.intakeForm.quantityReceived} onChange={(event) => props.setIntakeForm((current) => ({ ...current, quantityReceived: event.target.value }))} /></label>
            <label className="field"><span>Container Status</span><input className="input" value={props.intakeForm.containerStatus} onChange={(event) => props.setIntakeForm((current) => ({ ...current, containerStatus: event.target.value }))} placeholder="Original bottle, bagged, label readable..." /></label>
            <label className="field"><span>Received By</span><input className="input" value={props.intakeForm.receivedByName} onChange={(event) => props.setIntakeForm((current) => ({ ...current, receivedByName: event.target.value }))} /></label>
            <label className="field"><span>Received At</span><input className="input" type="datetime-local" value={props.intakeForm.receivedAt ?? ""} onChange={(event) => props.setIntakeForm((current) => ({ ...current, receivedAt: event.target.value }))} /></label>
            <label className="field"><span>Clarification</span><select className="input" value={props.intakeForm.clarificationStatus ?? "Clear"} onChange={(event) => props.setIntakeForm((current) => ({ ...current, clarificationStatus: event.target.value as CampMedicationIntakeInput["clarificationStatus"] }))}><option>Clear</option><option>Needs Parent Clarification</option></select></label>
            <label className="field"><span>Guardian Printed Name</span><input className="input" value={props.intakeForm.guardianName} onChange={(event) => props.setIntakeForm((current) => ({ ...current, guardianName: event.target.value }))} /></label>
            <label className="field"><span>Guardian Relationship</span><input className="input" value={props.intakeForm.guardianRelationship} onChange={(event) => props.setIntakeForm((current) => ({ ...current, guardianRelationship: event.target.value }))} /></label>
            <label className="field camp-wide-field"><span>Parent-Provided Instructions</span><textarea className="input" rows={2} value={props.intakeForm.parentInstructions} onChange={(event) => props.setIntakeForm((current) => ({ ...current, parentInstructions: event.target.value }))} /></label>
            <label className="field camp-wide-field"><span>Staff Notes</span><textarea className="input" rows={2} value={props.intakeForm.staffNotes} onChange={(event) => props.setIntakeForm((current) => ({ ...current, staffNotes: event.target.value }))} placeholder="Logging only. No dosage interpretation." /></label>
            <label className="field camp-wide-field"><span>Correction Note</span><input className="input" value={props.intakeForm.correctionNote ?? ""} onChange={(event) => props.setIntakeForm((current) => ({ ...current, correctionNote: event.target.value }))} placeholder="Use when this intake corrects a prior handoff record." /></label>
          </div>
          <SignaturePad value={props.intakeForm.guardianSignatureData} onChange={(signature) => props.setIntakeForm((current) => ({ ...current, guardianSignatureData: signature }))} />
          <label className="camp-confirm-row"><input type="checkbox" checked={props.intakeForm.confirmationAcknowledged} onChange={(event) => props.setIntakeForm((current) => ({ ...current, confirmationAcknowledged: event.target.checked }))} /><span>I confirm this reflects the medication and instructions provided by the parent/guardian at drop-off.</span></label>
          <button className="button primary" type="button" disabled={!props.intakeForm.confirmationAcknowledged || !hasSignature(props.intakeForm.guardianSignatureData)} onClick={() => void props.onSaveMedicationIntake()}>Save medication intake</button>
          <div className="camp-list camp-form-spaced">
            {(medication?.intakeHistory ?? []).map((item) => <div className="camp-list-row align-start" key={item.id}><div><strong>{item.studentName} - {item.medicationName}</strong><p className="muted">{item.quantityReceived || "Quantity not recorded"} received {new Date(item.receivedAt).toLocaleString()} by {item.receivedByName}. Guardian: {item.guardianName} ({item.guardianRelationship || "relationship not recorded"}).</p><p className="muted">{item.dose ? `Dose: ${item.dose}. ` : ""}{item.scheduleText ? `When: ${item.scheduleText}. ` : ""}{item.staffNotes}</p></div><span className={statusClass(item.clarificationStatus)}>{item.clarificationStatus}</span></div>)}
          </div>
        </section>

        <section className="panel" aria-labelledby="med-check-in">
          <p className="eyebrow">Medication Check-In</p><h3 id="med-check-in" className="section-title">Check-in workflow</h3>
          <MedicationRows
            records={medication?.checkIn ?? []}
            onEdit={(record) => props.setMedicationForm({ id: record.id, studentId: record.studentId, medicationName: record.medicationName, medicinePhotoStatus: record.medicinePhotoStatus, parentProvidedInstructions: record.parentProvidedInstructions, checkInStatus: record.checkInStatus, clarificationStatus: record.clarificationStatus })}
            onUploadPhoto={props.onUploadMedicationPhoto}
            onViewPhoto={props.onViewMedicationPhoto}
          />
          {props.photoMessage ? <p className="camp-save-message" role="status">{props.photoMessage}</p> : null}
          <div className="camp-form-grid camp-form-spaced">
            <label className="field"><span>Student</span><select className="input" value={props.medicationForm.studentId} onChange={(event) => props.setMedicationForm((current) => ({ ...current, studentId: event.target.value }))}>{props.overview.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
            <label className="field"><span>Medication Label</span><input className="input" value={props.medicationForm.medicationName} onChange={(event) => props.setMedicationForm((current) => ({ ...current, medicationName: event.target.value }))} /></label>
            <label className="field"><span>Photo</span><select className="input" value={props.medicationForm.medicinePhotoStatus} onChange={(event) => props.setMedicationForm((current) => ({ ...current, medicinePhotoStatus: event.target.value as CampMedicationRecord["medicinePhotoStatus"] }))}><option>Photo Needed</option><option>Photo On File</option></select></label>
            <label className="field"><span>Check-In Status</span><select className="input" value={props.medicationForm.checkInStatus} onChange={(event) => props.setMedicationForm((current) => ({ ...current, checkInStatus: event.target.value as CampMedicationRecord["checkInStatus"] }))}><option>Not Checked In</option><option>Checked In</option><option>Needs Parent Clarification</option></select></label>
            <label className="field"><span>Clarification</span><select className="input" value={props.medicationForm.clarificationStatus} onChange={(event) => props.setMedicationForm((current) => ({ ...current, clarificationStatus: event.target.value as CampMedicationRecord["clarificationStatus"] }))}><option>Clear</option><option>Needs Parent Clarification</option></select></label>
            <label className="field camp-wide-field"><span>Parent-Provided Instructions</span><textarea className="input" rows={2} value={props.medicationForm.parentProvidedInstructions} onChange={(event) => props.setMedicationForm((current) => ({ ...current, parentProvidedInstructions: event.target.value }))} /></label>
          </div>
          <button className="button primary" type="button" onClick={() => void props.onSaveMedication()}>Save medication check-in</button>
        </section>

        <section className="panel" aria-labelledby="med-schedule">
          <p className="eyebrow">Medication Schedule</p><h3 id="med-schedule" className="section-title">Schedule workflow</h3>
          <MedicationScheduleRows items={medication?.schedule ?? []} />
          <div className="camp-form-grid camp-form-spaced">
            <label className="field"><span>Medication</span><select className="input" value={props.scheduleForm.medicationRecordId} onChange={(event) => props.setScheduleForm((current) => ({ ...current, medicationRecordId: event.target.value }))}>{(medication?.checkIn ?? []).map((record) => <option key={record.id} value={record.id}>{record.studentName} - {record.medicationName}</option>)}</select></label>
            <label className="field"><span>Time Window</span><input className="input" value={props.scheduleForm.timeWindow} onChange={(event) => props.setScheduleForm((current) => ({ ...current, timeWindow: event.target.value }))} /></label>
            <label className="field"><span>Status</span><select className="input" value={props.scheduleForm.status} onChange={(event) => props.setScheduleForm((current) => ({ ...current, status: event.target.value as CampMedicationScheduleItem["status"] }))}><option>Pending</option><option>Logged</option><option>Needs Parent Clarification</option></select></label>
            <label className="field camp-wide-field"><span>Parent Instructions</span><textarea className="input" rows={2} value={props.scheduleForm.parentProvidedInstructions} onChange={(event) => props.setScheduleForm((current) => ({ ...current, parentProvidedInstructions: event.target.value }))} /></label>
          </div>
          <button className="button primary" type="button" onClick={() => void props.onSaveSchedule()}>Add schedule item</button>
        </section>

        <section className="panel" aria-labelledby="med-log">
          <p className="eyebrow">Medication Administration Log</p><h3 id="med-log" className="section-title">Administration log</h3>
          <div className="camp-form-grid">
            <label className="field"><span>Schedule Item</span><select className="input" value={props.administrationForm.scheduleItemId} onChange={(event) => props.setAdministrationForm((current) => ({ ...current, scheduleItemId: event.target.value }))}>{(medication?.schedule ?? []).map((item) => <option key={item.id} value={item.id}>{item.studentName} - {item.timeWindow}</option>)}</select></label>
            <label className="field"><span>Logged By</span><input className="input" value={props.administrationForm.loggedBy} onChange={(event) => props.setAdministrationForm((current) => ({ ...current, loggedBy: event.target.value }))} /></label>
            <label className="field"><span>Status</span><select className="input" value={props.administrationForm.status} onChange={(event) => props.setAdministrationForm((current) => ({ ...current, status: event.target.value as CampMedicationAdministrationLog["status"] }))}><option>Logged</option><option>Skipped</option><option>Needs Parent Clarification</option></select></label>
            <label className="field camp-wide-field"><span>Notes</span><textarea className="input" rows={2} value={props.administrationForm.notes} onChange={(event) => props.setAdministrationForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Logging only. No dosage interpretation." /></label>
          </div>
          <button className="button primary" type="button" onClick={() => void props.onSaveAdministrationLog()}>Save log entry</button>
          <div className="camp-list camp-form-spaced">
            {(medication?.administrationLog ?? []).map((log) => <div className="camp-list-row align-start" key={log.id}><div><strong>{log.studentName} - {log.timeWindow}</strong><p className="muted">{new Date(log.loggedAt).toLocaleString()} by {log.loggedBy}. {log.notes}</p></div><span className={statusClass(log.status)}>{log.status}</span></div>)}
          </div>
        </section>

        <section className="panel" aria-labelledby="med-return">
          <p className="eyebrow">Medication Return Checklist</p><h3 id="med-return" className="section-title">Return tracking</h3>
          <div className="camp-list">
            {(medication?.returnChecklist ?? []).map((item) => (
              <div className="camp-list-row" key={item.id}>
                <div><strong>{item.studentName}</strong><p className="muted">{item.returnedAt ? `Returned ${new Date(item.returnedAt).toLocaleString()} by ${item.returnedBy}` : "Return parent-provided medication to parent or authorized guardian."}</p></div>
                <select className="input camp-inline-select" value={item.returnStatus} onChange={(event) => void props.onSaveReturnStatus(item.id, event.target.value as CampMedicationReturnItem["returnStatus"])}><option>Pending Return</option><option>Returned to Parent</option><option>Needs Parent Clarification</option></select>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function MedicationRows({
  records,
  onEdit,
  onUploadPhoto,
  onViewPhoto
}: {
  records: CampMedicationRecord[];
  onEdit: (record: CampMedicationRecord) => void;
  onUploadPhoto: (record: CampMedicationRecord, file: File | null) => Promise<void>;
  onViewPhoto: (record: CampMedicationRecord) => Promise<void>;
}) {
  return (
    <div className="camp-list">
      {records.map((record) => (
        <div className="camp-list-row align-start" key={record.id}>
          <div className="camp-medicine-photo"><span>{record.medicinePhotoStatus}</span></div>
          <div>
            <strong>{record.studentName}</strong>
            <p className="muted">{record.medicationName} - {record.parentProvidedInstructions}</p>
            {record.latestQuantityReceived ? <p className="muted">Quantity received: {record.latestQuantityReceived}</p> : null}
            <div className="camp-photo-actions">
              <label className="button compact-button">
                <span>Take Medication Photo</span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => void onUploadPhoto(record, event.target.files?.[0] ?? null)}
                />
              </label>
              <label className="button compact-button">
                <span>Choose From Photo Library</span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) => void onUploadPhoto(record, event.target.files?.[0] ?? null)}
                />
              </label>
              {record.hasMedicationPhoto || record.medicinePhotoStatus === "Photo On File" ? (
                <button className="button compact-button" type="button" onClick={() => void onViewPhoto(record)}>View Photo</button>
              ) : null}
            </div>
          </div>
          <div className="camp-row-actions">
            <span className={statusClass(record.checkInStatus)}>{record.checkInStatus}</span>
            <button className="button compact-button" type="button" onClick={() => onEdit(record)}>Edit Medication</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MedicationScheduleRows({ items }: { items: CampMedicationScheduleItem[] }) {
  return <div className="camp-list">{items.map((item) => <div className="camp-list-row align-start" key={item.id}><div><strong>{item.studentName} - {item.timeWindow}</strong><p className="muted">{item.parentProvidedInstructions}{item.lastLoggedAt ? ` Last logged ${new Date(item.lastLoggedAt).toLocaleString()} by ${item.lastLoggedBy}.` : ""}</p></div><span className={statusClass(item.status)}>{item.status}</span></div>)}</div>;
}

function SignaturePad({ value, onChange }: { value: CampMedicationIntakeInput["guardianSignatureData"]; onChange: (signature: CampMedicationIntakeInput["guardianSignatureData"]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const signatureRef = useRef(value);
  const lastPointerEventAtRef = useRef(0);

  const drawSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";

    for (const stroke of value.strokes) {
      if (stroke.length < 2) continue;
      context.beginPath();
      context.moveTo(stroke[0].x, stroke[0].y);
      for (const point of stroke.slice(1)) {
        context.lineTo(point.x, point.y);
      }
      context.stroke();
    }
  }, [value]);

  useEffect(() => {
    signatureRef.current = value;
    drawSignature();
  }, [drawSignature, value]);

  function pointForClient(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(((clientX - rect.left) / rect.width) * value.width * 10) / 10,
      y: Math.round(((clientY - rect.top) / rect.height) * value.height * 10) / 10
    };
  }

  function addSignaturePoint(canvas: HTMLCanvasElement, clientX: number, clientY: number, startsStroke: boolean) {
    const point = pointForClient(canvas, clientX, clientY);
    if (startsStroke) {
      const nextSignature = { ...signatureRef.current, strokes: [...signatureRef.current.strokes, [point]] };
      signatureRef.current = nextSignature;
      onChange(nextSignature);
      return;
    }

    const currentSignature = signatureRef.current;
    const strokes = currentSignature.strokes.map((stroke, index) => index === currentSignature.strokes.length - 1 ? [...stroke, point] : stroke);
    const nextSignature = { ...currentSignature, strokes };
    signatureRef.current = nextSignature;
    onChange(nextSignature);
  }

  function beginSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    lastPointerEventAtRef.current = Date.now();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    addSignaturePoint(event.currentTarget, event.clientX, event.clientY, true);
  }

  function extendSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    lastPointerEventAtRef.current = Date.now();
    if (!drawingRef.current) return;
    addSignaturePoint(event.currentTarget, event.clientX, event.clientY, false);
  }

  function endSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    lastPointerEventAtRef.current = Date.now();
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function beginMouseSignature(event: React.MouseEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    addSignaturePoint(event.currentTarget, event.clientX, event.clientY, true);
  }

  function extendMouseSignature(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    addSignaturePoint(event.currentTarget, event.clientX, event.clientY, false);
  }

  function endMouseSignature() {
    drawingRef.current = false;
  }

  return (
    <div className="camp-signature-block">
      <div className="camp-section-header">
        <div><p className="eyebrow">Guardian Signature</p><p className="muted">Finger, stylus, or mouse signature captured as restricted handoff data.</p></div>
        <button className="button" type="button" onClick={() => onChange(emptySignatureData())}>Clear signature</button>
      </div>
      <canvas
        aria-label="Parent or guardian signature"
        className="camp-signature-pad"
        height={value.height}
        onMouseDown={beginMouseSignature}
        onMouseLeave={endMouseSignature}
        onMouseMove={extendMouseSignature}
        onMouseUp={endMouseSignature}
        onPointerCancel={endSignature}
        onPointerDown={beginSignature}
        onPointerLeave={endSignature}
        onPointerMove={extendSignature}
        onPointerUp={endSignature}
        ref={canvasRef}
        width={value.width}
      />
    </div>
  );
}
