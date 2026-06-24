"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CampAccessAdminPanel } from "@/components/camp/camp-access-admin";
import { useCamp } from "@/components/camp/camp-provider";
import { prepareCampImageFile } from "@/lib/camp/client-image";
import type {
  CampDocument,
  CampMedicationAdministrationLog,
  CampMedicationArchiveInput,
  CampMedicationIntakeRecord,
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
  CampOakwoodImportPreview,
  CampScheduleBlock,
  CampSignatureData,
  CampVisibleStudent
} from "@/lib/camp/types";

type MedicationPayload = {
  checkIn: CampMedicationRecord[];
  schedule: CampMedicationScheduleItem[];
  administrationLog: CampMedicationAdministrationLog[];
  returnChecklist: CampMedicationReturnItem[];
  intakeHistory: CampMedicationIntakeRecord[];
};

type MedicationState =
  | { status: "idle" | "forbidden" | "loading" }
  | { status: "ready"; data: MedicationPayload }
  | { status: "error"; message: string };

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
  return <span className={tone ? `camp-status ${tone}` : "camp-status"}>{children}</span>;
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
            <div className="camp-list-row align-start" key={doc.id}>
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
          <CampAccessAdminPanel />
        </div>
      ) : (
        <RestrictedNotice required="medicalCommand" />
      )}
    </ToolPageShell>
  );
}

type OakwoodUploadField = "combinedFile" | "camperFile" | "staffFile";

const oakwoodUploadFields: Array<{ field: OakwoodUploadField; label: string; sheetField: string }> = [
  { field: "combinedFile", label: "Combined Oakwood workbook", sheetField: "combinedSheet" },
  { field: "camperFile", label: "Camper workbook", sheetField: "camperSheet" },
  { field: "staffFile", label: "Leaders/Staff workbook", sheetField: "staffSheet" }
];

function oakwoodPersonTypeLabel(personType: CampOakwoodImportPreview["rows"][number]["personType"]): string {
  return personType === "adult" ? "Leader/staff" : "Camper";
}

