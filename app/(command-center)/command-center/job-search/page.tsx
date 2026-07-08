"use client";

import { useEffect, useState } from "react";
import type { JobApplication, JobApplicationStatus } from "@/lib/command-center/types";
import { formatDate } from "@/lib/utils";

const PIPELINE_COLUMNS: { status: JobApplicationStatus; label: string }[] = [
  { status: "researching", label: "Researching" },
  { status: "applied", label: "Applied" },
  { status: "phone_screen", label: "Phone Screen" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
  { status: "withdrawn", label: "Withdrawn" }
];

export default function CommandCenterJobSearchPage() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/job-applications");
      if (!response.ok) throw new Error("Failed to load applications");
      const data = (await response.json()) as { applications: JobApplication[] };
      setApplications(data.applications);
    } catch {
      setError("Job applications could not be loaded. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: JobApplicationStatus) {
    const previous = applications;
    setApplications((current) => current.map((app) => (app.id === id ? { ...app, status } : app)));
    setError(null);
    const response = await fetch(`/api/command-center/job-applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      setApplications(previous);
      setError("Application status could not be saved.");
    }
  }

  async function updateFollowUp(id: string, nextDate: string) {
    const previous = applications;
    setApplications((current) => current.map((app) => (app.id === id ? { ...app, nextFollowUpDate: nextDate || undefined } : app)));
    setError(null);
    const response = await fetch(`/api/command-center/job-applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nextFollowUpDate: nextDate || null })
    });
    if (!response.ok) {
      setApplications(previous);
      setError("Follow-up date could not be saved.");
    }
  }

  async function addApplication() {
    if (!company.trim() || !role.trim()) return;
    setError(null);
    const response = await fetch("/api/command-center/job-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: company.trim(), role: role.trim(), status: "researching", nextFollowUpDate: nextFollowUpDate || undefined })
    });
    if (!response.ok) {
      setError("Application could not be created.");
      return;
    }
    const application = (await response.json()) as JobApplication;
    setApplications((current) => [application, ...current]);
    setCompany("");
    setRole("");
    setNextFollowUpDate("");
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid workspace-page">
      <section className="panel">
        <p className="eyebrow">Job Search</p>
        <h2 className="section-title flush">Application Pipeline</h2>
        <div className="toolbar">
          <input type="text" placeholder="Company" value={company} onChange={(event) => setCompany(event.target.value)} />
          <input type="text" placeholder="Role" value={role} onChange={(event) => setRole(event.target.value)} />
          <input
            type="date"
            aria-label="Next follow-up date"
            value={nextFollowUpDate}
            onChange={(event) => setNextFollowUpDate(event.target.value)}
          />
          <button className="button primary" type="button" onClick={addApplication}>
            + Add Application
          </button>
        </div>
        {error ? (
          <p className="muted" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {loading ? (
        <p className="muted">Loading pipeline...</p>
      ) : (
        <div className="kanban task-board">
          {PIPELINE_COLUMNS.map((column) => {
            const columnApps = applications.filter((app) => app.status === column.status);
            return (
              <div className="kanban-column task-lane" key={column.status}>
                <div className="toolbar split">
                  <strong>{column.label}</strong>
                  <span className="pill">{columnApps.length}</span>
                </div>
                {columnApps.length === 0 ? <p className="kanban-empty">No applications in this stage.</p> : null}
                {columnApps.map((app) => {
                  const overdue = Boolean(app.nextFollowUpDate && app.nextFollowUpDate <= today);
                  return (
                    <article className="task-card command-center-task-card command-center-domain-job_search" key={app.id}>
                      <strong className="task-card-title">{app.company}</strong>
                      <div className="task-card-event">{app.role}</div>
                      <div className="toolbar split">
                        {app.nextFollowUpDate ? (
                          <span className="task-card-date">Follow up {formatDate(app.nextFollowUpDate)}</span>
                        ) : (
                          <span />
                        )}
                        {overdue ? <span className="pill red">Due</span> : null}
                      </div>
                      <div className="toolbar">
                        <select value={app.status} onChange={(event) => updateStatus(app.id, event.target.value as JobApplicationStatus)}>
                          {PIPELINE_COLUMNS.map((option) => (
                            <option key={option.status} value={option.status}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          aria-label={`Next follow-up for ${app.company}`}
                          value={app.nextFollowUpDate ?? ""}
                          onChange={(event) => updateFollowUp(app.id, event.target.value)}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
