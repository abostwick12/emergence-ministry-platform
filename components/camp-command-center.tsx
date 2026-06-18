"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  campAccessLabels,
  campAccessRoles,
  getDefaultCampAccessScope,
  isRestrictedCampMedicalRole
} from "@/lib/camp/access";
import type {
  CampAccessRole,
  CampMedicationAdministrationLog,
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
  CampOverviewPayload,
  CampRegistrationImportPreview,
  CampRestrictedMedicalRecord,
  CampStudentInput,
  CampVisibleStudent
} from "@/lib/camp/types";

type RestrictedState = {
  medical: CampRestrictedMedicalRecord[];
  medication: {
    checkIn: CampMedicationRecord[];
    schedule: CampMedicationScheduleItem[];
    administrationLog: CampMedicationAdministrationLog[];
    returnChecklist: CampMedicationReturnItem[];
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
    } catch (error) {
      setRestrictedState(null);
      setRestrictedError(error instanceof Error ? error.message : "Restricted camp data could not be loaded.");
    } finally {
      setRestrictedLoading(false);
    }
  }, [accessRole, canSeeRestrictedMedical]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadRestrictedData();
  }, [loadRestrictedData]);

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
          scheduleForm={scheduleForm}
          setScheduleForm={setScheduleForm}
          administrationForm={administrationForm}
          setAdministrationForm={setAdministrationForm}
          onSaveMedical={saveMedicalRecord}
          onSaveMedication={saveMedicationRecord}
          onSaveSchedule={saveScheduleItem}
          onSaveAdministrationLog={saveAdministrationLog}
          onSaveReturnStatus={saveReturnStatus}
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
  scheduleForm: ScheduleForm;
  setScheduleForm: React.Dispatch<React.SetStateAction<ScheduleForm>>;
  administrationForm: AdministrationForm;
  setAdministrationForm: React.Dispatch<React.SetStateAction<AdministrationForm>>;
  onSaveMedical: () => Promise<void>;
  onSaveMedication: () => Promise<void>;
  onSaveSchedule: () => Promise<void>;
  onSaveAdministrationLog: () => Promise<void>;
  onSaveReturnStatus: (id: string, status: CampMedicationReturnItem["returnStatus"]) => Promise<void>;
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

        <section className="panel" aria-labelledby="med-check-in">
          <p className="eyebrow">Medication Check-In</p><h3 id="med-check-in" className="section-title">Check-in workflow</h3>
          <MedicationRows records={medication?.checkIn ?? []} onEdit={(record) => props.setMedicationForm({ id: record.id, studentId: record.studentId, medicationName: record.medicationName, medicinePhotoStatus: record.medicinePhotoStatus, parentProvidedInstructions: record.parentProvidedInstructions, checkInStatus: record.checkInStatus, clarificationStatus: record.clarificationStatus })} />
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

function MedicationRows({ records, onEdit }: { records: CampMedicationRecord[]; onEdit: (record: CampMedicationRecord) => void }) {
  return <div className="camp-list">{records.map((record) => <button className="camp-list-row camp-edit-row" key={record.id} type="button" onClick={() => onEdit(record)}><div className="camp-medicine-photo"><span>{record.medicinePhotoStatus}</span></div><div><strong>{record.studentName}</strong><p className="muted">{record.medicationName} - {record.parentProvidedInstructions}</p></div><span className={statusClass(record.checkInStatus)}>{record.checkInStatus}</span></button>)}</div>;
}

function MedicationScheduleRows({ items }: { items: CampMedicationScheduleItem[] }) {
  return <div className="camp-list">{items.map((item) => <div className="camp-list-row align-start" key={item.id}><div><strong>{item.studentName} - {item.timeWindow}</strong><p className="muted">{item.parentProvidedInstructions}{item.lastLoggedAt ? ` Last logged ${new Date(item.lastLoggedAt).toLocaleString()} by ${item.lastLoggedBy}.` : ""}</p></div><span className={statusClass(item.status)}>{item.status}</span></div>)}</div>;
}