export function CampSettingsImportToolPage() {
  const { capabilities, refresh } = useCamp();
  const [sourceName, setSourceName] = useState("Camp Oakwood Upload");
  const [files, setFiles] = useState<Record<OakwoodUploadField, File | null>>({ combinedFile: null, camperFile: null, staffFile: null });
  const [sheetNames, setSheetNames] = useState<Record<OakwoodUploadField, string[]>>({ combinedFile: [], camperFile: [], staffFile: [] });
  const [selectedSheets, setSelectedSheets] = useState<Record<OakwoodUploadField, string>>({ combinedFile: "", camperFile: "", staffFile: "" });
  const [preview, setPreview] = useState<CampOakwoodImportPreview | null>(null);
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

  const hasFile = oakwoodUploadFields.some((item) => files[item.field]);
  const missingSheetLabels = oakwoodUploadFields
    .filter((item) => files[item.field] && sheetNames[item.field].length > 1 && !selectedSheets[item.field])
    .map((item) => item.label);

  function buildUploadForm(mode: "inspect" | "preview") {
    const formData = new FormData();
    formData.set("mode", mode);
    formData.set("sourceName", sourceName);
    for (const item of oakwoodUploadFields) {
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
    setConfirmed(false);
    setBusy("preview");
    const response = await fetch("/api/camp/import/upload", { method: "POST", body: buildUploadForm("preview") });
    const body = await response.json().catch(() => ({})) as { error?: string; preview?: CampOakwoodImportPreview };
    setBusy(null);
    if (!response.ok || !body.preview) {
      setMessage({ tone: "error", text: body.error ?? "Oakwood preview could not be created." });
      return;
    }
    setPreview(body.preview);
    setMessage({ tone: "success", text: "Oakwood preview ready. Nothing has been saved." });
  }

  async function commitPreview() {
    if (!preview || !confirmed) {
      setMessage({ tone: "error", text: "Review and confirm the preview before saving." });
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
    <ToolPageShell title="Import Camp Roster" subtitle="Camp Admin-only Oakwood roster/workbook upload with preview, validation, and explicit commit.">
      <div className="camp-tool-workflow">
        <section className="camp-admin-form" aria-label="Oakwood roster import">
          <p className="camp-cc-muted">Use this only for approved Oakwood roster/workbook imports. Uploads are inspected and previewed first; no roster data is saved automatically on upload.</p>
          <StatusPill tone="locked">Camp Admin only</StatusPill>
          <label className="field">
            <span>Import label</span>
            <input className="input" value={sourceName} onChange={(event) => setSourceName(event.target.value)} />
          </label>
          {oakwoodUploadFields.map((item) => (
            <div className="camp-list-row align-start" key={item.field}>
              <label className="field">
                <span>{item.label}</span>
                <input
                  className="input"
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/csv,application/vnd.ms-excel,application/octet-stream,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => {
                    const selectedFile = event.currentTarget.files?.[0] ?? null;
                    setFiles((current) => ({ ...current, [item.field]: selectedFile }));
                    setPreview(null);
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
          ))}
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

        {preview ? (
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
            <p className="camp-cc-muted">Restricted medical/contact/dietary fields stay in restricted storage on commit. Ambiguous or invalid rows block saving.</p>
            <label className="camp-checkbox-line">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              <span>I reviewed this Oakwood preview and approve saving the non-ambiguous rows.</span>
            </label>
            <button className="button primary" type="button" disabled={!confirmed || busy !== null || preview.summary.ambiguousCount > 0 || preview.summary.invalidCount > 0} onClick={() => void commitPreview()}>
              {busy === "commit" ? "Saving..." : "Save confirmed Oakwood import"}
            </button>
          </section>
        ) : null}

        {message ? <p className={message.tone === "error" ? "camp-save-message error" : "camp-save-message success"} role="status">{message.text}</p> : null}
      </div>
    </ToolPageShell>
  );
}

export function CampAdministerMedicineToolPage() {
  const searchParams = useSearchParams();
  return (
    <ToolPageShell title="Administer Medicine" subtitle="Andrew-only queue for medication administration.">
      <MedicationDataGate required="medicalCommand">
        {(data) => {
          const openItems = data.schedule.filter((item) => item.status !== "Logged");
          return data.schedule.length ? (
            <MedicationAdministrationForm data={data} openItems={openItems} requestedScheduleItemId={searchParams.get("scheduleItemId")} />
          ) : (
            <EmptyState>No open medication administration items are on file.</EmptyState>
          );
        }}
      </MedicationDataGate>
    </ToolPageShell>
  );
}

function MedicationAdministrationForm({
  data,
  openItems,
  requestedScheduleItemId
}: {
  data: MedicationPayload;
  openItems: CampMedicationScheduleItem[];
  requestedScheduleItemId: string | null;
}) {
  const activeItems = openItems.length ? openItems : data.schedule;
  const initialScheduleId = activeItems.some((item) => item.id === requestedScheduleItemId) ? requestedScheduleItemId ?? activeItems[0]?.id ?? "" : activeItems[0]?.id ?? "";
  const [scheduleItemId, setScheduleItemId] = useState(initialScheduleId);
  const [loggedBy, setLoggedBy] = useState("Andrew");
  const [status, setStatus] = useState<CampMedicationAdministrationLog["status"]>("Logged");
  const [notes, setNotes] = useState("");
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

  const selected = data.schedule.find((item) => item.id === scheduleItemId) ?? activeItems[0];
  const history = administrationLog.filter((log) => log.scheduleItemId === selected?.id && (showArchivedHistory || !log.archivedAt));
  const acknowledgementReady = ackUnavailable ? Boolean(ackReason.trim()) : hasSignature(ackSignature);
  const canSubmit = Boolean(selected) && Boolean(loggedBy.trim()) && acknowledgementReady && !saving;

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
        <select className="input" value={scheduleItemId} onChange={(event) => setScheduleItemId(event.target.value)}>
          {activeItems.map((item) => (
            <option key={item.id} value={item.id}>{item.studentName} - {item.timeWindow}</option>
          ))}
        </select>
      </label>

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
  const [intakeHistory, setIntakeHistory] = useState(data.intakeHistory);
  const [returnChecklist, setReturnChecklist] = useState(data.returnChecklist);
  const [showArchivedHistory, setShowArchivedHistory] = useState(false);
  const [medicationIdsWithPhoto, setMedicationIdsWithPhoto] = useState(() => new Set(data.checkIn.filter((record) => record.hasMedicationPhoto || record.medicinePhotoStatus === "Photo On File").map((record) => record.id)));
  const [medicationRecordId, setMedicationRecordId] = useState(data.checkIn[0]?.id ?? "");
  const selectedMedication = data.checkIn.find((record) => record.id === medicationRecordId) ?? data.checkIn[0];
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
  const visibleReturnChecklist = returnChecklist.filter((item) => showArchivedHistory || !item.archivedAt);
  const selectedReturn = visibleReturnChecklist.find((item) => item.id === returnItemId) ?? visibleReturnChecklist[0];
  const [returnStatus, setReturnStatus] = useState<CampMedicationReturnItem["returnStatus"]>(selectedReturn?.returnStatus ?? "Pending Return");
  const [returnedBy, setReturnedBy] = useState("Andrew");
  const [recipientName, setRecipientName] = useState(selectedReturn?.recipientName ?? "");
  const [recipientRelationship, setRecipientRelationship] = useState(selectedReturn?.recipientRelationship ?? "");
  const [returnNotes, setReturnNotes] = useState(selectedReturn?.returnNotes ?? "");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState<"intake" | "return" | null>(null);

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
    if (!selectedMedication) return;
    setMedicationName(selectedMedication.medicationName);
    setParentInstructions(selectedMedication.parentProvidedInstructions);
    setScheduleText(data.schedule.find((item) => item.medicationRecordId === selectedMedication.id)?.timeWindow ?? "");
  }, [data.schedule, selectedMedication]);

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

  const validIntakeFields = Boolean(
    selectedMedication &&
    medicationName.trim() &&
    dose.trim() &&
    scheduleText.trim() &&
    quantityReceived.trim() &&
    parentInstructions.trim() &&
    containerStatus.trim() &&
    receivedByName.trim() &&
    guardianName.trim() &&
    guardianRelationship.trim()
  );
  const canSaveIntake = validIntakeFields && hasSignature(guardianSignature) && confirmationAcknowledged && saving === null;

  async function saveIntake() {
    setMessage(null);
    if (!selectedMedication) {
      setMessage({ tone: "error", text: "Choose a camper medication record before saving intake." });
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

    if (!validIntakeFields) {
      setMessage({ tone: "error", text: "Complete the visible medication intake fields before saving." });
      return;
    }

    setSaving("intake");
    const response = await fetch("/api/camp/medication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "intake",
        medicationRecordId: selectedMedication.id,
        studentId: selectedMedication.studentId,
        medicationName,
        dose,
        scheduleText,
        parentInstructions,
        staffNotes,
        quantityReceived,
        containerStatus,
        receivedByName,
        guardianName,
        guardianRelationship,
        guardianSignatureData: guardianSignature,
        clarificationStatus,
        confirmationAcknowledged
      })
    });
    const body = await response.json().catch(() => ({})) as { error?: string; intake?: CampMedicationIntakeRecord };
    setSaving(null);
    if (!response.ok || !body.intake) {
      setMessage({ tone: "error", text: body.error ?? "Medication intake could not be saved." });
      return;
    }

    const selectedPhotoFile = intakePhotoFile;

    setIntakeHistory((current) => [body.intake as CampMedicationIntakeRecord, ...current]);
    setMessage({ tone: "success", text: "Saved. Medication intake recorded with parent/guardian acknowledgement." });
    setQuantityReceived("");
    setStaffNotes("");
    setGuardianName("");
    setGuardianRelationship("Parent/Guardian");
    setGuardianSignature(emptySignatureData());
    setIntakePhotoFile(null);
    setConfirmationAcknowledged(false);
    if (selectedPhotoFile && body.intake.medicationRecordId) {
      void uploadIntakePhotoInBackground(body.intake.medicationRecordId, body.intake.id, selectedPhotoFile);
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
        const nextVisibleReturns = body.returnChecklist.filter((item) => nextValue || !item.archivedAt);
        if (!nextVisibleReturns.some((item) => item.id === returnItemId)) setReturnItemId(nextVisibleReturns[0]?.id ?? "");
      }
    }
  }

  async function archiveWorkflowHistory(target: "intake" | "return", id: string) {
    if (!window.confirm("Hide this item from the active view? Archived items remain in the medical audit history.")) return;
    setMessage(null);
    try {
      const archived = await archiveMedicationHistoryItem(target, id, "Resolved edit hidden from active Medical Command view.");
      if (target === "intake") setIntakeHistory((current) => current.map((item) => item.id === id ? { ...item, ...archived } : item));
      if (target === "return") {
        setReturnChecklist((current) => current.map((item) => item.id === id ? { ...item, ...archived } : item));
        if (returnItemId === id) setReturnItemId(returnChecklist.find((item) => item.id !== id && !item.archivedAt)?.id ?? "");
      }
      setMessage({ tone: "success", text: "History item archived." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "History item could not be archived." });
    }
  }

  if (!data.checkIn.length) {
    return <EmptyState>No medication records are available for intake or return yet.</EmptyState>;
  }

  return (
    <div className="camp-tool-workflow">
      <section className="camp-admin-form" aria-label="Medication intake handoff">
        <h2 className="camp-tool-group-title">Record medication handoff / intake</h2>
        <p className="camp-cc-muted">Document original labeled containers, parent-provided dose/time/instructions, quantity, staff receipt, and parent/guardian handoff acknowledgement.</p>
        <label className="field">
          <span>Camper medication record</span>
          <select className="input" value={medicationRecordId} onChange={(event) => setMedicationRecordId(event.target.value)} aria-label="Camper medication record">
            {data.checkIn.map((record) => (
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
          {saving === "intake" ? "Saving intake..." : "Save medication intake"}
        </button>
      </section>

      <section className="camp-admin-form" aria-label="Medication return checkout">
        <h2 className="camp-tool-group-title">Record medication return / checkout</h2>
        {visibleReturnChecklist.length ? (
          <>
            <label className="field">
              <span>Return checklist item</span>
              <select className="input" value={returnItemId} onChange={(event) => setReturnItemId(event.target.value)} aria-label="Return checklist item">
                {visibleReturnChecklist.map((item) => (
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
        {intakeHistory.filter((item) => showArchivedHistory || !item.archivedAt).length ? (
          <div className="camp-list">
            {intakeHistory.filter((item) => showArchivedHistory || !item.archivedAt).slice(0, 5).map((item) => (
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
        {returnChecklist.filter((item) => showArchivedHistory || !item.archivedAt).length ? (
          <div className="camp-list">
            {returnChecklist.filter((item) => showArchivedHistory || !item.archivedAt).slice(0, 5).map((item) => (
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
            {data.schedule.map((item) => (
              <div className="camp-list-row align-start" key={item.id}>
                <div>
                  <strong>{item.studentName} - {item.timeWindow}</strong>
                  <p className="camp-cc-muted">{item.lastLoggedAt ? `Last logged ${new Date(item.lastLoggedAt).toLocaleString()} by ${item.lastLoggedBy || "staff"}.` : "No administration log on this schedule item yet."}</p>
                </div>
                <StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill>
              </div>
            ))}
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
