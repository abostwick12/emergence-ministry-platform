"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useState } from "react";
import { CampOperationDialog } from "@/components/camp/camp-operation-dialog";
import { useCamp } from "@/components/camp/camp-provider";
import { CampDaySelector } from "@/components/camp/camp-day-selector";
import type { CampScheduleBlock, CampScheduleInput } from "@/lib/camp/types";

const emptySchedule: CampScheduleInput = {
  title: "",
  day: "",
  time: "",
  date: "",
  startTime: "",
  endTime: "",
  location: "",
  owner: "",
  audience: "All Camp",
  notes: "",
  status: "Planned",
  visibility: "All Camp"
};

function scheduleToInput(item?: CampScheduleBlock, selectedDay = ""): CampScheduleInput {
  if (!item) return { ...emptySchedule, day: selectedDay };
  return {
    id: item.id,
    title: item.title,
    day: item.day,
    time: item.time,
    date: item.date ?? "",
    startTime: item.startTime ?? "",
    endTime: item.endTime ?? "",
    location: item.location,
    owner: item.owner ?? "",
    audience: item.audience,
    notes: item.notes ?? "",
    status: item.status ?? "Planned",
    visibility: item.visibility ?? "All Camp"
  };
}

function scheduleStatusClass(status?: CampScheduleBlock["status"]) {
  if (status === "Confirmed") return "camp-cc-tag ready";
  if (status === "Needs Review") return "camp-cc-tag warn";
  if (status === "Canceled") return "camp-cc-tag alert";
  return "camp-cc-tag subtle";
}

