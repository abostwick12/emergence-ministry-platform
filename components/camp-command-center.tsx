"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  supersedesMedicationRecordId?: string;
  correctionNote?: string;
  studentId: string;
  medicationName: string;
  medicinePhotoStatus: CampMedicationRecord["medicinePhotoStatus"];
  parentProvidedInstructions: string;
  checkInStatus: CampMedicationRecord["checkInStatus"];
  clarificationStatus: CampMedicationRecord["clarificationStatus"];
};
type ScheduleForm = {
  id?: string;
  supersedesScheduleItemId?: string;
  correctionNote?: string;
  medicationRecordId: string;
  timeWindow: string;
  parentProvidedInstructions: string;
  status: CampMedicationScheduleItem["status"];
};
type AdministrationForm = {
  supersedesAdministrationLogId?: string;
  correctionNote?: string;
  scheduleItemId: string;
  loggedBy: string;
  status: CampMedicationAdministrationLog["status"];
  notes: string;
};
type ReturnForm = {
  id: string;
  returnStatus: CampMedicationReturnItem["returnStatus"];
  returnedBy: string;
  returnedAt: string;
  recipientName: string;
  recipientRelationship: string;
  returnNotes: string;
  supersedesReturnItemId?: string;
  correctionNote?: string;
};
type IntakeForm = Omit<CampMedicationIntakeInput, "guardianSignatureData" | "confirmationAcknowledged"> & {
  guardianSignatureData: CampMedicationIntakeInput["guardianSignatureData"];
  confirmationAcknowledged: boolean;
};
type MedicationPhotoThumbnailState = {
  status: "loading" | "ready" | "unavailable";
  url?: string;
};
type CampSaveAction =
  | "student"
  | "archive"
  | "restore"
  | "assignment"
  | "medical"
  | "medication"
  | "intake"
  | "photo"
  | "schedule"
  | "administration"
  | "return"
  | "void"
  | "importPreview"
  | "importCommit";
