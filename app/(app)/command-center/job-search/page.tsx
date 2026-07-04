"use client";

import { useEffect, useState } from "react";
import type { JobApplication, JobApplicationStatus } from "@/lib/command-center/types";
import { formatDate } from "@/lib/utils";

const PIPELINE_COLUMNS: { status: JobApplicationStatus; label: string }[] = [
  { status: "researching", label: "Researching" },
  { status: "applied", label: "Applied" },
  { status: "phone_screen", label: "Phone Screen" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" }
];

export default function CommandCenterJobSearchPage() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/command-center/job-applications");
    const data = (await response.json()) as { applications: JobApplication[] };
    setApplications(data.applications);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: JobApplicationStatus) {
    setApplications((current) => current.map((app) => (app.id === id ? { ...app, status } : app)));
    await fetch(`/api/command-center/job-applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
  }

  async function addApplication() {
    if (!company.trim() || !role.trim()) return;
    const response = await fetch("/api/command-center/job-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: company.trim(), role: role.trim(), status: "researching" })
    });
    const application = (await response.json()) as JobApplication;
    setApplications((current) => [application, ...current]);
    setCompany("");
    setRole("");
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
          <button className="button primary" type="button" onClick={addApplication}>
            + Add Application
          </button>
        </div>
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
                      <select value={app.status} onChange={(event) => updateStatus(app.id, event.target.value as JobApplicationStatus)}>
                        {[...PIPELINE_COLUMNS, { status: "rejected" as const, label: "Rejected" }, { status: "withdrawn" as const, label: "Withdrawn" }].map(
                          (option) => (
                            <option key={option.status} value={option.status}>
                              {option.label}
                            </option>
                          )
                        )}
                      </select>
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