export default function CampSchedulePage() {
  const { scheduleForSelectedDay, selectedDay, loading, overview, refresh } = useCamp();
  const [editing, setEditing] = useState<CampScheduleInput | null>(null);
  const [viewing, setViewing] = useState<CampScheduleBlock | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const items = useMemo(() => scheduleForSelectedDay, [scheduleForSelectedDay]);

  async function saveSchedule() {
    if (!editing) return;
    setMessage(null);
    setSaving(true);
    const response = await fetch("/api/camp/schedule", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing)
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Schedule item could not be saved." });
      return;
    }
    await refresh();
    setEditing(null);
    setMessage({ tone: "success", text: "Schedule saved. Home and Next Up now use the updated schedule." });
  }

  async function archiveSchedule() {
    if (!editing?.id || !window.confirm("Archive this schedule item?")) return;
    setMessage(null);
    setSaving(true);
    const response = await fetch("/api/camp/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, action: "archive" })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Schedule item could not be archived." });
      return;
    }
    await refresh();
    setEditing(null);
    setMessage({ tone: "success", text: "Schedule item archived." });
  }

  return (
    <div className="camp-cc-page">
      <Link href="/camp/more" className="camp-cc-back">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>More</span>
      </Link>
      <header className="camp-cc-page-head">
        <h1>Schedule</h1>
        <p className="camp-cc-muted">{selectedDay || "Select a day"}</p>
      </header>
      <div className="camp-row-actions">
        <button className="button primary" type="button" onClick={() => setEditing(scheduleToInput(undefined, selectedDay))}>
          Add Schedule Item
        </button>
      </div>
      {message ? <p className={message.tone === "error" ? "camp-save-message error" : "camp-save-message success"} role="status">{message.text}</p> : null}

      <CampDaySelector />

      {loading && !overview.schedule.length ? (
        <p className="camp-cc-muted">Loading schedule…</p>
      ) : items.length === 0 ? (
        <p className="camp-cc-muted">No events scheduled for this day.</p>
      ) : (
        <ol className="camp-schedule-list">
          {items.map((item) => (
            <li key={item.id} className="camp-schedule-item" data-testid={`camp-schedule-card-${item.id}`}>
              <span className="camp-schedule-time">{item.time}</span>
              <div className="camp-schedule-body">
                <button className="camp-inline-button" type="button" onClick={() => setViewing(item)} aria-label={`Open ${item.title} schedule details`}>
                  <strong>{item.title}</strong>
                </button>
                <div className="camp-schedule-meta-row">
                  {item.location ? (
                    <span className="camp-schedule-meta-chip location">
                      <span>Location</span>
                      <strong>{item.location}</strong>
                    </span>
                  ) : null}
                  <span className="camp-cc-tag subtle">{item.audience}</span>
                  {item.status ? <span className={scheduleStatusClass(item.status)}>{item.status}</span> : null}
                </div>
                {item.notes ? (
                  <p className="camp-schedule-note">
                    <span>Notes</span>
                    {item.notes}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {viewing ? (
        <CampOperationDialog
          title={viewing.title}
          description="Full schedule details for this Camp event."
          onClose={() => setViewing(null)}
          footer={
            <>
              <button className="button" type="button" onClick={() => setViewing(null)}>Close</button>
              <button className="button primary" type="button" onClick={() => { setEditing(scheduleToInput(viewing, selectedDay)); setViewing(null); }}>Edit</button>
            </>
          }
        >
          <dl className="camp-team-detail-meta camp-schedule-detail-meta">
            <div>
              <dt>Event</dt>
              <dd>{viewing.title}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{viewing.time}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{viewing.location || "No location set"}</dd>
            </div>
            <div>
              <dt>Audience</dt>
              <dd>{viewing.audience}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{viewing.status ?? "Planned"}</dd>
            </div>
          </dl>
          <section className="camp-editor-card camp-schedule-notes-panel" aria-label="Schedule notes">
            <p className="camp-cc-eyebrow">Notes</p>
            <p>{viewing.notes?.trim() || "No notes set."}</p>
          </section>
        </CampOperationDialog>
      ) : null}
      {editing ? (
        <CampOperationDialog
          title={editing.id ? "Edit Schedule Item" : "Add Schedule Item"}
          description="Changes save to the shared Camp schedule and refresh Home."
          onClose={() => setEditing(null)}
          footer={
            <>
              {editing.id ? <button className="button compact-button danger" type="button" disabled={saving} onClick={() => void archiveSchedule()}>Archive</button> : null}
              <button className="button" type="button" disabled={saving} onClick={() => setEditing(null)}>Cancel</button>
              <button className="button primary" type="button" disabled={saving} onClick={() => void saveSchedule()}>{saving ? "Saving..." : "Save"}</button>
            </>
          }
        >
          <section className="camp-editor-card camp-modal-section" aria-label="Event">
            <p className="camp-cc-eyebrow">Event</p>
            <div className="camp-field-grid">
              <label className="field"><span>Title</span><input className="input" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
              <label className="field"><span>Owner</span><input className="input" value={editing.owner ?? ""} onChange={(event) => setEditing({ ...editing, owner: event.target.value })} /></label>
            </div>
          </section>
          <section className="camp-editor-card camp-modal-section" aria-label="Time">
            <p className="camp-cc-eyebrow">Time</p>
            <div className="camp-field-grid">
              <label className="field"><span>Day label</span><input className="input" value={editing.day} onChange={(event) => setEditing({ ...editing, day: event.target.value })} /></label>
              <label className="field"><span>Date</span><input className="input" type="date" value={editing.date ?? ""} onChange={(event) => setEditing({ ...editing, date: event.target.value })} /></label>
              <label className="field"><span>Display time</span><input className="input" value={editing.time} onChange={(event) => setEditing({ ...editing, time: event.target.value })} /></label>
              <label className="field"><span>Start time</span><input className="input" type="time" value={editing.startTime ?? ""} onChange={(event) => setEditing({ ...editing, startTime: event.target.value })} /></label>
              <label className="field"><span>End time</span><input className="input" type="time" value={editing.endTime ?? ""} onChange={(event) => setEditing({ ...editing, endTime: event.target.value })} /></label>
            </div>
          </section>
          <section className="camp-editor-card camp-modal-section" aria-label="Location and audience">
            <p className="camp-cc-eyebrow">Location / Audience / Status</p>
            <div className="camp-field-grid">
              <label className="field"><span>Location</span><input className="input" value={editing.location ?? ""} onChange={(event) => setEditing({ ...editing, location: event.target.value })} /></label>
              <label className="field"><span>Audience</span><select className="input" value={editing.audience} onChange={(event) => setEditing({ ...editing, audience: event.target.value as CampScheduleInput["audience"] })}><option value="All Camp">All Camp</option><option value="Leaders">Leaders</option><option value="Medical Team">Medical Team</option></select></label>
              <label className="field"><span>Status</span><select className="input" value={editing.status ?? "Planned"} onChange={(event) => setEditing({ ...editing, status: event.target.value as CampScheduleInput["status"] })}><option value="Planned">Planned</option><option value="Confirmed">Confirmed</option><option value="Needs Review">Needs Review</option><option value="Canceled">Canceled</option></select></label>
            </div>
          </section>
          <section className="camp-editor-card camp-modal-section" aria-label="Notes">
            <label className="field"><span>Notes</span><textarea className="input" rows={3} value={editing.notes ?? ""} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} /></label>
          </section>
        </CampOperationDialog>
      ) : null}
    </div>
  );
}