type CampActionStatus = {
  action: CampSaveAction;
  tone: "saving" | "success" | "error";
  message: string;
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

async function errorMessageFromResponse(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  const cleanFallback = fallback.replace(/[.\s]+$/, "");
  return body?.error ? `${cleanFallback}: ${body.error}` : fallback;
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
  const [actionStatus, setActionStatus] = useState<CampActionStatus | null>(null);
  const [activeAction, setActiveAction] = useState<CampSaveAction | null>(null);
  const [archivedStudents, setArchivedStudents] = useState<CampStudentPublic[]>([]);
  const [archiveReason, setArchiveReason] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [medicationPhotoThumbnails, setMedicationPhotoThumbnails] = useState<Record<string, MedicationPhotoThumbnailState>>({});
  const [photoModal, setPhotoModal] = useState<{ url: string; title: string } | null>(null);
  const [intakePhotoFile, setIntakePhotoFile] = useState<File | null>(null);
  const [intakePhotoPreviewUrl, setIntakePhotoPreviewUrl] = useState("");
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
  const [returnForm, setReturnForm] = useState<ReturnForm | null>(null);

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

  useEffect(() => {
    setSaveMessage("");
    setActionStatus(null);
    setActiveAction(null);
    setPhotoMessage("");
    setIntakePhotoFile(null);
  }, [accessRole]);

  const setActionMessage = useCallback((action: CampSaveAction, tone: CampActionStatus["tone"], message: string) => {
    setActionStatus({ action, tone, message });
    setSaveMessage(message);
  }, []);

  const beginAction = useCallback((action: CampSaveAction, message: string) => {
    setActiveAction(action);
    setActionMessage(action, "saving", message);
  }, [setActionMessage]);

  const completeAction = useCallback((action: CampSaveAction, message = "Saved") => {
    setActionMessage(action, "success", message);
    setActiveAction(null);
  }, [setActionMessage]);

  const failAction = useCallback((action: CampSaveAction, message = "Save failed - try again") => {
    setActionMessage(action, "error", message);
    setActiveAction(null);
  }, [setActionMessage]);

  const isActionActive = useCallback((action: CampSaveAction) => activeAction === action, [activeAction]);

  useEffect(() => {
    if (!intakePhotoFile) {
      setIntakePhotoPreviewUrl("");
      return;
    }

    const previewUrl = URL.createObjectURL(intakePhotoFile);
    setIntakePhotoPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [intakePhotoFile]);

  const fetchMedicationPhotoThumbnail = useCallback(async (record: CampMedicationRecord): Promise<MedicationPhotoThumbnailState> => {
    try {
      const response = await fetch(`/api/camp/medication/photos?role=${accessRole}&medicationRecordId=${encodeURIComponent(record.id)}`, { cache: "no-store" });
      if (!response.ok) {
        console.info("Medication photo thumbnail unavailable.", { medicationRecordId: record.id, status: response.status });
        return { status: "unavailable" };
      }
      const payload = (await response.json()) as { signedUrl?: string };
      if (!payload.signedUrl) {
        console.info("Medication photo thumbnail unavailable.", { medicationRecordId: record.id, status: "missing-signed-url" });
        return { status: "unavailable" };
      }
      return { status: "ready", url: payload.signedUrl };
    } catch {
      console.info("Medication photo thumbnail unavailable.", { medicationRecordId: record.id, status: "request-failed" });
      return { status: "unavailable" };
    }
  }, [accessRole]);

  useEffect(() => {
    if (!canSeeRestrictedMedical || !restrictedState?.medication.checkIn.length) {
      setMedicationPhotoThumbnails({});
      return;
    }

    let cancelled = false;
    const records = restrictedState.medication.checkIn.filter((record) => record.hasMedicationPhoto);
    const expectedIds = new Set(records.map((record) => record.id));
    setMedicationPhotoThumbnails((current) => {
      const next: Record<string, MedicationPhotoThumbnailState> = {};
      for (const record of records) {
        next[record.id] = current[record.id]?.status === "unavailable" ? current[record.id] : { status: "loading" };
      }
      return next;
    });

    async function loadMedicationPhotoThumbnails() {
      const entries = await Promise.all(records.map(async (record) => [record.id, await fetchMedicationPhotoThumbnail(record)] as const));
      if (!cancelled) {
        setMedicationPhotoThumbnails(Object.fromEntries(entries.filter(([id]) => expectedIds.has(id))));
      }
    }

    void loadMedicationPhotoThumbnails();
    return () => {
      cancelled = true;
    };
  }, [canSeeRestrictedMedical, fetchMedicationPhotoThumbnail, restrictedState?.medication.checkIn]);

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
    if (activeAction) return;
    if (!studentForm.name.trim()) {
      failAction("student", "Save failed - camper name is required.");
      return;
    }
    beginAction("student", studentForm.id ? "Saving camper updates..." : "Adding camper...");
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
    if (!response.ok) {
      failAction("student", await errorMessageFromResponse(response, "Camper could not be saved."));
      return;
    }
    beginAction("student", "Updating active camper list...");
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
    completeAction("student", "Camper saved.");
  }

  async function archiveStudent() {
    if (activeAction || !studentForm.id) return;
    const confirmed = window.confirm("Archived campers are removed from active Camp views but retained for recordkeeping.");
    if (!confirmed) return;

    beginAction("archive", "Archiving camper...");
    const response = await fetch(`/api/camp/students?role=${accessRole}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", studentId: studentForm.id, archiveReason })
    });
    if (!response.ok) {
      failAction("archive", await errorMessageFromResponse(response, "Camper could not be archived."));
      return;
    }
    beginAction("archive", "Refreshing active and archived camper lists...");
    if (response.ok) {
      setStudentForm({ name: "", grade: "", teamId: overview.teams[0]?.id ?? "", vehicleId: overview.vehicles[0]?.id ?? "", cabin: "", limitedSafetyFlags: [], limitedSafetyFlagsText: "" });
      setArchiveReason("");
      await loadOverview();
      await loadRestrictedData();
      await loadArchivedStudents();
    }
    completeAction("archive", "Camper archived.");
  }

  async function restoreStudent(studentId: string) {
    if (activeAction) return;
    beginAction("restore", "Restoring camper...");
    const response = await fetch(`/api/camp/students?role=${accessRole}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", studentId })
    });
    if (!response.ok) {
      failAction("restore", await errorMessageFromResponse(response, "Camper could not be restored."));
      return;
    }
    beginAction("restore", "Refreshing camper lists...");
    if (response.ok) {
      await loadOverview();
      await loadRestrictedData();
      await loadArchivedStudents();
    }
    completeAction("restore", "Camper restored.");
  }

  async function saveAssignment(studentId: string, teamId: string, vehicleId: string) {
    if (activeAction) return;
    beginAction("assignment", "Saving assignment...");
    const response = await fetch(`/api/camp/students?role=${accessRole}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentOnly: true, studentId, teamId, vehicleId })
    });
    if (!response.ok) {
      failAction("assignment", await errorMessageFromResponse(response, "Assignment could not be updated."));
      return;
    }
    beginAction("assignment", "Refreshing assignment list...");
    await loadOverview();
    completeAction("assignment", "Assignment updated.");
  }

  async function saveMedicalRecord() {
    if (activeAction) return;
    if (!medicalForm.studentId) {
      failAction("medical", "Save failed - choose a student first.");
      return;
    }
    beginAction("medical", "Saving restricted medical record...");
    const response = await fetch(`/api/camp/restricted-medical?role=${accessRole}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(medicalForm)
    });
    if (!response.ok) {
      failAction("medical", await errorMessageFromResponse(response, "Restricted medical record could not be saved."));
      return;
    }
    beginAction("medical", "Updating restricted medical view...");
    if (response.ok) {
      await loadOverview();
      await loadRestrictedData();
    }
    completeAction("medical", "Restricted medical record saved.");
  }

  async function saveMedicationRecord() {
    if (activeAction) return;
    if (!medicationForm.studentId) {
      failAction("medication", "Save failed - choose a student first.");
      return;
    }
    beginAction("medication", "Saving medication check-in...");
    const response = await fetch(`/api/camp/medication?role=${accessRole}`, {
      method: medicationForm.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(medicationForm)
    });
    if (!response.ok) {
      failAction("medication", await errorMessageFromResponse(response, "Medication check-in could not be saved."));
      return;
    }
    beginAction("medication", "Updating active medication list...");
    await loadOverview();
    await loadRestrictedData();
    clearMedicationForm();
    completeAction("medication", "Medication check-in saved.");
  }

  async function saveMedicationIntake() {
    if (activeAction) return;
    beginAction("intake", "Validating details...");
    if (!intakeForm.studentId || !intakeForm.medicationName.trim() || !intakeForm.guardianName.trim()) {
      failAction("intake", "Save failed - student, medication name, and guardian name are required.");
      return;
    }
    if (!hasSignature(intakeForm.guardianSignatureData) || !intakeForm.confirmationAcknowledged) {
      failAction("intake", "Save failed - guardian signature and confirmation are required.");
      return;
    }
    beginAction("intake", "Saving medication intake...");
    const response = await fetch(`/api/camp/medication?role=${accessRole}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "intake",
        ...intakeForm,
        receivedAt: intakeForm.receivedAt ? new Date(intakeForm.receivedAt).toISOString() : undefined
      })
    });
    if (!response.ok) {
      failAction("intake", await errorMessageFromResponse(response, "Medication intake could not be saved."));
      return;
    }

    const payload = (await response.json()) as { record?: CampMedicationRecord };
    if (intakePhotoFile && payload.record?.id) {
      beginAction("photo", "Uploading container photo...");
      const formData = new FormData();
      formData.set("medicationRecordId", payload.record.id);
      formData.set("photo", intakePhotoFile);
      const photoResponse = await fetch(`/api/camp/medication/photos?role=${accessRole}`, {
        method: "POST",
        body: formData
      });
      if (!photoResponse.ok) {
        const message = await errorMessageFromResponse(photoResponse, "Medication intake saved, but photo upload failed. Nothing was sent again.");
        setPhotoMessage(message);
        failAction("photo", message);
        return;
      }
      setPhotoMessage("Photo on file.");
    } else {
      setPhotoMessage("Medication intake saved without a medication photo.");
    }
    beginAction("intake", "Updating active medication list...");
    await loadOverview();
    await loadRestrictedData();
    setIntakePhotoFile(null);
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
    completeAction("intake", intakePhotoFile ? "Medication intake saved. Photo on file." : "Medication intake saved.");
  }

  function selectIntakePhoto(file: File | null) {
    if (!file) {
      setPhotoMessage("Medication photo capture cancelled. Intake can still be saved without a photo.");
      return;
    }
    setIntakePhotoFile(file);
    setPhotoMessage("Medication photo selected. It will save with this parent handoff.");
  }

  function removeIntakePhoto() {
    setIntakePhotoFile(null);
    setPhotoMessage("Medication photo removed. Intake can still be saved without a photo.");
  }

  function clearMedicationForm() {
    setMedicationForm({
      studentId: overview.students[0]?.id ?? "",
      medicationName: "",
      medicinePhotoStatus: "Photo Needed",
      parentProvidedInstructions: "",
      checkInStatus: "Not Checked In",
      clarificationStatus: "Clear"
    });
  }

  function clearScheduleForm() {
    setScheduleForm({
      medicationRecordId: restrictedState?.medication.checkIn[0]?.id ?? "",
      timeWindow: "",
      parentProvidedInstructions: "",
      status: "Pending"
    });
  }

  function clearAdministrationForm() {
    setAdministrationForm({
      scheduleItemId: restrictedState?.medication.schedule[0]?.id ?? "",
      loggedBy: campAccessLabels[accessRole],
      status: "Logged",
      notes: ""
    });
  }

  function clearIntakeForm() {
    setIntakePhotoFile(null);
    setIntakeForm((current) => ({
      ...current,
      medicationRecordId: restrictedState?.medication.checkIn[0]?.id ?? "",
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

  function correctIntake(item: CampMedicationIntakeRecord) {
    setIntakePhotoFile(null);
    setIntakeForm({
      studentId: item.studentId,
      medicationRecordId: item.medicationRecordId ?? "",
      medicationName: item.medicationName,
      dose: item.dose,
      scheduleText: item.scheduleText,
      parentInstructions: item.parentInstructions,
      staffNotes: item.staffNotes,
      quantityReceived: item.quantityReceived,
      containerStatus: item.containerStatus,
      receivedByName: campAccessLabels[accessRole],
      receivedAt: new Date().toISOString().slice(0, 16),
      guardianName: item.guardianName,
      guardianRelationship: item.guardianRelationship,
      guardianSignatureData: item.guardianSignatureData,
      clarificationStatus: item.clarificationStatus,
      confirmationAcknowledged: false,
      supersedesIntakeId: item.id,
      correctionNote: `Correction for intake ${new Date(item.receivedAt).toLocaleString()}`
    });
    setSaveMessage(`Editing medication intake for ${item.studentName} - saving creates a correction record.`);
  }

  function correctMedication(record: CampMedicationRecord) {
    setMedicationForm({
      id: undefined,
      supersedesMedicationRecordId: record.id,
      correctionNote: `Correction for ${record.medicationName}`,
      studentId: record.studentId,
      medicationName: record.medicationName,
      medicinePhotoStatus: "Photo Needed",
      parentProvidedInstructions: record.parentProvidedInstructions,
      checkInStatus: record.checkInStatus,
      clarificationStatus: record.clarificationStatus
    });
    setSaveMessage(`Editing medication for ${record.studentName} - saving creates a correction record.`);
  }

  function correctSchedule(item: CampMedicationScheduleItem) {
    setScheduleForm({
      id: undefined,
      supersedesScheduleItemId: item.id,
      correctionNote: `Correction for ${item.studentName} ${item.timeWindow}`,
      medicationRecordId: item.medicationRecordId,
      timeWindow: item.timeWindow,
      parentProvidedInstructions: item.parentProvidedInstructions,
      status: item.status
    });
    setSaveMessage(`Editing schedule item for ${item.studentName} - saving creates a correction record.`);
  }

  function correctAdministrationLog(log: CampMedicationAdministrationLog) {
    setAdministrationForm({
      supersedesAdministrationLogId: log.id,
      correctionNote: `Correction for log ${new Date(log.loggedAt).toLocaleString()}`,
      scheduleItemId: log.scheduleItemId ?? restrictedState?.medication.schedule[0]?.id ?? "",
      loggedBy: campAccessLabels[accessRole],
      status: log.status,
      notes: log.notes
    });
    setSaveMessage(`Correcting administration log for ${log.studentName} - saving creates a correction record.`);
  }

  function correctReturnItem(item: CampMedicationReturnItem) {
    setReturnForm({
      id: item.id,
      returnStatus: item.returnStatus,
      returnedBy: item.returnedBy ?? campAccessLabels[accessRole],
      returnedAt: item.returnedAt ? item.returnedAt.slice(0, 16) : new Date().toISOString().slice(0, 16),
      recipientName: item.recipientName ?? "",
      recipientRelationship: item.recipientRelationship ?? "",
      returnNotes: item.returnNotes ?? "",
      supersedesReturnItemId: item.id,
      correctionNote: `Correction for return item ${item.studentName}`
    });
  }

  async function voidWorkflowItem(target: "intake" | "medication" | "schedule" | "administrationLog" | "return", id: string) {
    if (activeAction) return;
    const voidReason = window.prompt("Void reason is required. This keeps the record in restricted audit history.");
    if (!voidReason?.trim()) return;
    const confirmed = window.confirm("Void this record? It will be hidden from active operational views but retained for restricted audit history.");
    if (!confirmed) return;
    beginAction("void", "Voiding record...");
    const response = await fetch(`/api/camp/medication?role=${accessRole}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "void", voidTarget: target, id, voidReason, voidedByName: campAccessLabels[accessRole] })
    });
    if (!response.ok) {
      failAction("void", await errorMessageFromResponse(response, "Record could not be voided."));
      return;
    }
    beginAction("void", "Updating active medication list...");
    await loadOverview();
    await loadRestrictedData();
    completeAction("void", "Record voided and retained in restricted audit history.");
  }

  async function saveScheduleItem() {
    if (activeAction) return;
    if (!scheduleForm.medicationRecordId || !scheduleForm.timeWindow.trim()) {
      failAction("schedule", "Save failed - medication and time window are required.");
      return;
    }
    beginAction("schedule", "Saving medication schedule...");
    const response = await fetch(`/api/camp/medication?role=${accessRole}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "schedule", ...scheduleForm })
    });
    if (!response.ok) {
      failAction("schedule", await errorMessageFromResponse(response, "Medication schedule could not be saved."));
      return;
    }
    beginAction("schedule", "Updating medication schedule...");
    await loadRestrictedData();
    clearScheduleForm();
    completeAction("schedule", "Medication schedule saved.");
  }

  async function saveAdministrationLog() {
    if (activeAction) return;
    if (!administrationForm.scheduleItemId) {
      failAction("administration", "Save failed - choose a schedule item first.");
      return;
    }
    beginAction("administration", "Recording medication administration...");
    const response = await fetch(`/api/camp/medication?role=${accessRole}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "administrationLog", ...administrationForm })
    });
    if (!response.ok) {
      failAction("administration", await errorMessageFromResponse(response, "Administration log could not be saved."));
      return;
    }
    beginAction("administration", "Updating administration log...");
    await loadRestrictedData();
    clearAdministrationForm();
    completeAction("administration", "Administration log saved.");
  }

  async function saveReturnForm() {
    if (activeAction || !returnForm) return;
    beginAction("return", "Recording parent handoff...");
    const response = await fetch(`/api/camp/medication?role=${accessRole}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "return",
        ...returnForm,
        returnedAt: returnForm.returnedAt ? new Date(returnForm.returnedAt).toISOString() : undefined
      })
    });
    if (!response.ok) {
      failAction("return", await errorMessageFromResponse(response, "Return checklist could not be updated."));
      return;
    }
    beginAction("return", "Updating return checklist...");
    setReturnForm(null);
    await loadRestrictedData();
    completeAction("return", "Return checklist updated.");
  }

  async function viewMedicationPhoto(record: CampMedicationRecord) {
    const thumbnail = medicationPhotoThumbnails[record.id];
    const result = thumbnail?.status === "ready" && thumbnail.url ? thumbnail : await fetchMedicationPhotoThumbnail(record);
    if (result.status !== "ready" || !result.url) {
      setMedicationPhotoThumbnails((current) => ({ ...current, [record.id]: { status: "unavailable" } }));
      setPhotoMessage("Medication photo could not be opened.");
      return;
    }
    setMedicationPhotoThumbnails((current) => ({ ...current, [record.id]: result }));
    setPhotoModal({ url: result.url, title: `${record.studentName} - ${record.medicationName}` });
  }

  async function retryMedicationPhoto(record: CampMedicationRecord) {
    if (activeAction) return;
    beginAction("photo", "Loading medication photo...");
    setMedicationPhotoThumbnails((current) => ({ ...current, [record.id]: { status: "loading" } }));
    const result = await fetchMedicationPhotoThumbnail(record);
    setMedicationPhotoThumbnails((current) => ({ ...current, [record.id]: result }));
    if (result.status !== "ready") {
      const message = "Medication photo is unavailable. Try again from a restricted account.";
      setPhotoMessage(message);
      failAction("photo", message);
      return;
    }
    completeAction("photo", "Medication photo ready.");
  }

  async function previewImport() {
    if (activeAction) return;
    beginAction("importPreview", "Validating import rows...");
    const response = await fetch(`/api/camp/import?role=${accessRole}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", csv: importCsv })
    });
    if (!response.ok) {
      const message = await errorMessageFromResponse(response, "Import preview could not be created.");
      setImportMessage(message);
      failAction("importPreview", message);
      return;
    }
    const payload = (await response.json()) as { preview: CampRegistrationImportPreview };
    setImportPreview(payload.preview);
    const message = "Import preview ready. Review before saving.";
    setImportMessage(message);
    completeAction("importPreview", message);
  }

  async function commitImport() {
    if (activeAction || !importPreview) return;
    beginAction("importCommit", "Saving reviewed import...");
    const response = await fetch(`/api/camp/import?role=${accessRole}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "commit", preview: importPreview })
    });
    if (!response.ok) {
      const message = await errorMessageFromResponse(response, "Import could not be saved.");
      setImportMessage(message);
      failAction("importCommit", message);
      return;
    }
    beginAction("importCommit", "Updating roster and restricted records...");
    setImportCsv("");
    setImportPreview(null);
    await loadOverview();
    await loadRestrictedData();
    setImportMessage("Import saved.");
    completeAction("importCommit", "Import saved.");
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
          <p className="eyebrow">Access Preview</p>
          <h3 className="section-title">Dev/admin access preview</h3>
          <p className="muted">This switcher previews server-filtered access. Restricted medical and medication tools only load for Andrew, Jaci, and Joel.</p>
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

      {saveMessage ? <p className={`camp-save-message ${actionStatus?.tone === "error" ? "error" : actionStatus?.tone === "success" ? "success" : ""}`} role="status">{saveMessage}</p> : null}

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
            <button className="button primary" type="button" disabled={isActionActive("student")} onClick={() => void saveStudent()}>{isActionActive("student") ? "Saving camper..." : studentForm.id ? "Save camper" : "Add camper"}</button>
            {studentForm.id ? <button className="button" type="button" onClick={() => setStudentForm({ name: "", grade: "", teamId: overview.teams[0]?.id ?? "", vehicleId: overview.vehicles[0]?.id ?? "", cabin: "", limitedSafetyFlags: [], limitedSafetyFlagsText: "" })}>Clear form</button> : null}
          </div>
          {canSeeRestrictedMedical && studentForm.id ? (
            <div className="camp-archive-box">
              <label className="field camp-wide-field">
                <span>Archive reason</span>
                <input className="input" value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder="Optional recordkeeping note" />
              </label>
              <button className="button danger" type="button" disabled={isActionActive("archive")} onClick={() => void archiveStudent()}>{isActionActive("archive") ? "Archiving..." : "Archive Camper"}</button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="camp-grid">
        <TeamAssignments students={overview.students} teams={overview.teams} canEdit={canEditRoster} isSaving={isActionActive("assignment")} onSave={saveAssignment} />
        <VehicleAssignments students={overview.students} vehicles={overview.vehicles} canEdit={canEditRoster} isSaving={isActionActive("assignment")} onSave={saveAssignment} />
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
          returnForm={returnForm}
          setReturnForm={setReturnForm}
          onSaveReturn={saveReturnForm}
          onCorrectIntake={correctIntake}
          onCorrectMedication={correctMedication}
          onCorrectSchedule={correctSchedule}
          onCorrectAdministrationLog={correctAdministrationLog}
          onCorrectReturn={correctReturnItem}
          onVoidWorkflowItem={voidWorkflowItem}
          onClearMedicationForm={clearMedicationForm}
          onClearScheduleForm={clearScheduleForm}
          onClearAdministrationForm={clearAdministrationForm}
          onClearIntakeForm={clearIntakeForm}
          archivedStudents={archivedStudents}
          archiveReason={archiveReason}
          setArchiveReason={setArchiveReason}
          showArchived={showArchived}
          setShowArchived={setShowArchived}
          onArchiveStudent={archiveStudent}
          onRestoreStudent={restoreStudent}
          onViewMedicationPhoto={viewMedicationPhoto}
          medicationPhotoThumbnails={medicationPhotoThumbnails}
          intakePhotoFile={intakePhotoFile}
          intakePhotoPreviewUrl={intakePhotoPreviewUrl}
          onSelectIntakePhoto={selectIntakePhoto}
          onRemoveIntakePhoto={removeIntakePhoto}
          onRetryMedicationPhoto={retryMedicationPhoto}
          photoMessage={photoMessage}
          importCsv={importCsv}
          setImportCsv={setImportCsv}
          importPreview={importPreview}
          importMessage={importMessage}
          activeAction={activeAction}
          actionStatus={actionStatus}
          onPreviewImport={previewImport}
          onCommitImport={commitImport}
        />
      )}

      {photoModal && typeof document !== "undefined" ? createPortal(
        <div className="camp-photo-modal" role="dialog" aria-modal="true" aria-label="Medication photo preview">
          <div className="camp-photo-modal-panel">
            <div className="camp-section-header">
              <div>
                <p className="eyebrow">Restricted Photo</p>
                <h3 className="section-title">{photoModal.title}</h3>
              </div>
              <button className="button compact-button" type="button" onClick={() => setPhotoModal(null)}>Close</button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoModal.url} alt={`Restricted medication photo for ${photoModal.title}`} />
          </div>
        </div>,
        document.body
      ) : null}

      <section className="panel camp-search-placeholder" aria-label="Future camp quick search">
        <p className="eyebrow">Future Camp Quick Search</p>
        <h3 className="section-title">Placeholder only</h3>
        <p className="muted">Future concept for searching approved camp records. No AI calls, external sending, OCR, sync, or autonomous action is wired in this workflow.</p>
      </section>
    </div>
  );
}

function TeamAssignments({ students, teams, canEdit, isSaving, onSave }: { students: CampVisibleStudent[]; teams: CampOverviewPayload["teams"]; canEdit: boolean; isSaving: boolean; onSave: (studentId: string, teamId: string, vehicleId: string) => Promise<void> }) {
  return (
    <section className="panel" aria-labelledby="camp-teams">
      <p className="eyebrow">Teams</p>
      <h3 id="camp-teams" className="section-title">Team assignments</h3>
      <div className="camp-list">
        {students.map((student) => (
          <div className="camp-list-row" key={student.id}>
            <div><strong>{student.name}</strong><p className="muted">{student.teamName ?? "No team"}</p></div>
            {canEdit ? <select className="input camp-inline-select" value={student.teamId} disabled={isSaving} onChange={(event) => void onSave(student.id, event.target.value, student.vehicleId)}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function VehicleAssignments({ students, vehicles, canEdit, isSaving, onSave }: { students: CampVisibleStudent[]; vehicles: CampOverviewPayload["vehicles"]; canEdit: boolean; isSaving: boolean; onSave: (studentId: string, teamId: string, vehicleId: string) => Promise<void> }) {
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
            <select className="input camp-inline-select" value={student.vehicleId} disabled={isSaving} onChange={(event) => void onSave(student.id, student.teamId ?? "", event.target.value)}>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select>
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
  returnForm: ReturnForm | null;
  setReturnForm: React.Dispatch<React.SetStateAction<ReturnForm | null>>;
  onSaveReturn: () => Promise<void>;
  onCorrectIntake: (item: CampMedicationIntakeRecord) => void;
  onCorrectMedication: (record: CampMedicationRecord) => void;
  onCorrectSchedule: (item: CampMedicationScheduleItem) => void;
  onCorrectAdministrationLog: (log: CampMedicationAdministrationLog) => void;
  onCorrectReturn: (item: CampMedicationReturnItem) => void;
  onVoidWorkflowItem: (target: "intake" | "medication" | "schedule" | "administrationLog" | "return", id: string) => Promise<void>;
  onClearMedicationForm: () => void;
  onClearScheduleForm: () => void;
  onClearAdministrationForm: () => void;
  onClearIntakeForm: () => void;
  archivedStudents: CampStudentPublic[];
  archiveReason: string;
  setArchiveReason: React.Dispatch<React.SetStateAction<string>>;
  showArchived: boolean;
  setShowArchived: React.Dispatch<React.SetStateAction<boolean>>;
  onArchiveStudent: () => Promise<void>;
  onRestoreStudent: (studentId: string) => Promise<void>;
  onViewMedicationPhoto: (record: CampMedicationRecord) => Promise<void>;
  medicationPhotoThumbnails: Record<string, MedicationPhotoThumbnailState>;
  intakePhotoFile: File | null;
  intakePhotoPreviewUrl: string;
  onSelectIntakePhoto: (file: File | null) => void;
  onRemoveIntakePhoto: () => void;
  onRetryMedicationPhoto: (record: CampMedicationRecord) => Promise<void>;
  photoMessage: string;
  importCsv: string;
  setImportCsv: React.Dispatch<React.SetStateAction<string>>;
  importPreview: CampRegistrationImportPreview | null;
  importMessage: string;
  activeAction: CampSaveAction | null;
  actionStatus: CampActionStatus | null;
  onPreviewImport: () => Promise<void>;
  onCommitImport: () => Promise<void>;
}) {
  const medication = props.restrictedState?.medication;
  const isSaving = (action: CampSaveAction) => props.activeAction === action;

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
        <ActionStatusMessage status={props.actionStatus} action="medical" />
        <button className="button primary" type="button" disabled={isSaving("medical")} onClick={() => void props.onSaveMedical()}>{isSaving("medical") ? "Saving restricted record..." : "Save restricted medical record"}</button>
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
                <button className="button" type="button" disabled={isSaving("restore")} onClick={() => void props.onRestoreStudent(student.id)}>{isSaving("restore") ? "Restoring..." : "Restore Camper"}</button>
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
            <button className="button" type="button" disabled={isSaving("importPreview") || isSaving("importCommit")} onClick={() => void props.onPreviewImport()}>{isSaving("importPreview") ? "Validating..." : "Preview import"}</button>
            <button className="button primary" type="button" disabled={!props.importPreview || props.importPreview.summary.blockedRows > 0 || isSaving("importCommit")} onClick={() => void props.onCommitImport()}>{isSaving("importCommit") ? "Saving import..." : "Save reviewed import"}</button>
          </div>
          <ActionStatusMessage status={props.actionStatus} action={props.actionStatus?.action === "importCommit" ? "importCommit" : "importPreview"} />
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
          <section className="camp-intake-photo-section" aria-labelledby="intake-medication-photo">
            <div>
              <p className="eyebrow">Medication / Container Photo</p>
              <h4 id="intake-medication-photo">Medication / Container Photo</h4>
              <p className="muted">Optional but recommended for medication labels, containers, inhalers, EpiPens, liquids, and pill organizers.</p>
            </div>
            <div className="camp-photo-actions">
              <label className="button primary compact-button">
                <span>Take Medication Photo</span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => props.onSelectIntakePhoto(event.target.files?.[0] ?? null)}
                />
              </label>
              <label className="button compact-button">
                <span>Choose From Photo Library</span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) => props.onSelectIntakePhoto(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            {props.intakePhotoPreviewUrl ? (
              <div className="camp-photo-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={props.intakePhotoPreviewUrl} alt="Selected medication or container preview" />
                <div className="camp-photo-preview-actions">
                  <span className="camp-status ready">{props.intakePhotoFile?.name ? `Photo selected: ${props.intakePhotoFile.name}` : "Photo selected"}</span>
                  <button className="button compact-button" type="button" onClick={props.onRemoveIntakePhoto}>Remove</button>
                  <label className="button compact-button">
                    <span>Retake</span>
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => props.onSelectIntakePhoto(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>
            ) : null}
            {props.photoMessage ? <p className="camp-save-message" role="status">{props.photoMessage}</p> : null}
          </section>
          <SignaturePad value={props.intakeForm.guardianSignatureData} onChange={(signature) => props.setIntakeForm((current) => ({ ...current, guardianSignatureData: signature }))} />
          <label className="camp-confirm-row"><input type="checkbox" checked={props.intakeForm.confirmationAcknowledged} onChange={(event) => props.setIntakeForm((current) => ({ ...current, confirmationAcknowledged: event.target.checked }))} /><span>I confirm this reflects the medication and instructions provided by the parent/guardian at drop-off.</span></label>
          {props.intakeForm.supersedesIntakeId ? <p className="camp-save-message" role="status">Saving will create a correction record and preserve the prior intake in restricted audit history.</p> : null}
          <ActionStatusMessage status={props.actionStatus} action={props.actionStatus?.action === "photo" ? "photo" : "intake"} />
          <div className="camp-form-actions">
            <button className="button primary" type="button" disabled={!props.intakeForm.confirmationAcknowledged || !hasSignature(props.intakeForm.guardianSignatureData) || isSaving("intake") || isSaving("photo")} onClick={() => void props.onSaveMedicationIntake()}>{isSaving("intake") || isSaving("photo") ? "Saving intake..." : "Save medication intake"}</button>
            <button className="button" type="button" disabled={isSaving("intake") || isSaving("photo")} onClick={props.onClearIntakeForm}>Clear intake form</button>
          </div>
          <div className="camp-list camp-form-spaced">
            {(medication?.intakeHistory ?? []).map((item) => {
              const photoRecord = medication?.checkIn.find((record) => record.id === item.medicationRecordId);
              return (
                <div className="camp-list-row align-start" key={item.id}>
                  <div>
                    <strong>{item.studentName} - {item.medicationName}</strong>
                    <p className="muted">{item.quantityReceived || "Quantity not recorded"} received {new Date(item.receivedAt).toLocaleString()} by {item.receivedByName}. Guardian: {item.guardianName} ({item.guardianRelationship || "relationship not recorded"}).</p>
                    <p className="muted">{item.dose ? `Dose: ${item.dose}. ` : ""}{item.scheduleText ? `When: ${item.scheduleText}. ` : ""}{item.staffNotes}</p>
                    {photoRecord?.hasMedicationPhoto || photoRecord?.medicinePhotoStatus === "Photo On File" ? <span className="camp-status ready">Photo on file</span> : null}
                    {item.correctionNote ? <p className="muted">Correction note: {item.correctionNote}</p> : null}
                    {item.voidReason ? <p className="muted">Void reason: {item.voidReason}</p> : null}
                    <div className="camp-row-actions">
                      <button className="button compact-button" type="button" disabled={Boolean(props.activeAction)} onClick={() => props.onCorrectIntake(item)}>Correct Intake</button>
                      {item.auditStatus !== "Voided" ? <button className="button compact-button" type="button" disabled={Boolean(props.activeAction)} onClick={() => void props.onVoidWorkflowItem("intake", item.id)}>Void Intake</button> : null}
                    </div>
                  </div>
                  <div className="camp-row-actions">
                    <span className={statusClass(item.clarificationStatus)}>{item.clarificationStatus}</span>
                    <AuditBadge status={item.auditStatus} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel" aria-labelledby="med-check-in">
          <p className="eyebrow">Medication Check-In</p><h3 id="med-check-in" className="section-title">Check-in workflow</h3>
          <MedicationRows
            records={medication?.checkIn ?? []}
            photoThumbnails={props.medicationPhotoThumbnails}
            onEdit={props.onCorrectMedication}
            onVoid={(record) => props.onVoidWorkflowItem("medication", record.id)}
            onViewPhoto={props.onViewMedicationPhoto}
            onRetryPhoto={props.onRetryMedicationPhoto}
            isBusy={Boolean(props.activeAction)}
          />
          <div className="camp-form-grid camp-form-spaced">
            <label className="field"><span>Student</span><select className="input" value={props.medicationForm.studentId} onChange={(event) => props.setMedicationForm((current) => ({ ...current, studentId: event.target.value }))}>{props.overview.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
            <label className="field"><span>Medication Label</span><input className="input" value={props.medicationForm.medicationName} onChange={(event) => props.setMedicationForm((current) => ({ ...current, medicationName: event.target.value }))} /></label>
            <label className="field"><span>Photo</span><select className="input" value={props.medicationForm.medicinePhotoStatus} onChange={(event) => props.setMedicationForm((current) => ({ ...current, medicinePhotoStatus: event.target.value as CampMedicationRecord["medicinePhotoStatus"] }))}><option>Photo Needed</option><option>Photo On File</option></select></label>
            <label className="field"><span>Check-In Status</span><select className="input" value={props.medicationForm.checkInStatus} onChange={(event) => props.setMedicationForm((current) => ({ ...current, checkInStatus: event.target.value as CampMedicationRecord["checkInStatus"] }))}><option>Not Checked In</option><option>Checked In</option><option>Needs Parent Clarification</option></select></label>
            <label className="field"><span>Clarification</span><select className="input" value={props.medicationForm.clarificationStatus} onChange={(event) => props.setMedicationForm((current) => ({ ...current, clarificationStatus: event.target.value as CampMedicationRecord["clarificationStatus"] }))}><option>Clear</option><option>Needs Parent Clarification</option></select></label>
            <label className="field camp-wide-field"><span>Parent-Provided Instructions</span><textarea className="input" rows={2} value={props.medicationForm.parentProvidedInstructions} onChange={(event) => props.setMedicationForm((current) => ({ ...current, parentProvidedInstructions: event.target.value }))} /></label>
            <label className="field camp-wide-field"><span>Correction Note</span><input className="input" value={props.medicationForm.correctionNote ?? ""} onChange={(event) => props.setMedicationForm((current) => ({ ...current, correctionNote: event.target.value }))} placeholder="Use when this medication check-in corrects a prior row." /></label>
          </div>
          {props.medicationForm.supersedesMedicationRecordId ? <p className="camp-save-message" role="status">Saving will create a corrected medication record and retain the prior row in restricted audit history.</p> : null}
          <ActionStatusMessage status={props.actionStatus} action="medication" />
          <div className="camp-form-actions">
            <button className="button primary" type="button" disabled={isSaving("medication")} onClick={() => void props.onSaveMedication()}>{isSaving("medication") ? "Saving medication..." : props.medicationForm.supersedesMedicationRecordId ? "Save corrected medication" : "Save medication check-in"}</button>
            <button className="button" type="button" disabled={isSaving("medication")} onClick={props.onClearMedicationForm}>Clear medication form</button>
          </div>
        </section>

        <section className="panel" aria-labelledby="med-schedule">
          <p className="eyebrow">Medication Schedule</p><h3 id="med-schedule" className="section-title">Schedule workflow</h3>
          <MedicationScheduleRows items={medication?.schedule ?? []} isBusy={Boolean(props.activeAction)} onCorrect={props.onCorrectSchedule} onVoid={(item) => props.onVoidWorkflowItem("schedule", item.id)} />
          <div className="camp-form-grid camp-form-spaced">
            <label className="field"><span>Medication</span><select className="input" value={props.scheduleForm.medicationRecordId} onChange={(event) => props.setScheduleForm((current) => ({ ...current, medicationRecordId: event.target.value }))}>{(medication?.checkIn ?? []).map((record) => <option key={record.id} value={record.id}>{record.studentName} - {record.medicationName}</option>)}</select></label>
            <label className="field"><span>Time Window</span><input className="input" value={props.scheduleForm.timeWindow} onChange={(event) => props.setScheduleForm((current) => ({ ...current, timeWindow: event.target.value }))} /></label>
            <label className="field"><span>Status</span><select className="input" value={props.scheduleForm.status} onChange={(event) => props.setScheduleForm((current) => ({ ...current, status: event.target.value as CampMedicationScheduleItem["status"] }))}><option>Pending</option><option>Logged</option><option>Needs Parent Clarification</option></select></label>
            <label className="field camp-wide-field"><span>Parent Instructions</span><textarea className="input" rows={2} value={props.scheduleForm.parentProvidedInstructions} onChange={(event) => props.setScheduleForm((current) => ({ ...current, parentProvidedInstructions: event.target.value }))} /></label>
            <label className="field camp-wide-field"><span>Correction Note</span><input className="input" value={props.scheduleForm.correctionNote ?? ""} onChange={(event) => props.setScheduleForm((current) => ({ ...current, correctionNote: event.target.value }))} placeholder="Use when this schedule row corrects a prior row." /></label>
          </div>
          {props.scheduleForm.supersedesScheduleItemId ? <p className="camp-save-message" role="status">Saving will create a corrected schedule row and retain the prior row in restricted audit history.</p> : null}
          <ActionStatusMessage status={props.actionStatus} action="schedule" />
          <div className="camp-form-actions">
            <button className="button primary" type="button" disabled={isSaving("schedule")} onClick={() => void props.onSaveSchedule()}>{isSaving("schedule") ? "Saving schedule..." : props.scheduleForm.supersedesScheduleItemId ? "Save corrected schedule" : "Add schedule item"}</button>
            <button className="button" type="button" disabled={isSaving("schedule")} onClick={props.onClearScheduleForm}>Clear schedule form</button>
          </div>
        </section>

        <section className="panel" aria-labelledby="med-log">
          <p className="eyebrow">Medication Administration Log</p><h3 id="med-log" className="section-title">Administration log</h3>
          <div className="camp-form-grid">
            <label className="field"><span>Schedule Item</span><select className="input" value={props.administrationForm.scheduleItemId} onChange={(event) => props.setAdministrationForm((current) => ({ ...current, scheduleItemId: event.target.value }))}>{(medication?.schedule ?? []).map((item) => <option key={item.id} value={item.id}>{item.studentName} - {item.timeWindow}</option>)}</select></label>
            <label className="field"><span>Logged By</span><input className="input" value={props.administrationForm.loggedBy} onChange={(event) => props.setAdministrationForm((current) => ({ ...current, loggedBy: event.target.value }))} /></label>
            <label className="field"><span>Status</span><select className="input" value={props.administrationForm.status} onChange={(event) => props.setAdministrationForm((current) => ({ ...current, status: event.target.value as CampMedicationAdministrationLog["status"] }))}><option>Logged</option><option>Skipped</option><option>Needs Parent Clarification</option></select></label>
            <label className="field camp-wide-field"><span>Notes</span><textarea className="input" rows={2} value={props.administrationForm.notes} onChange={(event) => props.setAdministrationForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Logging only. No dosage interpretation." /></label>
            <label className="field camp-wide-field"><span>Correction Note</span><input className="input" value={props.administrationForm.correctionNote ?? ""} onChange={(event) => props.setAdministrationForm((current) => ({ ...current, correctionNote: event.target.value }))} placeholder="Use when this log corrects a prior entry." /></label>
          </div>
          {props.administrationForm.supersedesAdministrationLogId ? <p className="camp-save-message" role="status">Saving will create a correction log and preserve the prior entry in restricted audit history.</p> : null}
          <ActionStatusMessage status={props.actionStatus} action="administration" />
          <div className="camp-form-actions">
            <button className="button primary" type="button" disabled={isSaving("administration")} onClick={() => void props.onSaveAdministrationLog()}>{isSaving("administration") ? "Saving log..." : props.administrationForm.supersedesAdministrationLogId ? "Save corrected log" : "Save log entry"}</button>
            <button className="button" type="button" disabled={isSaving("administration")} onClick={props.onClearAdministrationForm}>Clear log form</button>
          </div>
          <div className="camp-list camp-form-spaced">
            {(medication?.administrationLog ?? []).map((log) => (
              <div className="camp-list-row align-start" key={log.id}>
                <div>
                  <strong>{log.studentName} - {log.timeWindow}</strong>
                  <p className="muted">{new Date(log.loggedAt).toLocaleString()} by {log.loggedBy}. {log.notes}</p>
                  {log.correctionNote ? <p className="muted">Correction note: {log.correctionNote}</p> : null}
                  {log.voidReason ? <p className="muted">Void reason: {log.voidReason}</p> : null}
                  <div className="camp-row-actions">
                    <button className="button compact-button" type="button" disabled={Boolean(props.activeAction)} onClick={() => props.onCorrectAdministrationLog(log)}>Correct Log</button>
                    {log.auditStatus !== "Voided" ? <button className="button compact-button" type="button" disabled={Boolean(props.activeAction)} onClick={() => void props.onVoidWorkflowItem("administrationLog", log.id)}>Void Log</button> : null}
                  </div>
                </div>
                <div className="camp-row-actions">
                  <span className={statusClass(log.status)}>{log.status}</span>
                  <AuditBadge status={log.auditStatus} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" aria-labelledby="med-return">
          <p className="eyebrow">Medication Return Checklist</p><h3 id="med-return" className="section-title">Return tracking</h3>
          <div className="camp-list">
            {(medication?.returnChecklist ?? []).map((item) => (
              <div className="camp-list-row align-start" key={item.id}>
                <div>
                  <strong>{item.studentName}</strong>
                  <p className="muted">{item.returnedAt ? `Returned ${new Date(item.returnedAt).toLocaleString()} by ${item.returnedBy || "staff"}` : "Return parent-provided medication to parent or authorized guardian."}</p>
                  {item.recipientName ? <p className="muted">Recipient: {item.recipientName} ({item.recipientRelationship || "relationship not recorded"})</p> : null}
                  {item.returnNotes ? <p className="muted">{item.returnNotes}</p> : null}
                  {item.correctionNote ? <p className="muted">Correction note: {item.correctionNote}</p> : null}
                  {item.voidReason ? <p className="muted">Void reason: {item.voidReason}</p> : null}
                </div>
                <div className="camp-row-actions">
                  <span className={statusClass(item.returnStatus)}>{item.returnStatus}</span>
                  <AuditBadge status={item.auditStatus} />
                  <button className="button compact-button" type="button" disabled={Boolean(props.activeAction)} onClick={() => props.onCorrectReturn(item)}>Update Return</button>
                  {item.auditStatus !== "Voided" ? <button className="button compact-button" type="button" disabled={Boolean(props.activeAction)} onClick={() => void props.onVoidWorkflowItem("return", item.id)}>Void Return</button> : null}
                </div>
              </div>
            ))}
          </div>
          {props.returnForm ? (
            <div className="camp-form-grid camp-form-spaced">
              <label className="field"><span>Return Status</span><select className="input" value={props.returnForm.returnStatus} onChange={(event) => props.setReturnForm((current) => current ? ({ ...current, returnStatus: event.target.value as CampMedicationReturnItem["returnStatus"] }) : current)}><option>Pending Return</option><option>Returned to Parent/Guardian</option><option>Needs Parent Clarification</option><option>Not Returned / Follow-Up Needed</option></select></label>
              <label className="field"><span>Returned By</span><input className="input" value={props.returnForm.returnedBy} onChange={(event) => props.setReturnForm((current) => current ? ({ ...current, returnedBy: event.target.value }) : current)} /></label>
              <label className="field"><span>Returned At</span><input className="input" type="datetime-local" value={props.returnForm.returnedAt} onChange={(event) => props.setReturnForm((current) => current ? ({ ...current, returnedAt: event.target.value }) : current)} /></label>
              <label className="field"><span>Recipient Name</span><input className="input" value={props.returnForm.recipientName} onChange={(event) => props.setReturnForm((current) => current ? ({ ...current, recipientName: event.target.value }) : current)} /></label>
              <label className="field"><span>Recipient Relationship</span><input className="input" value={props.returnForm.recipientRelationship} onChange={(event) => props.setReturnForm((current) => current ? ({ ...current, recipientRelationship: event.target.value }) : current)} /></label>
              <label className="field camp-wide-field"><span>Return Notes</span><textarea className="input" rows={2} value={props.returnForm.returnNotes} onChange={(event) => props.setReturnForm((current) => current ? ({ ...current, returnNotes: event.target.value }) : current)} /></label>
              <label className="field camp-wide-field"><span>Correction Note</span><input className="input" value={props.returnForm.correctionNote ?? ""} onChange={(event) => props.setReturnForm((current) => current ? ({ ...current, correctionNote: event.target.value }) : current)} placeholder="Use when this return record corrects a prior row." /></label>
              <ActionStatusMessage status={props.actionStatus} action="return" />
              <div className="camp-form-actions camp-wide-field">
                <button className="button primary" type="button" disabled={isSaving("return")} onClick={() => void props.onSaveReturn()}>{isSaving("return") ? "Saving return..." : "Save return update"}</button>
                <button className="button" type="button" disabled={isSaving("return")} onClick={() => props.setReturnForm(null)}>Cancel return update</button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}

function MedicationRows({
  records,
  photoThumbnails,
  isBusy,
  onEdit,
  onVoid,
  onViewPhoto,
  onRetryPhoto
}: {
  records: CampMedicationRecord[];
  photoThumbnails: Record<string, MedicationPhotoThumbnailState>;
  isBusy: boolean;
  onEdit: (record: CampMedicationRecord) => void;
  onVoid: (record: CampMedicationRecord) => Promise<void>;
  onViewPhoto: (record: CampMedicationRecord) => Promise<void>;
  onRetryPhoto: (record: CampMedicationRecord) => Promise<void>;
}) {
  return (
    <div className="camp-list">
      {records.map((record) => {
        const photoExpected = Boolean(record.hasMedicationPhoto);
        const thumbnail = photoThumbnails[record.id];
        return (
        <div className="camp-list-row align-start" key={record.id}>
          <MedicationPhotoSquare
            record={record}
            photoExpected={photoExpected}
            thumbnail={thumbnail}
            onViewPhoto={onViewPhoto}
          />
          <div>
            <strong>{record.studentName}</strong>
            <p className="muted">{record.medicationName} - {record.parentProvidedInstructions}</p>
            {record.latestQuantityReceived ? <p className="muted">Quantity received: {record.latestQuantityReceived}</p> : null}
            {record.correctionNote ? <p className="muted">Correction note: {record.correctionNote}</p> : null}
            {record.voidReason ? <p className="muted">Void reason: {record.voidReason}</p> : null}
            <div className="camp-photo-actions">
              <span className="muted">{photoExpected ? "Tap the thumbnail to view the restricted medication photo." : "Photo capture happens during Medication Intake / Parent Handoff."}</span>
              {photoExpected && thumbnail?.status === "unavailable" ? (
                <button className="button compact-button" type="button" disabled={isBusy} onClick={() => void onRetryPhoto(record)}>Retry Photo</button>
              ) : null}
            </div>
          </div>
          <div className="camp-row-actions">
            <span className={statusClass(record.checkInStatus)}>{record.checkInStatus}</span>
            <AuditBadge status={record.auditStatus} />
            <button className="button compact-button" type="button" disabled={isBusy} onClick={() => onEdit(record)}>Correct Medication</button>
            {record.auditStatus !== "Voided" ? <button className="button compact-button" type="button" disabled={isBusy} onClick={() => void onVoid(record)}>Void Medication</button> : null}
          </div>
        </div>
        );
      })}
    </div>
  );
}

function MedicationPhotoSquare({
  record,
  photoExpected,
  thumbnail,
  onViewPhoto
}: {
  record: CampMedicationRecord;
  photoExpected: boolean;
  thumbnail?: MedicationPhotoThumbnailState;
  onViewPhoto: (record: CampMedicationRecord) => Promise<void>;
}) {
  if (thumbnail?.status === "ready" && thumbnail.url) {
    return (
      <button
        className="camp-medicine-photo has-photo"
        type="button"
        disabled={false}
        onClick={() => void onViewPhoto(record)}
        aria-label={`View medication photo for ${record.studentName}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnail.url} alt={`Medication photo for ${record.studentName}`} />
      </button>
    );
  }

  if (photoExpected) {
    return (
      <div className={`camp-medicine-photo ${thumbnail?.status === "unavailable" ? "photo-unavailable" : "photo-loading"}`} aria-label={`Medication photo ${thumbnail?.status === "unavailable" ? "unavailable" : "loading"} for ${record.studentName}`}>
        <span>{thumbnail?.status === "unavailable" ? "Photo unavailable" : "Loading photo"}</span>
      </div>
    );
  }

  return <div className="camp-medicine-photo"><span>{record.medicinePhotoStatus}</span></div>;
}

