"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CampAccessAdminPanel } from "@/components/camp/camp-access-admin";
import { CampLaunchReadinessPanel } from "@/components/camp/camp-launch-readiness-panel";
import { CampOperationDialog } from "@/components/camp/camp-operation-dialog";
import { useCamp } from "@/components/camp/camp-provider";
import { initialsForName } from "@/components/camp/camp-team-card";
import { CampStatusChip } from "@/components/camp/camp-ui";
import { prepareCampImageFile } from "@/lib/camp/client-image";
import { getMedicineIntakeReturnVisibility } from "@/lib/camp/medication-workflow-visibility";
import type {
  CampDocument,
  CampMedicationAdministrationEvent,
  CampMedicationAdministrationItem,
  CampMedicationAdministrationItemStatus,
  CampMedicationAdministrationLog,
  CampMedicationArchiveInput,
  CampMedicationIntakeRecord,
  CampMedicationIntakeSession,
  CampMedicationIntakeSessionMedicationInput,
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
  CampOakwoodImportPreview,
  CampRegistrationImportPreview,
  CampScheduleBlock,
  CampSignatureData,
  CampStaffInput,
  CampStaffMember,
  CampTeam,
  CampVisibleStudent
} from "@/lib/camp/types";

type MedicationPayload = {
  campers: CampVisibleStudent[];
  checkIn: CampMedicationRecord[];
  schedule: CampMedicationScheduleItem[];
  administrationLog: CampMedicationAdministrationLog[];
  administrationEvents?: CampMedicationAdministrationEvent[];
  administrationItems?: CampMedicationAdministrationItem[];
  returnChecklist: CampMedicationReturnItem[];
  intakeHistory: CampMedicationIntakeRecord[];
  intakeSessions?: CampMedicationIntakeSession[];
  scanEnabled?: boolean;
};

type MedicationState =
  | { status: "idle" | "forbidden" | "loading" }
  | { status: "ready"; data: MedicationPayload }
  | { status: "error"; message: string };

type IntakeDraftMedication = CampMedicationIntakeSessionMedicationInput & {
  clientId: string;
};

type MedicationLabelScanResponse = {
  studentNameOnLabel?: string;
  medicationName?: string;
  dose?: string;
  directions?: string;
  suggestedTimes?: string[];
  quantityReceived?: string;
  instructions?: string;
  rawText?: string;
  confidence: "low" | "medium" | "high";
  warnings: string[];
  error?: string;
  processingPath?: string;
};

type MedicationLabelScanReview = {
  studentNameOnLabel: string;
  medicationName: string;
  dose: string;
  directions: string;
  suggestedTimesText: string;
  quantityReceived: string;
  instructions: string;
};

const MEDICATION_SCAN_WARNING = "AI/OCR may misread medication labels. Verify every field against the original bottle before saving.";
const MEDICATION_SCAN_DISABLED_MESSAGE = "Medication label scanning is disabled.";

function emptyMedicationScanReview(): MedicationLabelScanReview {
  return {
    studentNameOnLabel: "",
    medicationName: "",
    dose: "",
    directions: "",
    suggestedTimesText: "",
    quantityReceived: "",
    instructions: ""
  };
}

function reviewFromMedicationScan(scan: MedicationLabelScanResponse): MedicationLabelScanReview {
  return {
    studentNameOnLabel: scan.studentNameOnLabel ?? "",
    medicationName: scan.medicationName ?? "",
    dose: scan.dose ?? "",
    directions: scan.directions ?? "",
    suggestedTimesText: scan.suggestedTimes?.join(", ") ?? "",
    quantityReceived: scan.quantityReceived ?? "",
    instructions: scan.instructions ?? ""
  };
}

function BackToMore() {
  return (
    <Link href="/camp/more" className="camp-cc-back">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      <span>More</span>
    </Link>
  );
}

function ToolPageShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="camp-cc-page">
      <BackToMore />
      <header className="camp-cc-page-head">
        <h1>{title}</h1>
        <p className="camp-cc-muted">{subtitle}</p>
      </header>
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="camp-cc-muted">{children}</p>;
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone?: "ready" | "warn" | "locked" }) {
  return <CampStatusChip tone={tone}>{children}</CampStatusChip>;
}

function medicationRecordForSchedule(data: MedicationPayload, item?: CampMedicationScheduleItem) {
  if (!item) return undefined;
  return data.checkIn.find((record) => record.id === item.medicationRecordId);
}

function latestIntakeForSchedule(data: MedicationPayload, item?: CampMedicationScheduleItem) {
  if (!item) return undefined;
  return data.intakeHistory.find((record) => record.medicationRecordId === item.medicationRecordId && !record.archivedAt);
}

function medicationDetailsForSchedule(data: MedicationPayload, item?: CampMedicationScheduleItem) {
  const medication = medicationRecordForSchedule(data, item);
  const intake = latestIntakeForSchedule(data, item);
  return {
    medicationName: medication?.medicationName || intake?.medicationName || "Medication name not recorded",
    dose: intake?.dose?.trim() || "Dose not recorded",
    instructions: item?.parentProvidedInstructions || medication?.parentProvidedInstructions || intake?.parentInstructions || "No instructions recorded.",
    staffNotes: intake?.staffNotes?.trim() || ""
  };
}

type MedicationPassItem = {
  schedule: CampMedicationScheduleItem;
  medication: CampMedicationRecord | undefined;
  details: ReturnType<typeof medicationDetailsForSchedule>;
};

type MedicationPassGroup = {
  id: string;
  studentId: string;
  studentName: string;
  timeWindow: string;
  items: MedicationPassItem[];
};

function medicationPassGroups(data: MedicationPayload, scheduleItems: CampMedicationScheduleItem[]): MedicationPassGroup[] {
  const groups = new Map<string, MedicationPassGroup>();
  const openItems = scheduleItems.filter((item) => item.status !== "Logged");
  const sourceItems = openItems.length ? openItems : scheduleItems;
  for (const schedule of sourceItems) {
    const medication = medicationRecordForSchedule(data, schedule);
    if (medication?.isPrn || medication?.scheduleType === "prn") continue;
    const key = `${schedule.studentId}::${schedule.timeWindow.trim().toLowerCase()}`;
    const group = groups.get(key) ?? {
      id: schedule.id,
      studentId: schedule.studentId,
      studentName: schedule.studentName,
      timeWindow: schedule.timeWindow,
      items: []
    };
    group.items.push({ schedule, medication, details: medicationDetailsForSchedule(data, schedule) });
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

function useRestrictedMedicationData(required: "restricted" | "medicalCommand" = "restricted", includeArchived = false): MedicationState {
  const { capabilities } = useCamp();
  const [state, setState] = useState<MedicationState>({ status: "idle" });
  const allowed = required === "medicalCommand" ? capabilities.medicalCommand : capabilities.restrictedMedical;

  useEffect(() => {
    if (!allowed) {
      setState({ status: "forbidden" });
      return;
    }

    let active = true;
    setState({ status: "loading" });
    const url = includeArchived ? "/api/camp/medication?includeArchived=true" : "/api/camp/medication";
    fetch(url, { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 403) {
          setState({ status: "forbidden" });
          return;
        }
        if (!response.ok) {
          setState({ status: "error", message: "Medication workflow data could not be loaded." });
          return;
        }
        setState({ status: "ready", data: (await response.json()) as MedicationPayload });
      })
      .catch(() => active && setState({ status: "error", message: "Medication workflow data could not be loaded." }));

    return () => {
      active = false;
    };
  }, [allowed, includeArchived]);

  return state;
}

function RestrictedNotice({ required }: { required: "restricted" | "medicalCommand" }) {
  return (
    <EmptyState>
      {required === "medicalCommand"
        ? "This page is available only in Andrew Medical Command."
        : "This page is available only to approved restricted Camp staff."}
    </EmptyState>
  );
}

function MedicationDataGate({
  required = "restricted",
  includeArchived = false,
  children
}: {
  required?: "restricted" | "medicalCommand";
  includeArchived?: boolean;
  children: (data: MedicationPayload) => React.ReactNode;
}) {
  const state = useRestrictedMedicationData(required, includeArchived);
  if (state.status === "forbidden") return <RestrictedNotice required={required} />;
  if (state.status === "loading" || state.status === "idle") return <EmptyState>Loading restricted workflow data...</EmptyState>;
  if (state.status === "error") return <p className="camp-cc-error">{state.message}</p>;
  if (state.status === "ready") return <>{children(state.data)}</>;
  return null;
}

function statusTone(status: string): "ready" | "warn" | undefined {
  if (status.includes("Logged") || status.includes("Checked") || status.includes("Returned") || status.includes("Ready")) return "ready";
  if (status.includes("Clarification") || status.includes("Missing") || status.includes("Needed") || status.includes("Pending")) return "warn";
  return undefined;
}

function staffRoleLabel(role: CampStaffMember["role"]): string {
  if (role === "leader") return "Leader";
  if (role === "staff") return "Staff";
  return "Adult volunteer";
}

function emptySignatureData(width = 640, height = 220): CampSignatureData {
  return { width, height, strokes: [] };
}

function hasSignature(signature: CampSignatureData): boolean {
  return signature.strokes.some((stroke) => stroke.length > 1);
}

function serializeStudentAcknowledgement(signature: CampSignatureData): string {
  return `DRAWN_INITIALS:${JSON.stringify(signature)}`;
}

function parseStoredSignatureData(value?: string): CampSignatureData | null {
  if (!value?.trim().toUpperCase().startsWith("DRAWN_INITIALS:")) return null;
  try {
    const parsed = JSON.parse(value.slice(value.indexOf(":") + 1)) as {
      width?: number;
      WIDTH?: number;
      height?: number;
      HEIGHT?: number;
      strokes?: Array<Array<{ x?: number; X?: number; y?: number; Y?: number }>>;
      STROKES?: Array<Array<{ x?: number; X?: number; y?: number; Y?: number }>>;
    };
    const width = parsed.width ?? parsed.WIDTH ?? 640;
    const height = parsed.height ?? parsed.HEIGHT ?? 220;
    const strokes = (parsed.strokes ?? parsed.STROKES ?? []).map((stroke) =>
      stroke.map((point) => ({
        x: point.x ?? point.X ?? 0,
        y: point.y ?? point.Y ?? 0
      }))
    );
    return { width, height, strokes };
  } catch {
    return null;
  }
}

function formatStudentAcknowledgement(log: CampMedicationAdministrationLog): string {
  if (log.studentAcknowledgementUnavailable) return `Unavailable/declined - ${log.studentAcknowledgementUnavailableReason}`;
  if (log.studentAcknowledgementInitials?.toUpperCase().startsWith("DRAWN_INITIALS:")) return "Finger/stylus acknowledgement on file";
  return log.studentAcknowledgementInitials || "Not recorded";
}

const ARCHIVE_HELPER_TEXT = "Archived items are hidden from this view but remain in the medical audit history.";

type MedicationHistoryTarget = CampMedicationArchiveInput["target"];
type MedicationHistoryRecord =
  | CampMedicationAdministrationLog
  | CampMedicationIntakeRecord
  | CampMedicationRecord
  | CampMedicationReturnItem
  | CampMedicationScheduleItem;

function archiveClassName(item: { archivedAt?: string }) {
  return item.archivedAt ? "camp-list-row align-start archived" : "camp-list-row align-start";
}

function archiveStatus(item: { archivedAt?: string; archivedByName?: string; archiveReason?: string }) {
  if (!item.archivedAt) return null;
  return (
    <p className="camp-cc-muted">
      Archived {new Date(item.archivedAt).toLocaleString()} by {item.archivedByName || "restricted staff"}{item.archiveReason ? `: ${item.archiveReason}` : "."}
    </p>
  );
}

async function archiveMedicationHistoryItem(target: MedicationHistoryTarget, id: string, archiveReason: string) {
  const response = await fetch("/api/camp/medication", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: "archive", archiveTarget: target, id, archiveReason })
  });
  const body = await response.json().catch(() => ({})) as { error?: string; item?: Partial<MedicationHistoryRecord> };
  if (!response.ok) throw new Error(body.error ?? "History item could not be archived.");
  return {
    archivedAt: typeof body.item?.archivedAt === "string" ? body.item.archivedAt : new Date().toISOString(),
    archivedByName: typeof body.item?.archivedByName === "string" ? body.item.archivedByName : "Restricted staff",
    archiveReason
  };
}

function SignaturePreview({ value, label }: { value: CampSignatureData; label: string }) {
  return (
    <svg className="camp-signature-pad preview" viewBox={`0 0 ${value.width} ${value.height}`} role="img" aria-label={label}>
      <rect width={value.width} height={value.height} rx="18" aria-hidden="true" />
      <path d={`M ${Math.round(value.width * 0.08)} ${Math.round(value.height * 0.72)} H ${Math.round(value.width * 0.92)}`} aria-hidden="true" />
      {value.strokes.map((stroke, index) => (
        <polyline key={`${index}-${stroke.length}`} points={stroke.map((point) => `${point.x},${point.y}`).join(" ")} />
      ))}
    </svg>
  );
}

function SignaturePad({
  value,
  onChange,
  label,
  description,
  clearLabel = "Clear signature",
  disabled = false
}: {
  value: CampSignatureData;
  onChange: (signature: CampSignatureData) => void;
  label: string;
  description: string;
  clearLabel?: string;
  disabled?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drawingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const signatureRef = useRef(value);

  useEffect(() => {
    signatureRef.current = value;
  }, [value]);

  function pointForEvent(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(value.width, ((event.clientX - rect.left) / rect.width) * value.width)),
      y: Math.max(0, Math.min(value.height, ((event.clientY - rect.top) / rect.height) * value.height))
    };
  }

  function startDrawing(event: React.PointerEvent<SVGSVGElement>) {
    if (disabled) return;
    event.preventDefault();
    drawingRef.current = true;
    activePointerIdRef.current = event.pointerId;
    const nextSignature = { ...signatureRef.current, strokes: [...signatureRef.current.strokes, [pointForEvent(event)]] };
    signatureRef.current = nextSignature;
    onChange(nextSignature);
    if (event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Some mobile browsers do not allow capture on SVG; drawing still works
        // from the initial point and normal pointer move events.
      }
    }
  }

  function draw(event: React.PointerEvent<SVGSVGElement>) {
    if (disabled || !drawingRef.current) return;
    if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return;
    event.preventDefault();
    const current = signatureRef.current;
    const strokes = [...current.strokes];
    const activeStroke = strokes[strokes.length - 1] ?? [];
    strokes[strokes.length - 1] = [...activeStroke, pointForEvent(event)];
    const nextSignature = { ...current, strokes };
    signatureRef.current = nextSignature;
    onChange(nextSignature);
  }

  function stopDrawing(event: React.PointerEvent<SVGSVGElement>) {
    drawingRef.current = false;
    activePointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className={disabled ? "camp-signature-block disabled" : "camp-signature-block"}>
      <div className="camp-signature-head">
        <div>
          <p className="eyebrow">{label}</p>
          <p className="camp-cc-muted">{description}</p>
        </div>
        <button className="button compact-button" type="button" disabled={disabled} onClick={() => onChange(emptySignatureData(value.width, value.height))}>
          {clearLabel}
        </button>
      </div>
      <svg
        ref={svgRef}
        aria-label={label}
        className="camp-signature-pad"
        viewBox={`0 0 ${value.width} ${value.height}`}
        role="img"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={(event) => {
          if (drawingRef.current) stopDrawing(event);
        }}
      >
        <rect width={value.width} height={value.height} rx="18" aria-hidden="true" />
        <path d={`M ${Math.round(value.width * 0.08)} ${Math.round(value.height * 0.72)} H ${Math.round(value.width * 0.92)}`} aria-hidden="true" />
        {value.strokes.map((stroke, index) => (
          <polyline key={`${index}-${stroke.length}`} points={stroke.map((point) => `${point.x},${point.y}`).join(" ")} />
        ))}
      </svg>
    </div>
  );
}

