"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import type {
  CampDocument,
  CampMedicationAdministrationLog,
  CampMedicationIntakeRecord,
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
  CampScheduleBlock,
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

function useRestrictedMedicationData(required: "restricted" | "medicalCommand" = "restricted"): MedicationState {
  const { role, capabilities } = useCamp();
  const [state, setState] = useState<MedicationState>({ status: "idle" });
  const allowed = required === "medicalCommand" ? capabilities.medicalCommand : capabilities.restrictedMedical;

  useEffect(() => {
    if (!allowed) {
      setState({ status: "forbidden" });
      return;
    }

    let active = true;
    setState({ status: "loading" });
    fetch(`/api/camp/medication?role=${role}`, { cache: "no-store" })
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
  }, [allowed, role]);

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
  children
}: {
  required?: "restricted" | "medicalCommand";
  children: (data: MedicationPayload) => React.ReactNode;
}) {
  const state = useRestrictedMedicationData(required);
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
  const { role, overview, loading } = useCamp();
  const grouped = useMemo(() => {
    const map = new Map<string, CampVisibleStudent[]>();
    for (const student of overview.students) {
      const key = role === "driver" ? student.vehicleName : student.teamName ?? "Unassigned team";
      const list = map.get(key) ?? [];
      list.push(student);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [overview.students, role]);

  return (
    <ToolPageShell title="My Team / My Assignments" subtitle={role === "driver" ? "Transport-scoped assignments visible to this driver view." : "Team assignments visible to this Camp access view."}>
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
        <Link className="camp-cc-entry" href="/settings">
          <span className="camp-cc-entry-body">
            <strong>Open Platform Settings</strong>
            <span className="camp-cc-muted">Camp access management lives in Settings for approved administrators.</span>
          </span>
          <span className="camp-cc-entry-arrow" aria-hidden="true">&gt;</span>
        </Link>
      ) : (
        <RestrictedNotice required="medicalCommand" />
      )}
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
  const { role } = useCamp();
  const activeItems = openItems.length ? openItems : data.schedule;
  const initialScheduleId = activeItems.some((item) => item.id === requestedScheduleItemId) ? requestedScheduleItemId ?? activeItems[0]?.id ?? "" : activeItems[0]?.id ?? "";
  const [scheduleItemId, setScheduleItemId] = useState(initialScheduleId);
  const [loggedBy, setLoggedBy] = useState("Andrew");
  const [status, setStatus] = useState<CampMedicationAdministrationLog["status"]>("Logged");
  const [notes, setNotes] = useState("");
  const [initials, setInitials] = useState("");
  const [ackUnavailable, setAckUnavailable] = useState(false);
  const [ackReason, setAckReason] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeItems.some((item) => item.id === requestedScheduleItemId)) {
      setScheduleItemId(requestedScheduleItemId ?? "");
    }
  }, [activeItems, requestedScheduleItemId]);

  const selected = data.schedule.find((item) => item.id === scheduleItemId) ?? activeItems[0];
  const history = data.administrationLog.filter((log) => log.scheduleItemId === selected?.id);
  const canSubmit = Boolean(selected) && !saving;

  async function submit() {
    if (!selected) return;
    setMessage(null);
    if (ackUnavailable && !ackReason.trim()) {
      setMessage({ tone: "error", text: "Reason is required when the student is unavailable or declined to initial." });
      return;
    }
    if (!ackUnavailable && !initials.trim()) {
      setMessage({ tone: "error", text: "Student acknowledgement initials are required, or mark unavailable/declined with a reason." });
      return;
    }

    setSaving(true);
    const response = await fetch(`/api/camp/medication?role=${role}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "administrationLog",
        scheduleItemId: selected.id,
        loggedBy,
        status,
        notes,
        studentAcknowledgementInitials: initials,
        studentAcknowledgementUnavailable: ackUnavailable,
        studentAcknowledgementUnavailableReason: ackReason
      })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Medication administration could not be logged." });
      return;
    }
    setMessage({ tone: "success", text: "Medication administration logged. Student acknowledgement recorded as acknowledgement only." });
    setNotes("");
    setInitials("");
    setAckUnavailable(false);
    setAckReason("");
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
          <p className="camp-cc-muted">Initials confirm acknowledgement of the interaction. They are not consent, approval, or a medication-administration signature.</p>
        </div>
        <label className="field">
          <span>Student initials</span>
          <input
            className="input camp-ack-input"
            value={initials}
            onChange={(event) => setInitials(event.target.value.toUpperCase())}
            disabled={ackUnavailable}
            inputMode="text"
            maxLength={6}
            aria-label="Student acknowledgement initials"
          />
        </label>
        <div className="camp-row-actions">
          <button className="button compact-button" type="button" onClick={() => { setInitials(""); setAckUnavailable(false); setAckReason(""); }}>
            Clear and Re-sign
          </button>
          <label className="camp-checkbox-line">
            <input type="checkbox" checked={ackUnavailable} onChange={(event) => setAckUnavailable(event.target.checked)} />
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
        {saving ? "Logging administration..." : "Log medication administration"}
      </button>

      <section aria-label="Administration history">
        <h2 className="camp-tool-group-title">Correction History</h2>
        {history.length ? (
          <div className="camp-list">
            {history.map((log) => (
              <div className="camp-list-row align-start" key={log.id}>
                <div>
                  <strong>{log.status} - {new Date(log.loggedAt).toLocaleString()}</strong>
                  <p className="camp-cc-muted">Logged by {log.loggedBy}. {log.notes}</p>
                  <p className="camp-cc-muted">
                    Acknowledgement: {log.studentAcknowledgementUnavailable ? `Unavailable/declined - ${log.studentAcknowledgementUnavailableReason}` : log.studentAcknowledgementInitials || "Not recorded"}
                  </p>
                </div>
                <StatusPill tone={statusTone(log.status)}>{log.auditStatus ?? "Active"}</StatusPill>
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
        {(data) => (
          <div className="camp-list">
            <div className="camp-list-row align-start">
              <div>
                <strong>Recent intake records</strong>
                <p className="camp-cc-muted">{data.intakeHistory.length ? data.intakeHistory.slice(0, 4).map((item) => `${item.studentName} (${item.quantityReceived || "quantity not recorded"})`).join(", ") : "No intake records on file."}</p>
              </div>
              <StatusPill>{data.intakeHistory.length}</StatusPill>
            </div>
            {data.returnChecklist.map((item) => (
              <div className="camp-list-row align-start" key={item.id}>
                <div>
                  <strong>{item.studentName}</strong>
                  <p className="camp-cc-muted">{item.returnNotes || "No return note on file."}</p>
                </div>
                <StatusPill tone={statusTone(item.returnStatus)}>{item.returnStatus}</StatusPill>
              </div>
            ))}
            <EmptyState>Intake and return edit controls are not split into this dedicated page yet.</EmptyState>
          </div>
        )}
      </MedicationDataGate>
    </ToolPageShell>
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
  return (
    <ToolPageShell title="Medication History & Corrections" subtitle="Restricted audit history for intake, schedule, administration, and return records.">
      <MedicationDataGate>
        {(data) => {
          const events = [
            ...data.administrationLog.map((item) => ({ id: `log-${item.id}`, title: `${item.studentName} - ${item.status}`, body: `${item.timeWindow} logged by ${item.loggedBy || "staff"}`, status: item.auditStatus ?? "Active" })),
            ...data.intakeHistory.map((item) => ({ id: `intake-${item.id}`, title: `${item.studentName} - intake`, body: item.receivedAt ? new Date(item.receivedAt).toLocaleString() : "Received time not recorded", status: item.auditStatus ?? "Active" })),
            ...data.returnChecklist.map((item) => ({ id: `return-${item.id}`, title: `${item.studentName} - return`, body: item.returnNotes || "No return note on file.", status: item.auditStatus ?? "Active" }))
          ];
          return events.length ? (
            <div className="camp-list">
              {events.slice(0, 12).map((event) => (
                <div className="camp-list-row align-start" key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <p className="camp-cc-muted">{event.body}</p>
                  </div>
                  <StatusPill tone={event.status === "Active" ? undefined : "warn"}>{event.status}</StatusPill>
                </div>
              ))}
            </div>
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