function MedicationScheduleRows({ items, isBusy, onCorrect, onVoid }: { items: CampMedicationScheduleItem[]; isBusy: boolean; onCorrect: (item: CampMedicationScheduleItem) => void; onVoid: (item: CampMedicationScheduleItem) => Promise<void> }) {
  return (
    <div className="camp-list">
      {items.map((item) => (
        <div className="camp-list-row align-start" key={item.id}>
          <div>
            <strong>{item.studentName} - {item.timeWindow}</strong>
            <p className="muted">{item.parentProvidedInstructions}{item.lastLoggedAt ? ` Last logged ${new Date(item.lastLoggedAt).toLocaleString()} by ${item.lastLoggedBy}.` : ""}</p>
            {item.correctionNote ? <p className="muted">Correction note: {item.correctionNote}</p> : null}
            {item.voidReason ? <p className="muted">Void reason: {item.voidReason}</p> : null}
          </div>
          <div className="camp-row-actions">
            <span className={statusClass(item.status)}>{item.status}</span>
            <AuditBadge status={item.auditStatus} />
            <button className="button compact-button" type="button" disabled={isBusy} onClick={() => onCorrect(item)}>Correct Schedule</button>
            {item.auditStatus !== "Voided" ? <button className="button compact-button" type="button" disabled={isBusy} onClick={() => void onVoid(item)}>Void Schedule</button> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditBadge({ status }: { status?: string }) {
  if (!status || status === "Active") return null;
  return <span className={status === "Voided" ? "camp-status locked" : "camp-status warn"}>{status}</span>;
}

function ActionStatusMessage({ status, action }: { status: CampActionStatus | null; action: CampSaveAction }) {
  if (!status || status.action !== action) return null;
  return <p className={`camp-save-message ${status.tone === "error" ? "error" : status.tone === "success" ? "success" : ""}`} role={status.tone === "error" ? "alert" : "status"}>{status.message}</p>;
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