export function CampDocumentsToolPage() {
  const { overview, loading } = useCamp();
  return (
    <ToolPageShell title="Forms & Documents" subtitle="Leader-facing packet status from the Camp data set.">
      {loading && !overview.documents.length ? (
        <EmptyState>Loading documents...</EmptyState>
      ) : overview.documents.length === 0 ? (
        <EmptyState>No Camp documents are on file yet.</EmptyState>
      ) : (
        <div className="camp-list">
          {overview.documents.map((doc: CampDocument) => (
            <div className="camp-list-row align-start" key={doc.id} data-testid={`camp-document-card-${doc.id}`}>
              <div>
                <strong>{doc.title}</strong>
                <p className="camp-cc-muted">Owner: {doc.owner}. Audience: {doc.audience}.</p>
              </div>
              <StatusPill tone={doc.status === "Ready" ? "ready" : "warn"}>{doc.status}</StatusPill>
            </div>
          ))}
        </div>
      )}
    </ToolPageShell>
  );
}

export function CampAnnouncementsToolPage() {
  const { overview } = useCamp();
  const leaderItems = overview.schedule.filter((item) => item.audience === "All Camp" || item.audience === "Leaders").slice(0, 5);
  return (
    <ToolPageShell title="Camp Announcements" subtitle="A focused announcement board is not live yet. Use these schedule signals for leader huddles.">
      {leaderItems.length ? (
        <div className="camp-list">
          {leaderItems.map((item: CampScheduleBlock) => (
            <div className="camp-list-row align-start" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p className="camp-cc-muted">{item.day} at {item.time}{item.location ? ` - ${item.location}` : ""}</p>
              </div>
              <StatusPill>{item.audience}</StatusPill>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>No announcement source is connected yet.</EmptyState>
      )}
    </ToolPageShell>
  );
}

export function CampCheckoutToolPage() {
  const { overview } = useCamp();
  return (
    <ToolPageShell title="Checkout / Return Home" subtitle="Return-home workflow is not split into a live checklist yet. Transportation data is shown for planning.">
      <div className="camp-vehicle-list">
        {overview.vehicles.map((vehicle) => {
          const riders = overview.students.filter((student) => student.vehicleId === vehicle.id);
          return (
            <section key={vehicle.id} className="camp-vehicle-card" aria-label={`${vehicle.name} checkout`}>
              <div className="camp-vehicle-head">
                <strong>{vehicle.name}</strong>
                <span className="camp-cc-muted">{riders.length} visible riders</span>
              </div>
              <p className="camp-cc-muted">Driver: {vehicle.driver || "Unassigned"}</p>
              <p className="camp-cc-muted">Return-home confirmation and parent handoff controls are not live on this page yet.</p>
            </section>
          );
        })}
      </div>
    </ToolPageShell>
  );
}

export function CampAssignmentsToolPage() {
  const { overview, loading } = useCamp();
  const grouped = useMemo(() => {
    const map = new Map<string, CampVisibleStudent[]>();
    for (const student of overview.students) {
      const key = student.teamName ?? "Unassigned team";
      const list = map.get(key) ?? [];
      list.push(student);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [overview.students]);

  return (
    <ToolPageShell title="My Team / My Assignments" subtitle="Assignments visible to your authenticated Camp access.">
      {loading && !overview.students.length ? (
        <EmptyState>Loading assignments...</EmptyState>
      ) : grouped.length === 0 ? (
        <EmptyState>No assignments are visible for this access view.</EmptyState>
      ) : (
        <div className="camp-list">
          {grouped.map(([group, students]) => (
            <div className="camp-list-row align-start" key={group}>
              <div>
                <strong>{group}</strong>
                <p className="camp-cc-muted">{students.map((student) => student.name).join(", ")}</p>
              </div>
              <StatusPill>{students.length}</StatusPill>
            </div>
          ))}
        </div>
      )}
    </ToolPageShell>
  );
}

export function CampSettingsToolPage() {
  const { capabilities } = useCamp();
  return (
    <ToolPageShell title="Camp Settings" subtitle="Camp access and platform settings stay behind admin-only controls.">
      {capabilities.medicalCommand ? (
        <div className="camp-list">
          <Link className="camp-cc-entry" href="/settings">
            <span className="camp-cc-entry-body">
              <strong>Open Platform Settings</strong>
              <span className="camp-cc-muted">Platform-wide settings and EMMA review controls.</span>
            </span>
            <span className="camp-cc-entry-arrow" aria-hidden="true">&gt;</span>
          </Link>
          <Link className="camp-cc-entry" href="/camp/settings/import">
            <span className="camp-cc-entry-body">
              <strong>Import Camp Roster</strong>
              <span className="camp-cc-muted">Approved Oakwood roster/workbook uploads with preview, validation, and explicit commit.</span>
            </span>
            <span className="camp-cc-entry-arrow" aria-hidden="true">&gt;</span>
          </Link>
          <Link className="camp-cc-entry" href="/camp/settings/import?mode=partner">
            <span className="camp-cc-entry-body">
              <strong>Partner Church Upload</strong>
              <span className="camp-cc-muted">Preview partner church camper spreadsheets before adding or updating safe roster fields.</span>
            </span>
            <span className="camp-cc-entry-arrow" aria-hidden="true">&gt;</span>
          </Link>
          <Link className="camp-cc-entry" href="/camp/settings/staff">
            <span className="camp-cc-entry-body">
              <strong>Leader / Staff Details</strong>
              <span className="camp-cc-muted">View imported leaders and edit safe operational assignments.</span>
            </span>
            <span className="camp-cc-entry-arrow" aria-hidden="true">&gt;</span>
          </Link>
          <CampLaunchReadinessPanel />
          <CampAccessAdminPanel />
        </div>
      ) : (
        <RestrictedNotice required="medicalCommand" />
      )}
    </ToolPageShell>
  );
}

function staffToInput(staff: CampStaffMember): CampStaffInput & { id: string } {
  return {
    id: staff.id,
    name: staff.name,
    profilePhotoUrl: staff.profilePhotoUrl ?? "",
    role: staff.role,
    shirtSize: staff.shirtSize ?? "",
    registrationExternalId: staff.registrationExternalId,
    sourceChurch: staff.sourceChurch ?? "",
    teamId: staff.teamId ?? ""
  };
}

export function CampStaffManagementToolPage() {
  const { overview, capabilities, loading, refresh } = useCamp();
  const [editing, setEditing] = useState<(CampStaffInput & { id: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<"idle" | "preparing" | "ready" | "failed">("idle");
  const [message, setMessage] = useState<{ tone: "error" | "success" | "warning"; text: string } | null>(null);
  const activeStaff = overview.staff.filter((staff) => !staff.archivedAt);
  const teamsById = useMemo(() => new Map(overview.teams.map((team) => [team.id, team])), [overview.teams]);

  async function saveStaff() {
    if (!editing) return;
    const savedStaff = activeStaff.find((staff) => staff.id === editing.id);
    const payload: CampStaffInput & { id: string } = {
      id: editing.id,
      name: editing.name
    };
    if (editing.role !== savedStaff?.role) payload.role = editing.role;
    if ((editing.teamId ?? "") !== (savedStaff?.teamId ?? "")) payload.teamId = editing.teamId ?? "";
    if ((editing.shirtSize ?? "") !== (savedStaff?.shirtSize ?? "")) payload.shirtSize = editing.shirtSize ?? "";
    if ((editing.sourceChurch ?? "") !== (savedStaff?.sourceChurch ?? "")) payload.sourceChurch = editing.sourceChurch ?? "";
    if ((editing.profilePhotoUrl ?? "") !== (savedStaff?.profilePhotoUrl ?? "")) payload.profilePhotoUrl = editing.profilePhotoUrl ?? "";

    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/camp/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({})) as { error?: string; warning?: string; optionalFieldsDropped?: boolean };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Staff details could not be saved." });
      return;
    }
    await refresh();
    setEditing(null);
    setPhotoStatus("idle");
    setMessage(body.warning || body.optionalFieldsDropped
      ? {
          tone: "warning",
          text: body.warning ?? "Basic staff details saved, but one or more optional fields could not be saved because the production schema is missing a column."
        }
      : { tone: "success", text: "Staff details saved." });
  }

  async function selectStaffPhoto(file: File | null) {
    if (!editing || !file) return;
    setPhotoStatus("preparing");
    setMessage(null);
    try {
      const prepared = await prepareCampImageFile(file, "camperProfile");
      const dataUrl = await fileToDataUrl(prepared);
      setEditing({ ...editing, profilePhotoUrl: dataUrl });
      setPhotoStatus("ready");
      setMessage({ tone: "success", text: "Leader photo ready. Save Staff Details to keep it." });
    } catch (error) {
      setPhotoStatus("failed");
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Leader photo could not be prepared." });
    }
  }

  if (!capabilities.medicalCommand) {
    return (
      <ToolPageShell title="Leader / Staff Details" subtitle="Imported staff details stay behind Camp Admin controls.">
        <RestrictedNotice required="medicalCommand" />
      </ToolPageShell>
    );
  }

  return (
    <ToolPageShell title="Leader / Staff Details" subtitle="Safe operational details for imported Oakwood leaders and staff.">
      {message ? <p className={`camp-save-message ${message.tone}`} role="status">{message.text}</p> : null}
      {loading && !activeStaff.length ? (
        <EmptyState>Loading Camp staff...</EmptyState>
      ) : activeStaff.length ? (
        <div className="camp-list">
          {activeStaff.map((staff) => (
            <div className="camp-list-row align-start" key={staff.id}>
              <span className="camp-leader-avatar" aria-hidden="true">
                {staff.profilePhotoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={staff.profilePhotoUrl} alt="" />
                  </>
                ) : (
                  initialsForName(staff.name)
                )}
              </span>
              <div>
                <strong>{staff.name}</strong>
                <p className="camp-cc-muted">
                  {staffRoleLabel(staff.role)}{staff.teamName ? ` - ${staff.teamName}` : " - Unassigned team"}{staff.shirtSize ? ` - ${staff.shirtSize}` : ""}
                </p>
                {staff.sourceChurch ? <p className="camp-cc-muted">Source church: {staff.sourceChurch}</p> : null}
                {staff.registrationExternalId ? <p className="camp-cc-muted">Oakwood registration ID: {staff.registrationExternalId}</p> : null}
              </div>
              <button className="button compact-button" type="button" onClick={() => { setEditing(staffToInput(staff)); setPhotoStatus("idle"); }}>Edit Details</button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>No imported leaders or staff are available yet. Commit an approved Oakwood staff roster import before editing leader details.</EmptyState>
      )}

      {editing ? (
        <section className="camp-admin-form" aria-label="Edit staff details">
          <div className="camp-section-header">
            <div>
              <p className="eyebrow">Edit Staff</p>
              <h2 className="camp-tool-group-title">{editing.name || "Staff member"}</h2>
            </div>
            <button className="button compact-button" type="button" disabled={saving} onClick={() => { setEditing(null); setPhotoStatus("idle"); }}>Close</button>
          </div>
          <div className="camp-form-grid">
            <div className="camp-profile-photo-row">
              <span className="camp-leader-avatar" aria-hidden="true">
                {editing.profilePhotoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editing.profilePhotoUrl} alt="" />
                  </>
                ) : (
                  initialsForName(editing.name)
                )}
              </span>
              <div className="camp-photo-actions">
                <label className="button compact-button">
                  <span>{photoStatus === "preparing" ? "Preparing..." : "Upload leader photo"}</span>
                  <input className="sr-only" type="file" accept="image/*" disabled={photoStatus === "preparing"} onChange={(event) => void selectStaffPhoto(event.target.files?.[0] ?? null)} />
                </label>
                <label className="button compact-button">
                  <span>Use camera</span>
                  <input className="sr-only" type="file" accept="image/*" capture="environment" disabled={photoStatus === "preparing"} onChange={(event) => void selectStaffPhoto(event.target.files?.[0] ?? null)} />
                </label>
                {editing.profilePhotoUrl ? <button className="button compact-button" type="button" onClick={() => { setEditing({ ...editing, profilePhotoUrl: "" }); setPhotoStatus("idle"); }}>Remove photo</button> : null}
              </div>
            </div>
            {photoStatus === "ready" ? <p className="camp-cc-muted">Thumbnail ready. Save Staff Details to keep this photo.</p> : null}
            {photoStatus === "failed" ? <p className="camp-cc-error">Leader photo could not be prepared.</p> : null}
            <label className="field">
              <span>Profile photo URL</span>
              <input className="input" value={editing.profilePhotoUrl ?? ""} onChange={(event) => { setEditing({ ...editing, profilePhotoUrl: event.target.value }); setPhotoStatus("idle"); }} placeholder="https://..." />
            </label>
            <label className="field">
              <span>Display name</span>
              <input className="input" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
            </label>
            <label className="field">
              <span>Role / type</span>
              <select className="input" value={editing.role ?? "adult_volunteer"} onChange={(event) => setEditing({ ...editing, role: event.target.value as CampStaffMember["role"] })}>
                <option value="adult_volunteer">Adult volunteer</option>
                <option value="leader">Leader</option>
                <option value="staff">Staff</option>
              </select>
            </label>
            <label className="field">
              <span>Team assignment</span>
              <select className="input" value={editing.teamId ?? ""} onChange={(event) => setEditing({ ...editing, teamId: event.target.value })}>
                <option value="">Unassigned</option>
                {overview.teams.map((team: CampTeam) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Shirt size</span>
              <input className="input" value={editing.shirtSize ?? ""} onChange={(event) => setEditing({ ...editing, shirtSize: event.target.value })} />
            </label>
            <label className="field">
              <span>Partner/source church</span>
              <input className="input" value={editing.sourceChurch ?? ""} onChange={(event) => setEditing({ ...editing, sourceChurch: event.target.value })} />
            </label>
          </div>
          {editing.registrationExternalId ? (
            <p className="camp-cc-muted">Oakwood registration ID {editing.registrationExternalId} is kept read-only to preserve import matching.</p>
          ) : null}
          {editing.teamId && !teamsById.has(editing.teamId) ? (
            <p className="camp-cc-error">Choose an active Camp team before saving.</p>
          ) : null}
          <button className="button primary" type="button" disabled={saving || !editing.name.trim()} onClick={() => void saveStaff()}>
            {saving ? "Saving..." : "Save Staff Details"}
          </button>
        </section>
      ) : null}
    </ToolPageShell>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read leader photo."));
    reader.readAsDataURL(file);
  });
}

type OakwoodUploadField = "combinedFile" | "camperFile" | "staffFile";
type ImportSourceMode = "oakwood" | "partnerChurch";

const oakwoodUploadFields: Array<{ field: OakwoodUploadField; label: string; sheetField: string }> = [
  { field: "combinedFile", label: "Combined Oakwood workbook", sheetField: "combinedSheet" },
  { field: "camperFile", label: "Camper workbook", sheetField: "camperSheet" },
  { field: "staffFile", label: "Leaders/Staff workbook", sheetField: "staffSheet" }
];

const partnerChurchUploadFields: Array<{ field: OakwoodUploadField; label: string; sheetField: string }> = [
  { field: "combinedFile", label: "Partner church spreadsheet", sheetField: "combinedSheet" }
];

function oakwoodPersonTypeLabel(personType: CampOakwoodImportPreview["rows"][number]["personType"]): string {
  return personType === "adult" ? "Leader/staff" : "Camper";
}

function defaultImportSourceName(mode: ImportSourceMode): string {
  return mode === "partnerChurch" ? "Partner Church Upload" : "Camp Oakwood Upload";
}

export function CampSettingsImportToolPage() {
  const searchParams = useSearchParams();
  const { capabilities, overview, refresh } = useCamp();
  const [sourceMode, setSourceMode] = useState<ImportSourceMode>(searchParams.get("mode") === "partner" ? "partnerChurch" : "oakwood");
  const [sourceName, setSourceName] = useState(defaultImportSourceName(searchParams.get("mode") === "partner" ? "partnerChurch" : "oakwood"));
  const [files, setFiles] = useState<Record<OakwoodUploadField, File | null>>({ combinedFile: null, camperFile: null, staffFile: null });
  const [sheetNames, setSheetNames] = useState<Record<OakwoodUploadField, string[]>>({ combinedFile: [], camperFile: [], staffFile: [] });
  const [selectedSheets, setSelectedSheets] = useState<Record<OakwoodUploadField, string>>({ combinedFile: "", camperFile: "", staffFile: "" });
  const [preview, setPreview] = useState<CampOakwoodImportPreview | null>(null);
  const [partnerPreview, setPartnerPreview] = useState<CampRegistrationImportPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<"inspect" | "preview" | "commit" | null>(null);

  if (!capabilities.medicalCommand) {
    return (
      <ToolPageShell title="Import Camp Roster" subtitle="Approved Oakwood roster/workbook import.">
        <EmptyState>This route is restricted to Camp Admins.</EmptyState>
      </ToolPageShell>
    );
  }

  const activeUploadFields = sourceMode === "partnerChurch" ? partnerChurchUploadFields : oakwoodUploadFields;
  const hasFile = activeUploadFields.some((item) => files[item.field]);
  const missingSheetLabels = activeUploadFields
    .filter((item) => files[item.field] && sheetNames[item.field].length > 1 && !selectedSheets[item.field])
    .map((item) => item.label);
  const activePreviewHasBlockingRows = sourceMode === "partnerChurch"
    ? !partnerPreview?.rows.some((row) => row.status !== "Blocked")
    : Boolean(preview?.summary.ambiguousCount || preview?.summary.invalidCount);
  const partnerPreviewSaveableRows = partnerPreview?.rows.filter((row) => row.status !== "Blocked").length ?? 0;

  function resetImportState(nextMode = sourceMode) {
    setFiles({ combinedFile: null, camperFile: null, staffFile: null });
    setSheetNames({ combinedFile: [], camperFile: [], staffFile: [] });
    setSelectedSheets({ combinedFile: "", camperFile: "", staffFile: "" });
    setPreview(null);
    setPartnerPreview(null);
    setConfirmed(false);
    setMessage(null);
    setSourceName(defaultImportSourceName(nextMode));
  }

  function switchSourceMode(nextMode: ImportSourceMode) {
    setSourceMode(nextMode);
    resetImportState(nextMode);
  }

  function buildUploadForm(mode: "inspect" | "preview") {
    const formData = new FormData();
    formData.set("mode", mode);
    formData.set("sourceType", sourceMode === "partnerChurch" ? "partnerChurch" : "oakwood");
    formData.set("sourceName", sourceName);
    for (const item of activeUploadFields) {
      const file = files[item.field];
      if (!file) continue;
      formData.set(item.field, file);
      const sheetName = selectedSheets[item.field];
      if (sheetName) formData.set(item.sheetField, sheetName);
    }
    return formData;
  }

  async function inspectUpload() {
    setMessage(null);
    setPreview(null);
    setPartnerPreview(null);
    setConfirmed(false);
    setBusy("inspect");
    const response = await fetch("/api/camp/import/upload", { method: "POST", body: buildUploadForm("inspect") });
    const body = await response.json().catch(() => ({})) as { error?: string; files?: Array<{ slot: OakwoodUploadField; sheetNames: string[] }> };
    setBusy(null);
    if (!response.ok || !body.files) {
      setMessage({ tone: "error", text: body.error ?? "Oakwood workbook inspection failed." });
      return;
    }
    const nextSheets = { combinedFile: [] as string[], camperFile: [] as string[], staffFile: [] as string[] };
    const nextSelected = { ...selectedSheets };
    for (const file of body.files) {
      nextSheets[file.slot] = file.sheetNames;
      if (file.sheetNames.length === 1) nextSelected[file.slot] = file.sheetNames[0];
    }
    setSheetNames(nextSheets);
    setSelectedSheets(nextSelected);
    setMessage({ tone: "success", text: "Workbook sheets inspected. Choose sheets, then preview before saving." });
  }

  async function previewUpload() {
    setMessage(null);
    if (missingSheetLabels.length) {
      setMessage({ tone: "error", text: `Choose a worksheet before previewing: ${missingSheetLabels.join(", ")}.` });
      return;
    }
    setPreview(null);
    setPartnerPreview(null);
    setConfirmed(false);
    setBusy("preview");
    const response = await fetch("/api/camp/import/upload", { method: "POST", body: buildUploadForm("preview") });
    const body = await response.json().catch(() => ({})) as { error?: string; preview?: CampOakwoodImportPreview | CampRegistrationImportPreview };
    setBusy(null);
    if (!response.ok || !body.preview) {
      setMessage({ tone: "error", text: body.error ?? (sourceMode === "partnerChurch" ? "Partner church preview could not be created." : "Oakwood preview could not be created.") });
      return;
    }
    if (sourceMode === "partnerChurch") {
      setPartnerPreview(body.preview as CampRegistrationImportPreview);
      setMessage({ tone: "success", text: "Partner church preview ready. Nothing has been saved." });
      return;
    }
    setPreview(body.preview as CampOakwoodImportPreview);
    setMessage({ tone: "success", text: "Oakwood preview ready. Nothing has been saved." });
  }

  async function commitPreview() {
    if (!confirmed) {
      setMessage({ tone: "error", text: "Review and confirm the preview before saving." });
      return;
    }

    if (sourceMode === "partnerChurch") {
      if (!partnerPreview) {
        setMessage({ tone: "error", text: "Build a partner church preview before saving." });
        return;
      }
      if (partnerPreviewSaveableRows === 0) {
        setMessage({ tone: "error", text: "Add at least one camper row with a student name before saving." });
        return;
      }
      setBusy("commit");
      const response = await fetch("/api/camp/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "commit", preview: partnerPreview })
      });
      const body = await response.json().catch(() => ({})) as { error?: string; committed?: Array<unknown> };
      setBusy(null);
      if (!response.ok || !body.committed) {
        setMessage({ tone: "error", text: body.error ?? "Partner church import could not be saved." });
        return;
      }
      await refresh();
      setMessage({ tone: "success", text: `Partner church import saved: ${body.committed.length} camper rows committed.` });
      setPartnerPreview(null);
      setConfirmed(false);
      return;
    }

    if (!preview) {
      setMessage({ tone: "error", text: "Build an Oakwood preview before saving." });
      return;
    }
    setBusy("commit");
    const response = await fetch("/api/camp/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "oakwoodCommit", oakwoodPreview: preview, confirmed: true })
    });
    const body = await response.json().catch(() => ({})) as { error?: string; result?: { committed: Array<{ personType?: string }> } };
    setBusy(null);
    if (!response.ok || !body.result) {
      setMessage({ tone: "error", text: body.error ?? "Oakwood import could not be saved." });
      return;
    }
    await refresh();
    const staffCommitted = body.result.committed.filter((row) => row.personType === "adult").length;
    const camperCommitted = body.result.committed.filter((row) => row.personType === "student").length;
    setMessage({ tone: "success", text: `Oakwood import saved: ${camperCommitted} campers and ${staffCommitted} leaders/staff committed.` });
    setPreview(null);
    setConfirmed(false);
  }

  return (
    <ToolPageShell
      title={sourceMode === "partnerChurch" ? "Partner Church Upload" : "Import Camp Roster"}
      subtitle={sourceMode === "partnerChurch" ? "Camp Admin-only partner church camper upload with preview and explicit commit." : "Camp Admin-only Oakwood roster/workbook upload with preview, validation, and explicit commit."}
    >
      <div className="camp-tool-workflow">
        <section className="camp-admin-form" aria-label={sourceMode === "partnerChurch" ? "Partner church roster import" : "Oakwood roster import"}>
          <div className="camp-import-mode-switch" role="tablist" aria-label="Import type">
            <button className={sourceMode === "oakwood" ? "camp-cc-mode-tab active" : "camp-cc-mode-tab"} type="button" role="tab" aria-selected={sourceMode === "oakwood"} onClick={() => switchSourceMode("oakwood")}>Oakwood roster</button>
            <button className={sourceMode === "partnerChurch" ? "camp-cc-mode-tab active" : "camp-cc-mode-tab"} type="button" role="tab" aria-selected={sourceMode === "partnerChurch"} onClick={() => switchSourceMode("partnerChurch")}>Partner Church Upload</button>
          </div>
          <p className="camp-cc-muted">
            {sourceMode === "partnerChurch"
              ? "Only student name is required. Team and other details can be added now or edited later. Restricted medical detail is not shown in this preview."
              : "Use this only for approved Oakwood roster/workbook imports. Uploads are inspected and previewed first; no roster data is saved automatically on upload. Production saving also requires server-verified migration 013 schema readiness and live import approval."}
          </p>
          <StatusPill tone="locked">Camp Admin only</StatusPill>
          <label className="field">
            <span>Import label</span>
            <input className="input" value={sourceName} onChange={(event) => setSourceName(event.target.value)} />
          </label>
          {activeUploadFields.map((item) => {
            const selectedFile = files[item.field];
            return (
              <div className="camp-list-row align-start camp-upload-row" key={item.field}>
                <label className="camp-upload-dropzone">
                  <span>{item.label}</span>
                  <strong>{selectedFile?.name ?? "Choose .xlsx or .csv file"}</strong>
                  <small>{sourceMode === "partnerChurch" ? "Only student name is required. Team and other details can be added now or edited later." : "Use the approved Oakwood workbook or CSV export."}</small>
                <input
                  className="sr-only"
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/csv,application/vnd.ms-excel,application/octet-stream,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => {
                    const selectedFile = event.currentTarget.files?.[0] ?? null;
                    setFiles((current) => ({ ...current, [item.field]: selectedFile }));
                    setPreview(null);
                    setPartnerPreview(null);
                    setConfirmed(false);
                  }}
                />
              </label>
              {sheetNames[item.field].length ? (
                <label className="field">
                  <span>Worksheet</span>
                  <select className="input" value={selectedSheets[item.field]} onChange={(event) => setSelectedSheets((current) => ({ ...current, [item.field]: event.target.value }))}>
                    <option value="">Select worksheet</option>
                    {sheetNames[item.field].map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
                  </select>
                </label>
              ) : null}
              </div>
            );
          })}
          <div className="camp-row-actions">
            <button className="button" type="button" disabled={!hasFile || busy !== null} onClick={() => void inspectUpload()}>
              {busy === "inspect" ? "Inspecting..." : "Inspect sheets"}
            </button>
            <button className="button primary" type="button" disabled={!hasFile || busy !== null} onClick={() => void previewUpload()}>
              {busy === "preview" ? "Previewing..." : "Build preview"}
            </button>
          </div>
          {missingSheetLabels.length ? <p className="camp-cc-error">Choose a worksheet for: {missingSheetLabels.join(", ")}.</p> : null}
        </section>

        {sourceMode === "oakwood" && preview ? (
          <section className="camp-admin-form" aria-label="Oakwood import preview">
            <h2 className="camp-tool-group-title">Preview summary</h2>
            <div className="camp-list">
              <div className="camp-list-row"><strong>Total source rows</strong><StatusPill>{preview.summary.totalSourceRows}</StatusPill></div>
              <div className="camp-list-row"><strong>New people</strong><StatusPill>{preview.summary.newCount}</StatusPill></div>
              <div className="camp-list-row"><strong>Matched people</strong><StatusPill>{preview.summary.matchedCount}</StatusPill></div>
              <div className="camp-list-row"><strong>Leader/staff rows</strong><StatusPill tone={preview.summary.staffRows ? "ready" : "locked"}>{preview.summary.staffRows}</StatusPill></div>
              <div className="camp-list-row"><strong>Warning rows</strong><StatusPill tone={preview.rows.some((row) => row.warnings.length) ? "warn" : "ready"}>{preview.rows.filter((row) => row.warnings.length > 0).length}</StatusPill></div>
              <div className="camp-list-row"><strong>Duplicate / ambiguous rows</strong><StatusPill tone={preview.summary.ambiguousCount ? "warn" : "ready"}>{preview.summary.ambiguousCount}</StatusPill></div>
              <div className="camp-list-row"><strong>Ambiguous rows</strong><StatusPill tone={preview.summary.ambiguousCount ? "warn" : "ready"}>{preview.summary.ambiguousCount}</StatusPill></div>
              <div className="camp-list-row"><strong>Invalid rows</strong><StatusPill tone={preview.summary.invalidCount ? "warn" : "ready"}>{preview.summary.invalidCount}</StatusPill></div>
            </div>
            {preview.uploadSources?.length ? (
              <div className="camp-list">
                {preview.uploadSources.map((source) => (
                  <div className="camp-list-row align-start" key={`${source.fileName}-${source.scope}`}>
                    <div>
                      <strong>{source.fileName}{source.sheetName ? ` / ${source.sheetName}` : ""}</strong>
                      <p className="camp-cc-muted">Scope: {source.scope}. Rows: {source.rowCount}. SHA-256: {source.checksumSha256.slice(0, 12)}...</p>
                    </div>
                    <StatusPill>{source.scope}</StatusPill>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="camp-list">
              {preview.rows.slice(0, 12).map((row) => (
                <div className="camp-list-row align-start" key={`${row.rowNumber}-${row.person.name}`}>
                  <div>
                    <strong>Row {row.rowNumber}: {row.person.name || "No name"}</strong>
                    <p className="camp-cc-muted">{oakwoodPersonTypeLabel(row.personType)} - {row.matchStatus} - Team: {row.person.teamName || "Unassigned"} - Vehicle: {row.person.vehicleName || "Unassigned"}</p>
                    {row.warnings.length ? <p className="camp-cc-muted">{row.warnings.join(" ")}</p> : null}
                  </div>
                  <StatusPill tone={row.matchStatus === "new" || row.matchStatus === "matched" ? "ready" : "warn"}>{row.matchStatus}</StatusPill>
                </div>
              ))}
            </div>
            {preview.rows.length > 12 ? <p className="camp-cc-muted">Showing the first 12 preview rows. All rows are included in the summary and commit guard.</p> : null}
            <p className="camp-cc-muted">Restricted medical/contact/dietary fields stay in restricted storage on commit. Ambiguous or invalid rows block saving. If production saving is not ready, the server will show the exact readiness or approval reason.</p>
            <label className="camp-checkbox-line">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              <span>I reviewed this Oakwood preview and approve saving the non-ambiguous rows.</span>
            </label>
            <button className="button primary" type="button" disabled={!confirmed || busy !== null || preview.summary.ambiguousCount > 0 || preview.summary.invalidCount > 0} onClick={() => void commitPreview()}>
              {busy === "commit" ? "Saving..." : "Save confirmed Oakwood import"}
            </button>
          </section>
        ) : null}

        {sourceMode === "partnerChurch" && partnerPreview ? (
          <section className="camp-admin-form" aria-label="Partner church import preview">
            <h2 className="camp-tool-group-title">Partner church preview</h2>
            <div className="camp-list">
              <div className="camp-list-row"><strong>Total camper rows</strong><StatusPill>{partnerPreview.summary.totalRows}</StatusPill></div>
              <div className="camp-list-row"><strong>Will add</strong><StatusPill tone={partnerPreview.summary.addRows ? "ready" : undefined}>{partnerPreview.summary.addRows ?? 0}</StatusPill></div>
              <div className="camp-list-row"><strong>Will update</strong><StatusPill tone={partnerPreview.summary.updateRows ? "ready" : undefined}>{partnerPreview.summary.updateRows ?? 0}</StatusPill></div>
              <div className="camp-list-row"><strong>Warning rows</strong><StatusPill tone={partnerPreview.summary.warningRows ? "warn" : "ready"}>{partnerPreview.summary.warningRows ?? 0}</StatusPill></div>
              <div className="camp-list-row"><strong>Blocked rows</strong><StatusPill tone={partnerPreview.summary.blockedRows ? "warn" : "ready"}>{partnerPreview.summary.blockedRows}</StatusPill></div>
              <div className="camp-list-row"><strong>Medical follow-up rows</strong><StatusPill tone={partnerPreview.summary.clarificationRows ? "warn" : "ready"}>{partnerPreview.summary.clarificationRows}</StatusPill></div>
            </div>
            {partnerPreview.uploadSources?.length ? (
              <div className="camp-list">
                {partnerPreview.uploadSources.map((source) => (
                  <div className="camp-list-row align-start" key={`${source.fileName}-${source.checksumSha256}`}>
                    <div>
                      <strong>{source.fileName}{source.sheetName ? ` / ${source.sheetName}` : ""}</strong>
                      <p className="camp-cc-muted">Rows: {source.rowCount}. SHA-256: {source.checksumSha256.slice(0, 12)}...</p>
                    </div>
                    <StatusPill>partner</StatusPill>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="camp-list">
              {partnerPreview.rows.slice(0, 12).map((row) => (
                <div className="camp-list-row align-start" key={`${row.rowNumber}-${row.camper.name}`}>
                  <div>
                    <strong>Row {row.rowNumber}: {row.camper.name || "No name"}</strong>
                    <p className="camp-cc-muted">
                      {(row.importAction ?? "add").toUpperCase()} - {row.sourceChurch || "Missing source church"} - Grade: {row.camper.grade || "n/a"} - Room: {row.camper.cabin || "Unassigned"} - Team: {overviewTeamName(row.camper.teamId) || "Unassigned"}
                      {row.camper.profilePhotoUrl ? " - Photo URL provided" : ""}
                    </p>
                    {row.warnings.length ? <p className="camp-cc-muted">{row.warnings.join(" ")}</p> : null}
                  </div>
                  <StatusPill tone={row.status === "Ready" ? "ready" : "warn"}>{row.importAction === "skip" ? "blocked" : row.status}</StatusPill>
                </div>
              ))}
            </div>
            {partnerPreview.rows.length > 12 ? <p className="camp-cc-muted">Showing the first 12 preview rows. All rows are included in the summary and save guard.</p> : null}
            <p className="camp-cc-muted">Supported safe fields: name, team, partner/source church, grade, room/cabin, shirt size, vehicle, photo URL, emergency contact presence, food allergy indicator, medical concern indicator, medication-on-file indicator, and safe operational notes. Restricted detail is not shown in this preview.</p>
            <label className="camp-checkbox-line">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              <span>I reviewed this partner church preview and approve saving {partnerPreviewSaveableRows} valid row{partnerPreviewSaveableRows === 1 ? "" : "s"}.</span>
            </label>
            <button className="button primary" type="button" disabled={!confirmed || busy !== null || activePreviewHasBlockingRows} onClick={() => void commitPreview()}>
              {busy === "commit" ? "Saving..." : `Save ${partnerPreviewSaveableRows} valid row${partnerPreviewSaveableRows === 1 ? "" : "s"}`}
            </button>
          </section>
        ) : null}

        {message ? <p className={message.tone === "error" ? "camp-save-message error" : "camp-save-message success"} role="status">{message.text}</p> : null}
      </div>
    </ToolPageShell>
  );

  function overviewTeamName(teamId?: string) {
    return overview.teams.find((team) => team.id === teamId)?.name ?? "";
  }
}

export function CampAdministerMedicineToolPage() {
  const searchParams = useSearchParams();
  return (
    <ToolPageShell title="Administer Medicine" subtitle="Andrew-only queue for medication administration.">
      <MedicationDataGate required="medicalCommand">
        {(data) => {
          return data.schedule.length ? (
            <GroupedMedicationAdministrationForm data={data} requestedScheduleItemId={searchParams.get("scheduleItemId")} />
          ) : (
            <EmptyState>No open medication administration items are on file.</EmptyState>
          );
        }}
      </MedicationDataGate>
    </ToolPageShell>
  );
}

function GroupedMedicationAdministrationForm({
  data,
  requestedScheduleItemId
}: {
  data: MedicationPayload;
  requestedScheduleItemId: string | null;
}) {
  const [scheduleItems, setScheduleItems] = useState(data.schedule);
  const groups = useMemo(() => medicationPassGroups(data, scheduleItems), [data, scheduleItems]);
  const initialGroupId = groups.find((group) => group.items.some((item) => item.schedule.id === requestedScheduleItemId))?.id ?? groups[0]?.id ?? "";
  const [groupId, setGroupId] = useState(initialGroupId);
  const selectedGroup = groups.find((group) => group.id === groupId) ?? groups[0];
  const [itemStatuses, setItemStatuses] = useState<Record<string, CampMedicationAdministrationItemStatus>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [administeredBy, setAdministeredBy] = useState("Andrew");
  const [notes, setNotes] = useState("");
  const [ackSignature, setAckSignature] = useState<CampSignatureData>(() => emptySignatureData());
  const [lastAckSignature, setLastAckSignature] = useState<CampSignatureData | null>(null);
  const [ackUnavailable, setAckUnavailable] = useState(false);
  const [ackReason, setAckReason] = useState("");
  const [administrationLog, setAdministrationLog] = useState(data.administrationLog);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScheduleItems(data.schedule);
  }, [data.schedule]);

  useEffect(() => {
    if (groups.some((group) => group.id === groupId)) return;
    setGroupId(groups[0]?.id ?? "");
  }, [groupId, groups]);

  useEffect(() => {
    if (!selectedGroup) return;
    setItemStatuses((current) => {
      const next = { ...current };
      for (const item of selectedGroup.items) {
        if (!next[item.schedule.id]) next[item.schedule.id] = "administered";
      }
      return next;
    });
  }, [selectedGroup]);

  const selectedItems = selectedGroup?.items.filter((item) => itemStatuses[item.schedule.id]) ?? [];
  const acknowledgementReady = ackUnavailable ? Boolean(ackReason.trim()) : hasSignature(ackSignature);
  const canSubmit = Boolean(selectedGroup) && selectedItems.length > 0 && Boolean(administeredBy.trim()) && acknowledgementReady && !saving;
  const groupHistory = selectedGroup
    ? administrationLog.filter((log) => log.studentId === selectedGroup.studentId && log.timeWindow === selectedGroup.timeWindow && !log.archivedAt)
    : [];

  function updateItemStatus(scheduleItemId: string, checked: boolean, status?: CampMedicationAdministrationItemStatus) {
    setItemStatuses((current) => {
      const next = { ...current };
      if (!checked) delete next[scheduleItemId];
      else next[scheduleItemId] = status ?? next[scheduleItemId] ?? "administered";
      return next;
    });
  }

  async function submitGroupedPass() {
    if (!selectedGroup) return;
    setMessage(null);
    if (!selectedItems.length) {
      setMessage({ tone: "error", text: "Select at least one medication before submitting a med pass." });
      return;
    }
    if (ackUnavailable && !ackReason.trim()) {
      setMessage({ tone: "error", text: "Reason is required when the student is unavailable or declined to initial." });
      return;
    }
    if (!ackUnavailable && !hasSignature(ackSignature)) {
      setMessage({ tone: "error", text: "Student acknowledgement signature is required, or mark unavailable/declined with a reason." });
      return;
    }

    setSaving(true);
    const response = await fetch("/api/camp/medication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "groupedAdministration",
        studentId: selectedGroup.studentId,
        timeWindow: selectedGroup.timeWindow,
        administeredBy,
        notes,
        studentAcknowledgementInitials: ackUnavailable ? "" : serializeStudentAcknowledgement(ackSignature),
        studentAcknowledgementUnavailable: ackUnavailable,
        studentAcknowledgementUnavailableReason: ackReason,
        items: selectedItems.map((item) => ({
          medicationRecordId: item.schedule.medicationRecordId,
          scheduleItemId: item.schedule.id,
          status: itemStatuses[item.schedule.id],
          doseGiven: item.details.dose,
          notes: itemNotes[item.schedule.id] ?? ""
        }))
      })
    });
    const body = await response.json().catch(() => ({})) as { error?: string; logs?: CampMedicationAdministrationLog[] };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Medication administration could not be logged." });
      return;
    }
    const logs = body.logs ?? [];
    setLastAckSignature(ackUnavailable ? null : ackSignature);
    setAdministrationLog((current) => [...logs, ...current.filter((log) => !logs.some((saved) => saved.id === log.id))]);
    setScheduleItems((current) => current.map((item) => {
      const savedLog = logs.find((log) => log.scheduleItemId === item.id);
      return savedLog ? { ...item, status: savedLog.status === "Logged" ? "Logged" : savedLog.status === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Pending", lastLoggedAt: savedLog.loggedAt, lastLoggedBy: savedLog.loggedBy } : item;
    }));
    setMessage({ tone: "success", text: `Medication administration logged. ${selectedItems.length} medication item${selectedItems.length === 1 ? "" : "s"} recorded under one student acknowledgement.` });
    setNotes("");
    setItemNotes({});
    setAckSignature(emptySignatureData());
    setAckUnavailable(false);
    setAckReason("");
  }

  return (
    <div className="camp-admin-form" aria-label="Grouped medication administration form">
      <div className="camp-list-row align-start">
        <div>
          <strong>Meds Due Now</strong>
          <p className="camp-cc-muted">Grouped by camper and time block. One student acknowledgement covers only the selected medications in this med pass.</p>
        </div>
        <StatusPill tone={groups.length ? "ready" : "locked"}>{groups.length ? `${groups.length} pass${groups.length === 1 ? "" : "es"}` : "No due meds"}</StatusPill>
      </div>

      {groups.length ? (
        <>
          {selectedGroup ? (
            <p className="camp-cc-muted">{selectedGroup.studentName} - {selectedGroup.timeWindow}</p>
          ) : null}
          <label className="field">
            <span>Medication time block</span>
            <select className="input" value={selectedGroup?.id ?? ""} onChange={(event) => { setGroupId(event.target.value); setMessage(null); }}>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.studentName} - {group.timeWindow}: {group.items.length} med{group.items.length === 1 ? "" : "s"} due</option>
              ))}
            </select>
          </label>

          {selectedGroup ? (
            <section className="camp-editor-card camp-medication-admin-card" aria-label={`Grouped med pass for ${selectedGroup.studentName}`} data-testid={`camp-medication-pass-${selectedGroup.studentId}-${selectedGroup.timeWindow}`}>
              <div className="camp-medication-admin-card-head">
                <div>
                  <strong>{selectedGroup.studentName} - {selectedGroup.timeWindow}</strong>
                  <p className="camp-cc-muted">{selectedGroup.items.length} medication{selectedGroup.items.length === 1 ? "" : "s"} in this med pass</p>
                </div>
                <StatusPill tone="warn">Due</StatusPill>
              </div>
              <div className="camp-list">
                {selectedGroup.items.map((item) => {
                  const status = itemStatuses[item.schedule.id] ?? "administered";
                  const checked = Boolean(itemStatuses[item.schedule.id]);
                  return (
                    <div className="camp-list-row align-start" key={item.schedule.id} data-testid={`camp-medication-admin-card-${item.schedule.id}`}>
                      <label className="camp-checkbox-line">
                        <input type="checkbox" checked={checked} onChange={(event) => updateItemStatus(item.schedule.id, event.target.checked)} />
                        <span>{item.details.medicationName}</span>
                      </label>
                      <dl className="camp-medication-admin-details">
                        <div>
                          <dt>Dose</dt>
                          <dd>{item.details.dose}</dd>
                        </div>
                        <div>
                          <dt>Scheduled time</dt>
                          <dd>{item.schedule.timeWindow}</dd>
                        </div>
                        <div className="wide">
                          <dt>Instructions</dt>
                          <dd>{item.details.instructions}{item.details.staffNotes ? ` ${item.details.staffNotes}` : ""}</dd>
                        </div>
                      </dl>
                      <div className="camp-form-grid">
                        <label className="field">
                          <span>Status</span>
                          <select className="input" value={status} disabled={!checked} onChange={(event) => updateItemStatus(item.schedule.id, true, event.target.value as CampMedicationAdministrationItemStatus)}>
                            <option value="administered">Administered</option>
                            <option value="skipped">Skipped</option>
                            <option value="refused">Refused</option>
                            <option value="held">Held</option>
                            <option value="not_present">Not present</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Item notes</span>
                          <input className="input" value={itemNotes[item.schedule.id] ?? ""} disabled={!checked} onChange={(event) => setItemNotes((current) => ({ ...current, [item.schedule.id]: event.target.value }))} />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="camp-form-grid">
            <label className="field">
              <span>Administered by staff member</span>
              <input className="input" value={administeredBy} onChange={(event) => setAdministeredBy(event.target.value)} />
            </label>
            <label className="field">
              <span>Staff notes</span>
              <input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>

          <section className="camp-ack-box" aria-label="Student acknowledgement only">
            <div>
              <strong>Student acknowledgement for selected meds</strong>
              <p className="camp-cc-muted">This acknowledgement applies only to this camper and time block.</p>
            </div>
            <SignaturePad
              value={ackSignature}
              onChange={setAckSignature}
              label="Student acknowledgement signature pad"
              description="Have the student draw their initials with a finger, mouse, or stylus when available."
              clearLabel="Clear and Re-sign"
              disabled={ackUnavailable}
            />
            <label className="camp-checkbox-line">
              <input
                type="checkbox"
                checked={ackUnavailable}
                onChange={(event) => {
                  setAckUnavailable(event.target.checked);
                  if (event.target.checked) setAckSignature(emptySignatureData());
                }}
              />
              <span>Unavailable or declined to initial</span>
            </label>
            {ackUnavailable ? (
              <label className="field">
                <span>Reason required</span>
                <input className="input" value={ackReason} onChange={(event) => setAckReason(event.target.value)} />
              </label>
            ) : null}
          </section>

          {message ? <p className={message.tone === "error" ? "camp-cc-error" : "camp-save-message success"} role="status">{message.text}</p> : null}
          {lastAckSignature ? (
            <SignaturePreview value={lastAckSignature} label="Student acknowledgement preview" />
          ) : null}

          <button className="button primary" type="button" disabled={!canSubmit} onClick={() => void submitGroupedPass()}>
            {saving ? "Logging med pass..." : "Administer Selected"}<span className="sr-only"> Confirm Administration</span>
          </button>

          <section aria-label="Administration history">
            <h2 className="camp-tool-group-title">Recent records for this pass</h2>
            {groupHistory.length ? (
              <div className="camp-list">
                {groupHistory.slice(0, 6).map((log) => (
                  <div className={archiveClassName(log)} key={log.id}>
                    <div>
                      <strong>{log.status} - {new Date(log.loggedAt).toLocaleString()}</strong>
                      <p className="camp-cc-muted">{log.notes}</p>
                      <p className="camp-cc-muted">Acknowledgement: {formatStudentAcknowledgement(log)}</p>
                      {parseStoredSignatureData(log.studentAcknowledgementInitials) ? (
                        <SignaturePreview value={parseStoredSignatureData(log.studentAcknowledgementInitials) as CampSignatureData} label={`Student acknowledgement preview for ${log.studentName}`} />
                      ) : null}
                    </div>
                    <StatusPill tone={statusTone(log.status)}>{log.status}</StatusPill>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>No administration history is on file for this grouped med pass yet.</EmptyState>
            )}
          </section>
        </>
      ) : (
        <EmptyState>No scheduled medications are due. PRN/as-needed medications are not shown automatically.</EmptyState>
      )}
    </div>
  );
}

function MedicationAdministrationForm({
  data,
  requestedScheduleItemId
}: {
  data: MedicationPayload;
  requestedScheduleItemId: string | null;
}) {
  const [scheduleItems, setScheduleItems] = useState(data.schedule);
  const currentOpenItems = useMemo(() => scheduleItems.filter((item) => item.status !== "Logged"), [scheduleItems]);
  const activeItems = useMemo(() => currentOpenItems.length ? currentOpenItems : scheduleItems, [currentOpenItems, scheduleItems]);
  const initialScheduleId = activeItems.some((item) => item.id === requestedScheduleItemId) ? requestedScheduleItemId ?? activeItems[0]?.id ?? "" : activeItems[0]?.id ?? "";
  const [scheduleItemId, setScheduleItemId] = useState(initialScheduleId);
  const [loggedBy, setLoggedBy] = useState("Andrew");
  const [status, setStatus] = useState<CampMedicationAdministrationLog["status"]>("Logged");
  const [notes, setNotes] = useState("");
  const [scheduleEdit, setScheduleEdit] = useState<{
    id: string;
    medicationRecordId: string;
    timeWindow: string;
    parentProvidedInstructions: string;
    status: CampMedicationScheduleItem["status"];
  } | null>(null);
  const [ackSignature, setAckSignature] = useState<CampSignatureData>(() => emptySignatureData());
  const [ackUnavailable, setAckUnavailable] = useState(false);
  const [ackReason, setAckReason] = useState("");
  const [administrationLog, setAdministrationLog] = useState(data.administrationLog);
  const [showArchivedHistory, setShowArchivedHistory] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeItems.some((item) => item.id === requestedScheduleItemId)) {
      setScheduleItemId(requestedScheduleItemId ?? "");
    }
  }, [activeItems, requestedScheduleItemId]);

  useEffect(() => {
    setScheduleItems(data.schedule);
  }, [data.schedule]);

  const selected = scheduleItems.find((item) => item.id === scheduleItemId) ?? activeItems[0];
  const selectedDetails = medicationDetailsForSchedule(data, selected);
  const history = administrationLog.filter((log) => log.scheduleItemId === selected?.id && (showArchivedHistory || !log.archivedAt));
  const acknowledgementReady = ackUnavailable ? Boolean(ackReason.trim()) : hasSignature(ackSignature);
  const canSubmit = Boolean(selected) && Boolean(loggedBy.trim()) && acknowledgementReady && !saving;

  function beginScheduleEdit() {
    if (!selected) return;
    setScheduleEdit({
      id: selected.id,
      medicationRecordId: selected.medicationRecordId,
      timeWindow: selected.timeWindow,
      parentProvidedInstructions: selected.parentProvidedInstructions,
      status: selected.status
    });
    setMessage(null);
  }

  async function saveScheduleEdit() {
    if (!scheduleEdit) return;
    if (!scheduleEdit.timeWindow.trim()) {
      setMessage({ tone: "error", text: "Medication time block needs a time or label before saving." });
      return;
    }

    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/camp/medication", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "schedule",
        id: scheduleEdit.id,
        medicationRecordId: scheduleEdit.medicationRecordId,
        timeWindow: scheduleEdit.timeWindow,
        parentProvidedInstructions: scheduleEdit.parentProvidedInstructions,
        status: scheduleEdit.status
      })
    });
    const body = await response.json().catch(() => ({})) as { error?: string; item?: CampMedicationScheduleItem };
    setSaving(false);
    if (!response.ok || !body.item) {
      setMessage({ tone: "error", text: body.error ?? "Medication time block could not be saved." });
      return;
    }

    setScheduleItems((current) => current.map((item) => item.id === body.item?.id ? body.item as CampMedicationScheduleItem : item));
    setScheduleItemId(body.item.id);
    setScheduleEdit(null);
    setMessage({ tone: "success", text: "Medication time block updated." });
  }

  async function submit() {
    if (!selected) return;
    setMessage(null);
    if (ackUnavailable && !ackReason.trim()) {
      setMessage({ tone: "error", text: "Reason is required when the student is unavailable or declined to initial." });
      return;
    }
    if (!ackUnavailable && !hasSignature(ackSignature)) {
      setMessage({ tone: "error", text: "Student acknowledgement signature is required, or mark unavailable/declined with a reason." });
      return;
    }

    setSaving(true);
    const response = await fetch("/api/camp/medication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "administrationLog",
        scheduleItemId: selected.id,
        loggedBy,
        status,
        notes,
        studentAcknowledgementInitials: ackUnavailable ? "" : serializeStudentAcknowledgement(ackSignature),
        studentAcknowledgementUnavailable: ackUnavailable,
        studentAcknowledgementUnavailableReason: ackReason
      })
    });
    const body = await response.json().catch(() => ({})) as { error?: string; log?: CampMedicationAdministrationLog };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Medication administration could not be logged." });
      return;
    }
    if (body.log) {
      setAdministrationLog((current) => [body.log as CampMedicationAdministrationLog, ...current.filter((log) => log.id !== body.log?.id)]);
    }
    setMessage({ tone: "success", text: "Medication administration logged. Student acknowledgement recorded as acknowledgement only." });
    setNotes("");
    setAckSignature(emptySignatureData());
    setAckUnavailable(false);
    setAckReason("");
  }

  async function toggleArchivedHistory(nextValue: boolean) {
    setShowArchivedHistory(nextValue);
    const response = await fetch(nextValue ? "/api/camp/medication?includeArchived=true" : "/api/camp/medication", { cache: "no-store" });
    const body = await response.json().catch(() => ({})) as Partial<MedicationPayload>;
    if (response.ok && body.administrationLog) setAdministrationLog(body.administrationLog);
  }

  async function archiveLog(log: CampMedicationAdministrationLog) {
    if (!window.confirm("Hide this administration history item from the active view? Archived items remain in the medical audit history.")) return;
    setMessage(null);
    try {
      const archived = await archiveMedicationHistoryItem("administrationLog", log.id, "Resolved administration edit hidden from active Medical Command view.");
      setAdministrationLog((current) => current.map((item) => item.id === log.id ? { ...item, ...archived } : item));
      setMessage({ tone: "success", text: "Administration history item archived." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Administration history item could not be archived." });
    }
  }

  return (
    <div className="camp-admin-form" aria-label="Medication administration form">
      <div className="camp-list-row align-start">
        <div>
          <strong>{selected ? `${selected.studentName} - ${selected.timeWindow}` : "Select a medication time block"}</strong>
          <p className="camp-cc-muted">Student initials acknowledge the interaction only. Staff documentation remains the medication record.</p>
        </div>
        {selected ? <StatusPill tone={statusTone(selected.status)}>{selected.status}</StatusPill> : null}
      </div>

      <label className="field">
        <span>Medication time block</span>
        <select className="input" value={scheduleItemId} onChange={(event) => { setScheduleItemId(event.target.value); setScheduleEdit(null); }}>
          {activeItems.map((item) => (
            <option key={item.id} value={item.id}>{item.studentName} - {item.timeWindow} - {medicationDetailsForSchedule(data, item).medicationName}</option>
          ))}
        </select>
      </label>
      {selected ? (
        <section className="camp-editor-card camp-medication-admin-card" aria-label="Selected administration block" data-testid={`camp-medication-admin-card-${selected.id}`}>
          <div className="camp-medication-admin-card-head">
            <div>
              <strong>{selected.studentName} - {selected.timeWindow}</strong>
              <p className="camp-cc-muted">{selectedDetails.medicationName}</p>
            </div>
            <div className="camp-row-actions">
              <StatusPill tone={statusTone(selected.status)}>{selected.status}</StatusPill>
              <button className="button compact-button" type="button" onClick={beginScheduleEdit}>Edit Time Block</button>
            </div>
          </div>
          <dl className="camp-medication-admin-details">
            <div>
              <dt>Medication</dt>
              <dd>{selectedDetails.medicationName}</dd>
            </div>
            <div>
              <dt>Dose</dt>
              <dd>{selectedDetails.dose}</dd>
            </div>
            <div>
              <dt>Scheduled time</dt>
              <dd>{selected.timeWindow}</dd>
            </div>
            <div className="wide">
              <dt>Instructions / notes</dt>
              <dd>{selectedDetails.instructions}{selectedDetails.staffNotes ? ` ${selectedDetails.staffNotes}` : ""}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <div className="camp-form-grid">
        <label className="field">
          <span>Logged by staff member</span>
          <input className="input" value={loggedBy} onChange={(event) => setLoggedBy(event.target.value)} />
        </label>
        <label className="field">
          <span>Status</span>
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value as CampMedicationAdministrationLog["status"])}>
            <option value="Logged">Logged</option>
            <option value="Skipped">Skipped</option>
            <option value="Needs Parent Clarification">Needs Parent Clarification</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span>Staff notes</span>
        <textarea className="input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Medication documentation notes" />
      </label>

      <section className="camp-ack-box" aria-label="Student acknowledgement only">
        <div>
          <strong>Student acknowledgement only</strong>
          <p className="camp-cc-muted">Finger initials acknowledge the interaction only. They are not consent, approval, or the staff medication-administration record.</p>
        </div>
        <SignaturePad
          value={ackSignature}
          onChange={setAckSignature}
          label="Student acknowledgement signature pad"
          description="Have the student draw their initials with a finger, mouse, or stylus when available."
          clearLabel="Clear and Re-sign"
          disabled={ackUnavailable}
        />
        <div className="camp-row-actions">
          <label className="camp-checkbox-line">
            <input
              type="checkbox"
              checked={ackUnavailable}
              onChange={(event) => {
                setAckUnavailable(event.target.checked);
                if (event.target.checked) setAckSignature(emptySignatureData());
              }}
            />
            <span>Unavailable or declined to initial</span>
          </label>
        </div>
        {ackUnavailable ? (
          <label className="field">
            <span>Reason required</span>
            <input className="input" value={ackReason} onChange={(event) => setAckReason(event.target.value)} />
          </label>
        ) : null}
      </section>

      {message ? <p className={message.tone === "error" ? "camp-cc-error" : "camp-save-message success"} role="status">{message.text}</p> : null}

      <button className="button primary" type="button" disabled={!canSubmit} onClick={() => void submit()}>
        {saving ? "Confirming administration..." : "Confirm Administration"}
      </button>

      <section aria-label="Administration history">
        <h2 className="camp-tool-group-title">Correction History</h2>
        <p className="camp-cc-muted">{ARCHIVE_HELPER_TEXT}</p>
        <label className="camp-checkbox-line">
          <input type="checkbox" checked={showArchivedHistory} onChange={(event) => void toggleArchivedHistory(event.target.checked)} />
          <span>Show archived</span>
        </label>
        {history.length ? (
          <div className="camp-list">
            {history.map((log) => (
              <div className={archiveClassName(log)} key={log.id}>
                <div>
                  <strong>{log.status} - {new Date(log.loggedAt).toLocaleString()}</strong>
                  <p className="camp-cc-muted">Logged by {log.loggedBy}. {log.notes}</p>
                  <p className="camp-cc-muted">
                    Acknowledgement: {formatStudentAcknowledgement(log)}
                  </p>
                  {archiveStatus(log)}
                  {parseStoredSignatureData(log.studentAcknowledgementInitials) ? (
                    <SignaturePreview value={parseStoredSignatureData(log.studentAcknowledgementInitials) as CampSignatureData} label={`Student acknowledgement preview for ${log.studentName}`} />
                  ) : null}
                </div>
                <div className="camp-row-actions">
                  <StatusPill tone={log.archivedAt ? "locked" : statusTone(log.status)}>{log.archivedAt ? "Archived" : log.auditStatus ?? "Active"}</StatusPill>
                  {!log.archivedAt ? <button className="button compact-button" type="button" onClick={() => void archiveLog(log)}>Archive</button> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No administration history is on file for this time block yet. Each save appends a new log.</EmptyState>
        )}
      </section>
      {scheduleEdit ? (
        <CampOperationDialog
          title="Edit Medication Time Block"
          description="Updates the selected administration block for this medication record."
          onClose={() => setScheduleEdit(null)}
          footer={
            <>
              <button className="button" type="button" disabled={saving} onClick={() => setScheduleEdit(null)}>Cancel</button>
              <button className="button primary" type="button" disabled={saving} onClick={() => void saveScheduleEdit()}>{saving ? "Saving..." : "Save Time Block"}</button>
            </>
          }
        >
          <div className="camp-field-grid">
            <label className="field">
              <span>Time block</span>
              <input className="input" value={scheduleEdit.timeWindow} onChange={(event) => setScheduleEdit({ ...scheduleEdit, timeWindow: event.target.value })} />
            </label>
            <label className="field">
              <span>Status</span>
              <select className="input" value={scheduleEdit.status} onChange={(event) => setScheduleEdit({ ...scheduleEdit, status: event.target.value as CampMedicationScheduleItem["status"] })}>
                <option value="Pending">Pending</option>
                <option value="Logged">Logged</option>
                <option value="Needs Parent Clarification">Needs Parent Clarification</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Parent-provided instructions</span>
            <textarea className="input" rows={3} value={scheduleEdit.parentProvidedInstructions} onChange={(event) => setScheduleEdit({ ...scheduleEdit, parentProvidedInstructions: event.target.value })} />
          </label>
        </CampOperationDialog>
      ) : null}
    </div>
  );
}

export function CampMedicineIntakeToolPage() {
  return (
    <ToolPageShell title="Medicine Intake / Return" subtitle="Restricted staff handoff records and return checklist.">
      <MedicationDataGate>
        {(data) => <MedicineIntakeReturnWorkflow data={data} />}
      </MedicationDataGate>
    </ToolPageShell>
  );
}

function MedicineIntakeReturnWorkflow({ data }: { data: MedicationPayload }) {
  const scanEnabled = data.scanEnabled === true;
  const [checkInRecords, setCheckInRecords] = useState(data.checkIn);
  const [intakeHistory, setIntakeHistory] = useState(data.intakeHistory);
  const [returnChecklist, setReturnChecklist] = useState(data.returnChecklist);
  const [showArchivedHistory, setShowArchivedHistory] = useState(false);
  const workflowVisibility = useMemo(
    () => getMedicineIntakeReturnVisibility({ checkIn: checkInRecords, intakeHistory, returnChecklist }, showArchivedHistory),
    [checkInRecords, intakeHistory, returnChecklist, showArchivedHistory]
  );
  const [medicationIdsWithPhoto, setMedicationIdsWithPhoto] = useState(() => new Set(checkInRecords.filter((record) => record.hasMedicationPhoto || record.medicinePhotoStatus === "Photo On File").map((record) => record.id)));
  const [medicationRecordId, setMedicationRecordId] = useState(data.checkIn[0]?.id ?? data.intakeHistory.find((item) => item.medicationRecordId && !item.archivedAt)?.medicationRecordId ?? "");
  const selectedMedication = medicationRecordId
    ? workflowVisibility.operationalMedicationRecords.find((record) => record.id === medicationRecordId)
    : undefined;
  const [selectedCamperId, setSelectedCamperId] = useState(selectedMedication?.studentId ?? data.campers[0]?.id ?? "");
  const selectedCamper = data.campers.find((camper) => camper.id === selectedCamperId);
  const [medicationName, setMedicationName] = useState(selectedMedication?.medicationName ?? "");
  const [dose, setDose] = useState("");
  const [scheduleText, setScheduleText] = useState(data.schedule.find((item) => item.medicationRecordId === selectedMedication?.id)?.timeWindow ?? "");
  const [quantityReceived, setQuantityReceived] = useState("");
  const [parentInstructions, setParentInstructions] = useState(selectedMedication?.parentProvidedInstructions ?? "");
  const [staffNotes, setStaffNotes] = useState("");
  const [containerStatus, setContainerStatus] = useState("Original labeled container received");
  const [receivedByName, setReceivedByName] = useState("Andrew");
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("Parent/Guardian");
  const [guardianSignature, setGuardianSignature] = useState<CampSignatureData>(() => emptySignatureData());
  const [clarificationStatus, setClarificationStatus] = useState<CampMedicationIntakeRecord["clarificationStatus"]>("Clear");
  const [draftMedications, setDraftMedications] = useState<IntakeDraftMedication[]>([]);
  const [editingDraftId, setEditingDraftId] = useState("");
  const [confirmationAcknowledged, setConfirmationAcknowledged] = useState(false);
  const [intakePhotoFile, setIntakePhotoFile] = useState<File | null>(null);
  const [intakePhotoPreviewUrl, setIntakePhotoPreviewUrl] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [photoUpload, setPhotoUpload] = useState<{
    status: "idle" | "uploading" | "uploaded" | "failed";
    medicationRecordId?: string;
    intakeRecordId?: string;
    file?: File;
    error?: string;
  }>({ status: "idle" });
  const [photoModal, setPhotoModal] = useState<{ url: string; title: string } | null>(null);
  const [returnItemId, setReturnItemId] = useState(returnChecklist[0]?.id ?? "");
  const selectedReturn = workflowVisibility.operationalReturnChecklist.find((item) => item.id === returnItemId) ?? workflowVisibility.operationalReturnChecklist[0];
  const [returnStatus, setReturnStatus] = useState<CampMedicationReturnItem["returnStatus"]>(selectedReturn?.returnStatus ?? "Pending Return");
  const [returnedBy, setReturnedBy] = useState("Andrew");
  const [recipientName, setRecipientName] = useState(selectedReturn?.recipientName ?? "");
  const [recipientRelationship, setRecipientRelationship] = useState(selectedReturn?.recipientRelationship ?? "");
  const [returnNotes, setReturnNotes] = useState(selectedReturn?.returnNotes ?? "");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState<"intake" | "return" | null>(null);
  const scanVideoRef = useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanStage, setScanStage] = useState<"camera" | "review">("camera");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [scanResult, setScanResult] = useState<MedicationLabelScanResponse | null>(null);
  const [scanReview, setScanReview] = useState<MedicationLabelScanReview>(() => emptyMedicationScanReview());

  useEffect(() => {
    if (!intakePhotoFile) {
      setIntakePhotoPreviewUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(intakePhotoFile);
    setIntakePhotoPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [intakePhotoFile]);

  useEffect(() => {
    if (!scanDialogOpen || scanStage !== "camera") return;
    let cancelled = false;
    const videoElement = scanVideoRef.current;

    async function startCamera() {
      setScanBusy(true);
      setScanMessage("Starting camera...");
      if (!navigator.mediaDevices?.getUserMedia) {
        setScanBusy(false);
        setScanMessage("Camera is unavailable in this browser. Continue with manual entry.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        scanStreamRef.current = stream;
        if (videoElement) {
          videoElement.srcObject = stream;
          await videoElement.play().catch(() => undefined);
        }
        setScanMessage("");
      } catch {
        setScanMessage("Camera could not be opened. Continue with manual entry.");
      } finally {
        if (!cancelled) setScanBusy(false);
      }
    }

    void startCamera();
    return () => {
      cancelled = true;
      scanStreamRef.current?.getTracks().forEach((track) => track.stop());
      scanStreamRef.current = null;
      if (videoElement) videoElement.srcObject = null;
    };
  }, [scanDialogOpen, scanStage]);

  useEffect(() => {
    if (!selectedMedication) return;
    setSelectedCamperId(selectedMedication.studentId);
    setMedicationName(selectedMedication.medicationName);
    setParentInstructions(selectedMedication.parentProvidedInstructions);
    setScheduleText(data.schedule.find((item) => item.medicationRecordId === selectedMedication.id)?.timeWindow ?? "");
  }, [data.schedule, selectedMedication]);

  useEffect(() => {
    if (medicationRecordId && !selectedMedication && workflowVisibility.operationalMedicationRecords[0]) {
      setMedicationRecordId(workflowVisibility.operationalMedicationRecords[0].id);
    }
  }, [medicationRecordId, selectedMedication, workflowVisibility.operationalMedicationRecords]);

  useEffect(() => {
    if (!selectedCamperId && data.campers[0]) setSelectedCamperId(data.campers[0].id);
  }, [data.campers, selectedCamperId]);

  useEffect(() => {
    if (!selectedReturn) return;
    setReturnStatus(selectedReturn.returnStatus);
    setRecipientName(selectedReturn.recipientName ?? "");
    setRecipientRelationship(selectedReturn.recipientRelationship ?? "");
    setReturnNotes(selectedReturn.returnNotes ?? "");
  }, [selectedReturn]);

  function selectIntakePhoto(file: File | null) {
    setIntakePhotoFile(file);
    if (file) setPhotoUpload({ status: "idle" });
    setPhotoMessage(file ? "Medication photo selected. It will save with this parent handoff." : "Medication photo capture cancelled. Intake can still be saved without a photo.");
  }

  function openScanDialog() {
    if (!scanEnabled) {
      setMessage({ tone: "error", text: MEDICATION_SCAN_DISABLED_MESSAGE });
      return;
    }
    setMessage(null);
    setScanDialogOpen(true);
    setScanBusy(false);
    resetScanReviewState();
  }

  function closeScanDialog() {
    setScanDialogOpen(false);
    setScanBusy(false);
    resetScanReviewState();
  }

  async function readLabelFromCamera() {
    const video = scanVideoRef.current;
    const canvas = scanCanvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setScanMessage("Camera frame is not ready yet. Try again, or continue with manual entry.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setScanMessage("Camera frame could not be prepared. Continue with manual entry.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) {
      setScanMessage("Camera frame could not be read. Continue with manual entry.");
      return;
    }

    await submitMedicationLabelFrame(new File([blob], "medication-label-frame.jpg", { type: "image/jpeg" }));
  }

  async function submitMedicationLabelFrame(file: File) {
    setScanBusy(true);
    setScanMessage("Reading label...");
    setScanResult(null);
    try {
      const formData = new FormData();
      formData.set("frame", file);
      const response = await fetch("/api/camp/medication/scan-label", { method: "POST", body: formData });
      const body = await response.json().catch(() => ({})) as MedicationLabelScanResponse;
      if (!response.ok) {
        setScanMessage(body.error ?? "Scan Label failed. Continue with manual entry.");
        setScanResult(body);
        return;
      }

      setScanResult(body);
      setScanReview(reviewFromMedicationScan(body));
      setScanStage("review");
      setScanMessage("");
    } catch {
      setScanMessage("Scan Label failed. Continue with manual entry.");
    } finally {
      setScanBusy(false);
    }
  }

  function saveReviewedMedicationRow() {
    const reviewedInstructions = [scanReview.directions, scanReview.instructions].map((value) => value.trim()).filter(Boolean).join("\n");
    const reviewedMedicationName = scanReview.medicationName.trim();
    const reviewedDose = scanReview.dose.trim();
    const reviewedSchedule = scanReview.suggestedTimesText.trim();
    const reviewedQuantity = scanReview.quantityReceived.trim();

    if (!selectedCamper || !reviewedMedicationName || !reviewedDose || !reviewedSchedule || !reviewedQuantity || !reviewedInstructions) {
      setScanMessage("Complete medication name, dose, suggested times, quantity, and instructions before saving this row.");
      return;
    }

    setDraftMedications((current) => [
      ...current,
      {
        clientId: `scan-${Date.now()}`,
        medicationRecordId: selectedMedication?.id,
        medicationName: reviewedMedicationName,
        dose: reviewedDose,
        scheduleText: reviewedSchedule,
        parentInstructions: reviewedInstructions,
        staffNotes,
        quantityReceived: reviewedQuantity,
        containerStatus,
        clarificationStatus,
        scheduleType: /\bprn\b|as needed/i.test(reviewedSchedule) ? "prn" : reviewedSchedule ? "scheduled" : "needs_review",
        isPrn: /\bprn\b|as needed/i.test(reviewedSchedule)
      }
    ]);
    setEditingDraftId("");
    resetMedicationEntryFields();
    setMessage({ tone: "success", text: "Reviewed scan row added to this intake session. Complete Intake saves the grouped medication record." });
    closeScanDialog();
  }

  function currentDraftMedication(): IntakeDraftMedication {
    return {
      clientId: editingDraftId || `draft-${Date.now()}`,
      medicationRecordId: selectedMedication?.id,
      medicationName,
      dose,
      scheduleText,
      parentInstructions,
      staffNotes,
      quantityReceived,
      containerStatus,
      clarificationStatus,
      scheduleType: /\bprn\b|as needed/i.test(scheduleText) ? "prn" : scheduleText.trim() ? "scheduled" : "needs_review",
      isPrn: /\bprn\b|as needed/i.test(scheduleText)
    };
  }

  function addOrUpdateMedicationRow() {
    setMessage(null);
    if (!validMedicationRow) {
      setMessage({ tone: "error", text: "Complete the medication row fields before adding it to this intake session." });
      return;
    }
    const row = currentDraftMedication();
    setDraftMedications((current) => editingDraftId
      ? current.map((item) => item.clientId === editingDraftId ? row : item)
      : [...current, row]);
    setEditingDraftId("");
    resetMedicationEntryFields();
  }

  function editMedicationRow(row: IntakeDraftMedication) {
    setEditingDraftId(row.clientId);
    setMedicationRecordId(row.medicationRecordId ?? "");
    setMedicationName(row.medicationName);
    setDose(row.dose);
    setScheduleText(row.scheduleText);
    setParentInstructions(row.parentInstructions);
    setStaffNotes(row.staffNotes ?? "");
    setQuantityReceived(row.quantityReceived);
    setContainerStatus(row.containerStatus);
    setClarificationStatus(row.clarificationStatus ?? "Clear");
    setMessage(null);
  }

  function removeMedicationRow(clientId: string) {
    setDraftMedications((current) => current.filter((item) => item.clientId !== clientId));
    if (editingDraftId === clientId) setEditingDraftId("");
  }

  async function openMedicationPhoto(medicationId: string, title: string) {
    setPhotoMessage("");
    const response = await fetch(`/api/camp/medication/photos?medicationRecordId=${encodeURIComponent(medicationId)}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({})) as { signedUrl?: string; error?: string };
    if (!response.ok || !body.signedUrl) {
      setPhotoMessage(body.error ?? "Medication photo is unavailable from this account.");
      return;
    }
    setPhotoModal({ url: body.signedUrl, title });
  }

  const validMedicationRow = Boolean(
    selectedCamper &&
    medicationName.trim() &&
    dose.trim() &&
    scheduleText.trim() &&
    quantityReceived.trim() &&
    parentInstructions.trim() &&
    containerStatus.trim()
  );
  const validSessionFields = Boolean(
    selectedCamper &&
    receivedByName.trim() &&
    guardianName.trim() &&
    guardianRelationship.trim()
  );
  const medicationRowsForCompletion = useMemo(() => {
    const rows = [...draftMedications];
    if (validMedicationRow && !editingDraftId) {
      rows.push({
        clientId: "current",
        medicationRecordId: selectedMedication?.id,
        medicationName,
        dose,
        scheduleText,
        parentInstructions,
        staffNotes,
        quantityReceived,
        containerStatus,
        clarificationStatus,
        scheduleType: /\bprn\b|as needed/i.test(scheduleText) ? "prn" : scheduleText.trim() ? "scheduled" : "needs_review",
        isPrn: /\bprn\b|as needed/i.test(scheduleText)
      });
    }
    return rows;
  }, [clarificationStatus, containerStatus, dose, draftMedications, editingDraftId, medicationName, parentInstructions, quantityReceived, scheduleText, selectedMedication?.id, staffNotes, validMedicationRow]);
  const canSaveIntake = validSessionFields && medicationRowsForCompletion.length > 0 && hasSignature(guardianSignature) && confirmationAcknowledged && saving === null;

  async function saveIntake() {
    setMessage(null);
    if (!selectedCamper) {
      setMessage({ tone: "error", text: "Choose an active camper before saving medication intake." });
      return;
    }
    if (!hasSignature(guardianSignature)) {
      setMessage({ tone: "error", text: "Parent/guardian handoff signature is required." });
      return;
    }
    if (!confirmationAcknowledged) {
      setMessage({ tone: "error", text: "Confirm that the handoff details were reviewed with the parent/guardian." });
      return;
    }

    if (!validSessionFields) {
      setMessage({ tone: "error", text: "Complete the camper, staff, and guardian fields before completing intake." });
      return;
    }

    if (!medicationRowsForCompletion.length) {
      setMessage({ tone: "error", text: "Add at least one medication before completing intake." });
      return;
    }

    setSaving("intake");
    const response = await fetch("/api/camp/medication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "intakeSession",
        studentId: selectedCamper.id,
        medications: medicationRowsForCompletion.map((row) => ({
          medicationRecordId: row.medicationRecordId,
          medicationName: row.medicationName,
          dose: row.dose,
          scheduleText: row.scheduleText,
          parentInstructions: row.parentInstructions,
          staffNotes: row.staffNotes,
          quantityReceived: row.quantityReceived,
          containerStatus: row.containerStatus,
          clarificationStatus: row.clarificationStatus,
          scheduleType: row.scheduleType,
          isPrn: row.isPrn,
          correctionNote: row.correctionNote
        })),
        receivedByName,
        guardianName,
        guardianRelationship,
        guardianSignatureData: guardianSignature,
        clarificationStatus,
        confirmationAcknowledged
      })
    });
    const body = await response.json().catch(() => ({})) as { error?: string; intakes?: CampMedicationIntakeRecord[]; records?: CampMedicationRecord[] };
    setSaving(null);
    if (!response.ok || !body.intakes?.length) {
      setMessage({ tone: "error", text: body.error ?? "Medication intake could not be saved." });
      return;
    }

    const selectedPhotoFile = intakePhotoFile;

    setIntakeHistory((current) => [...(body.intakes as CampMedicationIntakeRecord[]), ...current]);
    if (body.records?.length) {
      setCheckInRecords((current) => {
        let next = [...current];
        for (const record of body.records as CampMedicationRecord[]) {
          const existing = next.some((item) => item.id === record.id);
          next = existing ? next.map((item) => item.id === record.id ? record : item) : [record, ...next];
        }
        return next;
      });
    }
    setMessage({ tone: "success", text: `Saved. Medication intake recorded with parent/guardian acknowledgement. ${body.intakes.length} medication row${body.intakes.length === 1 ? "" : "s"} completed in this intake session.` });
    setDraftMedications([]);
    setEditingDraftId("");
    resetMedicationEntryFields();
    setGuardianName("");
    setGuardianRelationship("Parent/Guardian");
    setGuardianSignature(emptySignatureData());
    setIntakePhotoFile(null);
    setPhotoMessage("");
    setPhotoUpload({ status: "idle" });
    setConfirmationAcknowledged(false);
    closeScanDialog();
    if (selectedPhotoFile && body.intakes[0]?.medicationRecordId) {
      void uploadIntakePhotoInBackground(body.intakes[0].medicationRecordId, body.intakes[0].id, selectedPhotoFile);
    }
  }

  async function uploadIntakePhotoInBackground(medicationRecordId: string, intakeRecordId: string, file: File) {
    setPhotoUpload({ status: "uploading", medicationRecordId, intakeRecordId, file });
    setPhotoMessage("Photo uploading");
    try {
      const preparedFile = await prepareCampImageFile(file, "medicationLabel");
      const formData = new FormData();
      formData.set("medicationRecordId", medicationRecordId);
      formData.set("intakeRecordId", intakeRecordId);
      formData.set("photo", preparedFile);
      const photoResponse = await fetch("/api/camp/medication/photos", { method: "POST", body: formData });
      const photoBody = await photoResponse.json().catch(() => ({})) as { error?: string };
      if (!photoResponse.ok) {
        setPhotoUpload({ status: "failed", medicationRecordId, intakeRecordId, file, error: photoBody.error ?? "Photo upload failed." });
        setPhotoMessage("Photo upload failed");
        return;
      }
      setMedicationIdsWithPhoto((current) => new Set(current).add(medicationRecordId));
      setPhotoUpload({ status: "uploaded" });
      setPhotoMessage("Photo uploaded");
    } catch (error) {
      setPhotoUpload({ status: "failed", medicationRecordId, intakeRecordId, file, error: error instanceof Error ? error.message : "Photo upload failed." });
      setPhotoMessage("Photo upload failed");
    }
  }

  function retryIntakePhotoUpload() {
    if (!photoUpload.medicationRecordId || !photoUpload.intakeRecordId || !photoUpload.file) return;
    void uploadIntakePhotoInBackground(photoUpload.medicationRecordId, photoUpload.intakeRecordId, photoUpload.file);
  }

  async function saveReturn() {
    setMessage(null);
    if (!selectedReturn) {
      setMessage({ tone: "error", text: "Choose a return checklist item before saving." });
      return;
    }

    setSaving("return");
    const response = await fetch("/api/camp/medication", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "return",
        id: selectedReturn.id,
        returnStatus,
        returnedBy,
        recipientName,
        recipientRelationship,
        returnNotes
      })
    });
    const body = await response.json().catch(() => ({})) as { error?: string; item?: CampMedicationReturnItem };
    setSaving(null);
    if (!response.ok || !body.item) {
      setMessage({ tone: "error", text: body.error ?? "Medication return could not be saved." });
      return;
    }
    setReturnChecklist((current) => current.map((item) => item.id === body.item?.id ? body.item : item));
    setMessage({ tone: "success", text: "Medication return status updated." });
  }

  async function toggleArchivedHistory(nextValue: boolean) {
    setShowArchivedHistory(nextValue);
    const response = await fetch(nextValue ? "/api/camp/medication?includeArchived=true" : "/api/camp/medication", { cache: "no-store" });
    const body = await response.json().catch(() => ({})) as Partial<MedicationPayload>;
    if (response.ok) {
      if (body.intakeHistory) setIntakeHistory(body.intakeHistory);
      if (body.returnChecklist) {
        setReturnChecklist(body.returnChecklist);
        const nextVisibleReturns = getMedicineIntakeReturnVisibility({ checkIn: checkInRecords, intakeHistory, returnChecklist: body.returnChecklist }, nextValue).operationalReturnChecklist;
        if (!nextVisibleReturns.some((item) => item.id === returnItemId)) setReturnItemId(nextVisibleReturns[0]?.id ?? "");
      }
    }
  }

  function clearNewMedicationFields() {
    setMedicationName("");
    setParentInstructions("");
    setScheduleText("");
  }

  function resetMedicationEntryFields() {
    setMedicationRecordId("");
    clearNewMedicationFields();
    setDose("");
    setQuantityReceived("");
    setStaffNotes("");
    setContainerStatus("Original labeled container received");
    setClarificationStatus("Clear");
  }

  function resetScanReviewState() {
    setScanStage("camera");
    setScanMessage("");
    setScanResult(null);
    setScanReview(emptyMedicationScanReview());
  }

  async function archiveWorkflowHistory(target: "intake" | "return", id: string) {
    if (!window.confirm("Hide this item from the active view? Archived items remain in the medical audit history.")) return;
    setMessage(null);
    try {
      const archived = await archiveMedicationHistoryItem(target, id, "Resolved edit hidden from active Medical Command view.");
      if (target === "intake") setIntakeHistory((current) => current.map((item) => item.id === id ? { ...item, ...archived } : item));
      if (target === "return") {
        setReturnChecklist((current) => current.map((item) => item.id === id ? { ...item, ...archived } : item));
      }
      setMessage({ tone: "success", text: "History item archived." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "History item could not be archived." });
    }
  }

  if (!data.campers.length) {
    return <EmptyState>No active campers are available for medication intake. Confirm the Oakwood roster import committed active campers for the current Camp Oakwood session.</EmptyState>;
  }

  return (
    <div className="camp-tool-workflow">
      <section className="camp-admin-form" aria-label="Medication intake handoff">
        <h2 className="camp-tool-group-title">{selectedCamper ? `Medication Intake for ${selectedCamper.name}` : "Medication Intake"}</h2>
        <p className="camp-cc-muted">Add every medication for this camper, review the list, then complete intake once with one parent/guardian acknowledgement.</p>
        {data.campers.length ? (
          <>
            <label className="field">
              <span>Camper</span>
              <select className="input" value={selectedCamperId} onChange={(event) => { setSelectedCamperId(event.target.value); setDraftMedications([]); setEditingDraftId(""); resetMedicationEntryFields(); resetScanReviewState(); }} aria-label="Camper">
                {data.campers.map((camper) => (
                  <option key={camper.id} value={camper.id}>{camper.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Camper medication record</span>
              <select className="input" value={medicationRecordId} onChange={(event) => { setMedicationRecordId(event.target.value); if (!event.target.value) resetMedicationEntryFields(); }} aria-label="Camper medication record">
                <option value="">New medication for selected camper</option>
                {workflowVisibility.operationalMedicationRecords.map((record) => (
                  <option key={record.id} value={record.id}>{record.studentName} - {record.medicationName}</option>
                ))}
              </select>
            </label>
            <div className="camp-form-grid">
              <label className="field">
                <span>Medication name/type</span>
                <input className="input" value={medicationName} onChange={(event) => setMedicationName(event.target.value)} />
              </label>
              <label className="field">
                <span>Dose</span>
                <input className="input" value={dose} onChange={(event) => setDose(event.target.value)} placeholder="As written on parent label" />
              </label>
              <label className="field">
                <span>Scheduled time(s)</span>
                <input className="input" value={scheduleText} onChange={(event) => setScheduleText(event.target.value)} />
              </label>
              <label className="field">
                <span>Quantity received</span>
                <input className="input" value={quantityReceived} onChange={(event) => setQuantityReceived(event.target.value)} placeholder="Example: 10 tablets" />
              </label>
            </div>
            <label className="field">
              <span>Parent/guardian instructions</span>
              <textarea className="input" rows={3} value={parentInstructions} onChange={(event) => setParentInstructions(event.target.value)} />
            </label>
            <div className="camp-form-grid">
              <label className="field">
                <span>Container status</span>
                <input className="input" value={containerStatus} onChange={(event) => setContainerStatus(event.target.value)} />
              </label>
              <label className="field">
                <span>Received by leader/staff</span>
                <input className="input" value={receivedByName} onChange={(event) => setReceivedByName(event.target.value)} />
              </label>
              <label className="field">
                <span>Parent/guardian name</span>
                <input className="input" value={guardianName} onChange={(event) => setGuardianName(event.target.value)} />
              </label>
              <label className="field">
                <span>Relationship</span>
                <input className="input" value={guardianRelationship} onChange={(event) => setGuardianRelationship(event.target.value)} />
              </label>
            </div>
            <label className="field">
              <span>Staff notes</span>
              <textarea className="input" rows={3} value={staffNotes} onChange={(event) => setStaffNotes(event.target.value)} />
            </label>
            <label className="field">
              <span>Clarification status</span>
              <select className="input" value={clarificationStatus} onChange={(event) => setClarificationStatus(event.target.value as CampMedicationIntakeRecord["clarificationStatus"])}>
                <option value="Clear">Clear</option>
                <option value="Needs Parent Clarification">Needs Parent Clarification</option>
              </select>
            </label>
            <div className="camp-row-actions">
              <button className="button compact-button" type="button" onClick={addOrUpdateMedicationRow}>
                {editingDraftId ? "Update Medication Row" : "Add Medication Manually"}
              </button>
              <button
                className="button compact-button"
                type="button"
                disabled={!scanEnabled}
                title={scanEnabled ? "Open live prescription label scanner" : MEDICATION_SCAN_DISABLED_MESSAGE}
                onClick={openScanDialog}
              >
                Scan Label
              </button>
            </div>
            <section aria-label="Live label scan">
              <h3 className="camp-tool-group-title">Live Label Scan</h3>
              {scanEnabled ? (
                <>
                  <p className="camp-cc-muted">Optional camera helper for reducing typing. Manual medication entry remains available if scanning fails.</p>
                  <p className="camp-cc-muted">The scanner uses server-side transient frame processing with no permanent image storage.</p>
                  <p className="camp-cc-muted">{MEDICATION_SCAN_WARNING}</p>
                </>
              ) : (
                <p className="camp-cc-muted">{MEDICATION_SCAN_DISABLED_MESSAGE} Manual medication entry remains available.</p>
              )}
            </section>
            <section aria-label="Current medications for intake">
              <h3 className="camp-tool-group-title">Current Medications</h3>
              {medicationRowsForCompletion.length ? (
                <div className="camp-list">
                  {medicationRowsForCompletion.map((row) => (
                    <div className="camp-list-row align-start" key={row.clientId}>
                      <div>
                        <strong>{row.medicationName}</strong>
                        <p className="camp-cc-muted">{row.dose} | {row.scheduleText || "Needs schedule review"} | {row.quantityReceived}</p>
                      </div>
                      <div className="camp-row-actions">
                        {row.clientId !== "current" ? <button className="button compact-button" type="button" onClick={() => editMedicationRow(row)}>Edit</button> : null}
                        {row.clientId !== "current" ? <button className="button compact-button" type="button" onClick={() => removeMedicationRow(row.clientId)}>Remove</button> : null}
                        {row.isPrn ? <StatusPill tone="locked">PRN</StatusPill> : row.scheduleType === "needs_review" ? <StatusPill tone="warn">Needs schedule</StatusPill> : <StatusPill tone="ready">Scheduled</StatusPill>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>No medications added to this intake session yet.</EmptyState>
              )}
            </section>
            <section className="camp-intake-photo-section" aria-labelledby="intake-medication-photo">
              <div>
                <h3 id="intake-medication-photo">Medication label / container photo (optional)</h3>
                <p className="camp-cc-muted">Photograph the original labeled medication container at parent handoff.</p>
              </div>
              <div className="camp-photo-actions">
                <label className="button compact-button">
                  <span>Take photo</span>
                  <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => selectIntakePhoto(event.target.files?.[0] ?? null)} />
                </label>
                <label className="button compact-button">
                  <span>Upload photo</span>
                  <input className="sr-only" type="file" accept="image/*" onChange={(event) => selectIntakePhoto(event.target.files?.[0] ?? null)} />
                </label>
              </div>
              {intakePhotoPreviewUrl ? (
                <div className="camp-photo-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={intakePhotoPreviewUrl} alt="Selected medication label or container preview" />
                  <div className="camp-photo-preview-actions">
                    <span className="camp-status ready">{intakePhotoFile?.name ? `Photo selected: ${intakePhotoFile.name}` : "Photo selected"}</span>
                    <label className="button compact-button">
                      <span>Replace photo</span>
                      <input className="sr-only" type="file" accept="image/*" onChange={(event) => selectIntakePhoto(event.target.files?.[0] ?? null)} />
                    </label>
                    <button className="button compact-button" type="button" onClick={() => { setIntakePhotoFile(null); setPhotoMessage("Medication photo removed. Intake can still be saved without a photo."); }}>Remove photo</button>
                  </div>
                </div>
              ) : null}
              {photoMessage ? <p className={photoUpload.status === "failed" ? "camp-save-message error" : "camp-save-message"} role="status">{photoMessage}</p> : null}
              {photoUpload.status === "failed" ? (
                <button className="button compact-button" type="button" onClick={retryIntakePhotoUpload}>Retry upload</button>
              ) : null}
            </section>
            <SignaturePad
              value={guardianSignature}
              onChange={setGuardianSignature}
              label="Parent or guardian signature"
              description="Restricted handoff acknowledgement captured with finger, mouse, or stylus."
            />
            <label className="camp-checkbox-line">
              <input type="checkbox" checked={confirmationAcknowledged} onChange={(event) => setConfirmationAcknowledged(event.target.checked)} />
              <span>Parent/guardian handoff details reviewed with staff.</span>
            </label>
            <button className="button primary" type="button" disabled={!canSaveIntake} onClick={() => void saveIntake()}>
              {saving === "intake" ? "Completing intake..." : "Complete Intake"}<span className="sr-only"> Save medication intake</span>
            </button>
          </>
        ) : (
          <EmptyState>No medication intake records are available to continue intake.</EmptyState>
        )}
      </section>

      {scanDialogOpen ? (
        <CampOperationDialog
          title={scanStage === "review" ? "Review Scanned Medication" : "Scan Prescription Label"}
          description={scanStage === "review" ? "Edit every field against the physical bottle before saving this medication row." : "Point the camera at the prescription label. No photo will be saved."}
          onClose={closeScanDialog}
        >
          {scanStage === "camera" ? (
            <section className="camp-label-scan" aria-label="Scan Prescription Label">
              <p className="camp-cc-muted">Point the camera at the prescription label. No photo will be saved.</p>
              <div className="camp-label-scan-viewfinder">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={scanVideoRef} autoPlay muted playsInline />
              </div>
              <canvas ref={scanCanvasRef} hidden />
              {scanMessage ? <p className={scanResult?.error ? "camp-save-message error" : "camp-save-message"} role={scanResult?.error ? "alert" : "status"}>{scanMessage}</p> : null}
              <div className="camp-row-actions">
                <button className="button primary" type="button" disabled={scanBusy} onClick={() => void readLabelFromCamera()}>
                  {scanBusy ? "Reading Label..." : "Read Label"}
                </button>
                <label className="button compact-button">
                  <span>Use Temporary Image</span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={scanBusy}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      if (file) void submitMedicationLabelFrame(file);
                    }}
                  />
                </label>
                <button className="button compact-button" type="button" onClick={closeScanDialog}>Cancel</button>
              </div>
            </section>
          ) : (
            <section className="camp-label-scan-review" aria-label="Review Scanned Medication">
              <div className="camp-form-grid">
                <label className="field">
                  <span>Student name on label</span>
                  <input className="input" value={scanReview.studentNameOnLabel} onChange={(event) => setScanReview((current) => ({ ...current, studentNameOnLabel: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Medication name</span>
                  <input className="input" value={scanReview.medicationName} onChange={(event) => setScanReview((current) => ({ ...current, medicationName: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Dose / strength</span>
                  <input className="input" value={scanReview.dose} onChange={(event) => setScanReview((current) => ({ ...current, dose: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Suggested time(s)</span>
                  <input className="input" value={scanReview.suggestedTimesText} onChange={(event) => setScanReview((current) => ({ ...current, suggestedTimesText: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Quantity received</span>
                  <input className="input" value={scanReview.quantityReceived} onChange={(event) => setScanReview((current) => ({ ...current, quantityReceived: event.target.value }))} />
                </label>
              </div>
              <label className="field">
                <span>Directions</span>
                <textarea className="input" rows={3} value={scanReview.directions} onChange={(event) => setScanReview((current) => ({ ...current, directions: event.target.value }))} />
              </label>
              <label className="field">
                <span>Instructions / notes</span>
                <textarea className="input" rows={3} value={scanReview.instructions} onChange={(event) => setScanReview((current) => ({ ...current, instructions: event.target.value }))} />
              </label>
              <p className="camp-cc-muted">Confidence: <strong>{scanResult?.confidence ?? "low"}</strong></p>
              {scanResult?.warnings?.length ? (
                <ul className="camp-label-scan-warnings">
                  {scanResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              ) : null}
              <p className="camp-save-message warning" role="status">{MEDICATION_SCAN_WARNING}</p>
              {scanMessage ? <p className="camp-save-message error" role="alert">{scanMessage}</p> : null}
              <div className="camp-row-actions">
                <button className="button primary" type="button" onClick={saveReviewedMedicationRow}>Save Medication Row</button>
                <button className="button compact-button" type="button" onClick={() => { setScanStage("camera"); setScanResult(null); setScanReview(emptyMedicationScanReview()); setScanMessage(""); }}>Scan Again</button>
                <button className="button compact-button" type="button" onClick={closeScanDialog}>Cancel</button>
              </div>
              <p className="camp-cc-muted">Saving this row only adds it to the current intake session list. Complete Intake saves the grouped medication record.</p>
            </section>
          )}
        </CampOperationDialog>
      ) : null}

      <section className="camp-admin-form" aria-label="Medication return checkout">
        <h2 className="camp-tool-group-title">Record medication return / checkout</h2>
        {workflowVisibility.operationalReturnChecklist.length ? (
          <>
            <label className="field">
              <span>Return checklist item</span>
              <select className="input" value={returnItemId} onChange={(event) => setReturnItemId(event.target.value)} aria-label="Return checklist item">
                {workflowVisibility.operationalReturnChecklist.map((item) => (
                  <option key={item.id} value={item.id}>{item.studentName} - {item.returnStatus}</option>
                ))}
              </select>
            </label>
            <div className="camp-form-grid">
              <label className="field">
                <span>Return status</span>
                <select className="input" value={returnStatus} onChange={(event) => setReturnStatus(event.target.value as CampMedicationReturnItem["returnStatus"])}>
                  <option value="Pending Return">Pending Return</option>
                  <option value="Returned to Parent/Guardian">Returned to Parent/Guardian</option>
                  <option value="Needs Parent Clarification">Needs Parent Clarification</option>
                  <option value="Not Returned / Follow-Up Needed">Not Returned / Follow-Up Needed</option>
                </select>
              </label>
              <label className="field">
                <span>Returned by staff</span>
                <input className="input" value={returnedBy} onChange={(event) => setReturnedBy(event.target.value)} />
              </label>
              <label className="field">
                <span>Recipient name</span>
                <input className="input" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
              </label>
              <label className="field">
                <span>Recipient relationship</span>
                <input className="input" value={recipientRelationship} onChange={(event) => setRecipientRelationship(event.target.value)} />
              </label>
            </div>
            <label className="field">
              <span>Return notes</span>
              <textarea className="input" rows={3} value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} />
            </label>
            <p className="camp-cc-muted">Return acknowledgement signatures are not in the current durable schema; record recipient acknowledgement in return notes until that field exists.</p>
            <button className="button primary" type="button" disabled={saving === "return"} onClick={() => void saveReturn()}>
              {saving === "return" ? "Saving return..." : "Save return status"}
            </button>
          </>
        ) : (
          <EmptyState>No return checklist items are available yet.</EmptyState>
        )}
      </section>

      {message ? <p className={message.tone === "error" ? "camp-save-message error" : "camp-save-message success"} role="status">{message.text}</p> : null}

      {photoModal ? (
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
        </div>
      ) : null}

      <section aria-label="Medical history archive controls">
        <h2 className="camp-tool-group-title">History visibility</h2>
        <p className="camp-cc-muted">{ARCHIVE_HELPER_TEXT}</p>
        <label className="camp-checkbox-line">
          <input type="checkbox" checked={showArchivedHistory} onChange={(event) => void toggleArchivedHistory(event.target.checked)} />
          <span>Show archived</span>
        </label>
      </section>

      <section aria-label="Recent medication intake records">
        <h2 className="camp-tool-group-title">Recent intake records</h2>
        {workflowVisibility.visibleIntakeHistory.length ? (
          <div className="camp-list">
            {workflowVisibility.visibleIntakeHistory.slice(0, 5).map((item) => (
              <div className={archiveClassName(item)} key={item.id}>
                <div>
                  <strong>{item.studentName} - {item.medicationName}</strong>
                  <p className="camp-cc-muted">{item.quantityReceived || "Quantity not recorded"} received by {item.receivedByName}.</p>
                  {archiveStatus(item)}
                  <SignaturePreview value={item.guardianSignatureData} label={`Parent or guardian signature preview for ${item.studentName}`} />
                  {item.medicationRecordId && medicationIdsWithPhoto.has(item.medicationRecordId) ? (
                    <button className="button compact-button" type="button" onClick={() => void openMedicationPhoto(item.medicationRecordId as string, `${item.studentName} - ${item.medicationName}`)}>
                      View Photo
                    </button>
                  ) : null}
                </div>
                <div className="camp-row-actions">
                  <StatusPill tone={item.archivedAt ? "locked" : statusTone(item.clarificationStatus)}>{item.archivedAt ? "Archived" : item.auditStatus ?? item.clarificationStatus}</StatusPill>
                  {!item.archivedAt ? <button className="button compact-button" type="button" onClick={() => void archiveWorkflowHistory("intake", item.id)}>Archive</button> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No intake records on file.</EmptyState>
        )}
      </section>

      <section aria-label="Recent medication return records">
        <h2 className="camp-tool-group-title">Recent return records</h2>
        {workflowVisibility.visibleReturnHistory.length ? (
          <div className="camp-list">
            {workflowVisibility.visibleReturnHistory.slice(0, 5).map((item) => (
              <div className={archiveClassName(item)} key={item.id}>
                <div>
                  <strong>{item.studentName} - {item.returnStatus}</strong>
                  <p className="camp-cc-muted">{item.returnNotes || "No return note on file."}</p>
                  {archiveStatus(item)}
                </div>
                <div className="camp-row-actions">
                  <StatusPill tone={item.archivedAt ? "locked" : statusTone(item.returnStatus)}>{item.archivedAt ? "Archived" : item.auditStatus ?? item.returnStatus}</StatusPill>
                  {!item.archivedAt ? <button className="button compact-button" type="button" onClick={() => void archiveWorkflowHistory("return", item.id)}>Archive</button> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No return records on file.</EmptyState>
        )}
      </section>
    </div>
  );
}

export function CampMedicationScheduleToolPage() {
  return (
    <ToolPageShell title="Medication Schedule" subtitle="Restricted staff schedule view. Medication names and dosing details stay restricted.">
      <MedicationDataGate>
        {(data) => data.schedule.length ? (
          <div className="camp-list">
            {data.schedule.map((item) => {
              const details = medicationDetailsForSchedule(data, item);
              return (
                <div className="camp-list-row align-start" key={item.id} data-testid={`camp-medication-schedule-card-${item.id}`}>
                  <div>
                    <strong>{item.studentName} - {item.timeWindow}</strong>
                    <p className="camp-cc-muted">{details.medicationName} - {details.dose}</p>
                    <p className="camp-cc-muted">{item.lastLoggedAt ? `Last logged ${new Date(item.lastLoggedAt).toLocaleString()} by ${item.lastLoggedBy || "staff"}.` : "No administration log on this schedule item yet."}</p>
                  </div>
                  <StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState>No medication schedule items are on file.</EmptyState>
        )}
      </MedicationDataGate>
    </ToolPageShell>
  );
}

export function CampMedicationHistoryToolPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [locallyArchived, setLocallyArchived] = useState<Record<string, { archivedAt: string; archivedByName: string; archiveReason: string }>>({});
  return (
    <ToolPageShell title="Medication History & Corrections" subtitle="Restricted audit history for intake, schedule, administration, and return records.">
      <MedicationDataGate includeArchived={showArchived}>
        {(data) => {
          const baseEvents = [
            ...data.administrationLog.map((item) => ({ id: `log-${item.id}`, sourceId: item.id, target: "administrationLog" as const, title: `${item.studentName} - ${item.status}`, body: `${item.timeWindow} logged by ${item.loggedBy || "staff"}`, status: item.auditStatus ?? "Active", archivedAt: item.archivedAt, archivedByName: item.archivedByName, archiveReason: item.archiveReason })),
            ...data.intakeHistory.map((item) => ({ id: `intake-${item.id}`, sourceId: item.id, target: "intake" as const, title: `${item.studentName} - intake`, body: item.receivedAt ? new Date(item.receivedAt).toLocaleString() : "Received time not recorded", status: item.auditStatus ?? "Active", archivedAt: item.archivedAt, archivedByName: item.archivedByName, archiveReason: item.archiveReason })),
            ...data.checkIn.map((item) => ({ id: `med-${item.id}`, sourceId: item.id, target: "medication" as const, title: `${item.studentName} - medication check-in`, body: item.medicationName, status: item.auditStatus ?? "Active", archivedAt: item.archivedAt, archivedByName: item.archivedByName, archiveReason: item.archiveReason })),
            ...data.schedule.map((item) => ({ id: `schedule-${item.id}`, sourceId: item.id, target: "schedule" as const, title: `${item.studentName} - medication schedule`, body: item.timeWindow, status: item.auditStatus ?? "Active", archivedAt: item.archivedAt, archivedByName: item.archivedByName, archiveReason: item.archiveReason })),
            ...data.returnChecklist.map((item) => ({ id: `return-${item.id}`, sourceId: item.id, target: "return" as const, title: `${item.studentName} - return`, body: item.returnNotes || item.returnStatus, status: item.auditStatus ?? "Active", archivedAt: item.archivedAt, archivedByName: item.archivedByName, archiveReason: item.archiveReason }))
          ];
          const events = baseEvents
            .map((event) => ({ ...event, ...locallyArchived[event.id] }))
            .filter((event) => showArchived || !event.archivedAt);
          const activeResolvedEvents = events.filter((event) => !event.archivedAt && event.status !== "Active");

          async function archiveEvent(event: typeof events[number]) {
            if (!window.confirm("Hide this history item from the active view? Archived items remain in the medical audit history.")) return;
            setMessage(null);
            try {
              const archived = await archiveMedicationHistoryItem(event.target, event.sourceId, "Resolved edit hidden from active Medical Command view.");
              setLocallyArchived((current) => ({ ...current, [event.id]: archived }));
              setMessage({ tone: "success", text: "History item archived." });
            } catch (error) {
              setMessage({ tone: "error", text: error instanceof Error ? error.message : "History item could not be archived." });
            }
          }

          async function archiveResolvedEdits() {
            if (!activeResolvedEvents.length) return;
            if (!window.confirm(`Archive ${activeResolvedEvents.length} resolved edit history item(s)? Archived items remain in the medical audit history.`)) return;
            setMessage(null);
            try {
              const archivedItems = await Promise.all(activeResolvedEvents.map(async (event) => ({
                event,
                archived: await archiveMedicationHistoryItem(event.target, event.sourceId, "Resolved edit hidden from active Medical Command view.")
              })));
              setLocallyArchived((current) => ({
                ...current,
                ...Object.fromEntries(archivedItems.map(({ event, archived }) => [event.id, archived]))
              }));
              setMessage({ tone: "success", text: "Resolved edit history items archived." });
            } catch (error) {
              setMessage({ tone: "error", text: error instanceof Error ? error.message : "Resolved edit history items could not be archived." });
            }
          }

          return events.length ? (
            <>
              <div className="camp-row-actions">
                <label className="camp-checkbox-line">
                  <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
                  <span>Show archived</span>
                </label>
                <button className="button compact-button" type="button" disabled={!activeResolvedEvents.length} onClick={() => void archiveResolvedEdits()}>
                  Archive resolved edits
                </button>
              </div>
              <p className="camp-cc-muted">{ARCHIVE_HELPER_TEXT}</p>
              {message ? <p className={message.tone === "error" ? "camp-save-message error" : "camp-save-message success"} role="status">{message.text}</p> : null}
              <div className="camp-list">
                {events.slice(0, 20).map((event) => (
                  <div className={archiveClassName(event)} key={event.id}>
                    <div>
                      <strong>{event.title}</strong>
                      <p className="camp-cc-muted">{event.body}</p>
                      {archiveStatus(event)}
                    </div>
                    <div className="camp-row-actions">
                      <StatusPill tone={event.archivedAt ? "locked" : event.status === "Active" ? undefined : "warn"}>{event.archivedAt ? "Archived" : event.status}</StatusPill>
                      {!event.archivedAt ? <button className="button compact-button" type="button" onClick={() => void archiveEvent(event)}>Archive</button> : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState>No medication history is on file yet.</EmptyState>
          );
        }}
      </MedicationDataGate>
    </ToolPageShell>
  );
}

export function CampMedicalQuickViewToolPage() {
  return (
    <ToolPageShell title="Medical Quick View" subtitle="Restricted operational flags only. Detailed notes remain in restricted records.">
      <MedicationDataGate>
        {(data) => data.checkIn.length ? (
          <div className="camp-list">
            {data.checkIn.map((record) => (
              <div className="camp-list-row align-start" key={record.id}>
                <div>
                  <strong>{record.studentName}</strong>
                  <p className="camp-cc-muted">Handoff: {record.checkInStatus}. Photo: {record.medicinePhotoStatus}. Clarification: {record.clarificationStatus}.</p>
                </div>
                <StatusPill tone={statusTone(record.checkInStatus)}>{record.checkInStatus}</StatusPill>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No restricted medical quick-view records are on file.</EmptyState>
        )}
      </MedicationDataGate>
    </ToolPageShell>
  );
}
