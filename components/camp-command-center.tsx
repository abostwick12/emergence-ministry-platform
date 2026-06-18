"use client";

import { useEffect, useMemo, useState } from "react";
import {
  campAccessLabels,
  campAccessRoles,
  getCampVisibleStudents,
  getDefaultCampAccessScope,
  isRestrictedCampMedicalRole
} from "@/lib/camp/access";
import { campDocuments, campSchedule, campStartsOn, campTeams, campVehicles } from "@/lib/camp/public-data";
import type {
  CampAccessRole,
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
  CampRestrictedMedicalRecord
} from "@/lib/camp/types";

type RestrictedState = {
  medical: CampRestrictedMedicalRecord[];
  medication: {
    checkIn: CampMedicationRecord[];
    schedule: CampMedicationScheduleItem[];
    returnChecklist: CampMedicationReturnItem[];
  };
};

const lockedCopy = "Restricted to Andrew, Jaci, and Joel. Details are blocked by the server route.";

function daysUntilCamp() {
  const start = new Date(`${campStartsOn}T00:00:00`);
  const today = new Date();
  const diff = start.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function statusClass(status: string) {
  if (status.includes("Clarification") || status.includes("Review")) return "camp-status warn";
  if (status.includes("Checked") || status.includes("Ready") || status.includes("Received")) return "camp-status ready";
  return "camp-status";
}

export function CampCommandCenter() {
  const [accessRole, setAccessRole] = useState<CampAccessRole>("general_leader");
  const [query, setQuery] = useState("");
  const [restrictedState, setRestrictedState] = useState<RestrictedState | null>(null);
  const [restrictedError, setRestrictedError] = useState<string | null>(null);
  const [restrictedLoading, setRestrictedLoading] = useState(false);

  const canSeeRestrictedMedical = isRestrictedCampMedicalRole(accessRole);
  const visibleStudents = useMemo(
    () => getCampVisibleStudents(accessRole, getDefaultCampAccessScope(accessRole)),
    [accessRole]
  );
  const filteredStudents = visibleStudents.filter((student) =>
    student.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRestrictedData() {
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
          fetch(`/api/camp/restricted-medical?role=${accessRole}`),
          fetch(`/api/camp/medication?role=${accessRole}`)
        ]);

        if (!medicalResponse.ok || !medicationResponse.ok) {
          throw new Error("Restricted camp data could not be loaded.");
        }

        const [medical, medication] = await Promise.all([
          medicalResponse.json() as Promise<{ records: CampRestrictedMedicalRecord[] }>,
          medicationResponse.json() as Promise<RestrictedState["medication"]>
        ]);

        if (!cancelled) {
          setRestrictedState({ medical: medical.records, medication });
        }
      } catch (error) {
        if (!cancelled) {
          setRestrictedState(null);
          setRestrictedError(error instanceof Error ? error.message : "Restricted camp data could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setRestrictedLoading(false);
        }
      }
    }

    loadRestrictedData();

    return () => {
      cancelled = true;
    };
  }, [accessRole, canSeeRestrictedMedical]);

  return (
    <div className="camp-command-center">
      <section className="camp-hero" aria-labelledby="camp-home">
        <div>
          <p className="eyebrow">Camp Home</p>
          <h2 id="camp-home" className="camp-title">Camp Command Center</h2>
          <p className="camp-lede">
            Fast operational access for Emerge adult leaders before camp begins on June 29.
          </p>
        </div>
        <div className="camp-countdown" aria-label={`${daysUntilCamp()} days until camp`}>
          <strong>{daysUntilCamp()}</strong>
          <span>days out</span>
        </div>
      </section>

      <section className="panel camp-controls" aria-label="Camp access controls">
        <div>
          <p className="eyebrow">Access View</p>
          <h3 className="section-title">Permission simulation</h3>
          <p className="muted">
            This MVP uses local sample data. Restricted medical and medication records still load only through server routes.
          </p>
        </div>
        <div className="camp-role-tabs" role="group" aria-label="Camp access role">
          {campAccessRoles.map((role) => (
            <button
              className={role === accessRole ? "camp-role-tab active" : "camp-role-tab"}
              key={role}
              type="button"
              onClick={() => setAccessRole(role)}
            >
              {campAccessLabels[role]}
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="student-lookup">
        <div className="camp-section-header">
          <div>
            <p className="eyebrow">Student Quick Lookup</p>
            <h3 id="student-lookup" className="section-title">Students</h3>
          </div>
          <input
            className="input camp-search"
            type="search"
            placeholder="Search student name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="camp-student-grid">
          {filteredStudents.map((student) => (
            <article className="camp-student-card" key={student.id}>
              <span className="camp-avatar" aria-hidden="true">{student.photoInitials}</span>
              <div>
                <strong>{student.name}</strong>
                <p className="muted">
                  {student.teamName ? `${student.teamName} team · ` : ""}
                  {student.vehicleName}
                  {student.cabin ? ` · ${student.cabin}` : ""}
                </p>
                {student.limitedSafetyFlags?.length ? (
                  <div className="camp-flag-row">
                    {student.limitedSafetyFlags.map((flag) => (
                      <span className="camp-status warn" key={flag}>{flag}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="camp-grid">
        <section className="panel" aria-labelledby="camp-teams">
          <p className="eyebrow">Teams</p>
          <h3 id="camp-teams" className="section-title">Team assignments</h3>
          <div className="camp-list">
            {campTeams.map((team) => (
              <div className="camp-list-row" key={team.id}>
                <span className="camp-swatch" aria-hidden="true" />
                <div>
                  <strong>{team.name}</strong>
                  <p className="muted">{team.color} team · {team.leader}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" aria-labelledby="camp-transportation">
          <p className="eyebrow">Car Roster / Transportation</p>
          <h3 id="camp-transportation" className="section-title">Vehicle rosters</h3>
          <div className="camp-list">
            {campVehicles.map((vehicle) => {
              const riders = visibleStudents.filter((student) => student.vehicleId === vehicle.id);
              return (
                <div className="camp-list-row align-start" key={vehicle.id}>
                  <div>
                    <strong>{vehicle.name}</strong>
                    <p className="muted">{vehicle.driver} · {vehicle.departureWindow} · {riders.length}/{vehicle.capacity}</p>
                    <p className="camp-mini-list">{riders.map((rider) => rider.name).join(", ") || "No visible riders for this access view."}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="camp-grid">
        <section className="panel" aria-labelledby="camp-schedule">
          <p className="eyebrow">Schedule</p>
          <h3 id="camp-schedule" className="section-title">Critical timeline</h3>
          <div className="camp-list">
            {campSchedule
              .filter((item) => accessRole !== "driver" || item.audience === "All Camp")
              .map((item) => (
                <div className="camp-list-row align-start" key={item.id}>
                  <time className="camp-time">{item.day}<br />{item.time}</time>
                  <div>
                    <strong>{item.title}</strong>
                    <p className="muted">{item.location} · {item.audience}</p>
                  </div>
                </div>
              ))}
          </div>
        </section>

        <section className="panel" aria-labelledby="camp-documents">
          <p className="eyebrow">Documents</p>
          <h3 id="camp-documents" className="section-title">Leader packets</h3>
          <div className="camp-list">
            {campDocuments
              .filter((doc) => canSeeRestrictedMedical || doc.audience !== "Restricted Medical")
              .filter((doc) => accessRole !== "driver" || doc.audience === "Drivers")
              .map((doc) => (
                <div className="camp-list-row" key={doc.id}>
                  <div>
                    <strong>{doc.title}</strong>
                    <p className="muted">{doc.owner} · {doc.audience}</p>
                  </div>
                  <span className={statusClass(doc.status)}>{doc.status}</span>
                </div>
              ))}
          </div>
        </section>
      </div>

      <section className="panel camp-restricted-panel" aria-labelledby="camp-medical">
        <div className="camp-section-header">
          <div>
            <p className="eyebrow">Restricted Medical Info</p>
            <h3 id="camp-medical" className="section-title">Medical binder lookup</h3>
          </div>
          <span className={canSeeRestrictedMedical ? "camp-status ready" : "camp-status locked"}>
            {canSeeRestrictedMedical ? "Restricted Access" : "Locked"}
          </span>
        </div>
        {!canSeeRestrictedMedical ? (
          <p className="muted">{lockedCopy}</p>
        ) : restrictedLoading ? (
          <p className="muted">Loading restricted records...</p>
        ) : restrictedError ? (
          <p className="camp-error">{restrictedError}</p>
        ) : (
          <div className="camp-medical-grid">
            {restrictedState?.medical.map((record) => (
              <article className="camp-secure-card" key={record.studentId}>
                <strong>{record.studentName}</strong>
                <span className={statusClass(record.medicalFormStatus)}>{record.medicalFormStatus}</span>
                <p>{record.restrictedNotes}</p>
                <p className="muted">{record.allergyNotes}</p>
                <p className="muted">{record.insuranceStatus}</p>
                <p className="muted">{record.parentMedicalNotes}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="camp-grid camp-medication-sections">
        <MedicationSection
          title="Medication Check-In"
          eyebrow="Medication Check-In"
          locked={!canSeeRestrictedMedical}
          loading={restrictedLoading}
          rows={restrictedState?.medication.checkIn.map((record) => ({
            id: record.id,
            title: record.studentName,
            detail: `${record.medicationName} · ${record.parentProvidedInstructions}`,
            status: record.checkInStatus,
            medicinePhotoStatus: record.medicinePhotoStatus
          })) ?? []}
        />
        <MedicationSection
          title="Medication Schedule"
          eyebrow="Medication Schedule"
          locked={!canSeeRestrictedMedical}
          loading={restrictedLoading}
          rows={restrictedState?.medication.schedule.map((item) => ({
            id: item.id,
            title: `${item.studentName} · ${item.timeWindow}`,
            detail: item.parentProvidedInstructions,
            status: item.status
          })) ?? []}
        />
        <MedicationSection
          title="Medication Return Checklist"
          eyebrow="Medication Return Checklist"
          locked={!canSeeRestrictedMedical}
          loading={restrictedLoading}
          rows={restrictedState?.medication.returnChecklist.map((item) => ({
            id: item.id,
            title: item.studentName,
            detail: "Return parent-provided medication to parent or authorized guardian.",
            status: item.returnStatus
          })) ?? []}
        />
      </div>

      <section className="panel camp-search-placeholder" aria-label="Future camp quick search">
        <p className="eyebrow">Future Camp Quick Search</p>
        <h3 className="section-title">Placeholder only</h3>
        <p className="muted">
          Future concept for searching approved camp records. No AI calls, external sending, OCR, sync, or autonomous action is wired in this MVP.
        </p>
      </section>
    </div>
  );
}

function MedicationSection({
  eyebrow,
  title,
  locked,
  loading,
  rows
}: {
  eyebrow: string;
  title: string;
  locked: boolean;
  loading: boolean;
  rows: { id: string; title: string; detail: string; status: string; medicinePhotoStatus?: string }[];
}) {
  return (
    <section className="panel" aria-labelledby={title.toLowerCase().replaceAll(" ", "-")}>
      <p className="eyebrow">{eyebrow}</p>
      <h3 id={title.toLowerCase().replaceAll(" ", "-")} className="section-title">{title}</h3>
      {locked ? (
        <p className="muted">{lockedCopy}</p>
      ) : loading ? (
        <p className="muted">Loading restricted medication records...</p>
      ) : (
        <div className="camp-list">
          {rows.map((row) => (
            <div className="camp-list-row align-start" key={row.id}>
              {row.medicinePhotoStatus ? (
                <div className="camp-medicine-photo" aria-label={`Medicine photo status: ${row.medicinePhotoStatus}`}>
                  <span>{row.medicinePhotoStatus}</span>
                </div>
              ) : null}
              <div>
                <strong>{row.title}</strong>
                <p className="muted">{row.detail}</p>
              </div>
              <span className={statusClass(row.status)}>{row.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
