"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CampOperationDialog } from "@/components/camp/camp-operation-dialog";
import { useCamp } from "@/components/camp/camp-provider";
import { CampStudentAvatar } from "@/components/camp/camp-student-card";
import type { CampVehicle, CampVehicleInput, CampVisibleStudent } from "@/lib/camp/types";

function vehicleToInput(vehicle?: CampVehicle): CampVehicleInput {
  return {
    id: vehicle?.id,
    name: vehicle?.name ?? "",
    driver: vehicle?.driver ?? "",
    departureWindow: vehicle?.departureWindow ?? "",
    departureLocation: vehicle?.departureLocation ?? "",
    capacity: vehicle?.capacity ?? 0,
    notes: vehicle?.notes ?? ""
  };
}

export default function CampVehiclesPage() {
  const { overview, loading, refresh } = useCamp();
  const [editing, setEditing] = useState<CampVehicleInput | null>(null);
  const [movingStudent, setMovingStudent] = useState<CampVisibleStudent | null>(null);
  const [targetVehicleId, setTargetVehicleId] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const ridersByVehicle = useMemo(() => {
    const map = new Map<string, CampVisibleStudent[]>();
    for (const student of overview.students) {
      if (!student.vehicleId) continue;
      const list = map.get(student.vehicleId) ?? [];
      list.push(student);
      map.set(student.vehicleId, list);
    }
    return map;
  }, [overview.students]);

  const unassigned = overview.students.filter((student) => !student.vehicleId);

  async function saveVehicle() {
    if (!editing) return;
    setMessage(null);
    setSaving(true);
    const response = await fetch("/api/camp/vehicles", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing)
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Vehicle could not be saved." });
      return;
    }
    await refresh();
    setEditing(null);
    setMessage({ tone: "success", text: "Vehicle saved and rider counts refreshed." });
  }

  async function archiveVehicle() {
    if (!editing?.id || !window.confirm("Archive this vehicle and clear its rider assignments?")) return;
    setMessage(null);
    setSaving(true);
    const response = await fetch("/api/camp/vehicles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, action: "archive" })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Vehicle could not be archived." });
      return;
    }
    await refresh();
    setEditing(null);
    setMessage({ tone: "success", text: "Vehicle archived and riders moved to unassigned." });
  }

  async function saveRiderMove(vehicleId: string) {
    if (!movingStudent) return;
    setMessage(null);
    setSaving(true);
    const response = await fetch("/api/camp/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: movingStudent.id, assignmentOnly: true, vehicleId })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Rider assignment could not be saved." });
      return;
    }
    await refresh();
    setMovingStudent(null);
    setMessage({ tone: "success", text: "Rider assignment updated." });
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
        <h1>Transportation</h1>
        <p className="camp-cc-muted">{overview.vehicles.length} vehicles, {unassigned.length} unassigned campers</p>
      </header>
      <div className="camp-row-actions">
        <button className="button primary" type="button" onClick={() => setEditing(vehicleToInput())}>Add Vehicle</button>
      </div>
      {message ? <p className={message.tone === "error" ? "camp-save-message error" : "camp-save-message success"} role="status">{message.text}</p> : null}
      {loading && !overview.vehicles.length ? (
        <p className="camp-cc-muted">Loading vehicles...</p>
      ) : (
        <div className="camp-vehicle-list">
          {overview.vehicles.map((vehicle) => {
            const riders = ridersByVehicle.get(vehicle.id) ?? [];
            const remaining = vehicle.capacity - riders.length;
            return (
              <section key={vehicle.id} className="camp-vehicle-card" aria-label={vehicle.name} data-testid={`camp-vehicle-card-${vehicle.id}`}>
                <div className="camp-vehicle-head">
                  <strong>{vehicle.name}</strong>
                  <span className={remaining < 0 ? "camp-status warn" : "camp-cc-muted"}>{riders.length}/{vehicle.capacity || 0} seats</span>
                </div>
                <p className="camp-cc-muted">Driver: {vehicle.driver || "Unassigned"}</p>
                {vehicle.departureWindow ? <p className="camp-cc-muted">Departs: {vehicle.departureWindow}</p> : null}
                {vehicle.departureLocation ? <p className="camp-cc-muted">From: {vehicle.departureLocation}</p> : null}
                {remaining < 0 ? <p className="camp-cc-error">Capacity conflict: {Math.abs(remaining)} over capacity.</p> : <p className="camp-cc-muted">{Math.max(remaining, 0)} seats remaining.</p>}
                <div className="camp-row-actions">
                  <button className="button compact-button" type="button" onClick={() => setEditing(vehicleToInput(vehicle))}>Edit Vehicle</button>
                </div>
                {riders.length ? (
                  <ul className="camp-vehicle-riders">
                    {riders.map((rider) => (
                      <li key={rider.id}>
                        <CampStudentAvatar student={rider} size="sm" />
                        <button className="camp-inline-button" type="button" onClick={() => { setMovingStudent(rider); setTargetVehicleId(rider.vehicleId); }}>{rider.name}</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="camp-cc-muted">No riders visible for this access view.</p>
                )}
              </section>
            );
          })}
        </div>
      )}
      {editing ? (
        <CampOperationDialog
          title={editing.id ? "Edit Vehicle" : "Add Vehicle"}
          description="Transportation changes refresh riders, roster, and checkout."
          onClose={() => setEditing(null)}
          footer={
            <>
              {editing.id ? <button className="button compact-button" type="button" disabled={saving} onClick={() => void archiveVehicle()}>Archive</button> : null}
              <button className="button" type="button" disabled={saving} onClick={() => setEditing(null)}>Cancel</button>
              <button className="button primary" type="button" disabled={saving} onClick={() => void saveVehicle()}>{saving ? "Saving..." : "Save"}</button>
            </>
          }
        >
          <div className="camp-field-grid">
            <label className="field"><span>Name</span><input className="input" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
            <label className="field"><span>Driver</span><input className="input" value={editing.driver ?? ""} onChange={(event) => setEditing({ ...editing, driver: event.target.value })} /></label>
            <label className="field"><span>Departure time</span><input className="input" value={editing.departureWindow ?? ""} onChange={(event) => setEditing({ ...editing, departureWindow: event.target.value })} /></label>
            <label className="field"><span>Departure location</span><input className="input" value={editing.departureLocation ?? ""} onChange={(event) => setEditing({ ...editing, departureLocation: event.target.value })} /></label>
            <label className="field"><span>Capacity</span><input className="input" type="number" min={0} value={editing.capacity} onChange={(event) => setEditing({ ...editing, capacity: Number(event.target.value) })} /></label>
          </div>
          <label className="field"><span>Notes</span><textarea className="input" rows={3} value={editing.notes ?? ""} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} /></label>
        </CampOperationDialog>
      ) : null}
      {movingStudent ? (
        <CampOperationDialog
          title={`Move ${movingStudent.name}`}
          description="Assign, remove, or move this rider."
          onClose={() => setMovingStudent(null)}
          footer={
            <>
              <button className="button" type="button" disabled={saving} onClick={() => setMovingStudent(null)}>Cancel</button>
              <button className="button compact-button" type="button" disabled={saving} onClick={() => void saveRiderMove("")}>Remove Rider</button>
              <button className="button primary" type="button" disabled={saving} onClick={() => void saveRiderMove(targetVehicleId)}>{saving ? "Saving..." : "Save Move"}</button>
            </>
          }
        >
          <label className="field">
            <span>Vehicle</span>
            <select className="input" value={targetVehicleId} onChange={(event) => setTargetVehicleId(event.target.value)}>
              <option value="">Unassigned</option>
              {overview.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}
            </select>
          </label>
        </CampOperationDialog>
      ) : null}
    </div>
  );
}
